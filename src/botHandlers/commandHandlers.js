// src/botHandlers/commandHandlers.js
import { logger } from '../logger.js';
import { getDB, lastAyaTime as lastAyaTimeDbFn } from '../database.js';
import { helperSuccessSend, instructions as helperInstructions } from '../botHelpers.js';
import config from '../config.js';

/**
 * @async
 * @private
 * @function summaryStats
 * @description Sends a summary of chat statistics to the dev chat.
 * @param {object} botTelegram - The `bot.telegram` object from Telegraf.
 */
async function summaryStats(botTelegram) {
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
            await botTelegram.sendMessage(config.devChatId, totalChatsMsg);
        }
    } catch (e) {
        logger('Error while getting total chats for summaryStats:', e);
    }
}

/**
 * @async
 * @private
 * @function startCommandLogic
 * @description Sends the welcome message and initial stats.
 * @param {import('telegraf').Context} ctx - The Telegraf context object.
 * @param {object} botTelegram - The `bot.telegram` object from Telegraf.
 */
async function startCommandLogic(ctx, botTelegram) {
    const chatId = ctx.chat.id;
    const msg = `دايلي آية يرسل آية واحدة يوميا في نفس موعد آخر آية تطلبوها في الدردشات الشخصية أو المجموعات والقنوات حتى لا ينقطع وردكم اليومي.
لمعرفة الأوامر المتاحة: /commands

Daily Aya sends one Aya daily at the same time of the last Aya you request in private chats or groups and channels so your daily read doesn't stop.
For available commands: /commands`;

    try {
        const sentMsgCtx = await botTelegram.sendMessage(chatId, msg, {
            reply_markup: {
                inline_keyboard: [[{ text: '🎁', callback_data: JSON.stringify({ surpriseAyaAction: true }) }]],
            },
        });
        await helperSuccessSend(sentMsgCtx, 0, ctx.from?.language_code || '', 'request', lastAyaTimeDbFn);
        if (ctx) await summaryStats(botTelegram);
    } catch (e) {
        logger(`Error while sending start message to chat ${chatId}:`, e);
    }
}

// instructions function moved to botHelpers.js

/**
 * Handles the /start command.
 * @async
 * @export
 * @param {import('telegraf').Context} ctx - The Telegraf context object.
 * @param {object} dependencies - Dependencies object.
 * @param {object} dependencies.telegram - The `bot.telegram` object.
 * @param {object} dependencies.options - The `bot.options` object.
 * @param {function} dependencies.handleTextFn - The main handleText function from telegramBot.js.
 */
export async function handleStartCommand(ctx, { telegram, /* options, */ handleTextFn }) {
    // options removed
    if (ctx.startPayload && ctx.startPayload.length) {
        logger(`/start with payload: ${ctx.startPayload} from chat ${ctx.chat.id}`);
        return handleTextFn(ctx);
    }
    await startCommandLogic(ctx, telegram);
}

/**
 * Handles the /help command.
 * @async
 * @export
 * @param {import('telegraf').Context} ctx - The Telegraf context object.
 * @param {object} dependencies - Dependencies object.
 * @param {object} dependencies.telegram - The `bot.telegram` object.
 */
export async function handleHelpCommand(ctx, { telegram }) {
    await helperInstructions(ctx.chat.id, telegram);
}

/**
 * Handles the /surpriseme command.
 * @async
 * @export
 * @param {import('telegraf').Context} ctx - The Telegraf context object.
 * @param {object} dependencies - Dependencies object.
 * @param {function} dependencies.surpriseAyaFn - The surpriseAya function from telegramBot.js.
 */
export async function handleSurpriseMeCommand(ctx, { surpriseAyaFn }) {
    await surpriseAyaFn(ctx);
}

/**
 * Handles the /support command.
 * @async
 * @export
 * @param {import('telegraf').Context} ctx - The Telegraf context object.
 * @param {object} Markup - The Telegraf Markup object.
 */
export async function handleSupportCommand(ctx, Markup) {
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
}

/**
 * Handles the /reciters command.
 * @async
 * @export
 * @param {import('telegraf').Context} ctx - The Telegraf context object.
 * @param {function} recitersNavPageFn - The recitersNavPage function from reciterService.js.
 */
export async function handleRecitersCommand(ctx, recitersNavPageFn) {
    const msg = `من هو قارئك المفضل؟\n\nWho is your favorite Reciter?`;
    await ctx
        .reply(msg, { reply_markup: { inline_keyboard: recitersNavPageFn(1) } })
        .catch((e) => logger('Error sending /reciters message:', e));
}

/**
 * Handles the /channel command.
 * @async
 * @export
 * @param {import('telegraf').Context} ctx - The Telegraf context object.
 */
export async function handleChannelCommand(ctx) {
    await ctx.reply('https://t.me/DailyAyaGlobal').catch((e) => logger('Error sending /channel message:', e));
}

/**
 * Handles the /khatma command.
 * @async
 * @export
 * @param {import('telegraf').Context} ctx - The Telegraf context object.
 * @param {object} Markup - The Telegraf Markup object.
 */
export async function handleKhatmaCommand(ctx, Markup) {
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
}

/**
 * Handles the /commands command.
 * @async
 * @export
 * @param {import('telegraf').Context} ctx - The Telegraf context object.
 * @param {object} botTelegram - The `bot.telegram` object from Telegraf.
 */
export async function handleCommandsCommand(ctx, botTelegram) {
    try {
        const myCommands = await botTelegram.getMyCommands();
        let msg = myCommands.map((c) => `/${c.command}\n${c.description}`).join('\n\n');
        if (!msg) msg = 'No commands found or an error occurred.';
        await ctx.reply(msg);
    } catch (e) {
        logger('Error fetching/sending commands:', e);
        await ctx
            .reply("Sorry, couldn't fetch commands at the moment.")
            .catch((eCb) => logger('Error replying to /commands after fetch error:', eCb));
    }
}
