// src/ayaSender.js
import { logger } from './logger.js';

/**
 * @module ayaSender
 * @description Provides functions to send Ayas (text and audio) to users,
 * encapsulating the logic for message formatting and interaction with Telegraf API.
 */

/**
 * Sends the text part of an Aya (Arabic and English translation) to a chat.
 * Includes inline buttons for interaction.
 * @async
 * @export
 * @param {object} dependencies - Object containing all necessary functions and configs.
 * @param {object} dependencies.botTelegram - The bot.telegram object from Telegraf.
 * @param {string} dependencies.botUsername - The bot.options.username.
 * @param {function} dependencies.prepareAyaFn - The prepareAya function from quranService.
 * @param {function} dependencies.helperSendSorryFn - The helperSendSorry function from botHelpers.
 * @param {function} dependencies.helperAMenuButtonsFn - The helperAMenuButtons function from botHelpers.
 * @param {function} dependencies.helperSuccessSendFn - The helperSuccessSend function from botHelpers.
 * @param {function} dependencies.lastAyaTimeDbFn - The lastAyaTime function from database.
 * @param {function} dependencies.ayaId2suraAyaFn - The ayaId2suraAya function from quranService.
 * @param {number|string} chatId - The ID of the chat to send the Aya to.
 * @param {number} ayaId - The global ID of the Aya.
 * @param {string|null} reciter - The identifier of the reciter (or null for default/random).
 * @param {string|undefined} lang - The language code of the user/chat.
 * @param {string} trigger - The trigger for sending the Aya.
 * @returns {Promise<import('telegraf/typings/core/types/typegram').Message.TextMessage | null>}
 */
export async function sendAyaText(dependencies, chatId, ayaId, reciter, lang, trigger) {
    const {
        botTelegram,
        botUsername,
        prepareAyaFn,
        helperSendSorryFn,
        helperAMenuButtonsFn,
        helperSuccessSendFn,
        lastAyaTimeDbFn,
        ayaId2suraAyaFn, // Added for helperAMenuButtonsFn
    } = dependencies;

    logger(`Formatting Aya ${ayaId} for chat ${chatId}`);
    const currentReciter = reciter || 'None';

    if (!botUsername) {
        logger('sendAyaText: botUsername is not available for prepareAya.', new Error('botUsername missing'));
        // Fallback or throw error, for now, prepareAyaFn might handle it
    }
    const preparedAya = prepareAyaFn(ayaId, botUsername || 'DailyAyaBot');

    if (preparedAya.arText.startsWith('Error:')) {
        logger(`sendAyaText: Error preparing Aya ${ayaId}: ${preparedAya.arText}`);
        await helperSendSorryFn(botTelegram, chatId, 'text');
        return null;
    }

    const ayaDualText = `${preparedAya.arText}\n\n${preparedAya.enText}`;
    const buttons = helperAMenuButtonsFn('t0', ayaId, currentReciter, botUsername, ayaId2suraAyaFn);

    try {
        const sentMessageCtx = await botTelegram.sendMessage(chatId, ayaDualText, {
            disable_web_page_preview: true,
            disable_notification: true,
            parse_mode: 'HTML',
            reply_markup: buttons,
        });
        await helperSuccessSendFn(sentMessageCtx, ayaId, lang, trigger, lastAyaTimeDbFn);
        return sentMessageCtx;
    } catch (e) {
        logger(`Error in sendAyaText sending message to chat ${chatId} for Aya ${ayaId}:`, e);
        if (e.response && e.response.description && e.response.description.includes('upgraded to a supergroup')) {
            logger(`Chat ${chatId} upgraded to supergroup ${e.response.parameters.migrate_to_chat_id}. Retrying.`);
            await lastAyaTimeDbFn(chatId, 'blocked');
            // Recursive call needs to pass dependencies again
            return sendAyaText(dependencies, e.response.parameters.migrate_to_chat_id, ayaId, reciter, lang, trigger);
        }
        throw e;
    }
}

// sendAyaRecitation will be added next.

/**
 * Sends the audio recitation of an Aya to a chat.
 * @async
 * @export
 * @function sendAyaRecitation
 * @param {object} dependencies - Object containing all necessary functions and configs.
 * @param {object} dependencies.botTelegram - The bot.telegram object from Telegraf.
 * @param {string} dependencies.botUsername - The bot.options.username.
 * @param {function} dependencies.isValidReciterFn - The isValidReciter function from quranService.
 * @param {function} dependencies.getFavReciterDbFn - The getFavReciter function from database.
 * @param {function} dependencies.getRandomReciterIdentifierFn - The getRandomReciterIdentifier function from quranService.
 * @param {function} dependencies.helperSendSorryFn - The helperSendSorry function from botHelpers.
 * @param {function} dependencies.getRecitationFn - The getRecitation function from quranService.
 * @param {function} dependencies.ayaId2suraAyaFn - The ayaId2suraAya function from quranService.
 * @param {function} dependencies.helperAMenuButtonsFn - The helperAMenuButtons function from botHelpers.
 * @param {function} dependencies.lastAyaTimeDbFn - The lastAyaTime function from database.
 * @param {import('telegraf').Context} ctx - The Telegraf context object.
 * @param {number} ayaId - The global ID of the Aya.
 * @param {string|null} reciterIdentifier - The preferred reciter identifier, or null.
 */
export async function sendAyaRecitation(dependencies, ctx, ayaId, reciterIdentifier) {
    const {
        botTelegram,
        botUsername,
        isValidReciterFn,
        getFavReciterDbFn,
        getRandomReciterIdentifierFn,
        helperSendSorryFn,
        getRecitationFn,
        ayaId2suraAyaFn,
        helperAMenuButtonsFn,
        lastAyaTimeDbFn,
    } = dependencies;

    const chatId = ctx.chat?.id || ctx.update?.callback_query?.message?.chat?.id;
    if (!chatId) {
        logger('sendAyaRecitation: Could not determine chatId from context.', ctx);
        return;
    }

    let finalReciter = reciterIdentifier;
    if (!isValidReciterFn(reciterIdentifier)) {
        const favReciterResult = await getFavReciterDbFn(chatId);
        if (favReciterResult.success && isValidReciterFn(favReciterResult.data)) {
            finalReciter = favReciterResult.data;
        } else {
            finalReciter = getRandomReciterIdentifierFn();
            if (!finalReciter) {
                logger(
                    `sendAyaRecitation: Could not determine a valid reciter for chat ${chatId}.`,
                    new Error('No reciter available')
                );
                await helperSendSorryFn(botTelegram, chatId, 'audio');
                return;
            }
        }
    }
    logger(`sendAyaRecitation: Chat ${chatId} using reciter: ${finalReciter} for Aya ${ayaId}`);

    try {
        const recitationUrl = await getRecitationFn(ayaId, finalReciter);
        const suraAyaIndex = ayaId2suraAyaFn(ayaId);
        const recitationCaption = `<a href="t.me/${botUsername || 'DailyAyaBot'}?start=${suraAyaIndex.sura}-${suraAyaIndex.aya}">@${botUsername || 'DailyAyaBot'} ➔ ${suraAyaIndex.sura}:${suraAyaIndex.aya}</a>`;
        const buttons = helperAMenuButtonsFn('r0', ayaId, finalReciter, botUsername, ayaId2suraAyaFn);

        const sentAudioCtx = await botTelegram.sendAudio(chatId, recitationUrl, {
            caption: recitationCaption,
            parse_mode: 'HTML',
            disable_notification: true,
        });

        const originalMessageId = ctx.message?.message_id || ctx.update?.callback_query?.message?.message_id;

        if (originalMessageId) {
            if (sentAudioCtx.message_id === originalMessageId + 1) {
                await botTelegram
                    .editMessageReplyMarkup(chatId, originalMessageId, undefined, undefined)
                    .catch((e) => logger('Warning: Message not modified (remove markup text):', e));
                await botTelegram
                    .editMessageReplyMarkup(chatId, sentAudioCtx.message_id, undefined, buttons)
                    .catch((e) => logger('Warning: Message not modified (add markup audio):', e));
            } else {
                await botTelegram
                    .deleteMessage(chatId, sentAudioCtx.message_id)
                    .catch((e) => logger('Warning: Message ID invalid (delete initial audio):', e));
                await botTelegram.sendAudio(chatId, recitationUrl, {
                    reply_to_message_id: originalMessageId,
                    caption: recitationCaption,
                    parse_mode: 'HTML',
                    disable_notification: true,
                    reply_markup: buttons,
                });
                await botTelegram
                    .editMessageReplyMarkup(chatId, originalMessageId, undefined, undefined)
                    .catch((e) => logger('Warning: Message not modified (remove markup text reply):', e));
            }
        } else {
            await botTelegram
                .editMessageReplyMarkup(chatId, sentAudioCtx.message_id, undefined, buttons)
                .catch((e) => logger('Warning: Message not modified (add markup direct audio):', e));
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
                await lastAyaTimeDbFn(chatId, 'blocked');
            } else {
                await helperSendSorryFn(botTelegram, chatId, 'audio');
            }
        } else {
            await helperSendSorryFn(botTelegram, chatId, 'audio');
        }
    }
}
