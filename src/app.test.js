import { jest } from '@jest/globals';

jest.unstable_mockModule('./config.js', () => ({
    __esModule: true,
    default: {
        telegramToken: 'test-token',
        devChatId: 'test-chat-id',
        codeVer: 'test-version',
        timerCheckMinutes: 60,
        timerSendHours: 24,
        maxBotLaunchRetries: 1,
        botLaunchRetryDelay: 100,
        pingTargetGeneral: 'google.com',
        pingTargetAlternative: 'cloudflare.com',
    },
}));

const mockBootstrapLogger = jest.fn();
jest.unstable_mockModule('./logger.js', () => ({
    __esModule: true,
    logger: jest.fn(),
    bootstrapLogger: mockBootstrapLogger,
}));

jest.unstable_mockModule('./database.js', () => ({
    __esModule: true,
    connectDB: jest.fn().mockResolvedValue(true),
    getDB: jest.fn().mockReturnValue({ collection: () => ({ find: () => ({ toArray: () => [] }) }) }),
}));

jest.unstable_mockModule('./expressApp.js', () => ({
    __esModule: true,
    startExpressServer: jest.fn(),
}));

const mockLaunch = jest.fn().mockResolvedValue(true);
const mockInitializeBot = jest.fn();
const mockRegisterHandlers = jest.fn();
const mockPerformBotPreLaunchChecks = jest.fn();
const mockSendAya = jest.fn();
const mockCheckConnectivity = jest.fn().mockResolvedValue(true);

jest.unstable_mockModule('./botManager.js', () => ({
    __esModule: true,
    initializeBot: mockInitializeBot.mockReturnValue({
        bot: {
            launch: mockLaunch,
            stop: jest.fn(),
        },
        botUsernameReady: Promise.resolve('testbot'),
    }),
}));

jest.unstable_mockModule('./telegramBot.js', () => ({
    __esModule: true,
    registerHandlers: mockRegisterHandlers,
    performBotPreLaunchChecks: mockPerformBotPreLaunchChecks,
    sendAya: mockSendAya,
}));

jest.unstable_mockModule('./utils.js', () => ({
    __esModule: true,
    checkConnectivity: mockCheckConnectivity,
    maskTokenInUrl: jest.fn((url) => url),
}));

describe('App Startup', () => {
    let startApp;

    beforeEach(async () => {
        jest.resetModules();
        const app = await import('./app.js');
        startApp = app.startApp;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should initialize the timer before launching the bot', async () => {
        await startApp();

        const initializeTimerLog = mockBootstrapLogger.mock.calls.find(
            (call) => call[0] === 'Timer: initializeTimer() called.'
        );
        const launchLog = mockBootstrapLogger.mock.calls.find(
            (call) => call[0] === 'Bot launched successfully and polling started.'
        );

        const initializeTimerCallOrder =
            mockBootstrapLogger.mock.invocationCallOrder[mockBootstrapLogger.mock.calls.indexOf(initializeTimerLog)];
        const launchCallOrder =
            mockBootstrapLogger.mock.invocationCallOrder[mockBootstrapLogger.mock.calls.indexOf(launchLog)];

        expect(initializeTimerLog).toBeDefined();
        expect(launchLog).toBeDefined();
        expect(initializeTimerCallOrder).toBeLessThan(launchCallOrder);
    });
});
