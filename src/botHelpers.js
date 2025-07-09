// src/botHelpers.js
import { logger } from './logger.js';
// We might need `bot` instance for some helpers, or pass it explicitly.
// For now, let's see which ones need it.
// `aMenuButtons` needs `bot.options.username`.
// `adminChecker` needs `bot.telegram.getChatMember`.
// `successSend` needs `bot.telegram.sendMessage` (indirectly, via `lastAyaTime` which is fine, but also calls logger).
// `sendSorry` needs `bot.telegram.sendMessage`.

// To avoid circular dependencies with telegramBot.js (where bot is created),
// these helpers should either:
// 1. Take the `bot` instance (or specific parts like `bot.telegram` or `bot.options.username`) as an argument.
// 2. Be refactored so they don't directly depend on the `bot` instance but on values passed to them.

// Option 1 is often cleaner for utilities tightly coupled with the bot's functionality.
// Let's make them accept `bot` or necessary parts.

// --- Constants ---
export const NON_ADMINS_ALERT = `عذرا، هذه الخاصية في المجموعات والقنوات متاحة للمشرفين فقط.\n\nSorry, this feature in groups and channels is only available for admins.`;

// --- Helper Functions ---

/**
 * Checks if the user who sent the context (ctx) is an admin in the chat.
 * For private chats, all users are considered "admins" in this context.
 * For group/supergroup chats, it checks if the user's status is 'creator' or 'administrator'.
 * @async
 * @param {import('telegraf').Context} ctx - The Telegraf context object.
 * @param {object} botTelegram - The bot.telegram object from Telegraf.
 * @returns {Promise<boolean>} True if the user is an admin or in a private chat, false otherwise.
 */
export async function adminChecker(ctx, botTelegram) {
    if (!ctx || !ctx.chat || !ctx.from) {
        logger('adminChecker: Invalid context received.', ctx);
        return false;
    }
    if (ctx.chat.type === 'private') {
        return true;
    }
    try {
        const member = await botTelegram.getChatMember(ctx.chat.id, ctx.from.id);
        return ['creator', 'administrator'].includes(member.status);
    } catch (error) {
        // Renamed e to error for clarity
        // Check if it's a Telegraf-style error with response and description
        if (
            error.response &&
            typeof error.response.description === 'string' &&
            error.response.description.includes('CHAT_ADMIN_REQUIRED')
        ) {
            // Log informatively, not necessarily as a full error that gets sent to dev chat unless debugging is on
            logger(
                `adminChecker: Bot lacks admin rights in chat ${ctx.chat.id} to check member status for user ${ctx.from.id}. Assuming user is not admin for this check.`
            );
        } else {
            // Log other errors more verbosely as they might be unexpected
            logger(
                `Error in adminChecker while calling getChatMember for chat ${ctx.chat.id}, user ${ctx.from.id}:`,
                error
            );
        }
        return false; // Default to false on any error, including CHAT_ADMIN_REQUIRED
    }
}

/**
 * Sends instructions on how to request specific Ayas.
 * @async
 * @export
 * @param {number|string} chatId - The ID of the chat to send instructions to.
 * @param {object} botTelegram - The `bot.telegram` object from Telegraf.
 */
export async function instructions(chatId, botTelegram) {
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
        await botTelegram.sendMessage(chatId, msg);
        logger('Sent instructions message to chat ' + chatId);
    } catch (e) {
        logger('Failed to send instructions message to chat ' + chatId, e);
    }
}

/**
 * Logs a successful Aya send operation and updates the database with the last Aya time.
 * (Assumes lastAyaTime is imported and used elsewhere or passed if needed, currently it's from database.js)
 * @async
 * @param {import('telegraf').Context} ctx - The Telegraf context object from the sent message.
 * @param {number} ayaId - The global ID of the Aya that was sent.
 * @param {string|undefined} lang - The language code of the user/chat.
 * @param {string} trigger - The trigger for sending the Aya (e.g., "request", "timer").
 * @param {function} lastAyaTimeDbFn - The database function lastAyaTime.
 */
export async function successSend(ctx, ayaId, lang, trigger, lastAyaTimeDbFn) {
    try {
        const chatType = ctx.chat.type;
        const chatName = chatType === 'private' ? ctx.chat.first_name || ctx.from?.first_name : ctx.chat.title;
        await lastAyaTimeDbFn(ctx.chat.id, 'success', chatName, chatType, lang, trigger);
        logger(`Successfully sent Aya ${ayaId} to chat ${ctx.chat.id} (${chatName}). Trigger: ${trigger}`);
    } catch (e) {
        logger(`Error in successSend for chat ${ctx.chat.id}:`, e);
    }
}

/**
 * Sends a standardized "sorry" message to a chat when an operation fails.
 * @async
 * @param {object} botTelegram - The bot.telegram object from Telegraf.
 * @param {number|string} chatId - The ID of the chat to send the message to.
 * @param {'audio'|'text'|'unknown'} reason - The reason for the apology, determines the message content.
 */
export async function sendSorry(botTelegram, chatId, reason) {
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
        await botTelegram.sendMessage(chatId, msg, { disable_notification: true });
        logger(`Sorry message sent to ${chatId} due to ${reason}.`);
    } catch (e) {
        logger(`Failed to send sorry message to ${chatId}:`, e);
    }
}

/**
 * Generates the inline keyboard markup for the Aya menu.
 * @param {string} menuState - The current state of the menu (e.g., "t0", "r1").
 * @param {number} ayaId - The global Aya ID.
 * @param {string} reciter - The identifier of the reciter.
 * @param {string} botUsername - The username of the bot (bot.options.username).
 * @param {function} ayaId2suraAyaFn - The ayaId2suraAya function from quranService.
 * @returns {import('telegraf').Markup.Markup<import('telegraf/typings/core/types/typegram').InlineKeyboardMarkup>} The Telegraf inline keyboard markup.
 */
export function aMenuButtons(menuState, ayaId, reciter, botUsername, ayaId2suraAyaFn) {
    if (!botUsername) {
        logger('aMenuButtons: botUsername is not set. Using default.', new Error('botUsername missing'));
        botUsername = 'DailyAyaBot'; // Fallback, though should be passed.
    }

    const buttons = {
        inline_keyboard: [
            [
                {
                    text: menuState.includes('0') ? '···' : '•••',
                    callback_data: JSON.stringify({ aMenu: menuState, a: ayaId, r: reciter }),
                },
            ],
        ],
    };

    if (menuState.includes('1')) {
        // Expanded menu
        const ayaIndex = ayaId2suraAyaFn(ayaId);
        buttons.inline_keyboard[0].push({
            text: '⚠️',
            url: `https://sherbeeny.t.me?text=${encodeURIComponent(`السلام عليكم يا مطور دايلي آية\nرجاء مراجعة الآية ${ayaIndex.sura}:${ayaIndex.aya}\n\nPeace upon you, Daily Aya developer\nPlease revise Aya ${ayaIndex.sura}:${ayaIndex.aya}`)}`,
        });
        if (menuState === 'r1') {
            buttons.inline_keyboard[0].push({
                text: '🗣️',
                callback_data: JSON.stringify({ setReciter: reciter, a: ayaId }),
            });
        }
        buttons.inline_keyboard[0].push({
            text: '📖',
            url: `https://quran.com/${ayaIndex.sura}:${ayaIndex.aya}/tafsirs/ar-tafsir-muyassar`,
        });
    }

    if (menuState.includes('t')) {
        // Text menu shows recitation button
        buttons.inline_keyboard[0].push({
            text: '🔊',
            callback_data: JSON.stringify({ recite: ayaId, r: reciter }),
        });
    }

    buttons.inline_keyboard[0].push({
        text: '▼',
        callback_data: JSON.stringify({ currAya: ayaId, r: reciter }),
    });
    return buttons;
}

/**
 * Sends a message explaining why a user's request was not recognized.
 * This is only sent if the user is an admin in the chat.
 * @async
 * @param {import('telegraf').Context} ctx - The Telegraf context object.
 * @param {1|2|3|number} reason - A code indicating the reason for non-recognition.
 * @param {object} botTelegram - The bot.telegram object from Telegraf.
 */
export async function sendUnrecognizedMessage(ctx, reason, botTelegram) {
    // Renamed to avoid conflict
    const chatId = ctx.chat.id;
    // adminChecker is available in this file's scope
    const isUserAdmin = await adminChecker(ctx, botTelegram);
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
        await botTelegram.sendMessage(chatId, msg, {
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

/**
 * Generic wrapper for action handlers that require admin privileges.
 * @async
 * @param {import('telegraf').Context} ctx - The Telegraf context object from the callback query.
 * @param {object} botTelegram - The bot.telegram object from Telegraf.
 * @param {function(import('telegraf').Context): Promise<void>} actionFn - The function to execute if the user is an admin.
 * @param {boolean} [alertIfNotAdmin=true] - Whether to show an alert to non-admins.
 */
export async function helperAdminProtectedAction(ctx, botTelegram, actionFn, alertIfNotAdmin = true) {
    // adminChecker is already imported/defined in this file if this is where it lives,
    // or it needs to be passed/imported if it's elsewhere.
    // Assuming adminChecker is available in this scope (it is, as it's defined above in botHelpers.js)
    const isUserAdmin = await adminChecker(ctx, botTelegram);
    if (!isUserAdmin) {
        if (alertIfNotAdmin)
            await ctx
                .answerCbQuery(NON_ADMINS_ALERT, { show_alert: true }) // NON_ADMINS_ALERT is also in this file
                .catch((e) => logger('Error answering CBQ for non-admin:', e));
        else await ctx.answerCbQuery().catch((e) => logger('Error answering CBQ (silent) for non-admin:', e));
        return;
    }
    try {
        await actionFn(ctx);
        await ctx.answerCbQuery().catch((e) => logger('Error answering CBQ after admin action:', e));
    } catch (error) {
        logger('Error in helperAdminProtectedAction executing actionFn:', error); // Updated log message
        await ctx
            .answerCbQuery('An error occurred.', { show_alert: true })
            .catch((e) => logger('Error answering CBQ after actionFn error:', e));
    }
}

/**
 * Generic wrapper for action handlers that have different behaviors for admins and non-admins,
 * often involving opening a URL for non-admins.
 * @async
 * @param {import('telegraf').Context} ctx - The Telegraf context object.
 * @param {object} botTelegram - The bot.telegram object from Telegraf.
 * @param {function(import('telegraf').Context): Promise<void>} adminFn - Function to execute for admin users.
 * @param {function(import('telegraf').Context): Promise<string>} nonAdminCb - Function that returns a URL for non-admin users.
 * @param {boolean} [nonAdminAlert=false] - Whether to show an alert to non-admins before redirecting.
 * @param {string|null} [nonAdminUrl=null] - Pre-calculated URL for non-admins (if `nonAdminCb` is not used).
 */
export async function helperAdminConditionalAction(
    ctx,
    botTelegram,
    adminFn,
    nonAdminCb,
    nonAdminAlert = false,
    nonAdminUrl = null
) {
    // --- BEGIN DIAGNOSTIC LOGGING for helperAdminConditionalAction (Entry Point) ---
    let hACAEntryCtxDetails = 'N/A';
    const hACAEntryCtxType = typeof ctx;
    const hACAEntryCtxKeys = ctx ? Object.keys(ctx).join(', ') : 'N/A';
    const hACAEntryCtxCbQueryData = ctx?.update?.callback_query?.data;
    const hACAEntryCtxChatId = ctx?.chat?.id;
    const hACAEntryCtxCbQueryMessageChatId = ctx?.callbackQuery?.message?.chat?.id;

    try {
        if (ctx && typeof ctx === 'object') {
            const tempCtx = {
                callbackQuery: ctx.callbackQuery,
                chat: ctx.chat,
                from: ctx.from,
                message: ctx.message,
                update: ctx.update
                    ? {
                          update_id: ctx.update.update_id,
                          callback_query: ctx.update.callback_query
                              ? {
                                    data: ctx.update.callback_query.data,
                                    from: ctx.update.callback_query.from,
                                    message: ctx.update.callback_query.message
                                        ? {
                                              message_id: ctx.update.callback_query.message.message_id,
                                              chat: ctx.update.callback_query.message.chat,
                                          }
                                        : undefined,
                                }
                              : undefined,
                      }
                    : undefined,
            };
            hACAEntryCtxDetails = JSON.stringify(tempCtx, null, 2);
            if (hACAEntryCtxDetails.length > 1500) {
                hACAEntryCtxDetails = hACAEntryCtxDetails.substring(0, 1500) + '... (truncated)';
            }
        } else {
            hACAEntryCtxDetails = String(ctx);
        }
    } catch (stringifyError) {
        hACAEntryCtxDetails = `Could not stringify ctx in helperAdminConditionalAction (Entry). Error: ${stringifyError.message}`;
        logger(`DEBUG: helperAdminConditionalAction (Entry) - JSON.stringify failed for ctx:`, stringifyError);
    }
    logger(
        `DEBUG: helperAdminConditionalAction (Entry) - Received ctx.
        ctx Type: ${hACAEntryCtxType}
        ctx Keys: ${hACAEntryCtxKeys}
        ctx?.update?.callback_query?.data: ${hACAEntryCtxCbQueryData}
        ctx?.chat?.id (accessor): ${hACAEntryCtxChatId}
        ctx?.callbackQuery?.message?.chat?.id (direct): ${hACAEntryCtxCbQueryMessageChatId}
        ctx Relevant Parts: ${hACAEntryCtxDetails}`
    );
    // --- END DIAGNOSTIC LOGGING for helperAdminConditionalAction (Entry Point) ---

    const isUserAdmin = await adminChecker(ctx, botTelegram);
    logger(
        `DEBUG: helperAdminConditionalAction - adminChecker result: ${isUserAdmin} for user ${ctx?.from?.id} in chat ${ctx?.chat?.id}`
    );

    if (isUserAdmin) {
        try {
            // The 'ctx' passed to adminFn is the same 'ctx' received by helperAdminConditionalAction
            logger(
                `DEBUG: helperAdminConditionalAction - Calling adminFn. Passing ctx with keys: ${ctx ? Object.keys(ctx).join(', ') : 'N/A'}`
            );
            await adminFn(ctx); //<<<<< THIS IS WHERE CTX IS PASSED TO THE ASYNC ADMINFN CALLBACK
            logger(`DEBUG: helperAdminConditionalAction - adminFn executed. Answering CBQ.`);
            await ctx.answerCbQuery().catch((e) => logger('Error answering CBQ after admin fn in conditional:', e));
        } catch (error) {
            logger('Error in helperAdminConditionalAction executing adminFn:', error);
            await ctx
                .answerCbQuery('An error occurred.', { show_alert: true })
                .catch((e) => logger('Error answering CBQ after adminFn error in conditional:', e));
        }
    } else {
        // The 'ctx' passed to nonAdminCb is the same 'ctx' received by helperAdminConditionalAction
        logger(
            `DEBUG: helperAdminConditionalAction - User is not admin. Preparing nonAdminCb or URL. Passing ctx with keys: ${ctx ? Object.keys(ctx).join(', ') : 'N/A'} to nonAdminCb if it's a function.`
        );
        const urlToOpen = nonAdminUrl || (typeof nonAdminCb === 'function' ? await nonAdminCb(ctx) : null);
        if (urlToOpen) {
            logger(`DEBUG: helperAdminConditionalAction - Non-admin URL to open: ${urlToOpen}`);
            await ctx
                .answerCbQuery(nonAdminAlert ? NON_ADMINS_ALERT : '', { url: urlToOpen })
                .catch((e) => logger('Error answering CBQ with URL for non-admin:', e));
        } else {
            logger(`DEBUG: helperAdminConditionalAction - Non-admin, no URL to open. Alert: ${nonAdminAlert}`);
            await ctx
                .answerCbQuery(nonAdminAlert ? NON_ADMINS_ALERT : '', { show_alert: nonAdminAlert })
                .catch((e) => logger('Error answering CBQ for non-admin (no URL):', e));
        }
    }
}
