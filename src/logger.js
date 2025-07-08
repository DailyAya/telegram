import config from './config.js';
import { sendEmergencyNotification } from './utils.js';

/**
 * @module logger
 * @description Provides logging functionalities, including conditional console logging
 * based on debug status and sending error logs to a Telegram development chat.
 * It also offers a bootstrap logger for early application stages.
 */

/** @type {import('telegraf').Telegraf | null} */
let botInstance = null;

/**
 * Sets the Telegraf bot instance for the logger to use for sending messages.
 * This should be called once the bot is initialized.
 * @function setBotInstance
 * @param {import('telegraf').Telegraf} bot - The Telegraf bot instance.
 */
export function setBotInstance(bot) {
    botInstance = bot;
    // Use console.log directly here as this is part of the logger's own setup
    console.log('Logger: Bot instance received.');
}

/**
 * Logs a message. If an error is provided, it logs as an error and attempts
 * to send the error details to the Telegram development chat (if configured and bot instance is set).
 * Informational messages are logged to the console only if debugging is enabled.
 * @function logger
 * @param {string} message - The message to log.
 * @param {Error|any} [error] - Optional error object or additional details. If provided, the log is treated as an error.
 */
export function logger(message, error) {
    if (error === undefined) {
        // Informational message
        if (config.debugging) {
            console.log(message);
        }
    } else {
        // Check if it's a known "user blocked or deactivated" TelegramError
        // Telegraf errors often have `error.response.error_code` and `error.response.description`
        const isTelegramError = error && error.response && typeof error.response.description === 'string';
        let isBenignTelegramError = false;
        let benignReason = '';

        if (isTelegramError) {
            const errorCode = error.response.error_code;
            const errorDesc = error.response.description.toLowerCase();
            const blockKeywords =
                /blocked by the user|user is deactivated|chat not found|bot was kicked from the group chat|bot was blocked by the user|group chat was deleted|chat not found|user not found|member is deactivated/;

            if (errorCode === 403 || errorCode === 400) {
                // 403 Forbidden, 400 Bad Request (sometimes used for these)
                if (blockKeywords.test(errorDesc)) {
                    isBenignTelegramError = true;
                    benignReason = errorDesc;
                }
            }
        }

        if (isBenignTelegramError) {
            // Log benign errors to console (if debugging) but not to dev chat
            if (config.debugging) {
                console.log(
                    `Logger: Benign Telegram error for message "${message}": ${benignReason}. Error object:`,
                    error
                );
            }
        } else {
            // Regular error handling for other errors
            console.error(message, error); // Always log errors to console
            if (botInstance && config.devChatId) {
                let errorString;
                if (error instanceof Error) {
                    errorString = error.stack || error.message;
                } else if (typeof error === 'object' && error !== null) {
                    errorString = JSON.stringify(error, Object.getOwnPropertyNames(error), 2);
                } else {
                    errorString = String(error);
                }

                const logEntry = `${message} ${errorString}`;
                const truncatedMessage = logEntry.substring(0, 4096); // Telegram message limit

                botInstance.telegram.sendMessage(config.devChatId, truncatedMessage).catch((sendErr) => {
                    console.error('Logger: CRITICAL - Failed to send log message to Telegram:', sendErr);
                });
            } else if (!botInstance) {
                console.warn(
                    'Logger: Bot instance not set. Cannot send log to Telegram. Error details:',
                    message,
                    error
                );
            } else if (!config.devChatId) {
                console.warn(
                    'Logger: devChatId not configured. Cannot send log to Telegram. Error details:',
                    message,
                    error
                );
            }
        }
    }
}

/**
 * A simple logger for use during application bootstrap, before the main logger (and bot)
 * might be fully initialized. Prepends a timestamp and "BOOTSTRAP" label.
 * @function bootstrapLogger
 * @param {string} message - The message to log.
 * @param {Error|any} [error] - Optional error object or additional details.
 */
export function bootstrapLogger(message, error) {
    const timestamp = new Date().toISOString();
    if (error === undefined) {
        console.log(`[${timestamp}] ${message}`); // Prefix removed
    } else {
        let errorString;
        if (error instanceof Error) {
            errorString = error.stack || error.message;
        } else if (typeof error === 'object' && error !== null) {
            // Handle cases like error objects from axios that might not be instanceof Error
            // but have useful properties like message, stack, config, request, response.
            errorString = JSON.stringify(error, Object.getOwnPropertyNames(error), 2);
        } else {
            errorString = String(error);
        }
        console.error(`[${timestamp}] ${message}`, errorString); // Prefix removed

        if (config.devChatId && config.telegramToken) {
            // Sanitize and shorten the message for Telegram to avoid hitting limits easily
            let emergencyMessage = `[BOOTSTRAP ERROR] ${message}
`;
            if (error instanceof Error) {
                emergencyMessage += `${error.name}: ${error.message}`;
            } else if (typeof error === 'object' && error !== null) {
                emergencyMessage += JSON.stringify(error);
            } else {
                emergencyMessage += String(error);
            }
            if (emergencyMessage.length > 1000) {
                // Keep it reasonably short
                emergencyMessage = emergencyMessage.substring(0, 1000) + '...';
            }
            sendEmergencyNotification(emergencyMessage).catch((e) => {
                // Log if the emergency send itself fails, but don't do more.
                console.error('Emergency notification dispatch itself failed:', e.message);
            });
        }
    }
}
