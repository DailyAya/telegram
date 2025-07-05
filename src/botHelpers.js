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
    } catch (e) {
        logger('Error in adminChecker while calling getChatMember: ', e);
        return false;
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
