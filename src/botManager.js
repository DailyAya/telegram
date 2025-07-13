import { Telegraf } from 'telegraf';
import https from 'https';
import config from './config.js';
import { logger, setBotInstance as setLoggerBotInstance, bootstrapLogger } from './logger.js'; // Renamed setBotInstance to avoid conflict

let bot = null;
let botUsernameReadyPromise = null;
let botUsernamePromiseResolve = null;
let isInitialized = false;

/**
 * Initializes the Telegraf bot instance, sets up the getMe call,
 * and prepares a promise for when the bot's username is known.
 * This function ensures the bot is only initialized once.
 *
 * @returns {{bot: import('telegraf').Telegraf, botUsernameReady: Promise<string|null>}}
 *          An object containing the bot instance and a promise that resolves with the bot's username or null.
 */
export function initializeBot() {
    if (isInitialized && bot && botUsernameReadyPromise) {
        bootstrapLogger('[BOT_MANAGER] initializeBot: Already initialized.');
        return { bot, botUsernameReady: botUsernameReadyPromise };
    }

    // Ensure promise is created so it can be resolved even if instantiation fails
    botUsernameReadyPromise = new Promise((resolve) => {
        botUsernamePromiseResolve = resolve;
    });
    isInitialized = true; // Mark as initialized to prevent re-entry for this attempt path

    try {
        bootstrapLogger('[BOT_MANAGER] Initializing Telegraf bot...');
        const agent = new https.Agent({ timeout: 60000 });
        bootstrapLogger(
            `[BOT_MANAGER] Telegraf HTTPS agent configured. Token: ${config.telegramToken ? config.telegramToken.substring(0, 6) + '...' : 'NOT_SET'}`
        );

        bot = new Telegraf(config.telegramToken, { telegram: { agent } });
        setLoggerBotInstance(bot); // Pass the bot instance to the logger (assuming logger handles null bot if necessary)

        bootstrapLogger(
            `[BOT_MANAGER] Attempting bot.telegram.getMe() with token from config: ${config.telegramToken ? config.telegramToken.substring(0, 6) + '...' : 'NOT_SET'}`
        );
        bot.telegram
            .getMe()
            .then((botInfo) => {
                if (botInfo && botInfo.username) {
                    bot.options.username = botInfo.username;
                    bootstrapLogger(
                        `[BOT_MANAGER] bot.telegram.getMe() successful. Bot username set to: ${bot.options.username}`
                    );
                    if (botUsernamePromiseResolve) {
                        botUsernamePromiseResolve(botInfo.username);
                    }
                } else {
                    // Ensure bot.options.username is not set if getMe response is not as expected
                    if (bot && bot.options) bot.options.username = undefined;
                    bootstrapLogger(
                        '[BOT_MANAGER] bot.telegram.getMe() did not return expected botInfo or username.',
                        botInfo || 'botInfo is null/undefined'
                    );
                    if (botUsernamePromiseResolve) {
                        botUsernamePromiseResolve(null);
                    }
                }
            })
            .catch((err) => {
                if (bot && bot.options) bot.options.username = undefined;
                bootstrapLogger(`[BOT_MANAGER] CRITICAL - bot.telegram.getMe() failed. Error:`, err);
                if (err.response && err.response.description) {
                    bootstrapLogger(
                        `[BOT_MANAGER] getMe() failure details - Code: ${err.code}, Description: ${err.response.description}, Parameters: ${JSON.stringify(err.response.parameters)}`
                    );
                }
                if (err.response && err.response.data) {
                    bootstrapLogger(
                        `[BOT_MANAGER] getMe() failure - err.response.data: ${JSON.stringify(err.response.data)}`
                    );
                }
                if (botUsernamePromiseResolve) {
                    botUsernamePromiseResolve(null); // Resolve with null if getMe() failed
                }
            });
    } catch (instantiationError) {
        bootstrapLogger(`[BOT_MANAGER] CRITICAL: Failed to initialize Telegraf bot instance`, instantiationError);
        bot = null; // Ensure bot is null if instantiation failed
        if (botUsernamePromiseResolve) {
            botUsernamePromiseResolve(null); // Resolve the promise with null
        }
        // isInitialized is true, but bot is null, promise resolves to null.
    }

    bootstrapLogger('[BOT_MANAGER] Bot initialization sequence attempt complete.');
    return { bot, botUsernameReady: botUsernameReadyPromise };
}

/**
 * Returns the existing bot instance. Throws an error if initializeBot hasn't been called.
 * @returns {import('telegraf').Telegraf} The bot instance.
 */
export function getBotInstance() {
    if (!bot) {
        // Use module-scoped 'bot'
        logger(
            '[BOT_MANAGER] getBotInstance: initializeBot() must be called before getting the bot instance.',
            new Error('Bot not initialized')
        );
        throw new Error('Bot not initialized. Call initializeBot() first.');
    }
    return bot; // Use module-scoped 'bot'
}

/**
 * Returns the promise that resolves when the bot's username is known. Throws an error if initializeBot hasn't been called.
 * @returns {Promise<string|null>} The promise for the bot's username.
 */
export function getBotUsernameReadyPromise() {
    if (!botUsernameReadyPromise) {
        logger(
            '[BOT_MANAGER] getBotUsernameReadyPromise: initializeBot() must be called first.',
            new Error('Bot not initialized for username promise')
        );
        throw new Error('Bot not initialized for username promise. Call initializeBot() first.');
    }
    return botUsernameReadyPromise;
}

// Note: The directGetMeCheck function previously in telegramBot.js could be moved here
// or to a general utils/startupCheck module if still needed for independent pre-flight checks.
// For now, focusing on Telegraf's own getMe.
