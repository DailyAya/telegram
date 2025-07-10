// src/botHandlers/actionHandlers.js
// import { Markup } from 'telegraf'; // Removed unused import
import { logger } from '../logger.js';
import config from '../config.js'; // Import config
// ayaId2suraAya, nextAya are imported by functions that use these handlers (e.g. in telegramBot.js) and passed as Fn dependencies
// import { getQuranData, ayaId2suraAya, nextAya } from '../quranService.js'; // Not needed directly here
// import { setFavReciter } from '../database.js'; // Not needed directly here

export function initializeActionHandlers(/*dependencies*/) {
    // Removed unused parameter
    logger('Action handlers initialized with dependencies (or rather, this function is a placeholder).');
}

/**
 * Handles the 'groupkhatma' callback query for selecting a Juz.
 * @async
 * @export
 * @param {import('telegraf').Context} ctx - The Telegraf context object.
 * @param {object} dependencies - Dependencies object.
 * @param {function} dependencies.khatmaUpdateFn - The khatmaUpdate function.
 */
export async function handleGroupKhatmaAction(ctx, { khatmaUpdateFn }) {
    let callbackData;
    try {
        callbackData = JSON.parse(ctx.update.callback_query.data);
    } catch (parseError) {
        logger('groupkhatma action: Failed to parse callback_data', parseError);
        ctx.answerCbQuery('Error processing your request.').catch((e) =>
            logger('groupkhatma action: CbQ error on parse fail', e)
        );
        return;
    }

    const juz = callbackData.groupkhatma;
    if (typeof juz !== 'number' || juz < 1 || juz > 30) {
        logger(
            'groupkhatma action: Invalid Juz number in callback.',
            new Error(`Data: ${JSON.stringify(callbackData)}`)
        );
        ctx.answerCbQuery('Error: Invalid Juz number.').catch((e) =>
            logger('groupkhatma action: CbQ error on invalid Juz', e)
        );
        return;
    }

    const updatedText = khatmaUpdateFn({
        userId: ctx.from.id,
        firstName: ctx.from.first_name || `User${ctx.from.id}`,
        currentText: ctx.update.callback_query.message.text,
        currentEntities: ctx.update.callback_query.message.entities,
        juz: juz,
    });

    if (updatedText === false) {
        return ctx
            .answerCbQuery(`هذا الجزء هو اختيارك الحالي بالفعل ⚠️\n\n⚠️ This Juz is already your current selection.`, {
                show_alert: true,
            })
            .catch((e) => logger('Error CBQ khatma no change:', e));
    }

    try {
        await ctx.editMessageText(updatedText, {
            parse_mode: 'HTML',
            reply_markup: ctx.update.callback_query.message.reply_markup,
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
}

/**
 * Handles the 'recitersNavPage' callback query for reciter list navigation.
 * @async
 * @export
 * @param {import('telegraf').Context} ctx - The Telegraf context object.
 * @param {object} dependencies - Dependencies object.
 * @param {object} dependencies.botTelegram - The `bot.telegram` object.
 * @param {function} dependencies.recitersNavPageFn - The `recitersNavPage` helper function.
 * @param {function} dependencies.helperAdminProtectedAction - The admin protection wrapper.
 */
export async function handleRecitersNavPageAction(ctx, { botTelegram, recitersNavPageFn, helperAdminProtectedAction }) {
    await helperAdminProtectedAction(ctx, botTelegram, async (adminCtx) => {
        let callbackData;
        try {
            callbackData = JSON.parse(adminCtx.update.callback_query.data);
        } catch (e) {
            logger('recitersNavPage (action): Failed to parse callback_data', e);
            adminCtx
                .answerCbQuery('Error processing request.')
                .catch((eAns) => logger('recitersNavPage (action): Error answering CBQ on parse fail', eAns));
            return;
        }

        const requestedRecitersNavPage = callbackData.recitersNavPage;
        if (typeof requestedRecitersNavPage !== 'number') {
            logger(
                'recitersNavPage (action): requestedRecitersNavPage is not a number.',
                new Error(`Callback data: ${JSON.stringify(callbackData)}`)
            );
            adminCtx
                .answerCbQuery('Error: Invalid page number.')
                .catch((eAns) => logger('recitersNavPage (action): Error answering CBQ on invalid page type', eAns));
            return;
        }

        logger(`recitersNavPage (action): Navigating to page ${requestedRecitersNavPage}`);
        try {
            const newKeyboard = recitersNavPageFn(requestedRecitersNavPage);
            await adminCtx.editMessageReplyMarkup({ inline_keyboard: newKeyboard });
            adminCtx
                .answerCbQuery()
                .catch((eAns) =>
                    logger('recitersNavPage (action): Error answering CBQ post-edit (non-critical)', eAns)
                );
        } catch (e) {
            logger('recitersNavPage (action): Error editing message reply markup', e);
            adminCtx
                .answerCbQuery('Error updating list.')
                .catch((eAns) => logger('recitersNavPage (action): Error answering CBQ on edit error', eAns));
        }
    });
}

/**
 * Handles the 'instructionsAction' callback query.
 * @async
 * @export
 * @param {import('telegraf').Context} ctx - The Telegraf context object.
 * @param {object} dependencies - Dependencies object.
 * @param {object} dependencies.botTelegram - The `bot.telegram` object.
 * @param {function} dependencies.helperAdminProtectedAction - The admin protection wrapper.
 * @param {function} dependencies.instructionsFn - The function to send instructions.
 */
export async function handleInstructionsAction(ctx, { botTelegram, helperAdminProtectedAction, instructionsFn }) {
    await helperAdminProtectedAction(ctx, botTelegram, (adminCtx) => instructionsFn(adminCtx.chat.id));
}

/**
 * Handles the 'surpriseAyaAction' callback query.
 * @async
 * @export
 * @param {import('telegraf').Context} ctx - The Telegraf context object.
 * @param {object} dependencies - Dependencies object.
 * @param {object} dependencies.botTelegram - The `bot.telegram` object.
 * @param {function} dependencies.helperAdminProtectedAction - The admin protection wrapper.
 * @param {function} dependencies.surpriseAyaFn - The `surpriseAya` function.
 */
export async function handleSurpriseAyaAction(ctx, { botTelegram, helperAdminProtectedAction, surpriseAyaFn }) {
    await helperAdminProtectedAction(ctx, botTelegram, surpriseAyaFn);
}

/**
 * Handles the 'currAya' callback query for navigating to the next Aya.
 * @async
 * @export
 * @param {import('telegraf').Context} ctx - The Telegraf context object.
 * @param {object} dependencies - Dependencies object.
 * @param {object} dependencies.botTelegram - The `bot.telegram` object.
 * @param {object} dependencies.botOptions - The `bot.options` object.
 * @param {function} dependencies.helperAdminConditionalAction - The admin conditional wrapper.
 * @param {function} dependencies.sendAyaFn - The main `sendAya` function.
 * @param {function} dependencies.nextAyaFn - The `nextAya` helper from quranService.
 * @param {function} dependencies.ayaId2suraAyaFn - The `ayaId2suraAya` helper from quranService.
 */
export async function handleCurrAyaAction(
    ctx,
    { botTelegram, botOptions, helperAdminConditionalAction, sendAyaFn, nextAyaFn, ayaId2suraAyaFn }
) {
    const callbackData = JSON.parse(ctx.update.callback_query.data);
    await helperAdminConditionalAction(
        ctx,
        botTelegram,
        async (adminCtx) => {
            logger(`Next Aya after ${callbackData.currAya} by ${callbackData.r} for chat ${adminCtx.chat.id}`);
            await sendAyaFn(
                adminCtx.chat.id,
                nextAyaFn(callbackData.currAya),
                callbackData.r,
                adminCtx.from?.language_code,
                'next',
                false
            );
        },
        async (_nonAdminCtx) => {
            const ayaIndex = ayaId2suraAyaFn(nextAyaFn(callbackData.currAya));
            return `t.me/${botOptions.username || 'DailyAyaBot'}?start=${ayaIndex.sura}-${ayaIndex.aya}`;
        },
        false,
        `t.me/${botOptions.username || 'DailyAyaBot'}?start=${ayaId2suraAyaFn(nextAyaFn(callbackData.currAya)).sura}-${ayaId2suraAyaFn(nextAyaFn(callbackData.currAya)).aya}`
    );
}

/**
 * Handles the 'aMenu' callback query for toggling the Aya menu.
 * @async
 * @export
 * @param {import('telegraf').Context} ctx - The Telegraf context object.
 * @param {object} dependencies - Dependencies object.
 * @param {object} dependencies.botTelegram - The `bot.telegram` object.
 * @param {object} dependencies.botOptions - The `bot.options` object.
 * @param {function} dependencies.helperAdminProtectedAction - The admin protection wrapper.
 * @param {function} dependencies.helperAMenuButtonsFn - The `helperAMenuButtons` function from botHelpers.
 * @param {function} dependencies.ayaId2suraAyaFn - The `ayaId2suraAya` helper from quranService.
 */
export async function handleAMenuAction(
    ctx,
    { botTelegram, botOptions, helperAdminProtectedAction, helperAMenuButtonsFn, ayaId2suraAyaFn }
) {
    await helperAdminProtectedAction(ctx, botTelegram, async (adminCtx) => {
        const callbackData = JSON.parse(adminCtx.update.callback_query.data);
        const menu = callbackData.aMenu.includes('1')
            ? callbackData.aMenu.replace('1', '0')
            : callbackData.aMenu.replace('0', '1');
        const buttons = helperAMenuButtonsFn(
            menu,
            callbackData.a,
            callbackData.r,
            botOptions.username,
            ayaId2suraAyaFn
        );
        try {
            await adminCtx.editMessageReplyMarkup(buttons);
        } catch (e) {
            logger(`Warning: Error toggling aMenu (MESSAGE_ID_INVALID or other non-critical): `, e);
        }
    });
}

/**
 * Handles the 'recite' callback query for Aya recitation.
 * @async
 * @export
 * @param {import('telegraf').Context} ctx - The Telegraf context object.
 * @param {object} dependencies - Dependencies object.
 * @param {object} dependencies.botTelegram - The `bot.telegram` object.
 * @param {object} dependencies.botOptions - The `bot.options` object.
 * @param {function} dependencies.helperAdminConditionalAction - The admin conditional wrapper.
 * @param {function} dependencies.sendAyaRecitationFn - The `sendAyaRecitation` function.
 * @param {function} dependencies.ayaId2suraAyaFn - The `ayaId2suraAya` helper from quranService.
 */
export async function handleReciteAction(
    // ctx, // Old first argument (raw Telegraf context)
    // New first argument: an object with extracted data
    { chatId, fromId, messageId, callbackQueryData, rawCtx },
    // Dependencies remain the second argument
    dependencies // This now contains botTelegram, botOptions, etc. directly
) {
    // console.log('[handleReciteAction SUT ENTRY] typeof dependencies:', typeof dependencies, 'Keys:', dependencies ? Object.keys(dependencies) : 'N/A'); // Removed diagnostic log
    if (config.debugging) {
        console.log(
            `DEBUG: handleReciteAction --- ENTRY --- chatId: ${chatId}, fromId: ${fromId}, cbData: ${JSON.stringify(callbackQueryData)}`
        );
    }

    // callbackData is already parsed and passed as callbackQueryData
    // const callbackData = JSON.parse(ctx.update.callback_query.data); // Old way

    // helperAdminConditionalAction will be refactored to take primitives.
    // For now, it still expects a ctx-like object for adminChecker and answerCbQuery.
    // We pass rawCtx for that.

    // Construct fullSenderDeps here, in the direct scope of `dependencies`
    const fullSenderDeps = {
        botTelegram: dependencies.botTelegram,
        botUsername: dependencies.botOptions?.username,
        isValidReciterFn: dependencies.isValidReciterFn,
        getRecitationFn: dependencies.getRecitationFn,
        getFavReciterDbFn: dependencies.getFavReciterDbFn,
        getRandomReciterIdentifierFn: dependencies.getRandomReciterIdentifierFn,
        // helperSuccessSendFn is not used by sendAyaRecitationFn
        helperSendSorryFn: dependencies.helperSendSorryFn,
        helperAMenuButtonsFn: dependencies.helperAMenuButtonsFn,
        ayaId2suraAyaFn: dependencies.ayaId2suraAyaFn, // Added missing dependency
        lastAyaTimeDbFn: dependencies.lastAyaTimeDbFn, // Added missing dependency
    };

    const adminFn = async () => {
        // Takes no arguments, relies on closure
        if (!chatId) {
            // Uses chatId from handleReciteAction's parameters
            logger('Button reciter: CHAT_ID IS MISSING (in handleReciteAction adminFn). Cannot send recitation.');
            if (rawCtx && typeof rawCtx.answerCbQuery === 'function') {
                await rawCtx
                    .answerCbQuery('Error: Chat ID missing.', { show_alert: true })
                    .catch((e) => logger('Error answering CBQ for missing chatId in adminFn:', e));
            }
            return;
        }
        logger(`Button reciter: ${callbackQueryData.r} for Aya ${callbackQueryData.recite} in chat ${chatId}`);

        // adminFn now uses the pre-constructed fullSenderDeps from its closure
        await dependencies.sendAyaRecitationFn(
            // This is sendAyaRecitationFn from outer `dependencies`
            fullSenderDeps, // Pass the pre-constructed object
            chatId,
            messageId,
            fromId,
            callbackQueryData.recite,
            callbackQueryData.r
        );
    };

    await dependencies.helperAdminConditionalAction(
        // Use dependencies.helperAdminConditionalAction
        rawCtx,
        dependencies.botTelegram, // Use dependencies.botTelegram
        adminFn,
        async () => {
            // nonAdminCb
            const ayaIndex = dependencies.ayaId2suraAyaFn(callbackQueryData.recite);
            return `t.me/${dependencies.botOptions?.username || 'DailyAyaBot'}?start=r${ayaIndex.sura}-${ayaIndex.aya}`;
        },
        false,
        (() => {
            // nonAdminUrl
            const ayaIndex = dependencies.ayaId2suraAyaFn(callbackQueryData.recite);
            return `t.me/${dependencies.botOptions?.username || 'DailyAyaBot'}?start=r${ayaIndex.sura}-${ayaIndex.aya}`;
        })()
    );
}

/**
 * Handles the 'setReciter' callback query.
 * @async
 * @export
 * @param {import('telegraf').Context} ctx - The Telegraf context object.
 * @param {object} dependencies - Dependencies object.
 * @param {object} dependencies.botTelegram - The `bot.telegram` object.
 * @param {function} dependencies.helperAdminProtectedAction - The admin protection wrapper.
 * @param {function} dependencies.dbSetFavReciter - The `setFavReciter` database function.
 * @param {function} dependencies.getQuranDataFn - Function to get Quran data (for reciter names).
 * @param {object} dependencies.TelegrafMarkup - The Telegraf Markup object.
 */
export async function handleSetReciterAction(
    ctx,
    { botTelegram, helperAdminProtectedAction, dbSetFavReciter, getQuranDataFn, TelegrafMarkup }
) {
    await helperAdminProtectedAction(ctx, botTelegram, async (adminCtx) => {
        const callbackData = JSON.parse(adminCtx.update.callback_query.data);
        const requestedFavReciter = callbackData.setReciter;
        const qData = getQuranDataFn();

        const result = await dbSetFavReciter(adminCtx.chat.id, requestedFavReciter);
        let replyMsg;
        if (result.success) {
            if (requestedFavReciter === 'surprise') {
                replyMsg = `سيتم تغيير القارئ مع كل آية مفاجئة.\n\nReciter will be changed with each surprise Aya.`;
            } else {
                const reciterData = qData.arReciters.find((r) => r.identifier === requestedFavReciter);
                replyMsg = reciterData
                    ? `القارئ المفضل الحالي: ${reciterData.name}\n\nCurrent Favorit Reciter: ${reciterData.englishName}`
                    : `Favorite reciter set to: ${requestedFavReciter}`;
            }
        } else {
            replyMsg = `عذرا.. نواجه مشكلة أثناء حفظ القارئ المفضل ونأمل حلها قريبا.\n\nSorry.. There's an issue while setting favorite reciters and we hope it gets fixed soon.`;
        }
        const inlineKeyboard = callbackData.a
            ? [[TelegrafMarkup.button.callback('🎁', JSON.stringify({ surpriseAyaAction: true, a: callbackData.a }))]]
            : [[TelegrafMarkup.button.callback('🎁', JSON.stringify({ surpriseAyaAction: true }))]];

        await adminCtx
            .reply(replyMsg, TelegrafMarkup.inlineKeyboard(inlineKeyboard))
            .catch((e) => logger('Error replying to setReciter action:', e));
    });
}
