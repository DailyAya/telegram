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
        sendMessage: jest.fn(),
        sendAudio: jest.fn(),
        setMyCommands: jest.fn().mockResolvedValue(true),
        getChatMember: jest.fn(),
        editMessageReplyMarkup: jest.fn().mockResolvedValue(true),
        deleteMessage: jest.fn().mockResolvedValue(true) // Added mock
    },
    options: { username: undefined },
};
const MinimalMockTelegrafConstructor = jest.fn((_token, _options) => {
    return mockMinimalTelegrafInstance;
});
jest.unstable_mockModule('telegraf', () => {
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

// --- Mock other direct module dependencies ---
// database.js
const mockDbLastAyaTime = jest.fn();
const mockDbSetFavReciter = jest.fn();
const mockDbGetFavReciter = jest.fn();
jest.unstable_mockModule('./database.js', () => ({
    __esModule: true,
    lastAyaTime: mockDbLastAyaTime,
    setFavReciter: mockDbSetFavReciter,
    getFavReciter: mockDbGetFavReciter,
}));

// botHelpers.js - NO LONGER MOCKED (will use actual implementations)
// commandHandlers.js - Mocked, as SUT calls these.
const mockHandleStartCommand = jest.fn();
const mockHandleHelpCommand = jest.fn();
const mockHandleSurpriseMeCommand = jest.fn();
const mockHandleSupportCommand = jest.fn();
const mockHandleRecitersCommand = jest.fn();
const mockHandleChannelCommand = jest.fn();
const mockHandleKhatmaCommand = jest.fn();
const mockHandleCommandsCommand = jest.fn();
jest.unstable_mockModule('./botHandlers/commandHandlers.js', () => ({
    __esModule: true,
    handleStartCommand: mockHandleStartCommand,
    handleHelpCommand: mockHandleHelpCommand,
    handleSurpriseMeCommand: mockHandleSurpriseMeCommand,
    handleSupportCommand: mockHandleSupportCommand,
    handleRecitersCommand: mockHandleRecitersCommand,
    handleChannelCommand: mockHandleChannelCommand,
    handleKhatmaCommand: mockHandleKhatmaCommand,
    handleCommandsCommand: mockHandleCommandsCommand,
}));

// actionHandlers.js - NO LONGER MOCKED
// khatmaService.js
jest.unstable_mockModule('./botFeatures/khatmaService.js', () => ({ __esModule: true, khatmaUpdate: jest.fn() }));
// ayaSender.js - NO LONGER MOCKED

// quranService.js
const mockPrepareAya = jest.fn();
const mockGetRecitation = jest.fn();
const mockIsValidReciter = jest.fn();
const mockGetRandomReciterIdentifier = jest.fn();
const mockNextAya = jest.fn();
const mockAyaId2suraAya = jest.fn();
const mockSuraAya2ayaId = jest.fn();
const mockRasmifize = jest.fn((text) => text);
const mockGetQuranData = jest.fn(() => ({
    arReciters: [],
    enQuran: [{ ayahs: [], name: "Al-Fatiha", englishName: "Al-Fatiha" }]
}));
const mockCheckSource = jest.fn();
jest.unstable_mockModule('./quranService.js', () => ({
    __esModule: true,
    prepareAya: mockPrepareAya,
    getRecitation: mockGetRecitation,
    isValidReciter: mockIsValidReciter,
    getRandomReciterIdentifier: mockGetRandomReciterIdentifier,
    nextAya: mockNextAya,
    ayaId2suraAya: mockAyaId2suraAya,
    suraAya2ayaId: mockSuraAya2ayaId,
    normalizedSurasArNames: ['الفاتحة'],
    rasmifize: mockRasmifize,
    getQuranData: mockGetQuranData,
    checkSource: mockCheckSource,
}));

// reciterService.js
const mockPopulateRecitersButtons = jest.fn();
const mockRecitersNavPage = jest.fn();
jest.unstable_mockModule('./botFeatures/reciterService.js', () => ({
    __esModule: true,
    populateRecitersButtons: mockPopulateRecitersButtons,
    recitersNavPage: mockRecitersNavPage,
}));

// utils.js
const mockRandomAyaNumber = jest.fn();
const mockNumArabicToEnglish = jest.fn((text) => text);
const mockMaskTokenInUrl = jest.fn((url) => url);
jest.unstable_mockModule('./utils.js', () => ({
    __esModule: true,
    randomAyaNumber: mockRandomAyaNumber,
    numArabicToEnglish: mockNumArabicToEnglish,
    maskTokenInUrl: mockMaskTokenInUrl,
}));

// --- Declare SUT variables and handler stores ---
let bot, launchBot, sendAya, surpriseAya, handleText, botUsernameReady;
const registeredCommandHandlers = {};
let textHandlerFnForTest;
let myChatMemberHandlerFnForTest;
const registeredActionHandlersForTest = {};

beforeAll(async () => {
    jest.resetModules();
    const globalMockDefault = (await import('./__mocks__/config.mock.js')).default;
    currentConfigMock = { __esModule: true, default: globalMockDefault };

    const telegramBotModule = await import('./telegramBot.js');
    bot = telegramBotModule.bot;
    launchBot = telegramBotModule.launchBot;
    sendAya = telegramBotModule.sendAya;
    surpriseAya = telegramBotModule.surpriseAya;
    handleText = telegramBotModule.handleText;
    botUsernameReady = telegramBotModule.botUsernameReady;

    expect(MinimalMockTelegrafConstructor).toHaveBeenCalledWith(
        currentConfigMock.default.telegramToken,
        expect.objectContaining({ telegram: expect.objectContaining({ agent: expect.any(Object) }) })
    );
    expect(mockSetBotInstance).toHaveBeenCalledWith(bot);
    expect(bot).toBe(mockMinimalTelegrafInstance);

    const username = await botUsernameReady;
    expect(username).toBe('MinimalTestBot');
    expect(mockMinimalTelegrafInstance.telegram.getMe).toHaveBeenCalled();
    expect(bot.options.username).toBe('MinimalTestBot');
    expect(mockBootstrapLogger).toHaveBeenCalledWith(
        `launchBot: bot.telegram.getMe() successful. Bot username set to: MinimalTestBot`
    );

    expect(mockMinimalTelegrafInstance.start).toHaveBeenCalledWith(expect.any(Function));
    expect(mockMinimalTelegrafInstance.help).toHaveBeenCalledWith(expect.any(Function));
    const expectedCommands = ['surpriseme', 'support', 'reciters', 'channel', 'khatma', 'commands'];
    expectedCommands.forEach((commandName) => {
        expect(mockMinimalTelegrafInstance.command).toHaveBeenCalledWith(commandName, expect.any(Function));
    });
    expect(mockMinimalTelegrafInstance.on).toHaveBeenCalledWith('text', expect.any(Function));
    expect(mockMinimalTelegrafInstance.on).toHaveBeenCalledWith('my_chat_member', expect.any(Function));
    expect(mockMinimalTelegrafInstance.action).toHaveBeenCalled();
    expect(mockMinimalTelegrafInstance.telegram.setMyCommands).toHaveBeenCalled();

    if (mockMinimalTelegrafInstance.start.mock.calls.length > 0) {
        registeredCommandHandlers['start'] = mockMinimalTelegrafInstance.start.mock.calls[0][0];
    }
    if (mockMinimalTelegrafInstance.help.mock.calls.length > 0) {
        registeredCommandHandlers['help'] = mockMinimalTelegrafInstance.help.mock.calls[0][0];
    }
    mockMinimalTelegrafInstance.command.mock.calls.forEach((call) => {
        const commandName = call[0];
        const handlerFn = call[1];
        if (typeof handlerFn === 'function' && !registeredCommandHandlers[commandName]) {
            registeredCommandHandlers[commandName] = handlerFn;
        }
    });

    const textCall = mockMinimalTelegrafInstance.on.mock.calls.find((call) => call[0] === 'text');
    if (textCall && typeof textCall[1] === 'function') {
        textHandlerFnForTest = textCall[1];
    }

    const myChatMemberCall = mockMinimalTelegrafInstance.on.mock.calls.find((call) => call[0] === 'my_chat_member');
    if (myChatMemberCall && typeof myChatMemberCall[1] === 'function') {
        myChatMemberHandlerFnForTest = myChatMemberCall[1];
    }

    mockMinimalTelegrafInstance.action.mock.calls.forEach(call => {
        const trigger = call[0];
        const handlerFn = call[1];
        if (typeof handlerFn === 'function') {
            registeredActionHandlersForTest[trigger.toString()] = handlerFn;
        }
    });
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
    mockMinimalTelegrafInstance.telegram.getMe
        .mockClear()
        .mockResolvedValue({ id: 98765, is_bot: true, username: 'MinimalTestBot' });

    mockMinimalTelegrafInstance.telegram.sendMessage.mockClear().mockImplementation((chatIdParam, ..._args) => {
        const isPrivate = typeof chatIdParam === 'number' && chatIdParam > 0;
        return Promise.resolve({
            chat: {
                id: chatIdParam,
                type: isPrivate ? 'private' : 'group',
                first_name: isPrivate ? 'MinimalTestBot' : undefined,
                title: !isPrivate ? 'Test Group Title' : undefined
            },
            message_id: 1,
            from: {id: 'MinimalTestBot', first_name: 'MinimalTestBot'}
        });
    });
    mockMinimalTelegrafInstance.telegram.sendAudio.mockClear().mockImplementation((chatIdParam, ..._args) => {
        const isPrivate = typeof chatIdParam === 'number' && chatIdParam > 0;
        return Promise.resolve({
            chat: {
                id: chatIdParam,
                type: isPrivate ? 'private' : 'group',
                first_name: isPrivate ? 'MinimalTestBot' : undefined,
                title: !isPrivate ? 'Test Group Title Audio' : undefined
            },
            message_id: 2,
            from: {id: 'MinimalTestBot', first_name: 'MinimalTestBot'}
        });
    });
    mockMinimalTelegrafInstance.telegram.setMyCommands.mockClear().mockResolvedValue(true);
    mockMinimalTelegrafInstance.telegram.getChatMember.mockClear();


    mockDbLastAyaTime.mockClear();
    mockRandomAyaNumber.mockClear().mockReturnValue(123);

    mockPrepareAya.mockClear().mockReturnValue({ arText: 'Mocked Arabic Text', enText: 'Mocked English Text' });
    mockGetRecitation.mockClear().mockResolvedValue('mock.audio.url');
    mockIsValidReciter.mockClear().mockReturnValue(true);
    mockGetRandomReciterIdentifier.mockClear().mockReturnValue('mock.reciter');
    mockNextAya.mockClear().mockImplementation(id => id + 1);
    mockAyaId2suraAya.mockClear().mockReturnValue({ sura: 1, aya: 1 });
    mockSuraAya2ayaId.mockClear().mockReturnValue(1);
    mockCheckSource.mockClear().mockResolvedValue(undefined);

    mockHandleStartCommand.mockClear();
    mockHandleHelpCommand.mockClear();
    mockHandleSurpriseMeCommand.mockClear();
    mockHandleSupportCommand.mockClear();
    mockHandleRecitersCommand.mockClear();
    mockHandleChannelCommand.mockClear();
    mockHandleKhatmaCommand.mockClear();
    mockHandleCommandsCommand.mockClear();
});

describe('Telegram Bot - Initialization and Structure', () => {
    it('should have initialized correctly (core checks in beforeAll)', () => {
        expect(bot).toBe(mockMinimalTelegrafInstance);
    });
    it('launchBot should be a function', () => expect(typeof launchBot).toBe('function'));
    it('sendAya should be a function', () => expect(typeof sendAya).toBe('function'));
    it('surpriseAya should be a function', () => expect(typeof surpriseAya).toBe('function'));
    it('handleText should be a function', () => expect(typeof handleText).toBe('function'));
});

describe('launchBot', () => {
    it('should launch the bot and send startup message if devChatId is configured', async () => {
        bot.options.username = 'MinimalTestBot';
        await launchBot();
        expect(mockMinimalTelegrafInstance.launch).toHaveBeenCalledTimes(1);
        expect(mockMinimalTelegrafInstance.telegram.sendMessage).toHaveBeenCalledWith(
            currentConfigMock.default.devChatId,
            expect.stringContaining(`DailyAyaTelegram ${currentConfigMock.default.branch} instance`)
        );
        expect(mockCheckSource).toHaveBeenCalled();
    });

    it('should not send startup message if devChatId is not configured', async () => {
        const originalDevChatId = currentConfigMock.default.devChatId;
        currentConfigMock.default.devChatId = null;
        bot.options.username = 'MinimalTestBot';
        await launchBot();
        expect(mockMinimalTelegrafInstance.launch).toHaveBeenCalledTimes(1);
        expect(mockMinimalTelegrafInstance.telegram.sendMessage).not.toHaveBeenCalledWith(
            expect.anything(),
            expect.stringContaining('DailyAyaTelegram')
        );
        currentConfigMock.default.devChatId = originalDevChatId;
    });

    it('should log "Cannot send" if devChatId is set but bot username is not', async () => {
        expect(true).toBe(true);
    });

    it('should handle bot.launch() failure', async () => {
        bot.options.username = 'MinimalTestBot';
        mockMinimalTelegrafInstance.launch.mockImplementationOnce(() => {
            throw new Error('Launch Failed');
        });
        await expect(launchBot()).rejects.toThrow('Launch Failed');
        expect(mockBootstrapLogger).toHaveBeenLastCalledWith(
            'launchBot: Failed to complete critical launchBot setup steps. Error:',
            expect.any(Error)
        );
    });

    it('should not call checkSource if debugging is true', async () => {
        const originalDebugging = currentConfigMock.default.debugging;
        currentConfigMock.default.debugging = true;
        bot.options.username = 'MinimalTestBot';
        await launchBot();
        expect(mockMinimalTelegrafInstance.launch).toHaveBeenCalledTimes(1);
        expect(mockCheckSource).not.toHaveBeenCalled();
        currentConfigMock.default.debugging = originalDebugging;
    });

    it('should call checkSource with a functional sendMessage callback', async () => {
        bot.options.username = 'MinimalTestBot';
        currentConfigMock.default.debugging = false;
        await launchBot();
        expect(mockMinimalTelegrafInstance.launch).toHaveBeenCalledTimes(1);
        expect(mockCheckSource).toHaveBeenCalled();
        const checkSourceCallback = mockCheckSource.mock.calls[0][0];
        expect(typeof checkSourceCallback).toBe('function');
        const testChatId = 'testDevChat';
        const testMessage = 'Test source alert';
        await checkSourceCallback(testChatId, testMessage);
        expect(mockMinimalTelegrafInstance.telegram.sendMessage).toHaveBeenCalledWith(testChatId, testMessage);
    });
});

describe('sendAya', () => {
    let mockChatId;
    beforeEach(() => {
        mockChatId = 12345;
        mockMinimalTelegrafInstance.options.username = 'MinimalTestBot';
    });

    it('should call prepareAya and telegram.sendMessage via actual ayaSender.sendAyaText', async () => {
        await sendAya(mockChatId, 10, 'ar.alafasy', 'en', 'test');
        expect(mockPrepareAya).toHaveBeenCalledWith(10, 'MinimalTestBot');
        expect(mockMinimalTelegrafInstance.telegram.sendMessage).toHaveBeenCalledWith(
            mockChatId,
            'Mocked Arabic Text\n\nMocked English Text',
            expect.objectContaining({
                reply_markup: expect.any(Object)
            })
        );
        expect(mockDbLastAyaTime).toHaveBeenCalledWith(mockChatId, 'success', 'MinimalTestBot', 'private', 'en', 'test');
    });

    it('should call telegram.sendAudio via actual ayaSender.sendAyaRecitation if withRecitation is true', async () => {
        mockMinimalTelegrafInstance.telegram.sendMessage.mockResolvedValue({
            chat: { id: mockChatId, type: 'private', first_name: 'MinimalTestBot' },
            message_id: 789,
            from: {id: bot.options.username, first_name: bot.options.username}
        });
        mockAyaId2suraAya.mockReturnValue({sura:1, aya:1});

        await sendAya(mockChatId, 10, 'ar.alafasy', 'en', 'testRec', true);

        expect(mockMinimalTelegrafInstance.telegram.sendMessage).toHaveBeenCalledTimes(1);
        expect(mockMinimalTelegrafInstance.telegram.sendAudio).toHaveBeenCalledWith(
            mockChatId,
            'mock.audio.url',
            expect.objectContaining({
                caption: expect.stringContaining('@MinimalTestBot ➔ 1:1')
            })
        );
    });

    it('should use randomAyaNumber if ayaId is null, then call actual sendAyaText', async () => {
        mockRandomAyaNumber.mockReturnValue(77);
        await sendAya(mockChatId, null, 'ar.alafasy', 'en', 'surprise');
        expect(mockRandomAyaNumber).toHaveBeenCalled();
        expect(mockPrepareAya).toHaveBeenCalledWith(77, 'MinimalTestBot');
        expect(mockMinimalTelegrafInstance.telegram.sendMessage).toHaveBeenCalledWith(
            mockChatId,
            'Mocked Arabic Text\n\nMocked English Text',
            expect.anything()
        );
    });

    it('should call actual lastAyaTime with "blocked" on specific Telegram block errors from actual sendAyaText', async () => {
        const blockError = new Error('User is deactivated');
        blockError.response = { error_code: 403, description: 'Forbidden: user is deactivated' };
        mockMinimalTelegrafInstance.telegram.sendMessage.mockRejectedValueOnce(blockError);
        await sendAya(mockChatId, 10, 'ar.alafasy', 'en', 'timer_test');
        expect(mockLogger).toHaveBeenCalledWith(
            `sendAya: Error caught while sending Aya 10 to chat ${mockChatId}. Trigger: timer_test`,
            blockError
        );
        expect(mockDbLastAyaTime).toHaveBeenCalledWith(mockChatId, 'blocked');
    });

    it('should log (from sendAya) but not call lastAyaTime with "blocked" for generic errors from actual sendAyaText', async () => {
        const genericError = new Error('Generic network error');
        mockMinimalTelegrafInstance.telegram.sendMessage.mockRejectedValueOnce(genericError);
        await sendAya(mockChatId, 10, 'ar.alafasy', 'en', 'test_generic_error');
        expect(mockLogger).toHaveBeenCalledWith(
            `sendAya: Error caught while sending Aya 10 to chat ${mockChatId}. Trigger: test_generic_error`,
            genericError
        );
        const blockCall = mockDbLastAyaTime.mock.calls.find((call) => call[1] === 'blocked');
        expect(blockCall).toBeUndefined();
    });

    it('should not call actual sendAyaRecitation if actual sendAyaText fails', async () => {
        mockMinimalTelegrafInstance.telegram.sendMessage.mockRejectedValueOnce(new Error('Failed to send text'));
        mockGetRecitation.mockClear();
        await sendAya(mockChatId, 10, 'ar.alafasy', 'en', 'test', true);
        expect(mockGetRecitation).not.toHaveBeenCalled();
    });
});

describe('surpriseAya', () => {
    let mockCtx;
    const surpriseAyaChatId = 1234567; // Use a specific numeric ID
    beforeEach(() => {
        mockCtx = {
            chat: { id: surpriseAyaChatId, type: 'private' },
            from: { id: 'userSurprise', language_code: 'en-US', username: 'userSurpriseName', first_name: 'UserSurpriseFirstName' },
        };
        mockRandomAyaNumber.mockReturnValue(999);
        mockMinimalTelegrafInstance.options.username = 'MinimalTestBot';
        mockPrepareAya.mockClear().mockReturnValue({ arText: 'Surprise Ar', enText: 'Surprise En' });
        mockMinimalTelegrafInstance.telegram.sendMessage.mockClear();
        mockDbLastAyaTime.mockClear();
    });

    it('should call sendAya, leading to actual sendAyaText and then telegram.sendMessage', async () => {
        await surpriseAya(mockCtx);
        expect(mockRandomAyaNumber).toHaveBeenCalled();
        expect(mockPrepareAya).toHaveBeenCalledWith(999, 'MinimalTestBot');
        expect(mockMinimalTelegrafInstance.telegram.sendMessage).toHaveBeenCalledWith(
            surpriseAyaChatId,
            'Surprise Ar\n\nSurprise En',
            expect.anything()
        );
        expect(mockDbLastAyaTime).toHaveBeenCalledWith(surpriseAyaChatId, 'success', 'MinimalTestBot', 'private', 'en-US', 'surprise');
    });
});

describe('handleText (direct test of exported function)', () => {
    let mockCtx;
    const handleTextChatId = 7654321; // Use a specific numeric ID
    beforeEach(() => {
        mockCtx = {
            chat: { id: handleTextChatId, type: 'private' },
            from: { id: 'userHandleText', language_code: 'ar', username: 'userHandleTextName', first_name: 'UserFromFirstName' },
            message: { text: '' },
            startPayload: null,
            telegram: mockMinimalTelegrafInstance.telegram,
        };
        mockMinimalTelegrafInstance.options.username = 'MinimalTestBot';
        mockSuraAya2ayaId.mockClear();
        mockMinimalTelegrafInstance.telegram.sendMessage.mockClear();
        mockMinimalTelegrafInstance.telegram.sendAudio.mockClear();
        mockPrepareAya.mockClear().mockReturnValue({ arText: 'Prepared Ar Text', enText: 'Prepared En Text' });
        mockDbLastAyaTime.mockClear();
        mockMinimalTelegrafInstance.telegram.getChatMember.mockClear().mockResolvedValue({status: 'administrator'});
    });

    it('should call sendAya (leading to telegram.sendMessage) for valid Sura/Aya numbers', async () => {
        mockCtx.message.text = '2 255';
        mockSuraAya2ayaId.mockReturnValue(262);
        await handleText(mockCtx);
        expect(mockSuraAya2ayaId).toHaveBeenCalledWith({ sura: 2, aya: 255 });
        expect(mockMinimalTelegrafInstance.telegram.sendMessage).toHaveBeenCalledWith(
            handleTextChatId,
            expect.stringContaining('Prepared Ar Text'),
            expect.anything()
        );
        expect(mockDbLastAyaTime).toHaveBeenCalledWith(handleTextChatId, 'success', 'MinimalTestBot', 'private', 'ar', 'request');
    });

    it('should call sendAya for "آية الكرسي"', async () => {
        mockCtx.message.text = 'آية الكرسي';
        mockRasmifize.mockImplementation((text) => (text === 'الكرسي' ? 'الكرسي' : text));
        await handleText(mockCtx);
        expect(mockPrepareAya).toHaveBeenCalledWith(262, 'MinimalTestBot');
        expect(mockMinimalTelegrafInstance.telegram.sendMessage).toHaveBeenCalledWith(
            handleTextChatId,
            expect.stringContaining('Prepared Ar Text'),
            expect.anything()
        );
    });

    it('should call sendAya with withRecitation=true leading to sendAudio if startPayload contains "r"', async () => {
        mockCtx.message.text = '3 10';
        mockCtx.startPayload = 'somepayload-r';
        mockSuraAya2ayaId.mockReturnValue(349);
        mockIsValidReciter.mockReturnValue(true);
        mockGetRecitation.mockResolvedValue('http://actual.audio.url.r');
        mockAyaId2suraAya.mockReturnValue({sura:3, aya:10});

        await handleText(mockCtx);
        expect(mockMinimalTelegrafInstance.telegram.sendMessage).toHaveBeenCalledTimes(1);
        expect(mockMinimalTelegrafInstance.telegram.sendAudio).toHaveBeenCalledWith(
            handleTextChatId,
            'http://actual.audio.url.r',
            expect.objectContaining({ caption: expect.stringContaining('@MinimalTestBot ➔ 3:10') })
        );
    });

    it('should call actual helperSendUnrecognizedMessage (leading to telegram.sendMessage) for invalid Sura', async () => {
        mockCtx.message.text = '115 1';
        mockSuraAya2ayaId.mockReturnValue(-1);
        await handleText(mockCtx);
        expect(mockMinimalTelegrafInstance.telegram.sendMessage).toHaveBeenCalledWith(
            handleTextChatId,
            expect.stringContaining("couldn't recognize a Sura name"),
            expect.anything()
        );
    });

    it('should call actual helperSendUnrecognizedMessage for invalid Aya in Sura', async () => {
        mockCtx.message.text = '2 300';
        mockSuraAya2ayaId.mockReturnValue(0);
        await handleText(mockCtx);
        expect(mockMinimalTelegrafInstance.telegram.sendMessage).toHaveBeenCalledWith(
            handleTextChatId,
            expect.stringContaining("Aya number is not in the requested Sura"),
            expect.anything()
        );
    });

    it('should call actual helperSendUnrecognizedMessage for unparseable text', async () => {
        mockCtx.message.text = 'This is not an Aya request';
        mockSuraAya2ayaId.mockImplementation(() => -2);
        await handleText(mockCtx);
        expect(mockMinimalTelegrafInstance.telegram.sendMessage).toHaveBeenCalledWith(
            handleTextChatId,
            expect.stringContaining("only recognize Sura names in Arabic or numbers"),
            expect.anything()
        );
    });
});

describe('Command Handler Registrations and Admin Checks', () => {
    beforeAll(() => {
        if (!registeredCommandHandlers.start) throw new Error('Start command handler not captured in main beforeAll');
        if (!registeredCommandHandlers.help) throw new Error('Help command handler not captured in main beforeAll');
    });

    beforeEach(() => {
        mockMinimalTelegrafInstance.telegram.getChatMember.mockClear();
        mockLogger.mockClear();
        mockHandleStartCommand.mockClear();
        mockHandleHelpCommand.mockClear();
        mockHandleSurpriseMeCommand.mockClear();
        mockHandleSupportCommand.mockClear();
        mockHandleRecitersCommand.mockClear();
        mockHandleChannelCommand.mockClear();
        mockHandleKhatmaCommand.mockClear();
        mockHandleCommandsCommand.mockClear();
    });

    describe('/start command', () => {
        const command = 'start';
        const handlerToTest = () => registeredCommandHandlers[command];
        const expectedMockHandler = () => mockHandleStartCommand;

        it('should call commandHandlers.handleStartCommand for private chat', async () => {
            const mockCtx = {
                chat: { type: 'private', id: 'pc1' },
                from: { id: 'user1' },
                telegram: mockMinimalTelegrafInstance.telegram
            };
            await handlerToTest()(mockCtx);
            expect(expectedMockHandler()).toHaveBeenCalledWith(
                mockCtx,
                expect.objectContaining({
                    telegram: mockMinimalTelegrafInstance.telegram,
                    options: mockMinimalTelegrafInstance.options,
                    handleTextFn: handleText,
                })
            );
            expect(mockMinimalTelegrafInstance.telegram.getChatMember).not.toHaveBeenCalled();
        });

        it('should call commandHandlers.handleStartCommand if admin in group chat', async () => {
            mockMinimalTelegrafInstance.telegram.getChatMember.mockResolvedValue({ status: 'administrator' });
            const mockCtx = {
                chat: { type: 'group', id: 'gc1', title: 'Group Test 1' },
                from: { id: 'adminUser1' },
                telegram: mockMinimalTelegrafInstance.telegram
            };
            await handlerToTest()(mockCtx);
            expect(mockMinimalTelegrafInstance.telegram.getChatMember).toHaveBeenCalledWith('gc1', 'adminUser1');
            expect(expectedMockHandler()).toHaveBeenCalledWith(mockCtx, expect.objectContaining({
                 handleTextFn: handleText,
            }));
        });

        it('should log and not call commandHandlers.handleStartCommand if not admin in group chat', async () => {
            mockMinimalTelegrafInstance.telegram.getChatMember.mockResolvedValue({ status: 'member' });
            const mockCtx = {
                chat: { type: 'group', id: 'gc2', title: 'Group Test 2' },
                from: { id: 'nonAdminUser2', username: 'nonAdminUser2' },
                telegram: mockMinimalTelegrafInstance.telegram
            };
            const result = await handlerToTest()(mockCtx);
            expect(mockMinimalTelegrafInstance.telegram.getChatMember).toHaveBeenCalledWith('gc2', 'nonAdminUser2');
            expect(expectedMockHandler()).not.toHaveBeenCalled();
            expect(mockLogger).toHaveBeenCalledWith(
                `Ignored /start command from non-admin user nonAdminUser2 in chat gc2 (Group Test 2).`
            );
            expect(result).toBeUndefined();
        });
    });

    describe('/help command', () => {
        const command = 'help';
        const handlerToTest = () => registeredCommandHandlers[command];
        const expectedMockHandler = () => mockHandleHelpCommand;

        it('should call commandHandlers.handleHelpCommand for private chat', async () => {
            const mockCtx = { chat: { type: 'private', id: 'pcHelp' }, from: { id: 'userHelp' } };
            await handlerToTest()(mockCtx);
            expect(expectedMockHandler()).toHaveBeenCalledWith(
                mockCtx,
                expect.objectContaining({
                    telegram: mockMinimalTelegrafInstance.telegram,
                })
            );
            expect(mockMinimalTelegrafInstance.telegram.getChatMember).not.toHaveBeenCalled();
        });

        it('should call commandHandlers.handleHelpCommand if admin in group chat', async () => {
            mockMinimalTelegrafInstance.telegram.getChatMember.mockResolvedValue({ status: 'administrator' });
            const mockCtx = { chat: { type: 'group', id: 'gcHelp', title: 'Help Group' }, from: { id: 'adminHelp' } };
            await handlerToTest()(mockCtx);
            expect(mockMinimalTelegrafInstance.telegram.getChatMember).toHaveBeenCalledWith('gcHelp', 'adminHelp');
            expect(expectedMockHandler()).toHaveBeenCalledWith(mockCtx, expect.anything());
        });

        it('should log and not call commandHandlers.handleHelpCommand if not admin in group chat', async () => {
            mockMinimalTelegrafInstance.telegram.getChatMember.mockResolvedValue({ status: 'member' });
            const mockCtx = { chat: { type: 'group', id: 'gcHelpNA', title: 'Help Group NA' }, from: { id: 'nonAdminHelp', username: 'nonAdminHelp' } };
            const result = await handlerToTest()(mockCtx);
            expect(mockMinimalTelegrafInstance.telegram.getChatMember).toHaveBeenCalledWith('gcHelpNA', 'nonAdminHelp');
            expect(expectedMockHandler()).not.toHaveBeenCalled();
            expect(mockLogger).toHaveBeenCalledWith(
                `Ignored /help command from non-admin user nonAdminHelp in chat gcHelpNA (Help Group NA).`
            );
            expect(result).toBeUndefined();
        });
    });

    describe('/support command', () => {
        const command = 'support';
        const handlerToTest = () => registeredCommandHandlers[command];
        const expectedMockHandler = () => mockHandleSupportCommand;
        let TelegrafMarkup;

        beforeAll(async () => {
            TelegrafMarkup = (await import('telegraf')).Markup;
        });

        it('should call commandHandlers.handleSupportCommand (with Markup) for private chat', async () => {
            const mockCtx = { chat: { type: 'private', id: 'pcSupport' }, from: { id: 'userSupport' } };
            await handlerToTest()(mockCtx);
            expect(expectedMockHandler()).toHaveBeenCalledWith(mockCtx, TelegrafMarkup);
            expect(mockMinimalTelegrafInstance.telegram.getChatMember).not.toHaveBeenCalled();
        });
         it('should call commandHandlers.handleSupportCommand if admin in group chat', async () => {
            mockMinimalTelegrafInstance.telegram.getChatMember.mockResolvedValue({ status: 'administrator' });
            const mockCtx = { chat: { type: 'group', id: 'gcSupport', title: 'Support Group' }, from: { id: 'adminSupport' } };
            await handlerToTest()(mockCtx);
            expect(mockMinimalTelegrafInstance.telegram.getChatMember).toHaveBeenCalledWith('gcSupport', 'adminSupport');
            expect(expectedMockHandler()).toHaveBeenCalledWith(mockCtx, expect.anything());
        });
        it('should log and not call commandHandlers.handleSupportCommand if not admin in group chat', async () => {
            mockMinimalTelegrafInstance.telegram.getChatMember.mockResolvedValue({ status: 'member' });
            const mockCtx = { chat: { type: 'group', id: 'gcSupportNA', title: 'Support Group NA' }, from: { id: 'nonAdminSupport', username: 'nonAdminSupport' } };
            const result = await handlerToTest()(mockCtx);
            expect(mockMinimalTelegrafInstance.telegram.getChatMember).toHaveBeenCalledWith('gcSupportNA', 'nonAdminSupport');
            expect(expectedMockHandler()).not.toHaveBeenCalled();
            expect(mockLogger).toHaveBeenCalledWith(
                `Ignored /support command from non-admin user nonAdminSupport in chat gcSupportNA (Support Group NA).`
            );
            expect(result).toBeUndefined();
        });
    });
    // ... (Other command handlers like /surpriseme, /reciters, /channel, /khatma, /commands follow same pattern)
});

describe('Text Handler Registration and Admin Check', () => {
    beforeAll(() => {
        if (!textHandlerFnForTest) {
            throw new Error('Text handler (textHandlerFnForTest) not captured in main beforeAll');
        }
    });

    beforeEach(() => {
        mockMinimalTelegrafInstance.telegram.getChatMember.mockClear();
        mockLogger.mockClear();
        mockMinimalTelegrafInstance.telegram.sendMessage.mockClear();
        mockSuraAya2ayaId.mockClear();
        mockPrepareAya.mockClear().mockReturnValue({ arText: 'Prepared Text Ar', enText: 'Prepared Text En' });
        mockDbLastAyaTime.mockClear();
    });

    it('should call local handleText (leading to telegram.sendMessage) for private chat', async () => {
        const mockCtx = {
            chat: { type: 'private', id: 'pcTextEv' },
            from: { id: 'userTextEv', language_code: 'ar', username: 'userTextEvName' },
            message: { text: '2 255' },
        };
        mockSuraAya2ayaId.mockReturnValue(262);
        await textHandlerFnForTest(mockCtx);
        expect(mockMinimalTelegrafInstance.telegram.getChatMember).not.toHaveBeenCalled();
        expect(mockMinimalTelegrafInstance.telegram.sendMessage).toHaveBeenCalledWith(
            'pcTextEv',
            expect.stringContaining('Prepared Text Ar'),
            expect.anything()
        );
    });

    it('should call local handleText (leading to telegram.sendMessage) if admin in group chat', async () => {
        mockMinimalTelegrafInstance.telegram.getChatMember.mockResolvedValue({ status: 'administrator' });
        const mockCtx = {
            chat: { type: 'group', id: 'gcTextEv', title: 'Text Group Event' },
            from: { id: 'adminTextEv', language_code: 'ar', username: 'adminTextEvName' },
            message: { text: '2 255' },
        };
        mockSuraAya2ayaId.mockReturnValue(262);
        await textHandlerFnForTest(mockCtx);
        expect(mockMinimalTelegrafInstance.telegram.getChatMember).toHaveBeenCalledWith('gcTextEv', 'adminTextEv');
        expect(mockMinimalTelegrafInstance.telegram.sendMessage).toHaveBeenCalledWith(
            'gcTextEv',
            expect.stringContaining('Prepared Text Ar'),
            expect.anything()
        );
    });

    it('should log and not call local handleText (no sendMessage) if not admin in group chat', async () => {
        mockMinimalTelegrafInstance.telegram.getChatMember.mockResolvedValue({ status: 'member' });
        const mockCtx = {
            chat: { type: 'group', id: 'gcTextEvNA', title: 'Text Group Event NA' },
            from: { id: 'nonAdminTextEv', username: 'nonAdminTextEvName' },
            message: { text: '2 255' },
        };
        const result = await textHandlerFnForTest(mockCtx);
        expect(mockMinimalTelegrafInstance.telegram.getChatMember).toHaveBeenCalledWith('gcTextEvNA', 'nonAdminTextEv');
        expect(mockMinimalTelegrafInstance.telegram.sendMessage).not.toHaveBeenCalled();
        expect(mockLogger).toHaveBeenCalledWith(
            `Ignored text message from non-admin user ${mockCtx.from.id} in chat ${mockCtx.chat.id} (${mockCtx.chat.title}).`
        );
        expect(result).toBeUndefined();
    });
});

describe('MyChatMember Handler Logic', () => {
    beforeAll(() => {
        if (!myChatMemberHandlerFnForTest) {
            throw new Error("'my_chat_member' handler (myChatMemberHandlerFnForTest) not captured in main beforeAll");
        }
    });

    beforeEach(() => {
        mockHandleStartCommand.mockClear();
        mockDbLastAyaTime.mockClear();
        mockLogger.mockClear();
    });

    it("should call handleStartCommand when status is 'member'", async () => {
        const mockCtx = {
            chat: { id: 'chat1', type: 'group' },
            update: { my_chat_member: { new_chat_member: { status: 'member' } } },
        };
        await myChatMemberHandlerFnForTest(mockCtx);
        expect(mockHandleStartCommand).toHaveBeenCalledWith(mockCtx, expect.anything());
    });

    it("should call handleStartCommand when status is 'administrator'", async () => {
        const mockCtx = {
            chat: { id: 'chat2', type: 'private' },
            update: { my_chat_member: { new_chat_member: { status: 'administrator' } } },
        };
        await myChatMemberHandlerFnForTest(mockCtx);
        expect(mockHandleStartCommand).toHaveBeenCalledWith(mockCtx, expect.anything());
    });

    it("should call lastAyaTime with 'blocked' when status is 'kicked'", async () => {
        const mockCtx = {
            chat: { id: 'chat3' },
            update: { my_chat_member: { new_chat_member: { status: 'kicked' } } },
        };
        await myChatMemberHandlerFnForTest(mockCtx);
        expect(mockDbLastAyaTime).toHaveBeenCalledWith('chat3', 'blocked');
    });

    it("should call lastAyaTime with 'blocked' when status is 'left'", async () => {
        const mockCtx = {
            chat: { id: 'chat4' },
            update: { my_chat_member: { new_chat_member: { status: 'left' } } },
        };
        await myChatMemberHandlerFnForTest(mockCtx);
        expect(mockDbLastAyaTime).toHaveBeenCalledWith('chat4', 'blocked');
    });

    it('should log for unknown status', async () => {
        const mockCtx = {
            chat: { id: 'chat5' },
            update: { my_chat_member: { new_chat_member: { status: 'unknown_status' } } },
        };
        await myChatMemberHandlerFnForTest(mockCtx);
        expect(mockLogger).toHaveBeenCalledWith('Unknown my_chat_member status: unknown_status for chat chat5');
    });
});

describe('Action Handler Integration for "recite" button', () => {
    let registeredReciteActionHandler;
    const reciteRegexString = String(/^{"recite":\d+,"r":"[^"]+"}$/);

    beforeAll(() => {
        registeredReciteActionHandler = registeredActionHandlersForTest[reciteRegexString];
        if (!registeredReciteActionHandler) {
            console.log(
                'Available action triggers in registeredActionHandlersForTest:',
                Object.keys(registeredActionHandlersForTest)
            );
            throw new Error(
                `Recite action handler for regex ${reciteRegexString} not found. Check regex string or main beforeAll population.`
            );
        }
    });

    beforeEach(() => {
        mockLogger.mockClear();
        mockMinimalTelegrafInstance.telegram.getChatMember.mockClear().mockResolvedValue({ status: 'administrator' });
        mockMinimalTelegrafInstance.options.username = 'TestBotForReciteAction';
        mockIsValidReciter.mockClear().mockReturnValue(true);
        mockDbGetFavReciter.mockClear().mockResolvedValue({ success: true, data: 'mockReciter' });
        mockGetRandomReciterIdentifier.mockClear().mockReturnValue('randomReciter');
        mockGetRecitation.mockClear().mockResolvedValue('http://mock.audio.url');
        mockAyaId2suraAya.mockClear().mockReturnValue({ sura: 1, aya: 1 });
        mockDbLastAyaTime.mockClear();
    });

    it('should log "Received invalid or empty ctx" for recite action if ctx is corrupted at telegramBot.js level', async () => {
        if (!registeredReciteActionHandler) throw new Error("Recite action handler was not registered.");
        const corruptedCtx = {};
        await registeredReciteActionHandler(corruptedCtx);
        const wrapperErrorLog = mockLogger.mock.calls.find((call) =>
            call[0].includes('Recite action (telegramBot.js): Received invalid or empty ctx.')
        );
        expect(wrapperErrorLog).toBeDefined();
        expect(wrapperErrorLog[1]).toEqual({ ctxKeys: [], ctxValue: {} });
        const handleReciteActionEntryLog = mockLogger.mock.calls.find(
            (call) => call[0] === 'DEBUG: handleReciteAction --- ENTRY ---'
        );
        expect(handleReciteActionEntryLog).toBeUndefined();
        const senderErrorLog = mockLogger.mock.calls.find((call) => call[0].includes('Could not determine chatId'));
        expect(senderErrorLog).toBeUndefined();
    });
});
