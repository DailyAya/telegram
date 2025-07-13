import { jest } from '@jest/globals';

// Mock dependencies
jest.unstable_mockModule('./config.js', () => ({
    __esModule: true,
    default: {
        codeVer: 'test-version',
        timerCheckMinutes: 60,
        timerSendHours: 24,
        maxBotLaunchRetries: 1,
        botLaunchRetryDelay: 100,
        pingTargetGeneral: 'google.com',
        pingTargetAlternative: 'cloudflare.com',
    },
}));

jest.unstable_mockModule('./logger.js', () => ({
    __esModule: true,
    logger: jest.fn(),
    bootstrapLogger: jest.fn(),
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

const mockInitializeBot = jest.fn();
const mockRegisterHandlers = jest.fn();
const mockPerformBotPreLaunchChecks = jest.fn();
const mockSendAya = jest.fn();
const mockCheckConnectivity = jest.fn().mockResolvedValue(true);

jest.unstable_mockModule('./botManager.js', () => ({
    __esModule: true,
    initializeBot: mockInitializeBot.mockReturnValue({
        bot: {
            launch: jest.fn().mockResolvedValue(true),
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
    let originalProcessOn = process.on;
    let originalProcessExit = process.exit;

    beforeEach(async () => {
        jest.resetModules();
        // Mock process event handlers to avoid test runner exit
        process.on = jest.fn();
        process.exit = jest.fn();

        const appModule = await import('./app.js');
        startApp = appModule.default; // Assuming startApp is default export
    });

    afterEach(() => {
        process.on = originalProcessOn;
        process.exit = originalProcessExit;
        jest.clearAllMocks();
    });

    it('should call all initialization functions on startup', async () => {
        // Dynamically import app.js to trigger its execution
        await import('./app.js');

        // Check that the main startup functions were called
        expect(mockInitializeBot).toHaveBeenCalled();
        expect(mockRegisterHandlers).toHaveBeenCalled();
        expect(mockPerformBotPreLaunchChecks).toHaveBeenCalled();
    });

    it('should initialize the timer on startup', async () => {
        // Dynamically import app.js to trigger its execution
        await import('./app.js');

        // Check that the timer initialization function was called
        // This is a bit tricky because it's called inside an async function
        // that we don't have direct access to. We'll have to rely on the
        // side effects of the timer initialization.
        // For now, we'll just check if the logger was called with the
        // timer initialization message.
        const { bootstrapLogger } = await import('./logger.js');
        expect(bootstrapLogger).toHaveBeenCalledWith(expect.stringContaining('Timer: Initializing.'));
    });
});
