// src/__mocks__/config.js

/**
 * Mock for the config module.
 * Provides default valid values for critical environment variables
 * to prevent errors during tests that import the original config.
 * Ensures that all critical checks in the original config.js pass.
 */
const mockConfig = {
    telegramToken: 'MOCK_TELEGRAM_TOKEN_VALID', // Valid mock token
    devChatId: 'MOCK_DEV_CHAT_ID_VALID',       // Valid mock chat ID
    mongoDbCredentials: 'mockuser:mockpassword', // Valid mock credentials
    mongoSubdomain: 'mockcluster.mongodb.net', // Valid mock subdomain
    mongoURI: 'mongodb+srv://mockuser:mockpassword@mockcluster.mongodb.net/?retryWrites=true&w=majority',

    // Default values for other non-critical or less critical settings
    inst: 'test-inst',
    host: 'test-host',
    totalInst: '1',
    activeInst: 'test-inst@test-host',
    instActiveUntil: 'forever',
    branch: 'test-branch',
    debugging: false,
    codeVer: 'test-version',
    port: 3001,
    timerCheckMinutes: 60,
    timerSendHours: 24,
    pingTargetGeneral: 'https://www.google.com',
    pingTargetAlternative: 'https://1.1.1.1',
    pingTargetTelegramApiBase: 'https://api.telegram.org',
    botLaunchRetryDelay: 1000,
    maxBotLaunchRetries: 1,
};

export default mockConfig;
