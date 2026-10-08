import { jest } from '@jest/globals';

// --- Manage config.js mock manually ---
// Config.js is imported by commandHandlers.js as '../../../src/config.js'
let currentConfigMock = {
    __esModule: true,
    default: {
        telegramToken: 'COMMAND_HANDLER_TEST_INITIAL_TOKEN',
        devChatId: 'COMMAND_HANDLER_TEST_INITIAL_DEV_CHAT_ID',
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
        port: 3002,
        timerCheckMinutes: 60,
        timerSendHours: 24,
        pingTargetGeneral: 'http://test.example.com',
        pingTargetAlternative: 'http://test.example.org',
        pingTargetTelegramApiBase: 'http://test.api.telegram.org',
        botLaunchRetryDelay: 1000,
        maxBotLaunchRetries: 1,
    },
};
jest.unstable_mockModule('../../../src/config.js', () => {
    console.log(
        `****** unstable_mockModule for ../config.js using currentConfigMock (branch: ${currentConfigMock.default.branch}) ******`
    );
    return currentConfigMock;
});

// --- Mocking Other Dependencies of commandHandlers.js ---

// Mock ../logger.js
const mockLogger = jest.fn();
jest.unstable_mockModule('../../../src/logger.js', () => ({
    __esModule: true,
    logger: mockLogger,
}));

// Mock ../database.js
const mockGetDB = jest.fn().mockReturnValue({
    collection: jest.fn().mockReturnThis(),
    countDocuments: jest.fn().mockResolvedValue(0),
});
const mockLastAyaTimeDbFn = jest.fn().mockResolvedValue({ success: true });
jest.unstable_mockModule('../../../src/database.js', () => ({
    __esModule: true,
    getDB: mockGetDB,
    lastAyaTime: mockLastAyaTimeDbFn,
}));

// Mock ../botHelpers.js
const mockHelperSuccessSend = jest.fn(); // This is the mock function instance
const mockHelperInstructions = jest.fn();
jest.unstable_mockModule('../../../src/botHelpers.js', () => ({
    __esModule: true,
    successSend: mockHelperSuccessSend, // Mock exports 'successSend', which SUT aliases to helperSuccessSend
    instructions: mockHelperInstructions,
}));

// Mock telegraf's Markup
const mockMarkupButtonCb = jest.fn((text, data) => ({ text, callback_data: data }));
const mockMarkupButtonUrl = jest.fn((text, url) => ({ text, url }));
const mockMarkupInlineKeyboard = jest.fn((buttons) => ({ inline_keyboard: buttons }));
jest.unstable_mockModule('telegraf', () => ({
    __esModule: true,
    Markup: {
        inlineKeyboard: mockMarkupInlineKeyboard,
        button: {
            callback: mockMarkupButtonCb,
            url: mockMarkupButtonUrl,
        },
    },
}));

// --- Declare module-scoped variables for commandHandlers.js exports ---
let handleStartCommand,
    handleHelpCommand,
    handleSurpriseMeCommand,
    handleSupportCommand,
    handleRecitersCommand,
    handleChannelCommand,
    handleKhatmaCommand,
    handleCommandsCommand;

// --- Mocks for functions passed as dependencies to handlers ---
let mockTelegramApi;
let mockSurpriseAyaFn;
let mockHandleTextFn;
let mockRecitersNavPageFn;

beforeAll(async () => {
    jest.resetModules(); // Reset modules before setting config and importing

    // Set currentConfigMock to a standard mock configuration (e.g., from config.mock.js)
    // Corrected path: from src/botHandlers/ to src/__mocks__/ is ../__mocks__/
    const globalMockDefault = (await import('../../../src/__mocks__/config.mock.js')).default;
    currentConfigMock = { __esModule: true, default: globalMockDefault };
    console.log('****** Set currentConfigMock to GLOBAL MOCK values for commandHandlers.test.js ******');

    const commandHandlersModule = await import('../../../src/botHandlers/commandHandlers.js');
    handleStartCommand = commandHandlersModule.handleStartCommand;
    handleHelpCommand = commandHandlersModule.handleHelpCommand;
    handleSurpriseMeCommand = commandHandlersModule.handleSurpriseMeCommand;
    handleSupportCommand = commandHandlersModule.handleSupportCommand;
    handleRecitersCommand = commandHandlersModule.handleRecitersCommand;
    handleChannelCommand = commandHandlersModule.handleChannelCommand;
    handleKhatmaCommand = commandHandlersModule.handleKhatmaCommand;
    handleCommandsCommand = commandHandlersModule.handleCommandsCommand;
});

beforeEach(() => {
    mockLogger.mockClear();
    mockGetDB.mockClear();
    mockGetDB.mockReturnValue({
        collection: jest.fn().mockReturnThis(),
        countDocuments: jest.fn().mockResolvedValue(0),
    });
    mockLastAyaTimeDbFn.mockClear().mockResolvedValue({ success: true });
    mockHelperSuccessSend.mockClear();
    mockHelperInstructions.mockClear(); // Clear the new mock

    mockMarkupButtonCb.mockClear().mockImplementation((text, data) => ({ text, callback_data: data }));
    mockMarkupButtonUrl.mockClear().mockImplementation((text, url) => ({ text, url }));
    mockMarkupInlineKeyboard.mockClear().mockImplementation((buttons) => ({ inline_keyboard: buttons }));

    mockTelegramApi = {
        sendMessage: jest.fn().mockResolvedValue({}),
        getMyCommands: jest.fn().mockResolvedValue([]),
    };
    mockSurpriseAyaFn = jest.fn();
    mockHandleTextFn = jest.fn();
    mockRecitersNavPageFn = jest.fn().mockReturnValue([[{ text: 'Page 1 Reciter', callback_data: 'r1' }]]);
});

describe('Bot Command Handlers', () => {
    describe('handleStartCommand', () => {
        it('should call startCommandLogic without payload', async () => {
            const mockCtx = {
                chat: { id: 12345 },
                from: { language_code: 'en' },
                startPayload: null,
                // reply and other ctx methods are not directly used by handleStartCommand,
                // but by startCommandLogic which uses botTelegram.sendMessage
            };
            await handleStartCommand(mockCtx, {
                telegram: mockTelegramApi,
                options: {},
                handleTextFn: mockHandleTextFn,
            });

            expect(mockTelegramApi.sendMessage).toHaveBeenCalledWith(
                12345,
                expect.stringContaining('Daily Aya sends one Aya daily'),
                expect.objectContaining({
                    reply_markup: {
                        inline_keyboard: [[{ text: '🎁', callback_data: JSON.stringify({ surpriseAyaAction: true }) }]],
                    },
                })
            );
            expect(mockHelperSuccessSend).toHaveBeenCalled();
            expect(mockHandleTextFn).not.toHaveBeenCalled();
        });

        it('should call handleTextFn with payload', async () => {
            const mockCtx = {
                chat: { id: 12345 },
                from: { language_code: 'en' },
                startPayload: 'some-payload',
            };
            await handleStartCommand(mockCtx, {
                telegram: mockTelegramApi,
                options: {},
                handleTextFn: mockHandleTextFn,
            });
            expect(mockHandleTextFn).toHaveBeenCalledWith(mockCtx);
            expect(mockTelegramApi.sendMessage).not.toHaveBeenCalledWith(
                12345,
                expect.stringContaining('Daily Aya sends one Aya daily')
            );
        });
    });

    describe('handleHelpCommand', () => {
        it('should send instructions', async () => {
            const mockCtx = { chat: { id: 67890 } };
            await handleHelpCommand(mockCtx, { telegram: mockTelegramApi });
            // Verify that the (mocked) instructions function was called correctly
            expect(mockHelperInstructions).toHaveBeenCalledWith(mockCtx.chat.id, mockTelegramApi);
        });
    });

    describe('handleSurpriseMeCommand', () => {
        it('should call surpriseAyaFn', async () => {
            const mockCtx = { chat: { id: 111 } }; // Mock ctx as needed by surpriseAyaFn
            await handleSurpriseMeCommand(mockCtx, { surpriseAyaFn: mockSurpriseAyaFn });
            expect(mockSurpriseAyaFn).toHaveBeenCalledWith(mockCtx);
            // The logger call for "surpriseAyaUtil call commented out" was removed from the handler.
        });
    });

    describe('handleSupportCommand', () => {
        it('should reply with support message and buttons', async () => {
            const mockCtx = { reply: jest.fn().mockResolvedValue({}) };
            const TelegrafMarkup = (await import('telegraf')).Markup; // Get the mocked Markup

            await handleSupportCommand(mockCtx, TelegrafMarkup);

            expect(mockCtx.reply).toHaveBeenCalledWith(
                '👨‍💻',
                expect.objectContaining({
                    inline_keyboard: [
                        [expect.objectContaining({ text: 'Contact Us 💬 تواصل معنا' })],
                        [expect.objectContaining({ text: 'Support Us 🌱 دعم استمرارنا' })],
                    ],
                })
            );
        });
    });

    describe('handleRecitersCommand', () => {
        it('should reply with reciters list', async () => {
            const mockCtx = { reply: jest.fn().mockResolvedValue({}) };
            await handleRecitersCommand(mockCtx, mockRecitersNavPageFn);
            expect(mockCtx.reply).toHaveBeenCalledWith(expect.stringContaining('Who is your favorite Reciter?'), {
                reply_markup: { inline_keyboard: [[{ text: 'Page 1 Reciter', callback_data: 'r1' }]] },
            });
            expect(mockRecitersNavPageFn).toHaveBeenCalledWith(1);
        });
    });

    describe('handleChannelCommand', () => {
        it('should reply with channel link', async () => {
            const mockCtx = { reply: jest.fn().mockResolvedValue({}) };
            await handleChannelCommand(mockCtx);
            expect(mockCtx.reply).toHaveBeenCalledWith('https://t.me/DailyAyaGlobal');
        });
    });

    describe('handleKhatmaCommand', () => {
        it('should reply with Khatma buttons', async () => {
            const mockCtx = { reply: jest.fn().mockResolvedValue({}) };
            const TelegrafMarkup = (await import('telegraf')).Markup;

            await handleKhatmaCommand(mockCtx, TelegrafMarkup);
            expect(mockCtx.reply).toHaveBeenCalledWith(
                expect.stringContaining('How many ajzaa did you read?'),
                expect.any(Object) // Markup object is complex to match exactly here
            );
            expect(mockMarkupInlineKeyboard).toHaveBeenCalled(); // Check if Markup.inlineKeyboard was used
        });
    });

    describe('handleCommandsCommand', () => {
        it('should fetch and reply with commands', async () => {
            const mockCtx = { reply: jest.fn().mockResolvedValue({}) };
            mockTelegramApi.getMyCommands.mockResolvedValueOnce([{ command: 'test', description: 'Test command' }]);
            await handleCommandsCommand(mockCtx, mockTelegramApi);
            expect(mockTelegramApi.getMyCommands).toHaveBeenCalled();
            expect(mockCtx.reply).toHaveBeenCalledWith('/test\nTest command');
        });

        it('should reply with fallback if no commands found', async () => {
            const mockCtx = { reply: jest.fn().mockResolvedValue({}) };
            mockTelegramApi.getMyCommands.mockResolvedValueOnce([]); // No commands
            await handleCommandsCommand(mockCtx, mockTelegramApi);
            expect(mockCtx.reply).toHaveBeenCalledWith('No commands found or an error occurred.');
        });

        it('should handle error when fetching commands', async () => {
            const mockCtx = { reply: jest.fn().mockResolvedValue({}) };
            mockTelegramApi.getMyCommands.mockRejectedValueOnce(new Error('API fail'));
            await handleCommandsCommand(mockCtx, mockTelegramApi);
            expect(mockCtx.reply).toHaveBeenCalledWith("Sorry, couldn't fetch commands at the moment.");
        });
    });
});
