// src/__mocks__/config.mock.js
// console.log('****** GLOBAL MOCK: src/__mocks__/config.mock.js loaded ******'); // Commented out
export default {
    telegramToken: 'GLOBAL_MOCK_TOKEN_CONFIG_FILE',
    devChatId: 'GLOBAL_MOCK_DEV_CHAT_ID_CONFIG_FILE',
    mongoDbCredentials: 'global-mock-user:global-mock-pass',
    mongoSubdomain: 'global-mock-cluster.mongodb.net',
    mongoURI:
        'mongodb+srv://global-mock-user:global-mock-pass@global-mock-cluster.mongodb.net/?retryWrites=true&w=majority',
    branch: 'global-mock-branch',
    inst: 'global-mock-inst',
    host: 'global-mock-host',
    totalInst: '1',
    debugging: false,
    codeVer: 'global-mock-v1.0.0',
    instActiveUntil: '2099-12-31',
    port: 3333,
    timerCheckMinutes: 60,
    timerSendHours: 24,
    pingTargetGeneral: 'http://mock.example.com',
    pingTargetAlternative: 'http://mock.example.org',
    pingTargetTelegramApiBase: 'http://mock.api.telegram.org',
    botLaunchRetryDelay: 1000,
    maxBotLaunchRetries: 1,
};
