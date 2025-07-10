// src/botHelpers.js
import { logger } from './logger.js';

// --- Constants ---
export const NON_ADMINS_ALERT = `عذرا، هذه الخاصية في المجموعات والقنوات متاحة للمشرفين فقط.\n\nSorry, this feature in groups and channels is only available for admins.`;

// --- Helper Functions ---

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
        if (
            error.response &&
            typeof error.response.description === 'string' &&
            error.response.description.includes('CHAT_ADMIN_REQUIRED')
        ) {
            logger(
                `adminChecker: Bot lacks admin rights in chat ${ctx.chat.id} to check member status for user ${ctx.from.id}. Assuming user is not admin for this check.`
            );
        } else {
            logger(
                `Error in adminChecker while calling getChatMember for chat ${ctx.chat.id}, user ${ctx.from.id}:`,
                error
            );
        }
        return false;
    }
}

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

export async function sendSorry(botTelegram, chatId, reason) {
    let msg;
    switch (reason) {
        case 'audio':
            msg = `عذرا.. نواجه مشكلة في الملفات الصوتية ونأمل إصلاحها قريبا.\n\nSorry.. There's an issue in audio files and we hope it gets fixed soon.`;
            break;
        case 'text':
            msg = `عذرا.. نواجه مشكلة في نصوص الآيات ونأمل إصلاحها قريبا.\n\nSorry.. There's an issue in Aya texts and we hope it gets fixed soon.`;
            break;
        default:
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

export function aMenuButtons(menuState, ayaId, reciter, botUsername, ayaId2suraAyaFn) {
    if (!botUsername) {
        logger('aMenuButtons: botUsername is not set. Using default.', new Error('botUsername missing'));
        botUsername = 'DailyAyaBot';
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

export async function sendUnrecognizedMessage(ctx, reason, botTelegram) {
    const chatId = ctx.chat.id;
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

export async function helperAdminProtectedAction(ctx, botTelegram, actionFn, alertIfNotAdmin = true) {
    const isUserAdmin = await adminChecker(ctx, botTelegram);
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
        logger('Error in helperAdminProtectedAction executing actionFn:', error);
        await ctx
            .answerCbQuery('An error occurred.', { show_alert: true })
            .catch((e) => logger('Error answering CBQ after actionFn error:', e));
    }
}

export async function helperAdminConditionalAction(
    ctx, // This is the raw Telegraf context passed by callers
    botTelegram,
    adminFn,
    nonAdminCb,
    nonAdminAlert = false,
    nonAdminUrl = null
) {
    // adminChecker will use the passed `ctx`.
    const isUserAdmin = await adminChecker(ctx, botTelegram);

    if (isUserAdmin) {
        try {
            // Pass the original `ctx` to adminFn.
            // The adminFn (e.g., in handleReciteAction) is now designed to use primitives
            // from its closure if possible, or this `ctx` if it needs Telegraf methods.
            await adminFn(ctx);
            await ctx
                .answerCbQuery()
                .catch((e) => logger('Error answering CBQ after admin fn in conditional:', e.message));
        } catch (error) {
            logger('Error in helperAdminConditionalAction executing adminFn:', error);
            await ctx
                .answerCbQuery('An error occurred.', { show_alert: true })
                .catch((e) => logger('Error answering CBQ after adminFn error in conditional:', e.message));
        }
    } else {
        // Pass the original `ctx` to nonAdminCb.
        const urlToOpen = nonAdminUrl || (typeof nonAdminCb === 'function' ? await nonAdminCb(ctx) : null);
        if (urlToOpen) {
            await ctx
                .answerCbQuery(nonAdminAlert ? NON_ADMINS_ALERT : '', { url: urlToOpen })
                .catch((e) => logger('Error answering CBQ with URL for non-admin:', e.message));
        } else {
            await ctx
                .answerCbQuery(nonAdminAlert ? NON_ADMINS_ALERT : '', { show_alert: nonAdminAlert })
                .catch((e) => logger('Error answering CBQ for non-admin (no URL):', e.message));
        }
    }
}
