import os from 'os';
import { Telegraf, Markup } from 'telegraf'; // Import Markup here if needed by registerHandlers
import config from './config.js';
import { logger, bootstrapLogger } from './logger.js';
import { connectDB, getDB } from './database.js';
import { startExpressServer } from './expressApp.js';
import { initializeBot } from './botManager.js'; // New import
import {
    registerHandlers,
    launchBot as performBotPreLaunchChecks, // Renamed for clarity
    sendAya // Direct import of sendAya
} from './telegramBot.js';
import { checkConnectivity, maskTokenInUrl } from './utils.js';

bootstrapLogger(`Number of CPUs: ${os.cpus().length}`);
bootstrapLogger(`Starting DailyAya Telegram Bot - Version ${config.codeVer}`);

let timerIntervalId = null;
let globalBotInstance = null; // To store the bot instance for sigHandler

async function runTimerSend() {
    let numberOfChatsProcessed = 0;
    bootstrapLogger('runTimerSend: Cycle started.');
    const sendMillisThreshold = (config.timerSendHours - 1) * 60 * 60 * 1000;
    const comparisonTimestamp = Date.now() - sendMillisThreshold;

    logger(`runTimerSend: timerSendHours: ${config.timerSendHours}, timerCheckMinutes: ${config.timerCheckMinutes}`);
    logger(`runTimerSend: Calculated sendMillisThreshold: ${sendMillisThreshold}`);
    logger(`runTimerSend: Current Date.now(): ${Date.now()}`);
    logger(`runTimerSend: Querying for chats with lastAyaTime <= ${comparisonTimestamp} (i.e., older than ${new Date(comparisonTimestamp).toISOString()})`);

    try {
        const db = getDB();
        if (!db) {
            logger('runTimerSend: Database not available, skipping cycle.');
            bootstrapLogger(`runTimerSend: Cycle finished (DB not available). Processed ${numberOfChatsProcessed} chats.`);
            return;
        }

        const chats = await db.collection('chats').find({
            lastAyaTime: { $lte: comparisonTimestamp },
            blocked: false,
        }).toArray();

        numberOfChatsProcessed = chats.length;
        logger(`runTimerSend: Found ${numberOfChatsProcessed} eligible chats for this cycle.`);

        if (chats.length > 0) {
            for (let i = 0; i < Math.min(chats.length, 5); i++) {
                const chat = chats[i];
                logger(`runTimerSend: Eligible chat[${i}]: chatId: ${chat.chatId}, lastAyaTime: ${chat.lastAyaTime} (${new Date(chat.lastAyaTime).toISOString()}), favReciter: ${chat.favReciter}`);
            }
        }

        for (let i = 0; i < chats.length; i++) {
            const chat = chats[i];
            const delay = i * (config.debugging ? 1000 : 50);
            setTimeout(async () => {
                try {
                    logger(`runTimerSend: Attempting to send timed Aya to chat ${chat.chatId} (FavReciter: ${chat.favReciter || 'surprise'}, withRecitation: false)`);
                    // sendAya now correctly uses activeBotInstance set by registerHandlers
                    await sendAya(chat.chatId, null, chat.favReciter, null, 'timer', false);
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

function initializeTimer() {
    bootstrapLogger('Timer: initializeTimer() called.');
    if (timerIntervalId) {
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

    bootstrapLogger(`Timer: Initializing. timerCheckMinutes: ${config.timerCheckMinutes}, timerCheckMillis: ${timerCheckMillis}, timerFirstDelay: ${timerFirstDelay}ms (${+(timerFirstDelay / 1000 / 60).toFixed(2)} minutes).`);

    setTimeout(() => {
        bootstrapLogger('Timer: Initial setTimeout for first runTimerSend triggered.');
        if (getDB() && globalBotInstance) { // Ensure DB and Bot are ready for timer
             runTimerSend().catch((e) => {
                bootstrapLogger('Error during initial runTimerSend():', e);
            });
        } else {
            bootstrapLogger('Timer: DB or Bot not ready, skipping initial runTimerSend.');
        }
        timerIntervalId = setInterval(runTimerSend, timerCheckMillis);
        bootstrapLogger('Timer: setInterval for subsequent runTimerSend calls established.');
    }, timerFirstDelay);
}

async function attemptBotLaunchAndSetup() {
    let attempt = 0;
    const maxAttempts = config.maxBotLaunchRetries === 0 ? Infinity : config.maxBotLaunchRetries;

    // Initialize bot first using botManager
    // This call happens once and subsequent calls return the same instance.
    const { bot: botFromManager, botUsernameReady } = initializeBot();
    globalBotInstance = botFromManager; // Store for sigHandler

    // Register handlers once the bot object is available
    // Pass Markup if any handler in telegramBot.js needs it directly (though typically it's on ctx)
    registerHandlers(globalBotInstance, { Markup });

    const username = await botUsernameReady; // Wait for getMe to complete
    if (!username) {
        bootstrapLogger('CRITICAL: Bot username could not be retrieved after initialization. Bot cannot launch effectively.');
        // Decide if to throw or let retry logic handle this.
        // For now, let retry logic attempt to re-initialize if that's how initializeBot is designed,
        // or simply fail if initializeBot is a singleton initializer.
        // Given initializeBot is singleton, if username is null, subsequent launch attempts will also fail here.
        throw new Error('Bot username resolution failed. Cannot launch.');
    }
    bootstrapLogger(`Bot username '${username}' retrieved. Proceeding with launch sequence.`);

    // Perform pre-launch checks (this is the refactored launchBot from telegramBot.js)
    await performBotPreLaunchChecks();

    while (attempt < maxAttempts) {
        attempt++;
        bootstrapLogger(`Bot launch attempt ${attempt}${maxAttempts === Infinity ? '' : `/${maxAttempts}`}...`);
        try {
            // No need to check Telegram API again here, initializeBot already did getMe

            await globalBotInstance.launch(); // Actual Telegraf launch
            bootstrapLogger('Bot launched successfully and polling started.');

            // Initialize timer only after successful launch
            if (getDB()) {
                bootstrapLogger('Calling initial runTimerSend() after successful bot launch.');
                runTimerSend().catch((e) => {
                    bootstrapLogger('Error during initial runTimerSend():', e);
                });
            } else {
                bootstrapLogger('DB not available after bot launch, cannot run initial timer send.');
            }
            initializeTimer();
            return; // Success
        } catch (error) {
            bootstrapLogger(`Bot launch attempt ${attempt} failed. Reason: ${error.message}. Full Error:`, error);
            if (attempt >= maxAttempts) {
                bootstrapLogger(`Max bot launch retries (${maxAttempts}) reached. Giving up.`);
                return;
            }
            const generalInternetStillOk = await checkConnectivity(config.pingTargetGeneral);
            if (!generalInternetStillOk) {
                bootstrapLogger('CRITICAL: General internet connectivity lost during bot launch retries. Stopping retries.');
                return;
            }
            bootstrapLogger(`Will retry bot launch in ${config.botLaunchRetryDelay / 1000} seconds.`);
            await new Promise((resolve) => setTimeout(resolve, config.botLaunchRetryDelay));
        }
    }
}

async function sigHandler(signal) {
    bootstrapLogger(`Exiting due to ${signal} after ${+(process.uptime() / 3600).toFixed(2)} hours. Memory: ${Math.floor(process.memoryUsage().rss / (1024 * 1024))} MB`);
    if (timerIntervalId) {
        clearInterval(timerIntervalId);
        bootstrapLogger('Timer interval cleared.');
    }
    if (globalBotInstance && typeof globalBotInstance.stop === 'function') {
        bootstrapLogger('Stopping Telegram bot...');
        try {
            await globalBotInstance.stop(signal.toString());
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

async function startApp() {
    try {
        bootstrapLogger('Application startup sequence initiated...');
        startExpressServer();
        bootstrapLogger('Express server startup initiated.');

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

        let internetConnected = false;
        let internetAttempt = 0;
        while (!internetConnected) {
            internetAttempt++;
            bootstrapLogger(`Checking general internet connectivity (attempt ${internetAttempt})...`);
            bootstrapLogger(`Attempting primary connectivity check: ${config.pingTargetGeneral}`);
            if (await checkConnectivity(config.pingTargetGeneral)) {
                internetConnected = true;
                bootstrapLogger(`General internet connectivity established via primary target: ${config.pingTargetGeneral}`);
            } else {
                bootstrapLogger(`Primary connectivity check failed: ${config.pingTargetGeneral}. Attempting alternative: ${config.pingTargetAlternative}`);
                if (await checkConnectivity(config.pingTargetAlternative)) {
                    internetConnected = true;
                    bootstrapLogger(`General internet connectivity established via alternative target: ${config.pingTargetAlternative}`);
                } else {
                    bootstrapLogger(`Both primary and alternative general connectivity checks failed (attempt ${internetAttempt}).`);
                    bootstrapLogger(`Retrying internet connectivity check in ${config.botLaunchRetryDelay / 1000} seconds...`);
                    await new Promise((resolve) => setTimeout(resolve, config.botLaunchRetryDelay));
                }
            }
        }

        // No need for separate Telegram API reachability check here, initializeBot will do getMe.

        bootstrapLogger('All critical prerequisites met. Proceeding to bot launch and setup sequence...');
        await attemptBotLaunchAndSetup(); // This now handles initializeBot, registerHandlers, and bot.launch with retries

        bootstrapLogger('Main startup sequence complete. Express server is running. Bot launch process initiated/completed.');
    } catch (error) {
        bootstrapLogger('CRITICAL: Application startup failed in main sequence due to an unexpected error:', error);
        await sigHandler('startupError');
    }
}

startApp();
