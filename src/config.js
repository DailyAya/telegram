import { toBoolean } from './utils.js';

/**
 * @module config
 * @description Manages application configuration by loading environment variables and providing default values.
 * It also performs critical checks for essential variables at startup.
 */

/**
 * Application configuration object.
 * Loaded from environment variables with sensible defaults.
 * @type {object}
 * @property {string} telegramToken - The Telegram Bot API token. CRITICAL.
 * @property {string} inst - Instance identifier (e.g., '0', '1').
 * @property {string} host - Host identifier where the instance is running.
 * @property {string} totalInst - Total number of instances expected to run.
 * @property {string} activeInst - Identifier for the currently active instance (unused for now).
 * @property {string} instActiveUntil - Information about how long the instance is expected to be active.
 * @property {string} branch - The Git branch this deployment is from (e.g., 'main', 'staging', 'dev').
 * @property {boolean} debugging - Flag to enable or disable debugging features and logs.
 * @property {string} devChatId - Telegram Chat ID for development team notifications. CRITICAL.
 * @property {string} codeVer - Application version, typically from npm_package_version.
 * @property {number} port - Port number for the Express server.
 * @property {string|null} mongoDbCredentials - MongoDB connection credentials (username:password part). CRITICAL if mongoSubdomain is set.
 * @property {string|null} mongoSubdomain - MongoDB cluster subdomain (e.g., 'abcde.mongodb.net'). CRITICAL if mongoDbCredentials are set.
 * @property {string} mongoURI - Fully constructed MongoDB connection URI.
 * @property {number} timerCheckMinutes - Interval in minutes for checking if timed Ayas need to be sent.
 * @property {number} timerSendHours - Interval in hours for sending a timed Aya to a chat.
 */
const config = {
    telegramToken: process.env.telegramToken ?? 'YOUR_TELEGRAM_TOKEN_DEFAULT',
    inst: process.env.inst ?? '0',
    host: process.env.host ?? 'DefaultHost',
    totalInst: process.env.totalInst ?? '1',
    activeInst: process.env.activeInst ?? '0@DefaultHost', //unused for now
    instActiveUntil: process.env.instActiveUntil ?? 'N/A',
    branch: process.env.branch ?? 'staging',
    debugging: toBoolean(process.env.debugging ?? 'false'),
    devChatId: process.env.devChatId ?? 'YOUR_DEV_CHAT_ID_DEFAULT',
    // codeVer is sourced from npm_package_version (set via package.json).
    // Update package.json's "version" field to dd.mm.yyyy-HHMM (commit timestamp) before committing.
    codeVer: process.env.npm_package_version ?? '1970.01.01-local',
    port: process.env.PORT ?? 3000,
    mongoDbCredentials: process.env.mongoDbCredentials ?? null,
    mongoSubdomain: process.env.mongoSubdomain ?? null,
    timerCheckMinutes: parseInt(process.env.TimerCheckMinutes ?? '15', 10),
    timerSendHours: parseInt(process.env.TimerSendHours ?? '24', 10),
    pingTargetGeneral: process.env.PING_TARGET_GENERAL ?? 'https://www.google.com',
    pingTargetTelegramApiBase: process.env.PING_TARGET_TELEGRAM_API_BASE ?? 'https://api.telegram.org',
    botLaunchRetryDelay: parseInt(process.env.BOT_LAUNCH_RETRY_DELAY_MS ?? '30000', 10), // 30 seconds
    maxBotLaunchRetries: parseInt(process.env.MAX_BOT_LAUNCH_RETRIES ?? '5', 10), // 5 retries, 0 for indefinite
};

// Construct mongoURI using the fetched credentials and subdomain
config.mongoURI = `mongodb+srv://${config.mongoDbCredentials}@cluster0.${config.mongoSubdomain}.mongodb.net/?retryWrites=true&w=majority`;

// Add a check for critical variables and throw error if not set
if (!config.telegramToken || config.telegramToken === 'YOUR_TELEGRAM_TOKEN_DEFAULT') {
    throw new Error('CRITICAL: telegramToken is not defined in environment variables.');
}
if (!config.devChatId || config.devChatId === 'YOUR_DEV_CHAT_ID_DEFAULT') {
    throw new Error('CRITICAL: devChatId is not defined in environment variables.');
}
if (!config.mongoDbCredentials || !config.mongoSubdomain) {
    throw new Error('CRITICAL: MongoDB credentials or subdomain are not defined in environment variables.');
}

export default config;
