import https from 'https';
import { Telegraf, Markup } from 'telegraf';
import config from './config.js';
import { logger, setBotInstance, bootstrapLogger } from './logger.js';
import { lastAyaTime, setFavReciter, getFavReciter, getDB } from './database.js';
import {
    prepareAya,
    getRecitation,
    isValidReciter,
    getRandomReciterIdentifier,
    nextAya,
    ayaId2suraAya,
    suraAya2ayaId,
    normalizedSurasArNames,
    rasmifize,
    getQuranData,
    checkSource,
} from './quranService.js';
import { randomAyaNumber, numArabicToEnglish } from './utils.js';

/**
 * @module telegramBot
 * @description This module orchestrates all Telegram bot functionalities.
 * It initializes the Telegraf bot, sets up command and action handlers,
 * and integrates with other services like quranService and databaseService
 * to provide the bot's features such as sending Ayas, handling user requests,
 * and managing user preferences.
 * @property {import('telegraf').Telegraf} bot - The Telegraf bot instance.
 * @property {function} launchBot - Function to launch the Telegram bot.
 * @property {function} sendAya - Function to send an Aya (text and optionally recitation).
 * @property {function} adminChecker - Function to check if a user is an admin in a chat.
 * @property {string} NON_ADMINS_ALERT - Standard alert message for non-admin users.
 * @property {function} surpriseAya - Function to handle the "surprise me" action.
 * @property {function} handleText - Function to handle incoming text messages for Aya requests.
 */

// --- Constants ---
/**
 * Standard alert message for non-admin users trying to access admin-only features.
 * @type {string}
 */
export const NON_ADMINS_ALERT = `عذرا، هذه الخاصية في المجموعات والقنوات متاحة للمشرفين فقط.\n\nSorry, this feature in groups and channels is only available for admins.`;

// --- Bot Initialization ---
/**
 * The main Telegraf bot instance.
 * @type {import('telegraf').Telegraf}
 */
const agent = new https.Agent({ timeout: 30000 }); // 30 seconds timeout
bootstrapLogger('Telegraf HTTPS agent configured with 30-second timeout.');

const bot = new Telegraf(config.telegramToken, {
    telegram: { agent },
});
setBotInstance(bot); // Enable Telegram logging via logger.js

// Promise for ensuring bot username is available
let botUsernamePromiseResolve;
export const botUsernameReady = new Promise(resolve => {
    botUsernamePromiseResolve = resolve;
});

// Store bot username after getMe()
bot.telegram
    .getMe()
    .then((botInfo) => {
        bot.options.username = botInfo.username;
        bootstrapLogger(`Bot username set to: ${bot.options.username}`);
        if (botUsernamePromiseResolve) {
            botUsernamePromiseResolve(botInfo.username); // Resolve with username
        }
    })
    .catch((err) => {
        console.error('CRITICAL: bot.telegram.getMe() failed. Raw error object:', JSON.stringify(err, Object.getOwnPropertyNames(Object.getPrototypeOf(err) ? Object.getOwnPropertyNames(Object.getPrototypeOf(err)) : Object.keys(err)), 2));
        bootstrapLogger('Failed to get bot info (processed by bootstrapLogger):', err); // Message updated for clarity
        if (botUsernamePromiseResolve) {
            botUsernamePromiseResolve(null); // Resolve with null if getMe() failed
        }
    });

/**
 * Helper to get Quran data once.
 * @private
 * @type {{arQuran: Array<object>, enQuran: Array<object>, arReciters: Array<object>}}
 */
const quranData = getQuranData();

// --- Migrated Helper Functions (Adapted) ---

/**
 * Checks if the user who sent the context (ctx) is an admin in the chat.
 * For private chats, all users are considered "admins" in this context.
 * For group/supergroup chats, it checks if the user's status is 'creator' or 'administrator'.
 * @async
 * @function adminChecker
 * @param {import('telegraf').Context} ctx - The Telegraf context object.
 * @returns {Promise<boolean>} True if the user is an admin or in a private chat, false otherwise.
 */
export async function adminChecker(ctx) {
    if (!ctx || !ctx.chat || !ctx.from) {
        logger('adminChecker: Invalid context received.', ctx);
        return false;
    }
    if (ctx.chat.type === 'private') {
        return true;
    }
    try {
        const member = await bot.telegram.getChatMember(ctx.chat.id, ctx.from.id);
        return ['creator', 'administrator'].includes(member.status);
    } catch (e) {
        logger('Error in adminChecker while calling getChatMember: ', e);
        return false;
    }
}

/**
 * Logs a successful Aya send operation and updates the database with the last Aya time.
 * @async
 * @private
 * @function successSend
 * @param {import('telegraf').Context} ctx - The Telegraf context object from the sent message.
 * @param {number} ayaId - The global ID of the Aya that was sent.
 * @param {string|undefined} lang - The language code of the user/chat.
 * @param {string} trigger - The trigger for sending the Aya (e.g., "request", "timer").
 */
async function successSend(ctx, ayaId, lang, trigger) {
    try {
        const chatType = ctx.chat.type;
        const chatName = chatType === 'private' ? ctx.chat.first_name || ctx.from?.first_name : ctx.chat.title;
        await lastAyaTime(ctx.chat.id, 'success', chatName, chatType, lang, trigger);
        logger(`Successfully sent Aya ${ayaId} to chat ${ctx.chat.id} (${chatName}). Trigger: ${trigger}`);
    } catch (e) {
        logger(`Error in successSend for chat ${ctx.chat.id}:`, e);
    }
}

/**
 * Sends a standardized "sorry" message to a chat when an operation fails.
 * @async
 * @private
 * @function sendSorry
 * @param {number|string} chatId - The ID of the chat to send the message to.
 * @param {'audio'|'text'|'unknown'} reason - The reason for the apology, determines the message content.
 */
async function sendSorry(chatId, reason) {
    let msg;
    switch (reason) {
        case 'audio':
            msg = `عذرا.. نواجه مشكلة في الملفات الصوتية ونأمل إصلاحها قريبا.\n\nSorry.. There's an issue in audio files and we hope it gets fixed soon.`;
            break;
        case 'text':
            msg = `عذرا.. نواجه مشكلة في نصوص الآيات ونأمل إصلاحها قريبا.\n\nSorry.. There's an issue in Aya texts and we hope it gets fixed soon.`;
            break;
        default: // 'unknown' or any other reason
            msg = `عذرا.. حدثت مشكلة غير معروفة.\n\nSorry.. An unknown issue happened.`;
            break;
    }
    try {
        await bot.telegram.sendMessage(chatId, msg, { disable_notification: true });
        logger(`Sorry message sent to ${chatId} due to ${reason}.`);
    } catch (e) {
        logger(`Failed to send sorry message to ${chatId}:`, e);
    }
}

/**
 * Generates the inline keyboard markup for the Aya menu.
 * @private
 * @function aMenuButtons
 * @param {string} menuState - The current state of the menu (e.g., "t0", "r1"). "t" for text, "r" for recitation. "0" for compact, "1" for expanded.
 * @param {number} ayaId - The global Aya ID.
 * @param {string} reciter - The identifier of the reciter.
 * @returns {import('telegraf').Markup.Markup<import('telegraf/typings/core/types/typegram').InlineKeyboardMarkup>} The Telegraf inline keyboard markup.
 */
function aMenuButtons(menuState, ayaId, reciter) {
    if (!bot.options.username) {
        logger(
            'aMenuButtons: bot.options.username is not set. Using default.',
            new Error('bot.options.username missing')
        );
    }
    const currentBotUsername = bot.options.username || 'DailyAyaBot';

    const buttons = {
        inline_keyboard: [
            [
                {
                    text: menuState.includes('0') ? '···' : '•••', // Toggle button text
                    callback_data: JSON.stringify({ aMenu: menuState, a: ayaId, r: reciter }),
                },
            ],
        ],
    };

    if (menuState.includes('1')) {
        // Expanded menu
        const ayaIndex = ayaId2suraAya(ayaId);
        buttons.inline_keyboard[0].push({
            text: '⚠️', // Report issue
            url: `https://sherbeeny.t.me?text=${encodeURIComponent(`السلام عليكم يا مطور دايلي آية\nرجاء مراجعة الآية ${ayaIndex.sura}:${ayaIndex.aya}\n\nPeace upon you, Daily Aya developer\nPlease revise Aya ${ayaIndex.sura}:${ayaIndex.aya}`)}`,
        });
        if (menuState === 'r1') {
            // Only show set reciter for recitation menu
            buttons.inline_keyboard[0].push({
                text: '🗣️', // Set reciter
                callback_data: JSON.stringify({ setReciter: reciter, a: ayaId }),
            });
        }
        buttons.inline_keyboard[0].push({
            text: '📖', // Read Tafsir
            url: `https://quran.com/${ayaIndex.sura}:${ayaIndex.aya}/tafsirs/ar-tafsir-muyassar`,
        });
    }

    if (menuState.includes('t')) {
        // Only show recitation button for text menu
        buttons.inline_keyboard[0].push({
            text: '🔊', // Request recitation
            callback_data: JSON.stringify({ recite: ayaId, r: reciter }),
        });
    }

    buttons.inline_keyboard[0].push({
        text: '▼', // Next Aya
        callback_data: JSON.stringify({ currAya: ayaId, r: reciter }),
    });
    return buttons;
}

/**
 * Sends the text part of an Aya (Arabic and English translation) to a chat.
 * Includes inline buttons for interaction.
 * @async
 * @private
 * @function sendAyaText
 * @param {number|string} chatId - The ID of the chat to send the Aya to.
 * @param {number} ayaId - The global ID of the Aya.
 * @param {string|null} reciter - The identifier of the reciter (or null for default/random).
 * @param {string|undefined} lang - The language code of the user/chat.
 * @param {string} trigger - The trigger for sending the Aya.
 * @returns {Promise<import('telegraf/typings/core/types/typegram').Message.TextMessage | null>}
 *          A promise that resolves to the sent message context, or null if sending failed (e.g. Aya text not prepared).
 * @throws {Error} If sending the message via Telegram API fails for reasons other than supergroup migration.
 */
async function sendAyaText(chatId, ayaId, reciter, lang, trigger) {
    logger(`Formatting Aya ${ayaId} for chat ${chatId}`);
    const currentReciter = reciter || 'None';

    if (!bot.options.username) {
        logger(
            'sendAyaText: bot.options.username not available for prepareAya.',
            new Error('bot.options.username missing')
        );
    }
    const preparedAya = prepareAya(ayaId, bot.options.username || 'DailyAyaBot');

    if (preparedAya.arText.startsWith('Error:')) {
        logger(`sendAyaText: Error preparing Aya ${ayaId}: ${preparedAya.arText}`);
        await sendSorry(chatId, 'text');
        return null;
    }

    const ayaDualText = `${preparedAya.arText}\n\n${preparedAya.enText}`;
    const buttons = aMenuButtons('t0', ayaId, currentReciter);

    try {
        const sentMessageCtx = await bot.telegram.sendMessage(chatId, ayaDualText, {
            disable_web_page_preview: true,
            disable_notification: true,
            parse_mode: 'HTML',
            reply_markup: buttons,
        });
        await successSend(sentMessageCtx, ayaId, lang, trigger);
        return sentMessageCtx;
    } catch (e) {
        logger(`Error in sendAyaText sending message to chat ${chatId} for Aya ${ayaId}:`, e);
        if (e.response && e.response.description && e.response.description.includes('upgraded to a supergroup')) {
            logger(`Chat ${chatId} upgraded to supergroup ${e.response.parameters.migrate_to_chat_id}. Retrying.`);
            await lastAyaTime(chatId, 'blocked');
            return sendAyaText(e.response.parameters.migrate_to_chat_id, ayaId, reciter, lang, trigger);
        }
        throw e;
    }
}

/**
 * Sends the audio recitation of an Aya to a chat.
 * It determines the appropriate reciter based on user preference or a random selection.
 * Handles editing of message reply markup to attach buttons to the audio message.
 * @async
 * @private
 * @function sendAyaRecitation
 * @param {import('telegraf').Context} ctx - The Telegraf context object, used to determine chat ID and original message ID.
 * @param {number} ayaId - The global ID of the Aya.
 * @param {string|null} reciterIdentifier - The preferred reciter identifier, or null.
 */
async function sendAyaRecitation(ctx, ayaId, reciterIdentifier) {
    const chatId = ctx.chat?.id || ctx.update?.callback_query?.message?.chat?.id;
    if (!chatId) {
        logger('sendAyaRecitation: Could not determine chatId from context.', ctx);
        return;
    }

    let finalReciter = reciterIdentifier;
    if (!isValidReciter(reciterIdentifier)) {
        const favReciterResult = await getFavReciter(chatId);
        if (favReciterResult.success && isValidReciter(favReciterResult.data)) {
            finalReciter = favReciterResult.data;
        } else {
            finalReciter = getRandomReciterIdentifier();
            if (!finalReciter) {
                logger(
                    `sendAyaRecitation: Could not determine a valid reciter for chat ${chatId}.`,
                    new Error('No reciter available')
                );
                await sendSorry(chatId, 'audio');
                return;
            }
        }
    }
    logger(`sendAyaRecitation: Chat ${chatId} using reciter: ${finalReciter} for Aya ${ayaId}`);

    try {
        const recitationUrl = await getRecitation(ayaId, finalReciter);
        const suraAyaIndex = ayaId2suraAya(ayaId);
        const recitationCaption = `<a href="t.me/${bot.options.username || 'DailyAyaBot'}?start=${suraAyaIndex.sura}-${suraAyaIndex.aya}">@${bot.options.username || 'DailyAyaBot'} ➔ ${suraAyaIndex.sura}:${suraAyaIndex.aya}</a>`;
        const buttons = aMenuButtons('r0', ayaId, finalReciter);

        const sentAudioCtx = await bot.telegram.sendAudio(chatId, recitationUrl, {
            caption: recitationCaption,
            parse_mode: 'HTML',
            disable_notification: true,
        });

        const originalMessageId = ctx.message?.message_id || ctx.update?.callback_query?.message?.message_id;

        if (originalMessageId) {
            if (sentAudioCtx.message_id === originalMessageId + 1) {
                // Audio sent immediately after text
                await bot.telegram
                    .editMessageReplyMarkup(chatId, originalMessageId, undefined, undefined)
                    .catch((e) => logger('Warning: Message not modified or ID invalid when removing markup from text msg (recitation) (non-critical):', e));
                await bot.telegram
                    .editMessageReplyMarkup(chatId, sentAudioCtx.message_id, undefined, buttons)
                    .catch((e) => logger('Warning: Message not modified or ID invalid when adding markup to audio msg (recitation) (non-critical):', e));
            } else {
                // Audio sent later or as a result of callback; reply to original text
                await bot.telegram
                    .deleteMessage(chatId, sentAudioCtx.message_id)
                    .catch((e) => logger('Warning: Message ID invalid when deleting initial audio msg (recitation reply) (non-critical):', e));
                /*const repliedAudioCtx =*/ await bot.telegram.sendAudio(chatId, recitationUrl, {
                    // We don't use repliedAudioCtx currently
                    reply_to_message_id: originalMessageId,
                    caption: recitationCaption,
                    parse_mode: 'HTML',
                    disable_notification: true,
                    reply_markup: buttons,
                });
                await bot.telegram
                    .editMessageReplyMarkup(chatId, originalMessageId, undefined, undefined)
                    .catch((e) => logger('Warning: Message not modified or ID invalid when removing markup from text msg (recitation reply) (non-critical):', e));
            }
        } else {
            // No original message context (e.g., direct /recite command - though not implemented)
            await bot.telegram
                .editMessageReplyMarkup(chatId, sentAudioCtx.message_id, undefined, buttons)
                .catch((e) => logger('Warning: Message not modified or ID invalid when adding markup to direct audio msg (recitation) (non-critical):', e));
        }
    } catch (error) {
        logger(`Error in sendAyaRecitation for aya ${ayaId} by ${finalReciter} to chat ${chatId}:`, error);
        if (error.response && error.response.description) {
            const errorDesc = error.response.description.toLowerCase();
            if (
                errorDesc.includes('blocked by the user') ||
                errorDesc.includes('user is deactivated') ||
                errorDesc.includes('chat not found')
            ) {
                await lastAyaTime(chatId, 'blocked');
            } else {
                await sendSorry(chatId, 'audio');
            }
        } else {
            await sendSorry(chatId, 'audio');
        }
    }
}

/**
 * Main function to send an Aya (text and optionally recitation) to a chat.
 * It handles random Aya selection if no specific `ayaId` is provided.
 * This function is exported for use by `app.js` timer.
 * @async
 * @function sendAya
 * @param {number|string} chatId - The ID of the chat.
 * @param {number|null} ayaId - The global ID of the Aya to send, or null for a random Aya.
 * @param {string|null} reciter - The preferred reciter identifier, or null.
 * @param {string|undefined} lang - The language code of the user/chat.
 * @param {string} trigger - The trigger for sending the Aya (e.g., "request", "timer", "surprise").
 * @param {boolean} [withRecitation=false] - Whether to include audio recitation.
 */
async function sendAya(chatId, ayaId, reciter, lang, trigger, withRecitation = false) {
    logger(
        `Initiating sending an Aya to chat ${chatId}. AyaID: ${ayaId || 'random'}, Reciter: ${reciter || 'default/random'}, Trigger: ${trigger}, Recitation: ${withRecitation}`
    );

    const targetAyaId = ayaId || randomAyaNumber();

    try {
        const sentTextCtx = await sendAyaText(chatId, targetAyaId, reciter, lang, trigger);
        if (sentTextCtx && withRecitation) {
            await sendAyaRecitation(sentTextCtx, targetAyaId, reciter);
        }
    } catch (e) {
        logger(`sendAya: Error caught while sending Aya ${targetAyaId} to chat ${chatId}. Trigger: ${trigger}`, e);
        const errorDesc = e.response?.description?.toLowerCase() || '';
        const blockKeywords =
            /blocked by the user|user is deactivated|need administrator rights|not enough rights|chat not found|TOPIC_CLOSED|bot was kicked|CHAT_SEND_PLAIN_FORBIDDEN/;
        if (blockKeywords.test(errorDesc)) {
            await lastAyaTime(chatId, 'blocked');
        }
    }
}

/**
 * Handles the "surprise me" action, sending a random Aya with recitation.
 * This function is exported for testing.
 * @async
 * @function surpriseAya
 * @param {import('telegraf').Context} ctx - The Telegraf context object.
 */
export async function surpriseAya(ctx) {
    const lang = ctx.from?.language_code;
    await sendAya(ctx.chat.id, null, null, lang, 'surprise', false);
}

/**
 * Handles incoming text messages to parse potential Aya requests.
 * It normalizes the text, looks for Sura names or Sura/Aya numbers,
 * and then calls `sendAya` or `unrecognized` accordingly.
 * This function is exported for testing.
 * @async
 * @function handleText
 * @param {import('telegraf').Context & { message: import('telegraf/typings/core/types/typegram').Message.TextMessage }} ctx - The Telegraf context object containing the text message.
 */
export async function handleText(ctx) {
    const originalText = ctx.message.text;
    const normalizedTxt = rasmifize(numArabicToEnglish(originalText));
    const foundNums = normalizedTxt.match(/\d+/g) || [];
    const chatId = ctx.chat.id;
    let ayaId = -2;
    let foundArSuraNum = 0;

    logger(`Message from chat ${chatId} (${ctx.from?.username}): ${originalText}. Normalized: ${normalizedTxt}`);

    const ArMagicRegex = new RegExp(`[${rasmifize('المهوسصق')}]`);

    if (ArMagicRegex.test(normalizedTxt)) {
        if (normalizedTxt.includes(rasmifize('الكرسي'))) {
            ayaId = 262; // Ayat al-Kursi
        } else {
            for (let index = 0; index < normalizedSurasArNames.length; index++) {
                const suraNamePattern = normalizedSurasArNames[index].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(
                    `(^${suraNamePattern}$)|(^${suraNamePattern}([-: 0-9]+)(.*))|((.*)([-: ]+)${suraNamePattern}([-: 0-9]+)(.*))|((.*)([-: ]+)${suraNamePattern}$)`
                );
                if (regex.test(normalizedTxt)) {
                    foundArSuraNum = index + 1;
                    logger(`Found Arabic Sura name: ${quranData.enQuran[index].englishName} (Num: ${foundArSuraNum})`);
                    break;
                }
            }
            if (foundArSuraNum) {
                ayaId = suraAya2ayaId({ sura: foundArSuraNum, aya: foundNums.length ? parseInt(foundNums[0], 10) : 1 });
            }
        }
    }

    if (foundNums.length && !foundArSuraNum && ayaId === -2) {
        const potentialSuraNum = parseInt(foundNums[0], 10);
        const potentialAyaNum = foundNums.length >= 2 ? parseInt(foundNums[1], 10) : 1;
        ayaId = suraAya2ayaId({ sura: potentialSuraNum, aya: potentialAyaNum });
    }

    const startPayloadRecitation = ctx.startPayload ? ctx.startPayload.includes('r') : false;

    if (ayaId > 0) {
        await sendAya(chatId, ayaId, null, ctx.from?.language_code, 'request', startPayloadRecitation);
    } else {
        let reasonCode = 3;
        if (ayaId === 0) reasonCode = 2;
        else if (ayaId === -1) reasonCode = 1;
        await unrecognized(ctx, reasonCode);
    }
}

/**
 * Sends the initial welcome/start message for the bot.
 * This function is also called when a bot is added to a new group (non-private chat).
 * @async
 * @private
 * @function startCommandLogic
 * @param {number|string} chatId - The ID of the chat to send the message to.
 * @param {import('telegraf').Context|null} [ctx=null] - Optional Telegraf context, used for `summaryStats` if provided.
 */
async function startCommandLogic(chatId, ctx = null) {
    const msg = `دايلي آية يرسل آية واحدة يوميا في نفس موعد آخر آية تطلبوها في الدردشات الشخصية أو المجموعات والقنوات حتى لا ينقطع وردكم اليومي.
لمعرفة الأوامر المتاحة: /commands

Daily Aya sends one Aya daily at the same time of the last Aya you request in private chats or groups and channels so your daily read doesn't stop.
For available commands: /commands`;

    try {
        const sentMsgCtx = await bot.telegram.sendMessage(chatId, msg, {
            reply_markup: {
                inline_keyboard: [[{ text: '🎁', callback_data: JSON.stringify({ surpriseAyaAction: true }) }]],
            },
        });
        await successSend(sentMsgCtx, 0, ctx?.from?.language_code || '', 'request'); // ayaId 0 for start message
        if (ctx) await summaryStats(ctx);
    } catch (e) {
        logger(`Error while sending start message to chat ${chatId}:`, e);
    }
}

/**
 * Sends a summary of chat statistics (active, blocked) to the development chat.
 * @async
 * @private
 * @function summaryStats
 * @param {import('telegraf').Context} ctx - The Telegraf context (used to ensure devChatId is available via config).
 */
async function summaryStats(ctx) {
    // ctx is passed to ensure config context, though not directly used for properties
    try {
        const db = getDB();
        const privateActiveChats = await db.collection('chats').countDocuments({ blocked: false, chatType: 'private' });
        const otherActiveChats = await db
            .collection('chats')
            .countDocuments({ blocked: false, chatType: { $ne: 'private' } });
        const totalBlockedChats = await db.collection('chats').countDocuments({ blocked: true });

        const totalChatsMsg = `Total Active: ${privateActiveChats + otherActiveChats} | Blocked: ${totalBlockedChats}\nPrivate Active: ${privateActiveChats} | Others: ${otherActiveChats}`;
        logger(totalChatsMsg);

        if (config.devChatId) {
            await bot.telegram.sendMessage(config.devChatId, totalChatsMsg);
        }
    } catch (e) {
        logger('Error while getting total chats for summaryStats:', e);
    }
}

/**
 * Sends instructions on how to request specific Ayas.
 * @async
 * @private
 * @function instructions
 * @param {number|string} chatId - The ID of the chat to send instructions to.
 */
async function instructions(chatId) {
    const msg = `يمكنك طلب آية محددة بإرسال اسم أو رقم السورة ورقم الآية.
مثل: البقرة   ٢٥٥
أو مثل: ٢   ٢٥٥
أو آية الكرسي

وأيضا اسم أو رقم السورة فقط
مثل : البقرة
أو مثل : ٢

You can request a specific Aya by sending the numbers of Aya and Sura.
Example: 2   255
Or Sura number only: 2`;
    try {
        await bot.telegram.sendMessage(chatId, msg);
        logger('Sent instructions message to chat ' + chatId);
    } catch (e) {
        logger('Failed to send instructions message to chat ' + chatId, e);
    }
}

/**
 * Sends a message explaining why a user's request was not recognized.
 * This is only sent if the user is an admin in the chat.
 * @async
 * @private
 * @function unrecognized
 * @param {import('telegraf').Context} ctx - The Telegraf context object.
 * @param {1|2|3|number} reason - A code indicating the reason for non-recognition:
 *                                1: Could not recognize Sura name or number.
 *                                2: Aya number not in the requested Sura.
 *                                3: Unrecognized message type (e.g., sticker instead of text).
 *                                Other: Unknown error.
 */
async function unrecognized(ctx, reason) {
    const chatId = ctx.chat.id;
    const isUserAdmin = await adminChecker(ctx);
    if (!isUserAdmin) {
        logger(`Ignored unrecognized message from non-admin user ${ctx.from.id} in chat ${ctx.chat.id}.`);
        return;
    }

    let msg;
    switch (reason) {
        case 1:
            msg = `عذرا، لم نتعرف على اسم سورة باللغة العربية أو رقم سورة من 1 إلى 114.\n\nSorry, we couldn't recognize a Sura name in Arabic or Sura number from 1 to 114.`;
            break;
        case 2:
            msg = `عذرا، رقم الآية ليس في السورة المطلوبة.\n\nSorry, Aya number is not in the requested Sura.`;
            break;
        case 3:
            msg = `عذرا، حاليا نتعرف فقط على أسماء السور باللغة العربية أو أرقام السور والآيات في الرسائل النصية.\n\nSorry, we currently only recognize Sura names in Arabic or numbers of Sura and Aya in text messages.`;
            break;
        default:
            msg = `خطأ غير معروف!\n\nUnknown error!`;
            break;
    }

    try {
        await bot.telegram.sendMessage(chatId, msg, {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '🎁', callback_data: JSON.stringify({ surpriseAyaAction: true }) },
                        { text: '🤔', callback_data: JSON.stringify({ instructionsAction: true }) },
                    ],
                ],
            },
        });
        logger('Sent reason of unrecognized request to chat ' + chatId);
    } catch (e) {
        logger('Failed to send reason of unrecognized request to chat ' + chatId, e);
    }
}

// --- Reciters Command Helpers ---
/**
 * Cache for inline keyboard buttons for reciter selection.
 * Populated by {@link populateRecitersButtons}.
 * @private
 * @type {Array<Array<import('telegraf/typings/core/types/typegram').InlineKeyboardButton.CallbackButton>>}
 */
let recitersInlineButtonsCache = [];

/**
 * Populates the `recitersInlineButtonsCache` with buttons for each available Arabic reciter.
 * This is called once at bot setup.
 * @private
 * @function populateRecitersButtons
 */
function populateRecitersButtons() {
    if (!quranData.arReciters || quranData.arReciters.length === 0) {
        logger('populateRecitersButtons: No Arabic reciters loaded.', new Error('arReciters data missing'));
        recitersInlineButtonsCache = [];
        return;
    }
    recitersInlineButtonsCache = quranData.arReciters.map((reciter) => [
        {
            text: `${reciter.englishName} ${reciter.name}`,
            callback_data: JSON.stringify({ setReciter: reciter.identifier }),
        },
    ]);
    logger('Reciters buttons populated and cached.');
}
populateRecitersButtons(); // Call at setup

// (Place this function where recitersNavPageMarkup was, or in a suitable location)
function recitersNavPage(page) { // Adapted from original index.js
    const recitersPerPage = 5;
    if (!recitersInlineButtonsCache || recitersInlineButtonsCache.length === 0) {
        logger('recitersNavPage: recitersInlineButtonsCache is empty or not initialized.');
        // Return a minimal navigation row even if there are no reciters
        return [[{
            text: `🎲`,
            callback_data: JSON.stringify({ setReciter: 'surprise' })
        },{
            text: `＜`,
            callback_data:  JSON.stringify({ recitersNavPage: 1 })
        },{
            text: `1/1`, // Show 1/1 if no reciters
            callback_data:  JSON.stringify({ inactive: true })
        },{
            text: `＞`,
            callback_data:  JSON.stringify({ recitersNavPage: 1 })
        }]];
    }

    const totalPages = Math.max(1, Math.ceil(recitersInlineButtonsCache.length / recitersPerPage)); // Ensure totalPages is at least 1
    const currentPage = Math.min(Math.max(page, 1), totalPages); // Normalize currentPage

    // Slice the cache, which contains arrays of buttons (rows)
    const buttonsSlice = recitersInlineButtonsCache.slice(
        (currentPage - 1) * recitersPerPage,
        currentPage * recitersPerPage
    );

    const navRow = [{
        text: `🎲`,
        callback_data: JSON.stringify({ setReciter: 'surprise' })
    },{
        text: `＜`,
        callback_data:  JSON.stringify({ recitersNavPage: currentPage > 1 ? currentPage - 1 : totalPages })
    },{
        text: `${currentPage}/${totalPages}`,
        callback_data:  JSON.stringify({ inactive: true })
    },{
        text: `＞`,
        callback_data:  JSON.stringify({ recitersNavPage: currentPage < totalPages ? currentPage + 1 : 1 })
    }];

    // buttonsSlice is an array of rows. Add navRow as the last row.
    return [...buttonsSlice, navRow];
}

// --- Khatma Command Helpers ---
/**
 * Updates the text of a Khatma progress message based on a user's Juz selection.
 * It parses existing user entries (HTML links) and inserts/updates the current user's selection
 * in a sorted manner.
 * @private
 * @function khatmaUpdate
 * @param {object} params - The parameters for updating the Khatma.
 * @param {number|string} params.userId - The ID of the user making the selection.
 * @param {string} params.firstName - The first name of the user.
 * @param {string} params.currentText - The current text of the Khatma message.
 * @param {Array<import('telegraf/typings/core/types/typegram').MessageEntity>} [params.currentEntities] - Optional entities from the current message, used to preserve existing HTML mentions.
 * @param {number} params.juz - The Juz number selected by the user.
 * @returns {string|false} The updated message text with HTML links, or `false` if no change was made (user selected the same Juz).
 */
function khatmaUpdate({ userId, firstName, currentText, currentEntities, juz }) {
    let textOffset = 0;
    let newText = currentText;

    (currentEntities || []).forEach((entity) => {
        if (entity.type === 'text_mention' && entity.user) {
            const mention = `<a href="tg://user?id=${entity.user.id}">${entity.user.first_name}</a>`;
            newText =
                newText.substring(0, textOffset + entity.offset) +
                mention +
                newText.substring(textOffset + entity.offset + entity.length);
            textOffset += mention.length - entity.length;
        }
    });

    const userUpdateLine = `<a href="tg://user?id=${userId}">${firstName}</a> ➔ ${juz} ${juz === 30 ? '🏆' : '💪'}`;
    const textArray = newText.split('\n\n');
    const header = textArray.shift();

    const existingUserEntryIndex = textArray.findIndex((item) => item.includes(`<a href="tg://user?id=${userId}">`));
    if (existingUserEntryIndex !== -1 && textArray[existingUserEntryIndex] === userUpdateLine) {
        return false;
    }

    const filteredArray = textArray.filter((item) => !item.includes(`<a href="tg://user?id=${userId}">`));

    let insertAtIndex = filteredArray.findIndex((item) => {
        const match = item.match(/(\d+)(?: .{1,2})$/);
        return match && parseInt(match[1], 10) < juz;
    });

    if (insertAtIndex === -1) {
        filteredArray.push(userUpdateLine);
    } else {
        filteredArray.splice(insertAtIndex, 0, userUpdateLine);
    }

    return [header, ...filteredArray].join('\n\n');
}

// --- Command Handlers ---
bot.start(async (ctx) => {
    if (ctx.chat.type !== 'private' && !(await adminChecker(ctx))) {
        logger(`Ignored /start command from non-admin user ${ctx.from.id} in chat ${ctx.chat.id} (${ctx.chat.title}).`);
        return;
    }
    // If in private chat, or if admin in group, proceed:
    if (ctx.startPayload && ctx.startPayload.length) {
        logger(`/start with payload: ${ctx.startPayload} from chat ${ctx.chat.id}`);
        return handleText(ctx);
    }
    await startCommandLogic(ctx.chat.id, ctx);
});

bot.help(async (ctx) => {
    if (ctx.chat.type !== 'private' && !(await adminChecker(ctx))) {
        logger(`Ignored /help command from non-admin user ${ctx.from.id} in chat ${ctx.chat.id} (${ctx.chat.title}).`);
        return; // Silently ignore in groups if not admin
    }
    // If in private chat, or if admin in group, proceed:
    await instructions(ctx.chat.id);
});

bot.command('surpriseme', async (ctx) => {
    if (ctx.chat.type !== 'private' && !(await adminChecker(ctx))) {
        logger(`Ignored /surpriseme command from non-admin user ${ctx.from.id} in chat ${ctx.chat.id} (${ctx.chat.title}).`);
        return;
    }
    await surpriseAya(ctx);
});

bot.command('support', async (ctx) => {
    if (ctx.chat.type !== 'private' && !(await adminChecker(ctx))) {
        logger(`Ignored /support command from non-admin user ${ctx.from.id} in chat ${ctx.chat.id} (${ctx.chat.title}).`);
        return;
    }
    const msg = `👨‍💻`;
    await ctx
        .reply(
            msg,
            Markup.inlineKeyboard([
                [Markup.button.url('Contact Us 💬 تواصل معنا', 'https://t.me/sherbeeny')],
                [Markup.button.url('Support Us 🌱 دعم استمرارنا', 'https://www.paypal.me/sherbeeny/10')],
            ])
        )
        .catch((e) => logger('Error sending /support message:', e));
});

bot.command('reciters', async (ctx) => {
    if (ctx.chat.type !== 'private' && !(await adminChecker(ctx))) {
        logger(`Ignored /reciters command from non-admin user ${ctx.from.id} in chat ${ctx.chat.id} (${ctx.chat.title}).`);
        return;
    }
    const msg = `من هو قارئك المفضل؟\n\nWho is your favorite Reciter?`;
    await ctx.reply(msg, { reply_markup: { inline_keyboard: recitersNavPage(1) } }).catch((e) => logger('Error sending /reciters message:', e));
});

bot.command('channel', async (ctx) => {
    if (ctx.chat.type !== 'private' && !(await adminChecker(ctx))) {
        logger(`Ignored /channel command from non-admin user ${ctx.from.id} in chat ${ctx.chat.id} (${ctx.chat.title}).`);
        return;
    }
    await ctx.reply('https://t.me/DailyAyaGlobal').catch((e) => logger('Error sending /channel message:', e));
});

bot.command('khatma', async (ctx) => {
    if (ctx.chat.type !== 'private' && !(await adminChecker(ctx))) {
        logger(`Ignored /khatma command from non-admin user ${ctx.from.id} in chat ${ctx.chat.id} (${ctx.chat.title}).`);
        return;
    }
    const msg = `كم جزء قرأت؟ \nHow many ajzaa did you read?`;
    const quran30btns = [];
    for (let i = 0; i < 6; i++) {
        const row = [];
        for (let juz = 1 + 5 * i; juz <= 5 + 5 * i; juz++) {
            row.push(Markup.button.callback(juz.toString(), JSON.stringify({ groupkhatma: juz })));
        }
        quran30btns.push(row);
    }
    await ctx.reply(msg, Markup.inlineKeyboard(quran30btns)).catch((e) => logger('Error sending /khatma message:', e));
});

bot.command('commands', async (ctx) => {
    if (ctx.chat.type !== 'private' && !(await adminChecker(ctx))) {
        logger(`Ignored /commands command from non-admin user ${ctx.from.id} in chat ${ctx.chat.id} (${ctx.chat.title}).`);
        return;
    }
    try {
        const myCommands = await bot.telegram.getMyCommands();
        let msg = myCommands.map((c) => `/${c.command}\n${c.description}`).join('\n\n');
        if (!msg) msg = 'No commands found or an error occurred.';
        await ctx.reply(msg);
    } catch (e) {
        logger('Error fetching/sending commands:', e);
        await ctx
            .reply("Sorry, couldn't fetch commands at the moment.")
            .catch((e) => logger('Error replying to /commands after fetch error:', e));
    }
});

// Set bot commands for Telegram menu
bot.telegram
    .setMyCommands([
        { command: 'surpriseme', description: '🎁 Surprise Me فاجئني' },
        { command: 'khatma', description: '💪 Group Khatma ختمة مجموعة' },
        { command: 'help', description: '🤔 Instructions إرشادات' },
        { command: 'support', description: '🤗 Support دعم' },
        { command: 'reciters', description: '🗣️ Set Reciter اختيار القارئ' },
        { command: 'channel', description: '📢 Daily Aya Channel قناة دايلي آية' },
        { command: 'commands', description: '🔎 Show all commands أوامري' },
    ])
    .catch((e) => logger('Error setting bot commands:', e));

// --- Action Handlers (Callback Queries) ---

/**
 * Generic wrapper for action handlers that require admin privileges.
 * @async
 * @private
 * @function adminProtectedAction
 * @param {import('telegraf').Context} ctx - The Telegraf context object from the callback query.
 * @param {function(import('telegraf').Context): Promise<void>} actionFn - The function to execute if the user is an admin.
 * @param {boolean} [alertIfNotAdmin=true] - Whether to show an alert to non-admins.
 */
async function adminProtectedAction(ctx, actionFn, alertIfNotAdmin = true) {
    const isUserAdmin = await adminChecker(ctx);
    if (!isUserAdmin) {
        if (alertIfNotAdmin)
            await ctx
                .answerCbQuery(NON_ADMINS_ALERT, { show_alert: true })
                .catch((e) => logger('Error answering CBQ for non-admin:', e));
        else await ctx.answerCbQuery().catch((e) => logger('Error answering CBQ (silent) for non-admin:', e));
        return;
    }
    try {
        await actionFn(ctx);
        await ctx.answerCbQuery().catch((e) => logger('Error answering CBQ after admin action:', e));
    } catch (error) {
        logger('Error in adminProtectedAction executing actionFn:', error);
        await ctx
            .answerCbQuery('An error occurred.', { show_alert: true })
            .catch((e) => logger('Error answering CBQ after actionFn error:', e));
    }
}

/**
 * Generic wrapper for action handlers that have different behaviors for admins and non-admins,
 * often involving opening a URL for non-admins.
 * @async
 * @private
 * @function adminConditionalAction
 * @param {import('telegraf').Context} ctx - The Telegraf context object.
 * @param {function(import('telegraf').Context): Promise<void>} adminFn - Function to execute for admin users.
 * @param {function(import('telegraf').Context): Promise<string>} nonAdminCb - Function that returns a URL for non-admin users.
 * @param {boolean} [nonAdminAlert=false] - Whether to show an alert to non-admins before redirecting.
 * @param {string|null} [nonAdminUrl=null] - Pre-calculated URL for non-admins (if `nonAdminCb` is not used).
 */
async function adminConditionalAction(ctx, adminFn, nonAdminCb, nonAdminAlert = false, nonAdminUrl = null) {
    const isUserAdmin = await adminChecker(ctx);
    if (isUserAdmin) {
        try {
            await adminFn(ctx);
            await ctx.answerCbQuery().catch((e) => logger('Error answering CBQ after admin fn in conditional:', e));
        } catch (error) {
            logger('Error in adminConditionalAction executing adminFn:', error);
            await ctx
                .answerCbQuery('An error occurred.', { show_alert: true })
                .catch((e) => logger('Error answering CBQ after adminFn error in conditional:', e));
        }
    } else {
        const urlToOpen = nonAdminUrl || (typeof nonAdminCb === 'function' ? await nonAdminCb(ctx) : null);
        if (urlToOpen) {
            await ctx
                .answerCbQuery(nonAdminAlert ? NON_ADMINS_ALERT : '', { url: urlToOpen })
                .catch((e) => logger('Error answering CBQ with URL for non-admin:', e));
        } else {
            await ctx
                .answerCbQuery(nonAdminAlert ? NON_ADMINS_ALERT : '', { show_alert: nonAdminAlert })
                .catch((e) => logger('Error answering CBQ for non-admin (no URL):', e));
        }
    }
}

// Action handlers using the new structure
bot.action(/^{"groupkhatma":\d+}$/, async (ctx) => {
    // Admin check removed - all users can press these buttons

    let callbackData;
    try {
        callbackData = JSON.parse(ctx.update.callback_query.data);
    } catch (parseError) {
        logger('groupkhatma action: Failed to parse callback_data', parseError);
        ctx.answerCbQuery('Error processing your request.').catch(e => logger('groupkhatma action: CbQ error on parse fail', e));
        return;
    }

    const juz = callbackData.groupkhatma;
    if (typeof juz !== 'number' || juz < 1 || juz > 30) {
         logger('groupkhatma action: Invalid Juz number in callback.', new Error(`Data: ${JSON.stringify(callbackData)}`));
         ctx.answerCbQuery('Error: Invalid Juz number.').catch(e => logger('groupkhatma action: CbQ error on invalid Juz', e));
         return;
    }

    const updatedText = khatmaUpdate({
        userId: ctx.from.id,
        firstName: ctx.from.first_name || `User${ctx.from.id}`,
        currentText: ctx.update.callback_query.message.text,
        currentEntities: ctx.update.callback_query.message.entities,
        juz: juz,
    });

    if (updatedText === false) { // No change, user selected same Juz
        return ctx
            .answerCbQuery(`هذا الجزء هو اختيارك الحالي بالفعل ⚠️\n\n⚠️ This Juz is already your current selection.`, {
                show_alert: true,
            })
            .catch((e) => logger('Error CBQ khatma no change:', e));
    }

    try {
        await ctx.editMessageText(updatedText, {
            parse_mode: 'HTML',
            reply_markup: ctx.update.callback_query.message.reply_markup, // Keep existing buttons
        });
        await ctx
            .replyWithHTML(
                `<a href="tg://user?id=${ctx.from.id}">${ctx.from.first_name || `User${ctx.from.id}`}</a> ➔ ${juz} ${juz === 30 ? '🏆' : '💪'}`,
                { disable_notification: true, reply_to_message_id: ctx.update.callback_query.message.message_id }
            )
            .catch((e) => logger('Error replying to Khatma update:', e));
        await ctx.answerCbQuery(
            `تم التحديث ✔️\nنسأل الله أن يتقبل منا ومنكم 🤲\n\n✔️ Updated!\n🤲 May Allah accept from us and you.`,
            { show_alert: true }
        );
    } catch (e) {
        logger(`Error while updating khatma message or replying:`, e);
        await ctx
            .answerCbQuery(
                `تم الإرسال ✔️\nالملخص قد يكون ممتلئ ⚠️\nنسأل الله أن يتقبل منا ومنكم 🤲\n\n✔️ Sent!\n⚠️ Summary might be full.\n🤲 May Allah accept from us and you.`,
                { show_alert: true }
            )
            .catch((eCb) => logger('Error CBQ khatma update error:', eCb));
    }
});

bot.action(/^{"recitersNavPage":\s*\d+\s*}$/, async (ctx) => { // Regex adapted slightly for potential spaces
    await adminProtectedAction(ctx, async (adminCtx) => {
        let callbackData;
        try {
            callbackData = JSON.parse(adminCtx.update.callback_query.data);
        } catch (e) {
            logger('recitersNavPage (action): Failed to parse callback_data', e);
            adminCtx.answerCbQuery('Error processing request.').catch(eAns => logger('recitersNavPage (action): Error answering CBQ on parse fail', eAns));
            return;
        }

        const requestedRecitersNavPage = callbackData.recitersNavPage;
        if (typeof requestedRecitersNavPage !== 'number') {
            logger('recitersNavPage (action): requestedRecitersNavPage is not a number.', new Error(`Callback data: ${JSON.stringify(callbackData)}`));
            adminCtx.answerCbQuery('Error: Invalid page number.').catch(eAns => logger('recitersNavPage (action): Error answering CBQ on invalid page type', eAns));
            return;
        }

        logger(`recitersNavPage (action): Navigating to page ${requestedRecitersNavPage}`);
        try {
            const newKeyboard = recitersNavPage(requestedRecitersNavPage);
            // Log the generated keyboard for debugging if needed
            // logger(`recitersNavPage (action): Generated keyboard: ${JSON.stringify(newKeyboard)}`);

            await adminCtx.editMessageReplyMarkup({ inline_keyboard: newKeyboard });
            // No need to explicitly answerCbQuery if editMessageReplyMarkup succeeds,
            // unless there's specific feedback to give. Telegraf often handles this.
            // However, the original code had ctx.answerCbQuery(), so keeping it for consistency if it doesn't cause issues.
            adminCtx.answerCbQuery().catch(eAns => logger('recitersNavPage (action): Error answering CBQ post-edit (non-critical)', eAns));

        } catch (e) {
            logger('recitersNavPage (action): Error editing message reply markup', e);
            adminCtx.answerCbQuery('Error updating list.').catch(eAns => logger('recitersNavPage (action): Error answering CBQ on edit error', eAns));
        }
    });
});

bot.action(/^{"setReciter":"[^"]+"(?:,"a":\d+)?}$/, async (ctx) => {
    await adminProtectedAction(ctx, async (adminCtx) => {
        const callbackData = JSON.parse(adminCtx.update.callback_query.data);
        const requestedFavReciter = callbackData.setReciter;

        const result = await setFavReciter(adminCtx.chat.id, requestedFavReciter);
        let replyMsg;
        if (result.success) {
            if (requestedFavReciter === 'surprise') {
                replyMsg = `سيتم تغيير القارئ مع كل آية مفاجئة.\n\nReciter will be changed with each surprise Aya.`;
            } else {
                const reciterData = quranData.arReciters.find((r) => r.identifier === requestedFavReciter);
                replyMsg = reciterData
                    ? `القارئ المفضل الحالي: ${reciterData.name}\n\nCurrent Favorit Reciter: ${reciterData.englishName}`
                    : `Favorite reciter set to: ${requestedFavReciter}`;
            }
        } else {
            replyMsg = `عذرا.. نواجه مشكلة أثناء حفظ القارئ المفضل ونأمل حلها قريبا.\n\nSorry.. There's an issue while setting favorite reciters and we hope it gets fixed soon.`;
        }
        const inlineKeyboard = callbackData.a
            ? [[Markup.button.callback('🎁', JSON.stringify({ surpriseAyaAction: true, a: callbackData.a }))]]
            : [[Markup.button.callback('🎁', JSON.stringify({ surpriseAyaAction: true }))]];

        await adminCtx
            .reply(replyMsg, Markup.inlineKeyboard(inlineKeyboard))
            .catch((e) => logger('Error replying to setReciter action:', e));
    });
});

bot.action(
    JSON.stringify({ instructionsAction: true }),
    async (ctx) => await adminProtectedAction(ctx, (adminCtx) => instructions(adminCtx.chat.id))
);
bot.action(/^{"surpriseAyaAction":true(?:,"a":\d+)?}$/, async (ctx) => await adminProtectedAction(ctx, surpriseAya));

bot.action(/^{"currAya":\d+,"r":"[^"]+"}$/, async (ctx) => {
    const callbackData = JSON.parse(ctx.update.callback_query.data);
    await adminConditionalAction(
        ctx,
        async (adminCtx) => {
            logger(`Next Aya after ${callbackData.currAya} by ${callbackData.r} for chat ${adminCtx.chat.id}`);
            await sendAya(
                adminCtx.chat.id,
                nextAya(callbackData.currAya),
                callbackData.r,
                adminCtx.from?.language_code,
                'next',
                false // <--- Changed value
            );
        },
        async (nonAdminCtx) => {
            const ayaIndex = ayaId2suraAya(nextAya(callbackData.currAya));
            return `t.me/${bot.options.username || 'DailyAyaBot'}?start=${ayaIndex.sura}-${ayaIndex.aya}`;
        },
        false,
        `t.me/${bot.options.username || 'DailyAyaBot'}?start=${ayaId2suraAya(nextAya(callbackData.currAya)).sura}-${ayaId2suraAya(nextAya(callbackData.currAya)).aya}`
    );
});

bot.action(/^{"aMenu":"[^"]+","a":\d+,"r":"[^"]+"}$/, async (ctx) => {
    await adminProtectedAction(ctx, async (adminCtx) => {
        const callbackData = JSON.parse(adminCtx.update.callback_query.data);
        const menu = callbackData.aMenu.includes('1')
            ? callbackData.aMenu.replace('1', '0')
            : callbackData.aMenu.replace('0', '1');
        const buttons = aMenuButtons(menu, callbackData.a, callbackData.r);
        try {
            await adminCtx.editMessageReplyMarkup(buttons);
        } catch (e) {
            // Can fail if message is too old, etc.
            logger(`Warning: Error toggling aMenu (MESSAGE_ID_INVALID or other non-critical): `, e);
        }
    });
});

bot.action(/^{"recite":\d+,"r":"[^"]+"}$/, async (ctx) => {
    const callbackData = JSON.parse(ctx.update.callback_query.data);
    await adminConditionalAction(
        ctx,
        async (adminCtx) => {
            logger(`Button reciter: ${callbackData.r} for Aya ${callbackData.recite} in chat ${adminCtx.chat.id}`);
            await sendAyaRecitation(adminCtx, callbackData.recite, callbackData.r);
        },
        async (nonAdminCtx) => {
            const ayaIndex = ayaId2suraAya(callbackData.recite);
            return `t.me/${bot.options.username || 'DailyAyaBot'}?start=r${ayaIndex.sura}-${ayaIndex.aya}`;
        },
        false,
        `t.me/${bot.options.username || 'DailyAyaBot'}?start=r${ayaId2suraAya(callbackData.recite).sura}-${ayaId2suraAya(callbackData.recite).aya}`
    );
});

// --- Other Event Handlers ---
bot.on('text', async (ctx) => {
    if (ctx.chat.type !== 'private' && !(await adminChecker(ctx))) {
        logger(`Ignored text message from non-admin user ${ctx.from.id} in chat ${ctx.chat.id} (${ctx.chat.title}).`);
        return; // Silently ignore text from non-admins in groups
    }
    // If in private chat, or if admin in group, proceed:
    await handleText(ctx);
});

bot.on('my_chat_member', async (ctx) => {
    const newStatus = ctx.update.my_chat_member.new_chat_member.status;
    logger(`my_chat_member update for chat ${ctx.chat.id}: ${newStatus}`);
    switch (newStatus) {
        case 'member':
        case 'administrator':
            // If bot is added or re-added to a group/channel, or unblocked in private.
            if (ctx.chat.type !== 'private') {
                await startCommandLogic(ctx.chat.id);
            } else {
                await startCommandLogic(ctx.chat.id); // Also call for private if unblocked/re-added
            }
            break;
        case 'kicked': // Bot was kicked from a group/channel
        case 'left': // Bot left a group/channel or was blocked by user in private chat
            await lastAyaTime(ctx.chat.id, 'blocked');
            break;
        default:
            logger(`Unknown my_chat_member status: ${newStatus} for chat ${ctx.chat.id}`);
            break;
    }
});

// --- Export Bot Instance, sendAya and Launch Function ---
export { bot, sendAya }; // Exporting sendAya for timer use by app.js

/**
 * Launches the Telegram bot and sets up initial configurations.
 * This includes sending a startup message to the dev chat, checking Quran sources,
 * and starting the Telegraf polling mechanism.
 * @async
 * @function launchBot
 * @throws {Error} If bot launch fails.
 */
export async function launchBot() {
    try {
        const username = await botUsernameReady;

        if (!username) {
            bootstrapLogger('launchBot: Bot username could not be retrieved. Launch aborted.');
            throw new Error('Bot username could not be retrieved. Launch aborted.');
        }
        // bootstrapLogger for username set is already in getMe().then()

        bootstrapLogger('launchBot: Attempting to start Telegraf polling via bot.launch()...');
        bot.launch();
        bootstrapLogger('launchBot: Telegraf polling initiated in background.');

        if (config.devChatId && bot.options.username) {
            const instStateMsg = `DailyAyaTelegram ${config.branch} instance ${config.inst}@${config.host} (of total ${config.totalInst}) is active in ${config.debugging ? 'debugging' : 'normal'} mode of version ${config.codeVer} until ${config.instActiveUntil}.\nMemory Used: ${Math.floor(process.memoryUsage().rss / (1024 * 1024))} MB\nUptime: ${+(process.uptime() / 3600).toFixed(2)} hours`;
            try {
                await bot.telegram.sendMessage(config.devChatId, instStateMsg);
                bootstrapLogger('Startup state message sent to dev group.');
            } catch (e) {
                bootstrapLogger('Error sending startup state message to dev group (proceeding):', e);
            }
        } else if (config.devChatId && !bot.options.username) {
            bootstrapLogger('launchBot: Cannot send startup state message to dev group - bot username not available or devChatId not set.');
        }

        if (!config.debugging) {
            checkSource((chatId, message) => bot.telegram.sendMessage(chatId, message))
                .then(() => logger('Initial Quran source check scheduled/done.')) // Regular logger for this async task's result
                .catch((e) => logger('Error during initial Quran source check:', e));
        }

        bootstrapLogger('launchBot: Core setup complete, polling initiated.');

    } catch (e) {
        bootstrapLogger('Failed to complete critical launchBot setup steps. Error:', e);
        throw e;
    }

    // General error handler for the bot (catches runtime errors after successful launch)
    // This is correctly placed at the end of the file in the original structure.
    // Moving it here if it was accidentally removed or if ensuring it's after the new launchBot.
    // On review, the original file has it at the very end, which is fine.
    // This comment block serves as a reminder of its placement and purpose.
    // bot.catch((err, ctx) => {
    // logger(`Telegraf bot error for ${ctx.updateType}:`, err);
    // });
}
