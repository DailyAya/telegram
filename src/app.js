import os from 'os';
import config from './config.js';
import { logger, bootstrapLogger } from './logger.js';
import { connectDB, getDB } from './database.js';
import { startExpressServer } from './expressApp.js';
import { launchBot, bot, sendAya as sendAyaFromBot } from './telegramBot.js';

/**
 * @module app
 * @description This is the main entry point for the DailyAya Telegram Bot application.
 * It handles the initialization of all services, starts the Telegram bot and Express server,
 * sets up the timer for sending daily Ayas, and manages graceful shutdown of the application.
 */

// --- Initial Logging ---
bootstrapLogger(`Number of CPUs: ${os.cpus().length}`);
bootstrapLogger(`Starting DailyAya Telegram Bot - Version ${config.codeVer}`);

// --- Timer Logic ---
/**
 * Interval ID for the timer that periodically calls {@link runTimerSend}.
 * Used to clear the interval on graceful shutdown.
 * @private
 * @type {NodeJS.Timeout|null}
 */
let timerIntervalId = null;

/**
 * Fetches chats eligible for a timed Aya from the database and sends an Aya to each.
 * This function is executed periodically by a timer. It calculates the eligibility
 * based on `config.timerSendHours` and `config.timerCheckMinutes`.
 * Ayas are sent with a delay between each to avoid rate limiting.
 * @async
 * @private
 * @function runTimerSend
 */
async function runTimerSend() {
    bootstrapLogger('runTimerSend: Cycle started.');
    const sendMillisThreshold = config.timerSendHours * 60 * 60 * 1000 - config.timerCheckMinutes * 60 * 1000;

    try {
        const db = getDB();
        if (!db) {
            logger('runTimerSend: Database not available, skipping cycle.');
            return;
        }

        const chats = await db
            .collection('chats')
            .find({
                lastAyaTime: { $lte: Date.now() - sendMillisThreshold },
                blocked: false,
            })
            .toArray();

        if (chats.length > 0) {
            logger(`Timer: Found ${chats.length} chats to send Aya to.`);
        } else {
            logger(`Timer: No chats eligible for a timed Aya in this cycle.`);
        }

        for (let i = 0; i < chats.length; i++) {
            const chat = chats[i];
            const delay = i * (config.debugging ? 1000 : 5000);

            setTimeout(async () => {
                try {
                    logger(
                        `Timer: Attempting to send Aya to chat ${chat.chatId} (FavReciter: ${chat.favReciter || 'surprise'})`
                    );
                    await sendAyaFromBot(chat.chatId, null, chat.favReciter, null, 'timer', true);
                } catch (e) {
                    logger(`Timer: Error sending Aya to chat ${chat.chatId} individually:`, e);
                }
            }, delay);
        }
    } catch (e) {
        logger('runTimerSend: General error during timer cycle:', e);
    }
}

// --- Graceful Shutdown ---
/**
 * Handles graceful shutdown of the application upon receiving termination signals.
 * It clears the timer interval, stops the Telegram bot, and exits the process.
 * @async
 * @private
 * @function sigHandler
 * @param {string} signal - The signal received (e.g., 'SIGTERM', 'SIGINT').
 */
async function sigHandler(signal) {
    bootstrapLogger(
        `Exiting due to ${signal} after ${+(process.uptime() / 3600).toFixed(2)} hours. Memory: ${Math.floor(process.memoryUsage().rss / (1024 * 1024))} MB`
    );

    if (timerIntervalId) {
        clearInterval(timerIntervalId);
        bootstrapLogger('Timer interval cleared.');
    }

    if (bot && typeof bot.stop === 'function') {
        bootstrapLogger('Stopping Telegram bot...');
        try {
            await bot.stop(signal.toString());
            bootstrapLogger('Telegram bot stopped.');
        } catch (e) {
            bootstrapLogger('Error stopping Telegram bot:', e);
        }
    }

    bootstrapLogger('Shutdown sequence complete. Exiting process.');
    process.exit(0);
}

process.on('SIGTERM', () => sigHandler('SIGTERM'));
process.on('SIGINT', () => sigHandler('SIGINT'));
process.on('uncaughtException', (err, origin) => {
    bootstrapLogger(`CRITICAL: Uncaught Exception at: ${origin}`, err);
    sigHandler('uncaughtException').catch(() => process.exit(1));
});
process.on('unhandledRejection', (reason, promise) => {
    bootstrapLogger('CRITICAL: Unhandled Rejection at:', promise);
    bootstrapLogger('Reason:', reason);
    sigHandler('unhandledRejection').catch(() => process.exit(1));
});

// --- Application Startup ---
/**
 * Initializes and starts all components of the application:
 * 1. Connects to the database.
 * 2. Starts the Express server.
 * 3. Launches the Telegram bot.
 * 4. Schedules the periodic timer for sending Ayas.
 * If any critical startup step fails, it logs the error and exits the process.
 * @async
 * @private
 * @function startApp
 */
async function startApp() {
    try {
        bootstrapLogger('Application startup sequence initiated...');

        await connectDB();

        startExpressServer();

        await launchBot();

        const timerCheckMillis = config.timerCheckMinutes * 60 * 1000;
        const timerNow = new Date();
        const minutesIntoCycle = timerNow.getMinutes() % config.timerCheckMinutes;
        const secondsIntoMinute = timerNow.getSeconds();
        const millisIntoSecond = timerNow.getMilliseconds();

        let timerFirstDelay = (config.timerCheckMinutes - minutesIntoCycle) * 60 * 1000;
        timerFirstDelay -= secondsIntoMinute * 1000 + millisIntoSecond;

        if (timerFirstDelay < 0) {
            timerFirstDelay += config.timerCheckMinutes * 60 * 1000;
        }

        bootstrapLogger(
            `Timer: First run in ${+(timerFirstDelay / 1000 / 60).toFixed(2)} minutes. Subsequent checks every ${config.timerCheckMinutes} minutes.`
        );

        setTimeout(() => {
            runTimerSend();
            timerIntervalId = setInterval(runTimerSend, timerCheckMillis);
        }, timerFirstDelay);

        bootstrapLogger('Application started successfully and timer scheduled.');
    } catch (error) {
        bootstrapLogger('CRITICAL: Application startup failed:', error);
        process.exit(1);
    }
}

// --- Start the Application ---
startApp();
