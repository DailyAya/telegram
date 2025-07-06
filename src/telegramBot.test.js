import { jest } from '@jest/globals';

// --- Manage config.js mock manually ---
let currentConfigMock = {
    __esModule: true,
    default: { // Minimal valid config
        telegramToken: 'TELEGRAMBOT_TEST_INITIAL_TOKEN',
        devChatId: 'TELEGRAMBOT_TEST_INITIAL_DEV_CHAT_ID',
        mongoDbCredentials: 'test-user:test-pass',
        mongoSubdomain: 'test-cluster.mongodb.net',
        mongoURI: 'mongodb+srv://test-user:test-pass@test-cluster.mongodb.net/?retryWrites=true&w=majority',
        branch: 'test-branch',
        inst: 'test-inst',
        host: 'test-host',
        totalInst: '1',
        debugging: false,
        codeVer: 'test-v0.0.0',
        instActiveUntil: '2000-01-01',
        port: 3007,
        timerCheckMinutes: 60,
        timerSendHours: 24,
        pingTargetGeneral: 'http://test.example.com',
        pingTargetAlternative: 'http://test.example.org',
        pingTargetTelegramApiBase: 'http://test.api.telegram.org',
        botLaunchRetryDelay: 1000,
        maxBotLaunchRetries: 1,
    },
};
jest.unstable_mockModule('./config.js', () => {
    console.log(`****** TELEGRAMBOT_TEST: unstable_mockModule for ./config.js using currentConfigMock (branch: ${currentConfigMock.default.branch}) ******`);
    return currentConfigMock;
});

// --- Mock Telegraf ---
const mockMinimalTelegrafInstance = {
    start: jest.fn(),
    help: jest.fn(),
    command: jest.fn(),
    on: jest.fn(),
    action: jest.fn(),
    launch: jest.fn(),
    catch: jest.fn(),
    telegram: {
        getMe: jest.fn().mockResolvedValue({ id: 98765, is_bot: true, username: 'MinimalTestBot' }),
        sendMessage: jest.fn().mockResolvedValue({}),
        setMyCommands: jest.fn().mockResolvedValue(true),
    },
    options: { username: undefined },
};
const MinimalMockTelegrafConstructor = jest.fn((token, options) => {
    console.log('****** TELEGRAMBOT_TEST: MinimalMockTelegrafConstructor WAS CALLED with token:', token);
    return mockMinimalTelegrafInstance;
});

jest.unstable_mockModule('telegraf', () => {
    console.log('****** TELEGRAMBOT_TEST: MINIMAL unstable_mockModule for telegraf CALLED ******');
    return {
        __esModule: true,
        Telegraf: MinimalMockTelegrafConstructor,
        Markup: {
            inlineKeyboard: jest.fn((buttons) => ({ inline_keyboard: buttons })),
            button: {
                callback: jest.fn((text, data) => ({ text, callback_data: data })),
                url: jest.fn((text, url) => ({ text, url })),
            },
        },
    };
});

// --- Mock Logger ---
const mockLogger = jest.fn();
const mockSetBotInstance = jest.fn();
const mockBootstrapLogger = jest.fn();
jest.unstable_mockModule('./logger.js', () => ({
    __esModule: true,
    logger: mockLogger,
    setBotInstance: mockSetBotInstance,
    bootstrapLogger: mockBootstrapLogger,
}));

// --- Mock other direct module dependencies of telegramBot.js ---
jest.unstable_mockModule('./database.js', () => ({
    __esModule: true,
    lastAyaTime: jest.fn(),
    setFavReciter: jest.fn(),
    getFavReciter: jest.fn(),
}));
jest.unstable_mockModule('./botHelpers.js', () => ({
    __esModule: true,
    adminChecker: jest.fn(),
    successSend: jest.fn(),
    sendSorry: jest.fn(),
    aMenuButtons: jest.fn(),
    helperAdminProtectedAction: jest.fn((ctx, botTelegram, actionFn) => actionFn(ctx)),
    helperAdminConditionalAction: jest.fn(),
    sendUnrecognizedMessage: jest.fn(),
    instructions: jest.fn(),
}));
jest.unstable_mockModule('./botHandlers/commandHandlers.js', () => ({
    __esModule: true,
    handleStartCommand: jest.fn(),
    handleHelpCommand: jest.fn(),
    handleSurpriseMeCommand: jest.fn(),
    handleSupportCommand: jest.fn(),
    handleRecitersCommand: jest.fn(),
    handleChannelCommand: jest.fn(),
    handleKhatmaCommand: jest.fn(),
    handleCommandsCommand: jest.fn(),
}));
jest.unstable_mockModule('./botHandlers/actionHandlers.js', () => ({
    __esModule: true,
    handleGroupKhatmaAction: jest.fn(),
    handleRecitersNavPageAction: jest.fn(),
    handleSetReciterAction: jest.fn(),
    handleInstructionsAction: jest.fn(),
    handleSurpriseAyaAction: jest.fn(),
    handleCurrAyaAction: jest.fn(),
    handleAMenuAction: jest.fn(),
    handleReciteAction: jest.fn(),
}));
jest.unstable_mockModule('./botFeatures/khatmaService.js', () => ({
    __esModule: true,
    khatmaUpdate: jest.fn(),
}));
jest.unstable_mockModule('./ayaSender.js', () => ({
    __esModule: true,
    sendAyaText: jest.fn(),
    sendAyaRecitation: jest.fn(),
}));
jest.unstable_mockModule('./quranService.js', () => ({
    __esModule: true,
    prepareAya: jest.fn(),
    getRecitation: jest.fn(),
    isValidReciter: jest.fn(),
    getRandomReciterIdentifier: jest.fn(),
    nextAya: jest.fn(),
    ayaId2suraAya: jest.fn(),
    suraAya2ayaId: jest.fn(),
    normalizedSurasArNames: [],
    rasmifize: jest.fn(text => text),
    getQuranData: jest.fn(() => ({ arReciters: [] })),
    checkSource: mockCheckSource, // Use the module-scoped mock function
}));
jest.unstable_mockModule('./botFeatures/reciterService.js', () => ({
    __esModule: true,
    populateRecitersButtons: jest.fn(),
    recitersNavPage: jest.fn(),
}));
jest.unstable_mockModule('./utils.js', () => ({
    __esModule: true,
    randomAyaNumber: jest.fn(),
    numArabicToEnglish: jest.fn(text => text),
}));

// --- Specific mock function instances for quranService.js ---
const mockCheckSource = jest.fn();
// Add others from quranService if needed by other tests, e.g.
// const mockPrepareAya = jest.fn();


// --- Declare SUT variables ---
let bot, launchBot, sendAya, surpriseAya, handleText, botUsernameReady;


beforeAll(async () => {
    jest.resetModules();

    const globalMockDefault = (await import('./__mocks__/config.mock.js')).default;
    currentConfigMock = { __esModule: true, default: globalMockDefault };
    console.log('****** TELEGRAMBOT_TEST: Set currentConfigMock to GLOBAL MOCK values ******');

    const telegramBotModule = await import('./telegramBot.js');
    bot = telegramBotModule.bot;
    launchBot = telegramBotModule.launchBot;
    sendAya = telegramBotModule.sendAya;
    surpriseAya = telegramBotModule.surpriseAya;
    handleText = telegramBotModule.handleText;
    botUsernameReady = telegramBotModule.botUsernameReady;

    // Assertions moved here, immediately after module import and its top-level execution
    console.log('****** TELEGRAMBOT_TEST: Asserting Telegraf constructor call immediately after import ******');
    expect(MinimalMockTelegrafConstructor).toHaveBeenCalledWith(currentConfigMock.default.telegramToken, expect.any(Object));
    expect(mockSetBotInstance).toHaveBeenCalledWith(bot);
    expect(bot).toBe(mockMinimalTelegrafInstance);

    const username = await botUsernameReady; // Ensure getMe promise resolves
    expect(username).toBe('MinimalTestBot');
    // Check getMe call after awaiting the promise that depends on it.
    expect(mockMinimalTelegrafInstance.telegram.getMe).toHaveBeenCalled();
    expect(mockMinimalTelegrafInstance.options.username).toBe('MinimalTestBot');
    // This bootstrapLogger call happens inside the .then() of getMe()
    expect(mockBootstrapLogger).toHaveBeenCalledWith('Bot username set to: MinimalTestBot');

    // Check command registrations (these happen synchronously on module load after bot init)
    expect(mockMinimalTelegrafInstance.start).toHaveBeenCalled();
    expect(mockMinimalTelegrafInstance.help).toHaveBeenCalled();
    const expectedCommands = ['surpriseme', 'support', 'reciters', 'channel', 'khatma', 'commands'];
    expectedCommands.forEach(commandName => {
        expect(mockMinimalTelegrafInstance.command).toHaveBeenCalledWith(commandName, expect.any(Function));
    });

    expect(mockMinimalTelegrafInstance.on).toHaveBeenCalledWith('text', expect.any(Function));
    expect(mockMinimalTelegrafInstance.on).toHaveBeenCalledWith('my_chat_member', expect.any(Function));
    expect(mockMinimalTelegrafInstance.action).toHaveBeenCalled(); // General check
    expect(mockMinimalTelegrafInstance.action).toHaveBeenCalledWith(JSON.stringify({ instructionsAction: true }), expect.any(Function));
    expect(mockMinimalTelegrafInstance.action).toHaveBeenCalledWith(expect.any(RegExp), expect.any(Function));
    expect(mockMinimalTelegrafInstance.telegram.setMyCommands).toHaveBeenCalled();
});

beforeEach(() => {
    // Clear mocks that might have their state changed by tests,
    // or by module-level code if not fully isolated by `jest.resetModules` for every single test.
    // For module-level calls that happen once on first import, these clears are more for subsequent tests if we had them.
    mockLogger.mockClear();
    mockSetBotInstance.mockClear();
    mockBootstrapLogger.mockClear();
    // MinimalMockTelegrafConstructor.mockClear(); // DO NOT CLEAR - its call is a one-time event in beforeAll

    mockMinimalTelegrafInstance.start.mockClear();
    mockMinimalTelegrafInstance.help.mockClear();
    mockMinimalTelegrafInstance.command.mockClear();
    mockMinimalTelegrafInstance.on.mockClear();
    mockMinimalTelegrafInstance.action.mockClear();
    mockMinimalTelegrafInstance.launch.mockClear();
    mockMinimalTelegrafInstance.catch.mockClear();
    // Re-prime getMe for each test if launchBot or other test actions cause re-evaluation that involves getMe
    mockMinimalTelegrafInstance.telegram.getMe.mockClear().mockResolvedValue({ id: 98765, is_bot: true, username: 'MinimalTestBot' });
    mockMinimalTelegrafInstance.telegram.sendMessage.mockClear().mockResolvedValue({});
    mockMinimalTelegrafInstance.telegram.setMyCommands.mockClear().mockResolvedValue(true);
    mockMinimalTelegrafInstance.options.username = undefined;
});

describe('Telegram Bot - Initialization and Structure', () => {
    it('should have initialized correctly (verified in beforeAll)', () => {
        expect(bot).toBe(mockMinimalTelegrafInstance);
        expect(MinimalMockTelegrafConstructor.mock.calls.length).toBeGreaterThanOrEqual(1);
    });

    it('launchBot should be a function', () => {
        expect(typeof launchBot).toBe('function');
    });
    it('sendAya should be a function', () => {
        expect(typeof sendAya).toBe('function');
    });
    it('surpriseAya should be a function', () => {
        expect(typeof surpriseAya).toBe('function');
    });
    it('handleText should be a function', () => {
        expect(typeof handleText).toBe('function');
    });
});

describe('launchBot', () => {
    beforeEach(() => {
        mockMinimalTelegrafInstance.launch.mockClear();
        mockMinimalTelegrafInstance.telegram.sendMessage.mockClear();
        mockCheckSource.mockClear().mockResolvedValue(undefined); // Use direct mock instance
    });

    it('should launch the bot and send startup message if devChatId is configured', async () => {
        // Forcefully set username on the mock instance to bypass potential async timing issues
        // with the SUT's getMe().then() for this specific test's condition.
        // The main beforeAll already awaits botUsernameReady, which should set this,
        // but this makes the condition for sendMessage explicit for this test.
        mockMinimalTelegrafInstance.options.username = 'MinimalTestBot';

        await launchBot();

        expect(mockMinimalTelegrafInstance.launch).toHaveBeenCalled();
        expect(mockMinimalTelegrafInstance.telegram.sendMessage).toHaveBeenCalledWith(
            currentConfigMock.default.devChatId,
            expect.stringContaining(`DailyAyaTelegram ${currentConfigMock.default.branch} instance`)
        );
        expect(mockCheckSource).toHaveBeenCalled();
    });

    it('should not send startup message if devChatId is not configured', async () => {
        const originalDevChatId = currentConfigMock.default.devChatId;
        currentConfigMock.default.devChatId = null; // Modify for this test

        await launchBot();

        expect(mockMinimalTelegrafInstance.launch).toHaveBeenCalled();
        expect(mockMinimalTelegrafInstance.telegram.sendMessage).not.toHaveBeenCalledWith(
            expect.anything(), // Or originalDevChatId
            expect.stringContaining('DailyAyaTelegram')
        );

        // Restore devChatId if other tests depend on it, though mocks should isolate.
        // Better to use a fresh config load if this becomes an issue. For now, this is okay.
        currentConfigMock.default.devChatId = originalDevChatId;
    });

    it('should handle bot.launch() failure', async () => {
        mockMinimalTelegrafInstance.launch.mockImplementationOnce(() => {
            throw new Error('Launch Failed');
        });

        await expect(launchBot()).rejects.toThrow('Launch Failed');
        expect(mockBootstrapLogger).toHaveBeenCalledWith('Failed to complete critical launchBot setup steps. Error:', expect.any(Error));
    });

    it('should not call checkSource if debugging is true', async () => {
        const originalDebugging = currentConfigMock.default.debugging;
        currentConfigMock.default.debugging = true;

        await launchBot();

        expect(mockCheckSource).not.toHaveBeenCalled(); // Use the direct mock function instance

        currentConfigMock.default.debugging = originalDebugging; // Restore
    });
});

// Placeholder describe blocks for other major functions
describe('sendAya', () => {
    it.todo('should correctly call senderSendAyaText');
    it.todo('should call senderSendAyaRecitation if withRecitation is true');
    it.todo('should handle errors from ayaSender functions');
    it.todo('should update lastAyaTime on block error');
});

describe('surpriseAya', () => {
    it.todo('should call sendAya with null ayaId, null reciter, and surprise trigger');
});

describe('handleText', () => {
    it.todo('should correctly parse Sura and Aya from text');
    it.todo('should call sendAya for valid requests');
    it.todo('should call helperSendUnrecognizedMessage for invalid requests');
});
