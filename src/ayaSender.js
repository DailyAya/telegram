// src/ayaSender.js
import { logger } from './logger.js';
import config from './config.js'; // Import config

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
    let {
        // Changed const to let for botUsername
        botTelegram,
        botUsername, // Now mutable within this scope
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
        const msg = 'sendAyaText: botUsername is not available for prepareAya. Using fallback.';
        if (config.debugging) {
            logger(msg, new Error('botUsername missing for prepareAya'));
        } else {
            logger(msg);
        }
        botUsername = 'DailyAyaBot'; // Fallback
    }
    const preparedAya = prepareAyaFn(ayaId, botUsername); // Use botUsername which now has fallback

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
 * @param {number|string} chatId - The ID of the chat to send the recitation to.
 * @param {number|undefined} messageId - The ID of the message to potentially reply to or edit (optional).
 * @param {number|string|undefined} fromId - The ID of the user initiating the action (optional, for logging or future use).
 * @param {number} ayaId - The global ID of the Aya.
 * @param {string|null} reciterIdentifier - The preferred reciter identifier, or null.
 */
export async function sendAyaRecitation(dependencies, chatId, messageId, _fromId, ayaId, reciterIdentifier) {
    // _fromId is received but not used in the current logic beyond this point.
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

    // chatId is now a direct parameter. The following validation ensures it's usable.
    if (!chatId) {
        logger(`sendAyaRecitation: Received null or undefined chatId. Cannot send recitation.`, {
            ayaId,
            reciterIdentifier,
        });
        // Not sending helperSendSorry here as we don't have a chatId to send it to.
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

        // messageId is now a direct parameter. Use it.
        // const originalMessageId = ctx.message?.message_id || ctx.update?.callback_query?.message?.message_id; // Old way

        if (messageId) {
            // Check if messageId was provided
            if (sentAudioCtx.message_id === messageId + 1) {
                await botTelegram
                    .editMessageReplyMarkup(chatId, messageId, undefined, undefined)
                    .catch((e) => logger('Warning: Message not modified (remove markup text):', e));
                await botTelegram
                    .editMessageReplyMarkup(chatId, sentAudioCtx.message_id, undefined, buttons)
                    .catch((e) => logger('Warning: Message not modified (add markup audio):', e));
            } else {
                await botTelegram
                    .deleteMessage(chatId, sentAudioCtx.message_id)
                    .catch((e) => logger('Warning: Message ID invalid (delete initial audio):', e));
                await botTelegram.sendAudio(chatId, recitationUrl, {
                    reply_to_message_id: messageId, // Use messageId here
                    caption: recitationCaption,
                    parse_mode: 'HTML',
                    disable_notification: true,
                    reply_markup: buttons,
                });
                await botTelegram
                    .editMessageReplyMarkup(chatId, messageId, undefined, undefined) // And here
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
