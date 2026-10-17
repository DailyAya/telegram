console.log('[TELEGRAMBOT_SUT] Importing dependencies...');
import axios from 'axios'; // Added for direct getMe check
import https from 'https'; // REINSTATED for custom agent
import { Telegraf, Markup } from 'telegraf';
console.log('[TELEGRAMBOT_SUT] Telegraf imported.');
import config from './config.js'; // config is already imported, ensure it's used by directGetMeCheck
import { logger, setBotInstance, bootstrapLogger } from './logger.js';
import { lastAyaTime, setFavReciter, getFavReciter } from './database.js'; // Removed getDB
import {
    // NON_ADMINS_ALERT as BOT_NON_ADMINS_ALERT, // Removed unused import alias
    adminChecker as helperAdminChecker,
    successSend as helperSuccessSend,
    sendSorry as helperSendSorry,
    aMenuButtons as helperAMenuButtons,
    helperAdminProtectedAction,
    helperAdminConditionalAction,
    sendUnrecognizedMessage as helperSendUnrecognizedMessage,
    instructions as helperInstructions, // Import new helper
} from './botHelpers.js';
import * as commandHandlers from './botHandlers/commandHandlers.js';
import * as actionHandlers from './botHandlers/actionHandlers.js';
import { khatmaUpdate as khatmaServiceKhatmaUpdate } from './botFeatures/khatmaService.js';
import { sendAyaText as senderSendAyaText, sendAyaRecitation as senderSendAyaRecitation } from './ayaSender.js'; // Import new aya senders
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
import {
    populateRecitersButtons as servicePopulateRecitersButtons,
    recitersNavPage as serviceRecitersNavPage,
} from './botFeatures/reciterService.js';
import { randomAyaNumber, numArabicToEnglish, maskTokenInUrl } from './utils.js'; // Added maskTokenInUrl

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
 * @property {string} NON_ADMINS_ALERT - Standard alert message for non-admin users. // This will be from botHelpers
 * @property {function} surpriseAya - Function to handle the "surprise me" action.
 * @property {function} handleText - Function to handle incoming text messages for Aya requests.
 */

// NON_ADMINS_ALERT is now imported as BOT_NON_ADMINS_ALERT from botHelpers.js

// --- Bot Initialization ---
/**
 * The main Telegraf bot instance.
 * @type {import('telegraf').Telegraf}
 */
const agent = new https.Agent({ timeout: 60000 }); // 60 seconds timeout
bootstrapLogger('Telegraf HTTPS agent configured with 60-second timeout (REINSTATED).');

const bot = new Telegraf(config.telegramToken, { telegram: { agent } }); // Custom agent REINSTATED
setBotInstance(bot); // Enable Telegram logging via logger.js

// Promise for ensuring bot username is available
let botUsernamePromiseResolve;
export const botUsernameReady = new Promise((resolve) => {
    botUsernamePromiseResolve = resolve;
});

// Store bot username after getMe()

/**
 * Performs a direct check of the Telegram getMe endpoint using Axios.
 * Logs the result using bootstrapLogger.
 */
async function directGetMeCheck() {
    const url = `https://api.telegram.org/bot${config.telegramToken}/getMe`;
    const maskedToken = config.telegramToken
        ? `${config.telegramToken.substring(0, 6)}...${config.telegramToken.substring(config.telegramToken.length - 4)}`
        : 'NOT_SET';
    // Use maskTokenInUrl for logging the URL
    bootstrapLogger(`directGetMeCheck: Attempting with token (masked) ${maskedToken} to URL: ${maskTokenInUrl(url)}`);

    try {
        const response = await axios.get(url, { timeout: 10000 }); // 10-second timeout, similar to sendEmergencyNotification
        bootstrapLogger(
            `directGetMeCheck: Success! Response Status: ${response.status}, Data: ${JSON.stringify(response.data)}`
        );
    } catch (error) {
        bootstrapLogger(`directGetMeCheck: Failed!`);
        if (error.response) {
            bootstrapLogger(
                `directGetMeCheck: Error Response Status: ${error.response.status}, Data: ${JSON.stringify(error.response.data)}`
            );
        } else if (error.request) {
            // Log specific, safe fields from error.request and error.config instead of the whole objects
            let requestSummary = 'Axios request made but no response received.';
            if (error.config) {
                requestSummary += ` Method: ${error.config.method}, URL: ${maskTokenInUrl(error.config.url)}, Timeout: ${error.config.timeout}.`;
            }
            if (error.code) {
                requestSummary += ` Code: ${error.code}.`;
            }
            bootstrapLogger(`directGetMeCheck: ${requestSummary}`, error.message); // Log primary message and error.message
        } else {
            // For errors during request setup
            bootstrapLogger(`directGetMeCheck: Error during request setup: ${error.message}`);
        }
        // Log key parts of the error, avoiding full object stringification if it might be circular
        bootstrapLogger(`directGetMeCheck: Error summary - Message: ${error.message}, Code: ${error.code || 'N/A'}`);
        if (error.stack) {
            bootstrapLogger(`directGetMeCheck: Stack: ${error.stack.substring(0, 500)}...`); // Log a portion of the stack
        }
    }
}

// Call the direct check before Telegraf's getMe
// Using an IIFE to await it, as this top-level code is synchronous.
// This will log its result before Telegraf's attempt.
(async () => {
    await directGetMeCheck();

    // Now proceed with Telegraf's getMe
    bot.telegram
        .getMe()
        .then((botInfo) => {
            if (botInfo && botInfo.username) {
                bot.options.username = botInfo.username;
                bootstrapLogger(
                    `launchBot: bot.telegram.getMe() successful. Bot username set to: ${bot.options.username}`
                );
                if (botUsernamePromiseResolve) {
                    botUsernamePromiseResolve(botInfo.username); // Resolve with username
                }
            } else {
                bootstrapLogger(
                    'launchBot: bot.telegram.getMe() did not return expected botInfo or username.',
                    botInfo || 'botInfo is null/undefined'
                );
                if (botUsernamePromiseResolve) {
                    botUsernamePromiseResolve(null); // Resolve with null
                }
            }
        })
        .catch((err) => {
            bootstrapLogger('launchBot: CRITICAL - bot.telegram.getMe() failed. Error:', err);
            // Log detailed error information if available
            if (err.response && err.response.description) {
                bootstrapLogger(
                    `launchBot: getMe() failure details - Code: ${err.code}, Description: ${err.response.description}, Parameters: ${JSON.stringify(err.response.parameters)}`
                );
            }
            // Additionally, log err.response.data if it exists, as it might contain more info
            if (err.response && err.response.data) {
                bootstrapLogger(`launchBot: getMe() failure - err.response.data: ${JSON.stringify(err.response.data)}`);
            }
            if (botUsernamePromiseResolve) {
                botUsernamePromiseResolve(null); // Resolve with null if getMe() failed
            }
        });
})(); // Close and invoke the IIFE
console.log('[TELEGRAMBOT_SUT] getMe IIFE executed.');

/**
 * Helper to get Quran data once.
 * @private
 * @type {{arQuran: Array<object>, enQuran: Array<object>, arReciters: Array<object>}}
 */
const quranData = getQuranData();

// --- Helper Functions are being moved to botHelpers.js ---

// adminChecker is now imported as helperAdminChecker from botHelpers.js
// successSend is now imported as helperSuccessSend from botHelpers.js
// sendSorry is now imported as helperSendSorry from botHelpers.js
// aMenuButtons is now imported as helperAMenuButtons from botHelpers.js

// sendAyaText and sendAyaRecitation moved to src/ayaSender.js

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

    const senderDependencies = {
        botTelegram: bot.telegram,
        botUsername: bot.options.username,
        prepareAyaFn: prepareAya, // from quranService
        helperSendSorryFn: helperSendSorry, // from botHelpers
        helperAMenuButtonsFn: helperAMenuButtons, // from botHelpers
        helperSuccessSendFn: helperSuccessSend, // from botHelpers
        lastAyaTimeDbFn: lastAyaTime, // from database
        ayaId2suraAyaFn: ayaId2suraAya, // from quranService
        isValidReciterFn: isValidReciter, // from quranService
        getFavReciterDbFn: getFavReciter, // from database
        getRandomReciterIdentifierFn: getRandomReciterIdentifier, // from quranService
        getRecitationFn: getRecitation, // from quranService
    };

    try {
        const sentTextCtx = await senderSendAyaText(senderDependencies, chatId, targetAyaId, reciter, lang, trigger);
        if (sentTextCtx && withRecitation) {
            // Pass primitives to the refactored senderSendAyaRecitation
            await senderSendAyaRecitation(
                senderDependencies,
                sentTextCtx.chat.id, // chatId from the message context
                sentTextCtx.message_id, // messageId from the message context
                sentTextCtx.from?.id, // fromId (bot's ID) from the message context, optional
                targetAyaId,
                reciter
            );
        }
    } catch (e) {
        logger(`sendAya: Error caught while sending Aya ${targetAyaId} to chat ${chatId}. Trigger: ${trigger}`, e);
        const errorDesc = e.response?.description?.toLowerCase() || '';
        const blockKeywords =
            /blocked by the user|user is deactivated|need administrator rights|not enough rights|chat not found|chat_restricted|topic_closed|bot was kicked|chat_send_plain_forbidden/;
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
        await helperSendUnrecognizedMessage(ctx, reasonCode, bot.telegram);
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
// async function startCommandLogic(chatId, ctx = null) { // MOVED to commandHandlers.js
// ...
// }

/**
 * Sends a summary of chat statistics (active, blocked) to the development chat.
 * @async
 * @private
 * @function summaryStats
 * @param {import('telegraf').Context} ctx - The Telegraf context (used to ensure devChatId is available via config).
 */
// async function summaryStats(ctx) { // MOVED to commandHandlers.js
// ...
// }

// instructions function has been moved to botHelpers.js

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
// async function unrecognized(ctx, reason) { // MOVED to botHelpers.js as sendUnrecognizedMessage
//     const chatId = ctx.chat.id;
//     const isUserAdmin = await helperAdminChecker(ctx, bot.telegram);
//     if (!isUserAdmin) {
//         logger(`Ignored unrecognized message from non-admin user ${ctx.from.id} in chat ${ctx.chat.id}.`);
//         return;
//     }

//     let msg;
//     switch (reason) {
//         case 1:
//             msg = `عذرا، لم نتعرف على اسم سورة باللغة العربية أو رقم سورة من 1 إلى 114.\n\nSorry, we couldn't recognize a Sura name in Arabic or Sura number from 1 to 114.`;
//             break;
//         case 2:
//             msg = `عذرا، رقم الآية ليس في السورة المطلوبة.\n\nSorry, Aya number is not in the requested Sura.`;
//             break;
//         case 3:
//             msg = `عذرا، حاليا نتعرف فقط على أسماء السور باللغة العربية أو أرقام السور والآيات في الرسائل النصية.\n\nSorry, we currently only recognize Sura names in Arabic or numbers of Sura and Aya in text messages.`;
//             break;
//         default:
//             msg = `خطأ غير معروف!\n\nUnknown error!`;
//             break;
//     }

//     try {
//         await bot.telegram.sendMessage(chatId, msg, {
//             reply_markup: {
//                 inline_keyboard: [
//                     [
//                         { text: '🎁', callback_data: JSON.stringify({ surpriseAyaAction: true }) },
//                         { text: '🤔', callback_data: JSON.stringify({ instructionsAction: true }) },
//                     ],
//                 ],
//             },
//         });
//         logger('Sent reason of unrecognized request to chat ' + chatId);
//     } catch (e) {
//         logger('Failed to send reason of unrecognized request to chat ' + chatId, e);
//     }
// }

// --- Reciters Command Helpers ---
// Moved to src/botFeatures/reciterService.js
// Cache `recitersInlineButtonsCache` is now internal to reciterService.js
// `populateRecitersButtons` is now imported as `servicePopulateRecitersButtons`.
// `recitersNavPage` is now imported as `serviceRecitersNavPage`.

servicePopulateRecitersButtons(); // Call at setup to populate the cache in the service

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
// function khatmaUpdate({ userId, firstName, currentText, currentEntities, juz }) { // MOVED to khatmaService.js
//     let textOffset = 0;
//     let newText = currentText;

//     (currentEntities || []).forEach((entity) => {
//         if (entity.type === 'text_mention' && entity.user) {
//             const mention = `<a href="tg://user?id=${entity.user.id}">${entity.user.first_name}</a>`;
//             newText =
//                 newText.substring(0, textOffset + entity.offset) +
//                 mention +
//                 newText.substring(textOffset + entity.offset + entity.length);
//             textOffset += mention.length - entity.length;
//         }
//     });

//     const userUpdateLine = `<a href="tg://user?id=${userId}">${firstName}</a> ➔ ${juz} ${juz === 30 ? '🏆' : '💪'}`;
//     const textArray = newText.split('\n\n');
//     const header = textArray.shift();

//     const existingUserEntryIndex = textArray.findIndex((item) => item.includes(`<a href="tg://user?id=${userId}">`));
//     if (existingUserEntryIndex !== -1 && textArray[existingUserEntryIndex] === userUpdateLine) {
//         return false;
//     }

//     const filteredArray = textArray.filter((item) => !item.includes(`<a href="tg://user?id=${userId}">`));

//     // Corrected logic for ascending sort by Juz:
//     // Find the index of the first element whose Juz number is GREATER than the new Juz.
//     // Insert the new Juz BEFORE this element. If no such element, append to end.
//     let insertAtIndex = filteredArray.findIndex((item) => {
//         const match = item.match(/(\d+)(?: .{1,2})$/);
//         return match && parseInt(match[1], 10) > juz;
//     });
//     if (insertAtIndex === -1) { // No element is greater, so append
//         filteredArray.push(userUpdateLine);
//     } else { // Found an element greater, insert before it
//         filteredArray.splice(insertAtIndex, 0, userUpdateLine);
//     }

//     return [header, ...filteredArray].join('\n\n');
// }

// --- Command Handlers ---
bot.start(async (ctx) => {
    // Admin check remains here for now, or could be moved into the handler if preferred
    if (ctx.chat.type !== 'private' && !(await helperAdminChecker(ctx, bot.telegram))) {
        logger(`Ignored /start command from non-admin user ${ctx.from.id} in chat ${ctx.chat.id} (${ctx.chat.title}).`);
        return;
    }
    // Pass necessary parts of bot (telegram, options) and handleText function to the handler
    await commandHandlers.handleStartCommand(ctx, {
        telegram: bot.telegram,
        options: bot.options,
        handleTextFn: handleText,
    });
});

bot.help(async (ctx) => {
    if (ctx.chat.type !== 'private' && !(await helperAdminChecker(ctx, bot.telegram))) {
        logger(`Ignored /help command from non-admin user ${ctx.from.id} in chat ${ctx.chat.id} (${ctx.chat.title}).`);
        return; // Silently ignore in groups if not admin
    }
    await commandHandlers.handleHelpCommand(ctx, { telegram: bot.telegram });
});

bot.command('surpriseme', async (ctx) => {
    if (ctx.chat.type !== 'private' && !(await helperAdminChecker(ctx, bot.telegram))) {
        logger(
            `Ignored /surpriseme command from non-admin user ${ctx.from.id} in chat ${ctx.chat.id} (${ctx.chat.title}).`
        );
        return;
    }
    // surpriseAya is still in telegramBot.js, handleText also.
    // The handleSurpriseMeCommand in commandHandlers.js calls the original surpriseAya.
    // This needs careful thought: either pass the original surpriseAya function or the whole bot instance.
    // For now, let's assume commandHandlers.handleSurpriseMeCommand can take ctx and the bot instance.
    await commandHandlers.handleSurpriseMeCommand(ctx, {
        telegram: bot.telegram,
        options: bot.options,
        surpriseAyaFn: surpriseAya,
    });
});

bot.command('support', async (ctx) => {
    if (ctx.chat.type !== 'private' && !(await helperAdminChecker(ctx, bot.telegram))) {
        logger(
            `Ignored /support command from non-admin user ${ctx.from.id} in chat ${ctx.chat.id} (${ctx.chat.title}).`
        );
        return;
    }
    await commandHandlers.handleSupportCommand(ctx, Markup); // Pass Markup
});

bot.command('reciters', async (ctx) => {
    if (ctx.chat.type !== 'private' && !(await helperAdminChecker(ctx, bot.telegram))) {
        logger(
            `Ignored /reciters command from non-admin user ${ctx.from.id} in chat ${ctx.chat.id} (${ctx.chat.title}).`
        );
        return;
    }
    await commandHandlers.handleRecitersCommand(ctx, serviceRecitersNavPage); // Pass imported serviceRecitersNavPage
});

bot.command('channel', async (ctx) => {
    if (ctx.chat.type !== 'private' && !(await helperAdminChecker(ctx, bot.telegram))) {
        logger(
            `Ignored /channel command from non-admin user ${ctx.from.id} in chat ${ctx.chat.id} (${ctx.chat.title}).`
        );
        return;
    }
    await commandHandlers.handleChannelCommand(ctx);
});

bot.command('khatma', async (ctx) => {
    if (ctx.chat.type !== 'private' && !(await helperAdminChecker(ctx, bot.telegram))) {
        logger(
            `Ignored /khatma command from non-admin user ${ctx.from.id} in chat ${ctx.chat.id} (${ctx.chat.title}).`
        );
        return;
    }
    await commandHandlers.handleKhatmaCommand(ctx, Markup); // Pass Markup
});

bot.command('commands', async (ctx) => {
    if (ctx.chat.type !== 'private' && !(await helperAdminChecker(ctx, bot.telegram))) {
        logger(
            `Ignored /commands command from non-admin user ${ctx.from.id} in chat ${ctx.chat.id} (${ctx.chat.title}).`
        );
        return;
    }
    await commandHandlers.handleCommandsCommand(ctx, bot.telegram);
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
    ])
    .catch((e) => logger('Error setting bot commands:', e));

// --- Action Handlers (Callback Queries) ---

// It's better to have a single generic callback_query handler if we want to log ALL callbacks.
// However, Telegraf's `bot.action` registers specific handlers.
// To log all, we'd typically use `bot.on('callback_query', ...)`.
// Let's add this generic handler first for logging, then ensure specific actions still work.
// Note: If a generic `bot.on('callback_query')` is registered, it might intercept
// callbacks before specific `bot.action()` handlers if not managed carefully (e.g. by calling next()).
// For simple logging, placing it before specific `bot.action` might be okay if it doesn't stop propagation.
// Telegraf processes `on` before `action` if both match.
// A safer approach for just logging might be to wrap each action handler call,
// but for initial broad diagnosis, a general logger is okay.
// Let's try adding a general `bot.on('callback_query')` that logs and then does nothing else,
// allowing other handlers to pick up. Telegraf should call all matching handlers.

/* REVERTED: This generic handler without next() caused all action buttons to stop working.
bot.on('callback_query', async (ctx, next) => {
    const cbData = ctx.update.callback_query.data;
    const fromId = ctx.update.callback_query.from.id;
    const username = ctx.update.callback_query.from.username;
    logger(
        `DEBUG: ROOT_CALLBACK_QUERY_HANDLER: Received callback_query. Data: "${cbData}", From ID: ${fromId} (@${username || 'no_username'})`
    );
    // To ensure other action handlers are called, we would typically call `await next();`
    // However, Telegraf's `bot.action` doesn't use the `next` middleware pattern in the same way `composer.action` does.
    // For `Telegraf.action()`, it directly maps a regex/string to a handler.
    // If `bot.on('callback_query')` is also present, Telegraf will execute `on` handlers first, then `action` handlers that match.
    // So, this logger should fire, and then the specific `bot.action` should still fire.
    // No `next()` call is needed here for `bot.action` to also work. // THIS ASSUMPTION WAS WRONG
});
*/

// adminProtectedAction and adminConditionalAction are now imported from botHelpers.js
// as helperAdminProtectedAction and helperAdminConditionalAction.

// Action handlers using the new structure
bot.action(/^{"groupkhatma":\d+}$/, async (ctx) =>
    actionHandlers.handleGroupKhatmaAction(ctx, { khatmaUpdateFn: khatmaServiceKhatmaUpdate })
);

bot.action(/^{"recitersNavPage":\s*\d+\s*}$/, async (ctx) =>
    actionHandlers.handleRecitersNavPageAction(ctx, {
        botTelegram: bot.telegram,
        recitersNavPageFn: serviceRecitersNavPage, // Use imported serviceRecitersNavPage
        helperAdminProtectedAction: helperAdminProtectedAction,
    })
);

bot.action(/^{"setReciter":"[^"]+"(?:,"a":\d+)?}$/, async (ctx) =>
    actionHandlers.handleSetReciterAction(ctx, {
        botTelegram: bot.telegram,
        helperAdminProtectedAction: helperAdminProtectedAction,
        dbSetFavReciter: setFavReciter, // from database.js
        getQuranDataFn: getQuranData, // from quranService.js (imported in telegramBot.js)
        TelegrafMarkup: Markup, // from telegraf
    })
);

bot.action(JSON.stringify({ instructionsAction: true }), async (ctx) =>
    actionHandlers.handleInstructionsAction(ctx, {
        botTelegram: bot.telegram,
        helperAdminProtectedAction: helperAdminProtectedAction,
        instructionsFn: helperInstructions, // Pass the imported helperInstructions
    })
);
bot.action(/^{"surpriseAyaAction":true(?:,"a":\d+)?}$/, async (ctx) =>
    actionHandlers.handleSurpriseAyaAction(ctx, {
        botTelegram: bot.telegram,
        helperAdminProtectedAction: helperAdminProtectedAction,
        surpriseAyaFn: surpriseAya, // Pass the local surpriseAya function
    })
);

bot.action(/^{"currAya":\d+,"r":"[^"]+"}$/, async (ctx) =>
    actionHandlers.handleCurrAyaAction(ctx, {
        botTelegram: bot.telegram,
        botOptions: bot.options,
        helperAdminConditionalAction: helperAdminConditionalAction,
        sendAyaFn: sendAya, // sendAya from telegramBot.js
        nextAyaFn: nextAya, // nextAya from quranService (imported in telegramBot.js)
        ayaId2suraAyaFn: ayaId2suraAya, // ayaId2suraAya from quranService (imported in telegramBot.js)
    })
);

bot.action(/^{"aMenu":"[^"]+","a":\d+,"r":"[^"]+"}$/, async (ctx) =>
    actionHandlers.handleAMenuAction(ctx, {
        botTelegram: bot.telegram,
        botOptions: bot.options,
        helperAdminProtectedAction: helperAdminProtectedAction,
        helperAMenuButtonsFn: helperAMenuButtons, // from botHelpers.js
        ayaId2suraAyaFn: ayaId2suraAya, // from quranService.js
    })
);

bot.action(/^{"recite":\d+,"r":"[^"]+"}$/, async (ctx) => {
    let callbackData;
    let chatId;
    let fromId;
    let messageId;
    let rawCtxForAnswerCbQuery = ctx; // Keep original ctx for methods like answerCbQuery

    try {
        if (!ctx || typeof ctx !== 'object' || Object.keys(ctx).length === 0) {
            logger('Recite action (telegramBot.js): Received invalid or empty ctx.', {
                ctxKeys: ctx ? Object.keys(ctx) : null,
                ctxValue: ctx,
            });
            // Try to answer if possible, though ctx might be too broken
            if (ctx && typeof ctx.answerCbQuery === 'function') {
                await ctx
                    .answerCbQuery('Error processing your request (ctx).', { show_alert: true })
                    .catch((e) => logger('Error answering CBQ for bad/empty ctx:', e));
            }
            return;
        }

        // Defensive checks for critical properties
        if (
            !ctx.update ||
            typeof ctx.update !== 'object' ||
            !ctx.update.callback_query ||
            typeof ctx.update.callback_query !== 'object' ||
            typeof ctx.update.callback_query.data !== 'string'
        ) {
            logger('Recite action (telegramBot.js): ctx.update.callback_query.data is missing or invalid.', {
                ctxUpdateKeys: ctx.update ? Object.keys(ctx.update) : 'no_update',
                cbQuery: ctx.update ? ctx.update.callback_query : 'no_update',
            });
            await ctx
                .answerCbQuery('Error processing your request (data).', { show_alert: true })
                .catch((e) => logger('Error answering CBQ for bad ctx.update:', e));
            return;
        }
        callbackData = JSON.parse(ctx.update.callback_query.data);

        if (!ctx.chat || typeof ctx.chat !== 'object' || typeof ctx.chat.id === 'undefined') {
            logger('Recite action (telegramBot.js): ctx.chat.id is missing or invalid.', { ctxChat: ctx.chat });
            await ctx
                .answerCbQuery('Error processing your request (chat).', { show_alert: true })
                .catch((e) => logger('Error answering CBQ for bad ctx.chat:', e));
            return;
        }
        chatId = ctx.chat.id;

        // fromId is optional for some flows but good for admin checks.
        fromId = ctx.from?.id;
        if (!fromId) {
            logger(
                `Recite action (telegramBot.js): ctx.from.id is missing (ctxFrom: ${JSON.stringify(ctx.from)}). Proceeding, but admin checks might be affected.`
            );
        }

        messageId = ctx.update.callback_query.message?.message_id;
        if (!messageId) {
            logger(
                `Recite action (telegramBot.js): ctx.update.callback_query.message.message_id is missing (cbQueryMsg: ${JSON.stringify(ctx.update.callback_query.message)}). Recitation might not be able to edit original message markup.`
            );
        }
    } catch (e) {
        logger('Recite action (telegramBot.js): Error parsing ctx or callback_data in wrapper.', {
            error: e.message,
            ctxKeys: ctx ? Object.keys(ctx) : 'ctx_null_or_undefined_in_catch',
        });
        if (ctx && typeof ctx.answerCbQuery === 'function') {
            await ctx
                .answerCbQuery('Error parsing your request.', { show_alert: true })
                .catch((eCb) => logger('Error answering CBQ for parse fail in wrapper:', eCb));
        }
        return;
    }

    // Call handleReciteAction with a new structured object containing extracted primitives
    // and the rawCtx for methods like answerCbQuery if still needed by deeper functions.
    // The goal is for downstream functions to primarily use the primitives.
    actionHandlers.handleReciteAction(
        {
            // Primitives
            chatId: chatId,
            fromId: fromId, // May be undefined
            messageId: messageId, // May be undefined
            callbackQueryData: callbackData,

            // Raw context, primarily for Telegraf methods like answerCbQuery, editMessageText etc.
            // if they are still called directly by handleReciteAction or its direct helpers.
            // Ideally, these methods would also be wrapped or their usage localized.
            rawCtx: rawCtxForAnswerCbQuery,
        },
        {
            // Dependencies remain the same
            botTelegram: bot.telegram,
            botOptions: bot.options,
            helperAdminConditionalAction: helperAdminConditionalAction,
            sendAyaRecitationFn: senderSendAyaRecitation,
            ayaId2suraAyaFn: ayaId2suraAya,
            // Add functions needed by sendAyaRecitationFn via actionHandlers
            isValidReciterFn: isValidReciter,
            getRecitationFn: getRecitation,
            getFavReciterDbFn: getFavReciter,
            getRandomReciterIdentifierFn: getRandomReciterIdentifier,
            // helperSuccessSendFn is not needed for recite action
            helperSendSorryFn: helperSendSorry,
            helperAMenuButtonsFn: helperAMenuButtons,
            lastAyaTimeDbFn: lastAyaTime, // Added missing dependency
        }
    );
});

// --- Other Event Handlers ---
bot.on('text', async (ctx) => {
    if (ctx.chat.type !== 'private' && !(await helperAdminChecker(ctx, bot.telegram))) {
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
            // startCommandLogic now expects (ctx, botTelegram) and is in commandHandlers.js
            // We need to pass the full ctx for it to extract chatId and other details if needed.
            if (ctx.chat.type !== 'private') {
                // commandHandlers.handleStartCommand is the main entry, let's see if startCommandLogic is exported
                // from commandHandlers.js. It is not, it's an internal helper there.
                // The original startCommandLogic took (chatId, ctx=null).
                // The one moved to commandHandlers takes (ctx, botTelegram).
                // The bot.start command calls commandHandlers.handleStartCommand(ctx, {telegram, options, handleTextFn})
                // This handleStartCommand then calls the internal startCommandLogic(ctx, telegram)
                // So, for my_chat_member, we should call commandHandlers.handleStartCommand.
                await commandHandlers.handleStartCommand(ctx, {
                    telegram: bot.telegram,
                    options: bot.options,
                    handleTextFn: handleText,
                });
            } else {
                await commandHandlers.handleStartCommand(ctx, {
                    telegram: bot.telegram,
                    options: bot.options,
                    handleTextFn: handleText,
                });
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

        // The following three lines were the first (erroneous) bot.launch() call and its logging. They are removed.
        // bootstrapLogger('launchBot: Attempting to start Telegraf polling via bot.launch()...');
        // bot.launch();
        // bootstrapLogger('launchBot: Telegraf polling initiated in background.');

        if (config.devChatId && bot.options.username) {
            const instStateMsg = `DailyAyaTelegram ${config.branch} instance ${config.inst}@${config.host} (of total ${config.totalInst}) is active in ${config.debugging ? 'debugging' : 'normal'} mode of version ${config.codeVer} until ${config.instActiveUntil}.\nMemory Used: ${Math.floor(process.memoryUsage().rss / (1024 * 1024))} MB\nUptime: ${+(process.uptime() / 3600).toFixed(2)} hours`;
            bootstrapLogger(`launchBot: Attempting to send startup state message to devChatId: ${config.devChatId}`);
            try {
                await bot.telegram.sendMessage(config.devChatId, instStateMsg);
                bootstrapLogger('launchBot: Startup state message successfully sent to dev group.');
            } catch (e) {
                bootstrapLogger('launchBot: Error sending startup state message to dev group (proceeding):', e);
            }
        } else if (config.devChatId && !bot.options.username) {
            bootstrapLogger(
                'launchBot: Cannot send startup state message to dev group - bot username not available or devChatId not set.'
            );
        }

        // Wrap bot.launch() in try-catch
        try {
            bootstrapLogger('launchBot: Attempting to call bot.launch() to start polling...');
            bot.launch(); // This call is non-blocking and starts polling in the background.
            bootstrapLogger('launchBot: bot.launch() called successfully. Polling should be active.');
        } catch (launchError) {
            bootstrapLogger('launchBot: CRITICAL - Error occurred directly during bot.launch() call:', launchError);
            // Depending on the error, this might be a critical failure preventing the bot from starting.
            // The main try-catch for launchBot will also catch this if it's re-thrown or if launchBot itself throws.
            throw launchError; // Re-throw to be caught by the outer try-catch if necessary for retry logic in app.js
        }

        if (!config.debugging) {
            checkSource((chatId, message) => bot.telegram.sendMessage(chatId, message))
                .then(() => logger('Initial Quran source check scheduled/done.')) // Regular logger for this async task's result
                .catch((e) => logger('Error during initial Quran source check:', e));
        }

        bootstrapLogger('launchBot: Core setup complete, polling should be initiated.');
    } catch (e) {
        bootstrapLogger('launchBot: Failed to complete critical launchBot setup steps. Error:', e);
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
console.log('[TELEGRAMBOT_SUT] End of module execution (after launchBot export).');
