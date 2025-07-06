import { jest } from '@jest/globals';

// --- Manage config.js mock manually ---
let currentConfigMock = {
    __esModule: true,
    default: {
        telegramToken: 'TELEGRAMBOT_TEST_INITIAL_TOKEN',
        devChatId: 'TELEGRAMBOT_TEST_INITIAL_DEV_CHAT_ID',
        mongoDbCredentials: 'test-user:test-pass',
        mongoSubdomain: 'test-cluster.mongodb.net',
        mongoURI: 'mongodb+srv://test-user:test-pass@test-cluster.mongodb.net/?retryWrites=true&w=majority',
        branch: 'test-branch', inst: 'test-inst', host: 'test-host', totalInst: '1',
        debugging: false, codeVer: 'test-v0.0.0', instActiveUntil: '2000-01-01', port: 3007,
        timerCheckMinutes: 60, timerSendHours: 24,
        pingTargetGeneral: 'http://test.example.com', pingTargetAlternative: 'http://test.example.org',
        pingTargetTelegramApiBase: 'http://test.api.telegram.org',
        botLaunchRetryDelay: 1000, maxBotLaunchRetries: 1,
    },
};
jest.unstable_mockModule('./config.js', () => {
    console.log(`****** TELEGRAMBOT_TEST: unstable_mockModule for ./config.js using currentConfigMock (branch: ${currentConfigMock.default.branch}) ******`);
    return currentConfigMock;
});

// --- Mock Telegraf ---
const mockMinimalTelegrafInstance = {
    start: jest.fn(), help: jest.fn(), command: jest.fn(), on: jest.fn(),
    action: jest.fn(), launch: jest.fn(), catch: jest.fn(),
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
        __esModule: true, Telegraf: MinimalMockTelegrafConstructor,
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
    __esModule: true, logger: mockLogger, setBotInstance: mockSetBotInstance, bootstrapLogger: mockBootstrapLogger,
}));

// --- Mock other direct module dependencies ---

// database.js
const mockDbLastAyaTime = jest.fn();
const mockDbSetFavReciter = jest.fn();
const mockDbGetFavReciter = jest.fn();
jest.unstable_mockModule('./database.js', () => ({
    __esModule: true, lastAyaTime: mockDbLastAyaTime, setFavReciter: mockDbSetFavReciter, getFavReciter: mockDbGetFavReciter,
}));

// botHelpers.js
const mockHelperAdminChecker = jest.fn();
const mockHelperSuccessSend = jest.fn();
const mockHelperSendSorry = jest.fn();
const mockHelperAMenuButtons = jest.fn();
const mockHelperAdminProtectedAction = jest.fn(async (ctx, botTelegram, actionFn) => actionFn(ctx)); // Simplified for now
const mockHelperAdminConditionalAction = jest.fn();
const mockHelperSendUnrecognizedMessage = jest.fn();
const mockHelperInstructions = jest.fn();
jest.unstable_mockModule('./botHelpers.js', () => ({
    __esModule: true,
    adminChecker: mockHelperAdminChecker, successSend: mockHelperSuccessSend, sendSorry: mockHelperSendSorry,
    aMenuButtons: mockHelperAMenuButtons, helperAdminProtectedAction: mockHelperAdminProtectedAction,
    helperAdminConditionalAction: mockHelperAdminConditionalAction, sendUnrecognizedMessage: mockHelperSendUnrecognizedMessage,
    instructions: mockHelperInstructions,
}));

// commandHandlers.js
jest.unstable_mockModule('./botHandlers/commandHandlers.js', () => ({
    __esModule: true, handleStartCommand: jest.fn(), handleHelpCommand: jest.fn(), handleSurpriseMeCommand: jest.fn(),
    handleSupportCommand: jest.fn(), handleRecitersCommand: jest.fn(), handleChannelCommand: jest.fn(),
    handleKhatmaCommand: jest.fn(), handleCommandsCommand: jest.fn(),
}));

// actionHandlers.js
jest.unstable_mockModule('./botHandlers/actionHandlers.js', () => ({
    __esModule: true, handleGroupKhatmaAction: jest.fn(), handleRecitersNavPageAction: jest.fn(),
    handleSetReciterAction: jest.fn(), handleInstructionsAction: jest.fn(), handleSurpriseAyaAction: jest.fn(),
    handleCurrAyaAction: jest.fn(), handleAMenuAction: jest.fn(), handleReciteAction: jest.fn(),
}));

// khatmaService.js
jest.unstable_mockModule('./botFeatures/khatmaService.js', () => ({ __esModule: true, khatmaUpdate: jest.fn() }));

// ayaSender.js
const mockSenderSendAyaText = jest.fn();
const mockSenderSendAyaRecitation = jest.fn();
jest.unstable_mockModule('./ayaSender.js', () => ({
    __esModule: true, sendAyaText: mockSenderSendAyaText, sendAyaRecitation: mockSenderSendAyaRecitation,
}));

// quranService.js
const mockPrepareAya = jest.fn();
const mockGetRecitation = jest.fn();
const mockIsValidReciter = jest.fn();
const mockGetRandomReciterIdentifier = jest.fn();
const mockNextAya = jest.fn();
const mockAyaId2suraAya = jest.fn();
const mockSuraAya2ayaId = jest.fn();
const mockRasmifize = jest.fn(text => text);
const mockGetQuranData = jest.fn(() => ({ arReciters: [] }));
const mockCheckSource = jest.fn();
jest.unstable_mockModule('./quranService.js', () => ({
    __esModule: true, prepareAya: mockPrepareAya, getRecitation: mockGetRecitation, isValidReciter: mockIsValidReciter,
    getRandomReciterIdentifier: mockGetRandomReciterIdentifier, nextAya: mockNextAya, ayaId2suraAya: mockAyaId2suraAya,
    suraAya2ayaId: mockSuraAya2ayaId, normalizedSurasArNames: [], rasmifize: mockRasmifize,
    getQuranData: mockGetQuranData, checkSource: mockCheckSource,
}));

// reciterService.js
jest.unstable_mockModule('./botFeatures/reciterService.js', () => ({
    __esModule: true, populateRecitersButtons: jest.fn(), recitersNavPage: jest.fn(),
}));

// utils.js
const mockRandomAyaNumber = jest.fn();
const mockNumArabicToEnglish = jest.fn(text => text);
jest.unstable_mockModule('./utils.js', () => ({
    __esModule: true, randomAyaNumber: mockRandomAyaNumber, numArabicToEnglish: mockNumArabicToEnglish,
}));

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

    console.log('****** TELEGRAMBOT_TEST: Asserting Telegraf constructor call immediately after import ******');
    expect(MinimalMockTelegrafConstructor).toHaveBeenCalledWith(currentConfigMock.default.telegramToken, expect.any(Object));
    expect(mockSetBotInstance).toHaveBeenCalledWith(bot);
    expect(bot).toBe(mockMinimalTelegrafInstance);

    const username = await botUsernameReady;
    expect(username).toBe('MinimalTestBot');
    expect(mockMinimalTelegrafInstance.telegram.getMe).toHaveBeenCalled();
    expect(mockMinimalTelegrafInstance.options.username).toBe('MinimalTestBot');
    expect(mockBootstrapLogger).toHaveBeenCalledWith('Bot username set to: MinimalTestBot');

    expect(mockMinimalTelegrafInstance.start).toHaveBeenCalled();
    expect(mockMinimalTelegrafInstance.help).toHaveBeenCalled();
    const expectedCommands = ['surpriseme', 'support', 'reciters', 'channel', 'khatma', 'commands'];
    expectedCommands.forEach(commandName => {
        expect(mockMinimalTelegrafInstance.command).toHaveBeenCalledWith(commandName, expect.any(Function));
    });
    expect(mockMinimalTelegrafInstance.on).toHaveBeenCalledWith('text', expect.any(Function));
    expect(mockMinimalTelegrafInstance.on).toHaveBeenCalledWith('my_chat_member', expect.any(Function));
    expect(mockMinimalTelegrafInstance.action).toHaveBeenCalled();
    expect(mockMinimalTelegrafInstance.action).toHaveBeenCalledWith(JSON.stringify({ instructionsAction: true }), expect.any(Function));
    expect(mockMinimalTelegrafInstance.action).toHaveBeenCalledWith(expect.any(RegExp), expect.any(Function));
    expect(mockMinimalTelegrafInstance.telegram.setMyCommands).toHaveBeenCalled();
});

beforeEach(() => {
    mockLogger.mockClear();
    mockSetBotInstance.mockClear();
    mockBootstrapLogger.mockClear();
    MinimalMockTelegrafConstructor.mockClear();

    mockMinimalTelegrafInstance.start.mockClear();
    mockMinimalTelegrafInstance.help.mockClear();
    mockMinimalTelegrafInstance.command.mockClear();
    mockMinimalTelegrafInstance.on.mockClear();
    mockMinimalTelegrafInstance.action.mockClear();
    mockMinimalTelegrafInstance.launch.mockClear();
    mockMinimalTelegrafInstance.catch.mockClear();
    mockMinimalTelegrafInstance.telegram.getMe.mockClear().mockResolvedValue({ id: 98765, is_bot: true, username: 'MinimalTestBot' });
    mockMinimalTelegrafInstance.telegram.sendMessage.mockClear().mockResolvedValue({});
    mockMinimalTelegrafInstance.telegram.setMyCommands.mockClear().mockResolvedValue(true);
    mockMinimalTelegrafInstance.options.username = undefined;

    // Clear SUT direct dependency mocks
    mockDbLastAyaTime.mockClear();
    mockSenderSendAyaText.mockClear().mockResolvedValue({ chat: { id: 123 }, message_id: 456, from: {id: 'botid'} });
    mockSenderSendAyaRecitation.mockClear().mockResolvedValue({});
    mockRandomAyaNumber.mockClear().mockReturnValue(123);

    mockHelperSuccessSend.mockClear();
    mockHelperSendSorry.mockClear();
    mockHelperAMenuButtons.mockClear();
    mockDbGetFavReciter.mockClear();
    mockPrepareAya.mockClear();
    mockGetRecitation.mockClear();
    mockIsValidReciter.mockClear();
    mockGetRandomReciterIdentifier.mockClear();
    mockNextAya.mockClear();
    mockAyaId2suraAya.mockClear();
});

describe('Telegram Bot - Initialization and Structure', () => {
    it('should have initialized correctly (core checks in beforeAll)', () => {
        // Core initialization (like Telegraf constructor call) is asserted in beforeAll.
        // This test can verify the outcome, e.g., that `bot` is the expected mock instance.
        expect(bot).toBe(mockMinimalTelegrafInstance);
        // If MinimalMockTelegrafConstructor.toHaveBeenCalledWith in beforeAll passed, its call count was >= 1 then.
        // No need to re-check calls.length here if beforeEach clears it.
    });
    it('launchBot should be a function', () => expect(typeof launchBot).toBe('function'));
    it('sendAya should be a function', () => expect(typeof sendAya).toBe('function'));
    it('surpriseAya should be a function', () => expect(typeof surpriseAya).toBe('function'));
    it('handleText should be a function', () => expect(typeof handleText).toBe('function'));
});

describe('launchBot', () => {
    beforeEach(() => {
        mockMinimalTelegrafInstance.launch.mockClear();
        mockMinimalTelegrafInstance.telegram.sendMessage.mockClear();
        mockCheckSource.mockClear().mockResolvedValue(undefined);
    });

    it('should launch the bot and send startup message if devChatId is configured', async () => {
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
        currentConfigMock.default.devChatId = null;
        mockMinimalTelegrafInstance.options.username = 'MinimalTestBot';
        await launchBot();
        expect(mockMinimalTelegrafInstance.launch).toHaveBeenCalled();
        expect(mockMinimalTelegrafInstance.telegram.sendMessage).not.toHaveBeenCalledWith(
            expect.anything(), expect.stringContaining('DailyAyaTelegram')
        );
        currentConfigMock.default.devChatId = originalDevChatId;
    });

    it('should handle bot.launch() failure', async () => {
        mockMinimalTelegrafInstance.options.username = 'MinimalTestBot'; // Ensure username is set for pre-launch steps
        mockMinimalTelegrafInstance.launch.mockImplementationOnce(() => { throw new Error('Launch Failed'); });
        await expect(launchBot()).rejects.toThrow('Launch Failed');
        expect(mockBootstrapLogger).toHaveBeenCalledWith('Failed to complete critical launchBot setup steps. Error:', expect.any(Error));
    });

    it('should not call checkSource if debugging is true', async () => {
        const originalDebugging = currentConfigMock.default.debugging;
        currentConfigMock.default.debugging = true;
        mockMinimalTelegrafInstance.options.username = 'MinimalTestBot';
        await launchBot();
        expect(mockCheckSource).not.toHaveBeenCalled();
        currentConfigMock.default.debugging = originalDebugging;
    });
});

describe('sendAya', () => {
    let mockChatId;
    let mockSenderDepsBase;

    beforeEach(() => {
        mockChatId = 12345;
        mockMinimalTelegrafInstance.options.username = 'MinimalTestBot'; // Ensure username is set

        // Base senderDependencies, specific mocks will be primed in tests
        mockSenderDepsBase = {
            botTelegram: mockMinimalTelegrafInstance.telegram,
            botUsername: mockMinimalTelegrafInstance.options.username,
            prepareAyaFn: mockPrepareAya,
            helperSendSorryFn: mockHelperSendSorry,
            helperAMenuButtonsFn: mockHelperAMenuButtons,
            helperSuccessSendFn: mockHelperSuccessSend,
            lastAyaTimeDbFn: mockDbLastAyaTime,
            ayaId2suraAyaFn: mockAyaId2suraAya,
            isValidReciterFn: mockIsValidReciter,
            getFavReciterDbFn: mockDbGetFavReciter,
            getRandomReciterIdentifierFn: mockGetRandomReciterIdentifier,
            getRecitationFn: mockGetRecitation,
        };
    });

    it('should call senderSendAyaText and not recitation by default', async () => {
        await sendAya(mockChatId, 10, 'ar.alafasy', 'en', 'test'); // withRecitation defaults to false
        expect(mockSenderSendAyaText).toHaveBeenCalledWith(
            expect.objectContaining(mockSenderDepsBase), mockChatId, 10, 'ar.alafasy', 'en', 'test'
        );
        expect(mockSenderSendAyaRecitation).not.toHaveBeenCalled();
    });

    it('should call senderSendAyaRecitation if withRecitation is true and sendAyaText succeeds', async () => {
        const mockCtxFromSendText = { chat: { id: mockChatId }, message_id: 789, from: {id: 'botid'} };
        mockSenderSendAyaText.mockResolvedValue(mockCtxFromSendText);

        await sendAya(mockChatId, 10, 'ar.alafasy', 'en', 'test', true);
        expect(mockSenderSendAyaText).toHaveBeenCalledTimes(1);
        expect(mockSenderSendAyaRecitation).toHaveBeenCalledWith(
            expect.objectContaining(mockSenderDepsBase), mockCtxFromSendText, 10, 'ar.alafasy'
        );
    });

    it('should use randomAyaNumber if ayaId is null', async () => {
        mockRandomAyaNumber.mockReturnValue(77);
        await sendAya(mockChatId, null, 'ar.alafasy', 'en', 'surprise');
        expect(mockRandomAyaNumber).toHaveBeenCalled();
        expect(mockSenderSendAyaText).toHaveBeenCalledWith(
            expect.anything(), mockChatId, 77, 'ar.alafasy', 'en', 'surprise'
        );
    });

    it('should call lastAyaTime with "blocked" on specific Telegram block errors', async () => {
        const blockError = new Error("Blocked by user");
        blockError.response = { description: "Forbidden: bot was blocked by the user" };
        mockSenderSendAyaText.mockRejectedValue(blockError);

        await sendAya(mockChatId, 10, 'ar.alafasy', 'en', 'test');
        expect(mockDbLastAyaTime).toHaveBeenCalledWith(mockChatId, 'blocked');
    });

    it('should not call lastAyaTime with "blocked" for generic errors from sendAyaText', async () => {
        mockSenderSendAyaText.mockRejectedValue(new Error("Generic network error"));
        await sendAya(mockChatId, 10, 'ar.alafasy', 'en', 'test');
        // lastAyaTime might be called by successSend if that's part of a finally, but not with 'blocked'
        const blockCall = mockDbLastAyaTime.mock.calls.find(call => call[1] === 'blocked');
        expect(blockCall).toBeUndefined();
    });
     it('should not call recitation if sendAyaText fails', async () => {
        mockSenderSendAyaText.mockRejectedValue(new Error("Failed to send text"));
        await sendAya(mockChatId, 10, 'ar.alafasy', 'en', 'test', true);
        expect(mockSenderSendAyaRecitation).not.toHaveBeenCalled();
    });
});

describe('surpriseAya', () => {
    it.todo('should call sendAya with null ayaId, null reciter, and surprise trigger');
});

describe('handleText', () => {
    it.todo('should correctly parse Sura and Aya from text');
    it.todo('should call sendAya for valid requests');
    it.todo('should call helperSendUnrecognizedMessage for invalid requests');
});
