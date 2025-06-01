import os from 'os';
import config from './config.js';
import { logger, bootstrapLogger } from './logger.js';
import { connectDB, getDB } from './database.js';
import { startExpressServer } from './expressApp.js';
import { launchBot, bot, sendAya as sendAyaFromBot } from './telegramBot.js';
import { checkConnectivity } from './utils.js'; // Added import

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

/**
 * Initializes the periodic timer for sending Ayas.
 * Calculates the delay until the next appropriate interval.
 * @private
 * @function initializeTimer
 */
function initializeTimer() {
    if (timerIntervalId) { // Clear any existing timer before starting a new one
        clearInterval(timerIntervalId);
        timerIntervalId = null;
        bootstrapLogger('Timer: Cleared existing timer interval.');
    }

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
        `Timer: Initializing. First run in ${+(timerFirstDelay / 1000 / 60).toFixed(2)} minutes. Subsequent checks every ${config.timerCheckMinutes} minutes.`
    );

    setTimeout(() => {
        runTimerSend();
        timerIntervalId = setInterval(runTimerSend, timerCheckMillis);
    }, timerFirstDelay);
}


/**
 * Attempts to launch the Telegram bot with retries if initial attempts fail.
 * If successful, it initializes the timer for sending daily Ayas.
 * @async
 * @private
 * @function attemptBotLaunchWithRetriesAndInitializeTimer
 */
async function attemptBotLaunchWithRetriesAndInitializeTimer() {
    let attempt = 0;
    const maxAttempts = config.maxBotLaunchRetries === 0 ? Infinity : config.maxBotLaunchRetries; // 0 for indefinite

    while (attempt < maxAttempts) {
        attempt++;
        bootstrapLogger(`Bot launch attempt ${attempt}${maxAttempts === Infinity ? '' : `/${maxAttempts}`}...`);
        try {
            // Before each launch attempt, quickly check Telegram API again
            const telegramApiUrl = `${config.pingTargetTelegramApiBase}/bot${config.telegramToken}/getMe`;
            const isTelegramReachable = await checkConnectivity(telegramApiUrl, 3000); // Shorter timeout for retry check

            if (!isTelegramReachable) {
                 throw new Error('Telegram API not reachable before launch attempt.');
            }

            await launchBot();
            bootstrapLogger('Bot launched successfully after retries.');
            initializeTimer(); // Initialize timer only after successful bot launch
            return; // Success, exit function
        } catch (error) {
            logger(`Bot launch attempt ${attempt} failed:`, error.message); // Log only error message for brevity in retries

            if (attempt >= maxAttempts) {
                bootstrapLogger(`Max bot launch retries (${maxAttempts}) reached. Giving up on automatic launch.`);
                // The application will continue running with the Express server, but the bot won't be operational.
                // Manual intervention would be required.
                return;
            }

            // Before retrying, check general internet again.
            const generalInternetStillOk = await checkConnectivity(config.pingTargetGeneral, 3000);
            if (!generalInternetStillOk) {
                bootstrapLogger('CRITICAL: General internet connectivity lost during bot launch retries. Stopping retries.');
                // Similar to above, bot won't be operational.
                return;
            }
            bootstrapLogger(`Will retry bot launch in ${config.botLaunchRetryDelay / 1000} seconds.`);
            await new Promise(resolve => setTimeout(resolve, config.botLaunchRetryDelay));
        }
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
 * 2. Starts the Express server (for health checks).
 * 3. Checks general internet and Telegram API connectivity.
 * 4. Launches the Telegram bot (with retries if necessary).
 * 5. Schedules the periodic timer for sending Ayas (only after successful bot launch).
 * If critical initial steps fail (DB, Express, general internet), it exits.
 * @async
 * @private
 * @function startApp
 */
async function startApp() {
    try {
        bootstrapLogger('Application startup sequence initiated...');

        await connectDB();
        bootstrapLogger('Database connected.');

        startExpressServer(); // Non-blocking, starts listening for health checks
        bootstrapLogger('Express server startup initiated.');

        const generalInternetOk = await checkConnectivity(config.pingTargetGeneral);
        if (!generalInternetOk) {
            bootstrapLogger('CRITICAL: General internet connectivity check failed. Exiting.');
            await sigHandler('generalInternetFail'); // Attempt graceful shutdown of what's up
            return;
        }
        bootstrapLogger('General internet connectivity OK.');

        // Construct Telegram API URL carefully to avoid logging the token if the URL itself is logged by checkConnectivity
        const telegramApiUrl = `${config.pingTargetTelegramApiBase}/bot${config.telegramToken.substring(0,10)}.../getMe`; // Log-safe version for display
        const actualTelegramApiCheckUrl = `${config.pingTargetTelegramApiBase}/bot${config.telegramToken}/getMe`;

        bootstrapLogger(`Checking Telegram API reachability at: ${config.pingTargetTelegramApiBase}/bot[TOKEN_HIDDEN]/getMe`);
        const telegramApiOk = await checkConnectivity(actualTelegramApiCheckUrl);

        if (telegramApiOk) {
            bootstrapLogger('Telegram API reachable. Proceeding with normal bot launch.');
            await launchBot();
            bootstrapLogger('Bot launched successfully on first attempt.');
            initializeTimer();
        } else {
            bootstrapLogger('Telegram API not reachable, but general internet is OK. Starting bot launch retry loop (will not block further execution of startApp).');
            attemptBotLaunchWithRetriesAndInitializeTimer(); // Runs in background, logs its own progress/failures
        }

        // If we reach here, Express is running, DB is connected.
        // Bot might be running directly or retrying in the background.
        // Timer will only start if/when bot launch is successful.
        bootstrapLogger('Main startup sequence complete. Express server is running.');
        // Note: The application will not exit here if the bot is in a retry loop.
        // It relies on process signals or unhandled exceptions for termination if retries ultimately fail
        // and no other mechanism (like a supervisor) restarts it.

    } catch (error) {
        // This catch handles errors from connectDB, startExpressServer (if it were to throw synchronously),
        // initial connectivity checks, or if launchBot() is directly awaited and fails.
        bootstrapLogger('CRITICAL: Application startup failed in main sequence:', error);
        await sigHandler('startupError');
    }
}

// --- Start the Application ---
startApp();
