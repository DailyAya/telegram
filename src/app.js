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
    let numberOfChatsProcessed = 0;
    bootstrapLogger('runTimerSend: Cycle started.');
    // Eligibility: older than (timerSendHours - 1) hours ago (e.g., 23 hours for a 24h cycle) to align with hourly batching.
    const sendMillisThreshold = (config.timerSendHours - 1) * 60 * 60 * 1000;
    const comparisonTimestamp = Date.now() - sendMillisThreshold;

    logger(`runTimerSend: timerSendHours: ${config.timerSendHours}, timerCheckMinutes: ${config.timerCheckMinutes}`);
    logger(`runTimerSend: Calculated sendMillisThreshold: ${sendMillisThreshold}`);
    logger(`runTimerSend: Current Date.now(): ${Date.now()}`);
    logger(
        `runTimerSend: Querying for chats with lastAyaTime <= ${comparisonTimestamp} (i.e., older than ${new Date(comparisonTimestamp).toISOString()})`
    );

    try {
        const db = getDB();
        if (!db) {
            logger('runTimerSend: Database not available, skipping cycle.');
            bootstrapLogger(
                `runTimerSend: Cycle finished (DB not available). Processed ${numberOfChatsProcessed} chats.`
            );
            return;
        }

        const chats = await db
            .collection('chats')
            .find({
                lastAyaTime: { $lte: comparisonTimestamp },
                blocked: false,
            })
            .toArray();

        numberOfChatsProcessed = chats.length;
        logger(`runTimerSend: Found ${numberOfChatsProcessed} eligible chats for this cycle.`);

        if (chats.length > 0) {
            // Log details for a few chats
            for (let i = 0; i < Math.min(chats.length, 5); i++) {
                // Log up to 5 chats
                const chat = chats[i];
                logger(
                    `runTimerSend: Eligible chat[${i}]: chatId: ${chat.chatId}, lastAyaTime: ${chat.lastAyaTime} (${new Date(chat.lastAyaTime).toISOString()}), favReciter: ${chat.favReciter}`
                );
            }
        }

        for (let i = 0; i < chats.length; i++) {
            const chat = chats[i];
            const delay = i * (config.debugging ? 1000 : 50); // 50ms, up to 20 msg/sec

            setTimeout(async () => {
                try {
                    logger(
                        `runTimerSend: Attempting to send timed Aya to chat ${chat.chatId} (FavReciter: ${chat.favReciter || 'surprise'}, withRecitation: false)`
                    );
                    await sendAyaFromBot(chat.chatId, null, chat.favReciter, null, 'timer', false);
                } catch (e) {
                    logger(`runTimerSend: Error sending timed Aya to chat ${chat.chatId} individually:`, e);
                }
            }, delay);
        }
    } catch (e) {
        logger('runTimerSend: General error during timer cycle:', e);
    }
    bootstrapLogger(`runTimerSend: Cycle finished. Processed ${numberOfChatsProcessed} chats.`);
}

/**
 * Initializes the periodic timer for sending Ayas.
 * Calculates the delay until the next appropriate interval.
 * @private
 * @function initializeTimer
 */
function initializeTimer() {
    bootstrapLogger('Timer: initializeTimer() called.'); // Log invocation
    if (timerIntervalId) {
        // Clear any existing timer before starting a new one
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
        `Timer: Initializing. timerCheckMinutes: ${config.timerCheckMinutes}, timerCheckMillis: ${timerCheckMillis}, timerFirstDelay: ${timerFirstDelay}ms (${+(timerFirstDelay / 1000 / 60).toFixed(2)} minutes).`
    ); // Log parameters

    setTimeout(() => {
        bootstrapLogger('Timer: Initial setTimeout for first runTimerSend triggered.'); // Log when first run is due
        runTimerSend();
        timerIntervalId = setInterval(runTimerSend, timerCheckMillis);
        bootstrapLogger('Timer: setInterval for subsequent runTimerSend calls established.'); // Log interval setup
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
            const isTelegramReachable = await checkConnectivity(telegramApiUrl); // Shorter timeout for retry check

            if (!isTelegramReachable) {
                throw new Error('Telegram API not reachable before launch attempt.');
            }

            await launchBot(); // This now ensures username is set and dev chat message is attempted
            bootstrapLogger('Bot launched successfully after retries (polling started, dev chat msg sent).');

            // Call initial timer run and schedule recurring timer AFTER successful launch from retries
            if (getDB()) {
                bootstrapLogger('Calling initial runTimerSend() after successful bot launch (retries).');
                runTimerSend().catch((e) => {
                    // Using bootstrapLogger here as well, as full bot logger might still be iffy if launch was problematic
                    bootstrapLogger('Error during post-retry initial runTimerSend():', e);
                });
            } else {
                bootstrapLogger('DB not available after launchBot() (retries), cannot run initial timer send.');
            }
            initializeTimer();
            return; // Success, exit function
        } catch (error) {
            // Use bootstrapLogger here as the main logger (which relies on botInstance) might not be available if launchBot failed
            bootstrapLogger(`Bot launch attempt ${attempt} failed. Reason: ${error.message}. Full Error:`, error);

            if (attempt >= maxAttempts) {
                bootstrapLogger(`Max bot launch retries (${maxAttempts}) reached. Giving up on automatic launch.`);
                // The application will continue running with the Express server, but the bot won't be operational.
                // Manual intervention would be required.
                return;
            }

            // Before retrying, check general internet again.
            const generalInternetStillOk = await checkConnectivity(config.pingTargetGeneral);
            if (!generalInternetStillOk) {
                bootstrapLogger(
                    'CRITICAL: General internet connectivity lost during bot launch retries. Stopping retries.'
                );
                // Similar to above, bot won't be operational.
                return;
            }
            bootstrapLogger(`Will retry bot launch in ${config.botLaunchRetryDelay / 1000} seconds.`);
            await new Promise((resolve) => setTimeout(resolve, config.botLaunchRetryDelay));
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
// Critical prerequisites for the bot to run properly:
// 1. Internet connectivity (general and to Telegram API).
// 2. Database connection (MongoDB).
// 3. Telegram API reachability (bot token valid, API up).
// 4. Bot username resolvable (via getMe on Telegram API).
// 5. Express server starts for health checks.
async function startApp() {
    try {
        bootstrapLogger('Application startup sequence initiated...');

        startExpressServer(); // Non-blocking, starts listening for health checks
        bootstrapLogger('Express server startup initiated.');

        // 1. Database Connection Check
        // This loop retries indefinitely until successful.
        let dbConnected = false;
        let dbAttempt = 0;
        while (!dbConnected) {
            dbAttempt++;
            bootstrapLogger(`Attempting to connect to database (attempt ${dbAttempt})...`);
            try {
                await connectDB();
                dbConnected = true;
                bootstrapLogger('Database connected successfully.');
            } catch (dbError) {
                bootstrapLogger(`Database connection attempt ${dbAttempt} failed: ${dbError.message}`);
                bootstrapLogger(`Retrying database connection in ${config.botLaunchRetryDelay / 1000} seconds...`);
                await new Promise((resolve) => setTimeout(resolve, config.botLaunchRetryDelay));
            }
        }

        // 2. General Internet Connectivity Check
        // This loop retries indefinitely until successful.
        let internetConnected = false;
        let internetAttempt = 0;
        while (!internetConnected) {
            internetAttempt++;
            bootstrapLogger(`Checking general internet connectivity (attempt ${internetAttempt})...`);
            bootstrapLogger(`Attempting primary connectivity check: ${config.pingTargetGeneral}`);
            if (await checkConnectivity(config.pingTargetGeneral)) {
                internetConnected = true;
                bootstrapLogger(
                    `General internet connectivity established via primary target: ${config.pingTargetGeneral}`
                );
            } else {
                bootstrapLogger(
                    `Primary connectivity check failed: ${config.pingTargetGeneral}. Attempting alternative: ${config.pingTargetAlternative}`
                );
                if (await checkConnectivity(config.pingTargetAlternative)) {
                    internetConnected = true;
                    bootstrapLogger(
                        `General internet connectivity established via alternative target: ${config.pingTargetAlternative}`
                    );
                } else {
                    bootstrapLogger(
                        `Both primary and alternative general connectivity checks failed (attempt ${internetAttempt}).`
                    );
                    bootstrapLogger(
                        `Retrying internet connectivity check in ${config.botLaunchRetryDelay / 1000} seconds...`
                    );
                    await new Promise((resolve) => setTimeout(resolve, config.botLaunchRetryDelay));
                }
            }
        }

        // 3. Telegram API Reachability Check
        // This loop retries indefinitely until successful.
        let telegramApiReachable = false;
        let telegramApiAttempt = 0;
        const actualTelegramApiCheckUrl = `${config.pingTargetTelegramApiBase}/bot${config.telegramToken}/getMe`;
        // For logging, avoid exposing the full token
        const logSafeTelegramApiUrl = `${config.pingTargetTelegramApiBase}/bot${config.telegramToken ? config.telegramToken.substring(0, 10) + '...' : '[TOKEN_NOT_SET]'}/getMe`;

        while (!telegramApiReachable) {
            telegramApiAttempt++;
            bootstrapLogger(
                `Checking Telegram API reachability (attempt ${telegramApiAttempt}) at: ${logSafeTelegramApiUrl}`
            );
            if (await checkConnectivity(actualTelegramApiCheckUrl)) {
                telegramApiReachable = true;
                bootstrapLogger('Telegram API reachable.');
            } else {
                bootstrapLogger(`Telegram API reachability check failed (attempt ${telegramApiAttempt}).`);
                bootstrapLogger(
                    `Retrying Telegram API reachability check in ${config.botLaunchRetryDelay / 1000} seconds...`
                );
                await new Promise((resolve) => setTimeout(resolve, config.botLaunchRetryDelay));
            }
        }

        // All critical prerequisites are met. Now, attempt to launch the bot.
        // launchBot() itself will throw an error if username retrieval fails,
        // which will be caught by attemptBotLaunchWithRetriesAndInitializeTimer.
        bootstrapLogger('All critical prerequisites met. Proceeding to bot launch sequence...');
        attemptBotLaunchWithRetriesAndInitializeTimer(); // This function contains its own retry logic for launchBot and initializes the timer.

        bootstrapLogger('Main startup sequence complete. Express server is running. Bot launch process initiated.');
    } catch (error) {
        // This catch handles unexpected errors during the setup loops or if startExpressServer itself throws.
        bootstrapLogger('CRITICAL: Application startup failed in main sequence due to an unexpected error:', error);
        await sigHandler('startupError'); // Gracefully shut down
    }
}

// --- Start the Application ---
startApp();
