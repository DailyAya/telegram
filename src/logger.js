import config from './config.js';
import { sendEmergencyNotification } from './utils.js';

class Logger {
    constructor() {
        this.botInstance = null;
    }

    setBotInstance(bot) {
        this.botInstance = bot;
        this.log('Logger: Bot instance received.');
    }

    log(message, error) {
        const timestamp = new Date().toISOString();
        if (error === undefined) {
            if (config.debugging) {
                console.log(`[${timestamp}] ${message}`);
            }
        } else {
            const isTelegramError = error && error.response && typeof error.response.description === 'string';
            let isBenignTelegramError = false;
            let benignReason = '';

            if (isTelegramError) {
                const errorCode = error.response.error_code;
                const errorDesc = error.response.description.toLowerCase();
                const blockKeywords =
                    /blocked by the user|user is deactivated|chat not found|bot was kicked from the group chat|bot was blocked by the user|group chat was deleted|chat not found|user not found|member is deactivated/;

                if (errorCode === 403 || errorCode === 400) {
                    if (blockKeywords.test(errorDesc)) {
                        isBenignTelegramError = true;
                        benignReason = errorDesc;
                    }
                }
            }

            if (isBenignTelegramError) {
                if (config.debugging) {
                    console.log(
                        `[${timestamp}] Logger: Benign Telegram error for message "${message}": ${benignReason}. Error object:`,
                        error
                    );
                }
            } else {
                let errorString;
                if (error instanceof Error) {
                    errorString = error.stack || error.message;
                } else if (typeof error === 'object' && error !== null) {
                    errorString = JSON.stringify(error, Object.getOwnPropertyNames(error), 2);
                } else {
                    errorString = String(error);
                }
                console.error(`[${timestamp}] ${message}`, errorString);

                if (this.botInstance && config.devChatId) {
                    const logEntry = `${message} ${errorString}`;
                    const truncatedMessage = logEntry.substring(0, 4096);

                    this.botInstance.telegram.sendMessage(config.devChatId, truncatedMessage).catch((sendErr) => {
                        console.error('Logger: CRITICAL - Failed to send log message to Telegram:', sendErr);
                    });
                } else if (!this.botInstance) {
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

    bootstrap(message, error) {
        this.log(message, error);
    }
}

const logger = new Logger();
export default logger;
