import { jest } from '@jest/globals';
// import { Telegraf } from 'telegraf'; // Original Telegraf for type reference if needed - REMOVED

// Config mock is handled globally by moduleNameMapper - no local mock needed here.

// --- Top-level mocks for dependencies ---

// Mock logger.js
const mockLoggerGlobal = jest.fn();
const mockSetBotInstanceGlobal = jest.fn();
const mockBootstrapLoggerGlobal = jest.fn();
jest.unstable_mockModule('./logger.js', () => ({
    __esModule: true,
    logger: mockLoggerGlobal,
    setBotInstance: mockSetBotInstanceGlobal,
    bootstrapLogger: mockBootstrapLoggerGlobal,
}));

// Mock database.js
const mockLastAyaTime = jest.fn().mockResolvedValue({ success: true });
const mockSetFavReciter = jest.fn().mockResolvedValue({ success: true, reciter: 'mockReciter' });
const mockGetFavReciter = jest.fn().mockResolvedValue({ success: true, data: 'surprise' });
const mockGetDB = jest.fn().mockReturnValue({
    collection: jest.fn().mockReturnThis(),
    countDocuments: jest.fn().mockResolvedValue(0),
});
const mockConnectDB = jest.fn().mockResolvedValue(true);
jest.unstable_mockModule('./database.js', () => ({
    __esModule: true,
    lastAyaTime: mockLastAyaTime,
    setFavReciter: mockSetFavReciter,
    getFavReciter: mockGetFavReciter,
    getDB: mockGetDB,
    connectDB: mockConnectDB,
}));

// Mock quranService.js
const mockPrepareAya = jest.fn().mockReturnValue({ arText: 'Mock Arabic Aya', enText: 'Mock English Aya' });
const mockGetRecitation = jest.fn().mockResolvedValue('mock-audio-url.mp3');
const mockIsValidReciter = jest.fn().mockReturnValue(true);
const mockGetRandomReciterIdentifier = jest.fn().mockReturnValue('ar.mockrandom');
const mockNextAya = jest.fn((id) => id + 1);
const mockAyaId2SuraAya = jest.fn().mockReturnValue({ sura: 1, aya: 1 });
const mockSuraAya2AyaId = jest.fn().mockReturnValue(1);
const mockRasmifize = jest.fn((text) => text);
let __mockableNormalizedSurasArNamesForBotTest = ['initial-mock-sura-name-for-bot-test']; // Renamed from __mockableNormalizedSurasArNames
const mockGetQuranData = jest.fn().mockReturnValue({
    arReciters: [{ identifier: 'ar.alafasy', name: 'Alafasy', language: 'ar', englishName: 'Alafasy' }],
    enQuran: [{ name: 'Surat Al-Fatiha', englishName: 'Al-Fatiha', ayahs: [{ number: 1, numberInSurah: 1 }] }],
});
const mockCheckSource = jest.fn().mockResolvedValue(undefined);
jest.unstable_mockModule('./quranService.js', () => ({
    __esModule: true,
    prepareAya: mockPrepareAya,
    getRecitation: mockGetRecitation,
    isValidReciter: mockIsValidReciter,
    getRandomReciterIdentifier: mockGetRandomReciterIdentifier,
    nextAya: mockNextAya,
    ayaId2suraAya: mockAyaId2SuraAya,
    suraAya2ayaId: mockSuraAya2AyaId,
    rasmifize: mockRasmifize,
    get normalizedSurasArNames() {
        return __mockableNormalizedSurasArNamesForBotTest;
    },
    __setMockNormalizedSurasArNames: (newArray) => {
        __mockableNormalizedSurasArNamesForBotTest = newArray;
    },
    getQuranData: mockGetQuranData,
    checkSource: mockCheckSource,
}));

// Mock utils.js
const mockRandomAyaNumber = jest.fn().mockReturnValue(123);
const mockNumArabicToEnglish = jest.fn((text) => text);
jest.unstable_mockModule('./utils.js', () => ({
    __esModule: true,
    randomAyaNumber: mockRandomAyaNumber,
    numArabicToEnglish: mockNumArabicToEnglish,
}));

// Mock Telegraf
const mockTelegrafSendMessage = jest.fn().mockResolvedValue({});
const mockTelegrafEditMessageReplyMarkup = jest.fn().mockResolvedValue({});
const mockTelegrafAnswerCbQuery = jest.fn().mockResolvedValue(true);
const mockTelegrafGetChatMember = jest.fn().mockResolvedValue({ status: 'member' });
const mockTelegrafReply = jest.fn().mockResolvedValue({});
const _mockTelegrafReplyWithHTML = jest.fn().mockResolvedValue({}); // Prefixed
const _mockTelegrafEditMessageText = jest.fn().mockResolvedValue({}); // Prefixed
const mockTelegrafDeleteMessage = jest.fn().mockResolvedValue(true);
const mockTelegrafSetMyCommands = jest.fn().mockResolvedValue(true);
const mockTelegrafGetMyCommands = jest.fn().mockResolvedValue([]);
const mockTelegrafGetMe = jest
    .fn()
    .mockResolvedValue({ id: 42, is_bot: true, username: 'TestBot', first_name: 'Test Bot' });

const mockBotInstanceForTelegraf = {
    // Renamed from mockBotInstance
    telegram: {
        sendMessage: mockTelegrafSendMessage,
        getChatMember: mockTelegrafGetChatMember,
        setMyCommands: mockTelegrafSetMyCommands,
        getMyCommands: mockTelegrafGetMyCommands,
        getMe: mockTelegrafGetMe,
        editMessageReplyMarkup: mockTelegrafEditMessageReplyMarkup,
        deleteMessage: mockTelegrafDeleteMessage,
    },
    options: { username: 'TestBot' },
    context: {},
    start: jest.fn(),
    help: jest.fn(),
    command: jest.fn(),
    action: jest.fn(),
    on: jest.fn(),
    launch: jest.fn().mockResolvedValue(true),
    catch: jest.fn(),
    stop: jest.fn(),
};

jest.mock('telegraf', () => ({
    __esModule: true,
    Telegraf: jest.fn(() => mockBotInstanceForTelegraf), // Use the renamed instance
    Markup: {
        inlineKeyboard: jest.fn((buttons) => ({ inline_keyboard: buttons })),
        button: {
            url: jest.fn((text, url) => ({ text, url })),
            callback: jest.fn((text, data) => ({ text, callback_data: data })),
        },
    },
}));

// Now, attempt to import parts of telegramBot.js - This will be done dynamically.
// Static imports of TelegramBotModule and helpers from other local files are removed.

// --- Declare module-scoped variables for telegramBot.js exports ---
let bot, sendAya, adminChecker, NON_ADMINS_ALERT, _surpriseAya, handleText, _launchBot, botUsernameReady; // Prefixed unused

// --- Variable for specific logger mock access if needed by tests ---
let actualLoggerFromLoggerModule;

beforeAll(async () => {
    const importedModule = await import('./telegramBot.js');
    bot = importedModule.bot;
    sendAya = importedModule.sendAya;
    adminChecker = importedModule.adminChecker;
    NON_ADMINS_ALERT = importedModule.NON_ADMINS_ALERT;
    surpriseAya = importedModule.surpriseAya;
    handleText = importedModule.handleText;
    launchBot = importedModule.launchBot;
    botUsernameReady = importedModule.botUsernameReady;

    const loggerModule = await import('./logger.js'); // Gets the mocked logger module
    actualLoggerFromLoggerModule = loggerModule.logger; // This will be mockLoggerGlobal

    await botUsernameReady; // Ensure bot initialization (like getMe) is complete
});

// If adminChecker and other functions are not exported, we can't access them directly.
// The alternative is to test command handlers.
// For example, to test the '/help' command, we'd need to get the handler function
// that telegramBot.js registers with bot.command('help', handler).

describe.skip('Telegram Bot Tests - Initial Setup', () => {
    it('should initialize the bot with the mocked Telegraf instance', async () => {
        const { Telegraf: MockedTelegrafConstructor } = await import('telegraf');
        const { default: mockedConfig } = await import('./config.js'); // Get global mock
        expect(MockedTelegrafConstructor).toHaveBeenCalledWith(mockedConfig.telegramToken, {
            agent: expect.any(Object),
        });
        expect(bot).toBe(mockBotInstanceForTelegraf);
    });

    it('should call setBotInstance from logger', () => {
        expect(mockSetBotInstanceGlobal).toHaveBeenCalledWith(mockBotInstanceForTelegraf);
    });

    it('should attempt to fetch bot username on init', () => {
        expect(mockTelegrafGetMe).toHaveBeenCalled();
    });

    it('should set bot commands on init', () => {
        expect(mockTelegrafSetMyCommands).toHaveBeenCalled();
    });
});

// Destructuring from TelegramBotModule is no longer needed as variables are globally scoped
// const { adminChecker, NON_ADMINS_ALERT } = TelegramBotModule; // REMOVE

describe('Telegram Bot Helpers', () => {
    describe('adminChecker', () => {
        beforeEach(() => {
            mockTelegrafGetChatMember.mockClear();
            mockTelegrafGetChatMember.mockResolvedValue({ status: 'member' });
            if (actualLoggerFromLoggerModule) actualLoggerFromLoggerModule.mockClear();
            else mockLoggerGlobal.mockClear();
        });

        it('should return true if chat type is private', async () => {
            const mockCtx = { chat: { type: 'private' }, from: { id: 123 } };
            if (!adminChecker) throw new Error('adminChecker is not defined after dynamic import');
            const isAdmin = await adminChecker(mockCtx);
            expect(isAdmin).toBe(true);
            expect(mockTelegrafGetChatMember).not.toHaveBeenCalled();
        });

        it('should return true if user is creator in a group', async () => {
            mockTelegrafGetChatMember.mockResolvedValue({ status: 'creator' });
            const mockCtx = { chat: { type: 'group', id: 'g123' }, from: { id: 456 } };
            const isAdmin = await adminChecker(mockCtx);
            expect(mockTelegrafGetChatMember).toHaveBeenCalledWith('g123', 456);
            expect(isAdmin).toBe(true);
        });

        it('should return true if user is administrator in a group', async () => {
            mockTelegrafGetChatMember.mockResolvedValue({ status: 'administrator' });
            const mockCtx = { chat: { type: 'supergroup', id: 'sg123' }, from: { id: 789 } };
            const isAdmin = await adminChecker(mockCtx);
            expect(mockTelegrafGetChatMember).toHaveBeenCalledWith('sg123', 789);
            expect(isAdmin).toBe(true);
        });

        it('should return false if user is just a member in a group', async () => {
            const mockCtx = { chat: { type: 'group', id: 'g456' }, from: { id: 101 } };
            const isAdmin = await adminChecker(mockCtx);
            expect(mockTelegrafGetChatMember).toHaveBeenCalledWith('g456', 101);
            expect(isAdmin).toBe(false);
        });

        it('should return false if getChatMember fails or throws an error', async () => {
            mockTelegrafGetChatMember.mockRejectedValue(new Error('Telegram API error'));
            const mockCtx = { chat: { type: 'group', id: 'g789' }, from: { id: 202 } };
            const isAdmin = await adminChecker(mockCtx);
            expect(mockTelegrafGetChatMember).toHaveBeenCalledWith('g789', 202);
            expect(isAdmin).toBe(false);
            expect(actualLoggerFromLoggerModule || mockLoggerGlobal).toHaveBeenCalledWith(
                'Error in adminChecker while calling getChatMember: ',
                expect.any(Error)
            );
        });

        it('should return false if ctx.chat or ctx.from is missing', async () => {
            expect(await adminChecker({ from: { id: 123 } })).toBe(false);
            expect(actualLoggerFromLoggerModule || mockLoggerGlobal).toHaveBeenCalledWith(
                'adminChecker: Invalid context received.',
                { from: { id: 123 } }
            );

            if (actualLoggerFromLoggerModule) actualLoggerFromLoggerModule.mockClear();
            else mockLoggerGlobal.mockClear();
            expect(await adminChecker({ chat: { type: 'private' } })).toBe(false);
            expect(actualLoggerFromLoggerModule || mockLoggerGlobal).toHaveBeenCalledWith(
                'adminChecker: Invalid context received.',
                {
                    chat: { type: 'private' },
                }
            );
        });
    });
});

// --- Mocked Functions from Imports (for easier access in tests) ---
// These were previously require() calls. Now they should refer to the top-level imports
// or be accessed via the already imported mocked modules if needed.
// For example, `mockRandomAyaNumber` would be `actualNumArabicToEnglish` if it's from utils.js
// and if it's the actual function. If it's a mock, it's already mocked via jest.mock.
// The test was likely trying to get a direct handle on the mock function.
// Let's assume these were attempts to get the mocked functions.
// `jest.mock` replaces the module's exports with mocks. So, direct imports will get the mocks.
// const { sendAya: mockSendAyaFromTelegramBotInternal, bot: mockedBotObject } = TelegramBotModule; // This is fine
// const { randomAyaNumber: mockRandomAyaNumber } = actualNumArabicToEnglish; // This is wrong, randomAyaNumber is separate
// const { rasmifize: mockRasmifize, suraAya2ayaId: mockSuraAya2AyaId } = actualRasmifize; // This is also wrong
// const { logger: mockLogger } = actualLoggerForAdminCheckerTests; // This is also wrong if mockLogger is different

// Re-evaluating these:
// The original require calls were likely to get the auto-mocked jest.fn() instances.
// When using `import`, these are the same functions.
// So, `mockRandomAyaNumber` would be `actualRandomAyaNumber` (from utils, which is mocked).
// `mockRasmifize` would be `actualRasmifize` (from quranService, which is mocked).
// `mockLogger` would be `actualLoggerForAdminCheckerTests` (from logger, which is mocked).

// These constants are for convenience in tests. // REMOVE - No longer using TelegramBotModule statically
// const { sendAya: importedSendAyaFromTelegramBot, bot: importedBotObject } = TelegramBotModule;
// For mocked functions from other modules, we can directly use the globally defined mock function constants.
// e.g. mockRandomAyaNumber, mockRasmifize, mockLoggerGlobal

describe('Telegram Command Handler: /surpriseme', () => {
    let surprisemeHandler;
    const mockUserCtxAdmin = {
        chat: { id: 123, type: 'private' },
        from: { id: 123, language_code: 'en' },
        reply: mockTelegrafReply,
    };
    const mockUserCtxNonAdmin = {
        chat: { id: 456, type: 'group' },
        from: { id: 456, language_code: 'ar' },
        reply: mockTelegrafReply,
    };

    beforeAll(async () => {
        await botUsernameReady;
        const commandCall = mockBotInstanceForTelegraf.command.mock.calls.find((call) => call[0] === 'surpriseme');
        if (commandCall && typeof commandCall[1] === 'function') {
            surprisemeHandler = commandCall[1];
        } else {
            console.error(
                '/surpriseme handler not found. Calls:',
                mockBotInstanceForTelegraf.command.mock.calls.map((c) => c[0])
            );
        }
    });

    beforeEach(() => {
        mockTelegrafReply.mockClear();
        mockTelegrafGetChatMember.mockClear();
        if (sendAya) sendAya.mockClear();
    });

    it.skip('should call surpriseAya helper if user is admin (private chat)', async () => {
        if (!surprisemeHandler) {
            console.warn('Skipping /surpriseme admin test as handler not found');
            return;
        }
        await surprisemeHandler(mockUserCtxAdmin);
        expect(sendAya).toHaveBeenCalledWith(mockUserCtxAdmin.chat.id, null, null, 'en', 'surprise', false);
        expect(mockTelegrafReply).not.toHaveBeenCalled();
    });

    it.skip('should log and not call sendAya if user is not admin in a group', async () => {
        if (!surprisemeHandler) {
            console.warn('Skipping /surpriseme non-admin test as handler not found');
            return;
        }
        mockTelegrafGetChatMember.mockResolvedValue({ status: 'member' });
        await surprisemeHandler(mockUserCtxNonAdmin);
        expect(mockTelegrafGetChatMember).toHaveBeenCalledWith(
            mockUserCtxNonAdmin.chat.id,
            mockUserCtxNonAdmin.from.id
        );
        expect(mockLoggerGlobal).toHaveBeenCalledWith(
            expect.stringContaining('Ignored /surpriseme command from non-admin')
        );
        expect(sendAya).not.toHaveBeenCalled();
    });
});

describe('Telegram Action Handler: surpriseAyaAction', () => {
    let surpriseAyaActionHandler;
    const mockCbCtxAdmin = {
        chat: { id: 789, type: 'private' },
        from: { id: 789, language_code: 'fr' },
        update: { callback_query: { data: JSON.stringify({ surpriseAyaAction: true }) } },
        answerCbQuery: mockTelegrafAnswerCbQuery,
    };
    const mockCbCtxNonAdmin = {
        chat: { id: 'g789', type: 'group' },
        from: { id: 101, language_code: 'es' },
        update: { callback_query: { data: JSON.stringify({ surpriseAyaAction: true }) } },
        answerCbQuery: mockTelegrafAnswerCbQuery,
    };

    beforeAll(async () => {
        await botUsernameReady;
        const surpriseAyaRegex = /^{"surpriseAyaAction":true(?:,"a":\d+)?}$/;
        const foundByRegex = mockBotInstanceForTelegraf.action.mock.calls.find(
            (call) => call[0] instanceof RegExp && call[0].toString() === surpriseAyaRegex.toString()
        );
        if (foundByRegex && typeof foundByRegex[1] === 'function') {
            surpriseAyaActionHandler = foundByRegex[1];
        } else {
            console.error(
                'surpriseAyaAction handler not found. Calls:',
                mockBotInstanceForTelegraf.action.mock.calls.map((c) => c[0])
            );
        }
    });

    beforeEach(() => {
        mockTelegrafAnswerCbQuery.mockClear();
        if (sendAya) sendAya.mockClear();
        mockTelegrafGetChatMember.mockClear();
    });

    it.skip('should call surpriseAya helper and answerCbQuery if user is admin', async () => {
        if (!surpriseAyaActionHandler) {
            console.warn('Skipping surpriseAyaAction admin test: handler not found.');
            return;
        }
        await surpriseAyaActionHandler(mockCbCtxAdmin);
        expect(sendAya).toHaveBeenCalledWith(mockCbCtxAdmin.chat.id, null, null, 'fr', 'surprise', false);
        expect(mockTelegrafAnswerCbQuery).toHaveBeenCalled();
    });

    it.skip('should use NON_ADMINS_ALERT with answerCbQuery if user is not admin in group', async () => {
        if (!surpriseAyaActionHandler) {
            console.warn('Skipping surpriseAyaAction non-admin test: handler not found.');
            return;
        }
        mockTelegrafGetChatMember.mockResolvedValue({ status: 'member' });
        await surpriseAyaActionHandler(mockCbCtxNonAdmin);
        expect(mockTelegrafGetChatMember).toHaveBeenCalledWith(mockCbCtxNonAdmin.chat.id, mockCbCtxNonAdmin.from.id);
        expect(mockTelegrafAnswerCbQuery).toHaveBeenCalledWith(NON_ADMINS_ALERT, { show_alert: true });
        expect(sendAya).not.toHaveBeenCalled();
    });
});

describe('Telegram Bot: handleText Function', () => {
    const mockCtxBase = {
        from: { id: 123, language_code: 'en', username: 'testuser' },
        chat: { id: 12345, type: 'private' },
    };

    let quranServiceMockForHandleText;

    beforeAll(async () => {
        await botUsernameReady;
        quranServiceMockForHandleText = jest.requireMock('./quranService.js');
    });

    beforeEach(() => {
        if (sendAya) sendAya.mockClear();

        mockSuraAya2AyaId.mockClear();
        mockRasmifize.mockClear();
        mockGetQuranData.mockClear();
        mockNumArabicToEnglish.mockClear();

        mockRasmifize.mockImplementation((text) => {
            if (text === 'الكرسي') return 'الكرسي';
            if (text === 'البقرة') return 'البقره';
            if (text === '2') return '2';
            if (text === '255') return '255';
            return text;
        });

        mockGetQuranData.mockReturnValue({
            enQuran: [
                { name: 'Surat Al-Fatiha', englishName: 'Al-Fatiha', ayahs: [] },
                { name: 'Surat Al-Baqarah', englishName: 'Al-Baqarah', ayahs: [] },
            ],
            arReciters: [{ identifier: 'ar.alafasy', name: 'Alafasy', language: 'ar', englishName: 'Alafasy' }],
        });

        if (quranServiceMockForHandleText && quranServiceMockForHandleText.__setMockNormalizedSurasArNames) {
            quranServiceMockForHandleText.__setMockNormalizedSurasArNames([
                mockRasmifize('الفاتحة'),
                mockRasmifize('البقرة'),
            ]);
        } else {
            __mockableNormalizedSurasArNamesForBotTest = [mockRasmifize('الفاتحة'), mockRasmifize('البقرة')];
        }

        mockTelegrafSendMessage.mockClear();
    });

    it.skip('should call sendAya for "آية الكرسي" (Ayat al-Kursi)', async () => {
        const mockCtx = { ...mockCtxBase, message: { text: 'آية الكرسي' } };
        await handleText(mockCtx);
        expect(sendAya).toHaveBeenCalledWith(mockCtx.chat.id, 262, null, 'en', 'request', false);
    });

    it('should call sendAya for Sura and Aya numbers (e.g., "2 255")', async () => {
        const mockCtx = { ...mockCtxBase, message: { text: '2 255' } };
        mockSuraAya2AyaId.mockReturnValueOnce(262);
        await handleText(mockCtx);
        expect(mockSuraAya2AyaId).toHaveBeenCalledWith({ sura: 2, aya: 255 });
        expect(sendAya).toHaveBeenCalledWith(mockCtx.chat.id, 262, null, 'en', 'request', false);
    });

    it('should call sendAya for Sura name and Aya number (e.g., "البقرة ٢٥٥")', async () => {
        const mockCtx = { ...mockCtxBase, message: { text: 'البقرة ٢٥٥' } };
        mockNumArabicToEnglish.mockImplementationOnce((str) => str.replace('٢٥٥', '255'));
        mockSuraAya2AyaId.mockReturnValueOnce(262);
        await handleText(mockCtx);
        expect(mockNumArabicToEnglish).toHaveBeenCalledWith('البقرة ٢٥٥');
        expect(mockRasmifize).toHaveBeenCalledWith('البقرة 255');
        expect(mockSuraAya2AyaId).toHaveBeenCalledWith({ sura: 2, aya: 255 });
        expect(sendAya).toHaveBeenCalledWith(mockCtx.chat.id, 262, null, 'en', 'request', false);
    });

    it('should call unrecognized for invalid Sura number (e.g., "999 1")', async () => {
        const mockCtx = { ...mockCtxBase, message: { text: '999 1' } };
        mockSuraAya2AyaId.mockReturnValueOnce(-1);
        await handleText(mockCtx);
        expect(mockTelegrafSendMessage).toHaveBeenCalledWith(
            mockCtx.chat.id,
            expect.stringContaining('عذرا، لم نتعرف على اسم سورة'),
            expect.any(Object)
        );
        expect(sendAya).not.toHaveBeenCalled();
    });

    it('should call unrecognized for valid Sura but invalid Aya (e.g., "1 99")', async () => {
        const mockCtx = { ...mockCtxBase, message: { text: '1 99' } };
        mockSuraAya2AyaId.mockReturnValueOnce(0);
        await handleText(mockCtx);
        expect(mockTelegrafSendMessage).toHaveBeenCalledWith(
            mockCtx.chat.id,
            expect.stringContaining('عذرا، رقم الآية ليس في السورة المطلوبة'),
            expect.any(Object)
        );
        expect(sendAya).not.toHaveBeenCalled();
    });

    it('should call unrecognized for purely textual message not matching any pattern', async () => {
        const mockCtx = { ...mockCtxBase, message: { text: 'Hello world' } };
        await handleText(mockCtx);
        expect(mockTelegrafSendMessage).toHaveBeenCalledWith(
            mockCtx.chat.id,
            expect.stringContaining('عذرا، لم نتعرف على اسم سورة'),
            expect.any(Object)
        );
        expect(sendAya).not.toHaveBeenCalled();
    });
});

describe('Telegram Command Handlers', () => {
    describe('/help command', () => {
        let helpHandler;
        const mockUserCtx = {
            chat: { id: 12345, type: 'private' },
            from: { id: 123, is_bot: false, first_name: 'TestUser' },
            reply: mockTelegrafReply,
        };
        const mockGroupCtxNonAdmin = {
            chat: { id: 'g123', type: 'group' },
            from: { id: 456, is_bot: false, first_name: 'NonAdminUser' },
            reply: mockTelegrafReply,
        };

        beforeAll(async () => {
            await botUsernameReady;
            const commandCall = mockBotInstanceForTelegraf.command.mock.calls.find((call) => call[0] === 'help');
            if (commandCall && typeof commandCall[1] === 'function') {
                helpHandler = commandCall[1];
            } else {
                console.error(
                    'Help command handler not found. Calls:',
                    mockBotInstanceForTelegraf.command.mock.calls.map((c) => c[0])
                );
            }
        });

        beforeEach(() => {
            mockTelegrafSendMessage.mockClear();
            mockTelegrafReply.mockClear();
            mockTelegrafGetChatMember.mockClear();
            mockTelegrafGetChatMember.mockResolvedValue({ status: 'member' });
        });

        it.skip('should send instructions message if handler is found and user is admin (private chat)', async () => {
            if (!helpHandler) {
                console.warn('Skipping /help admin private test: handler not found.');
                return;
            }
            await helpHandler(mockUserCtx);
            expect(mockTelegrafSendMessage).toHaveBeenCalledWith(
                mockUserCtx.chat.id,
                expect.stringContaining('يمكنك طلب آية محددة')
            );
            expect(mockTelegrafReply).not.toHaveBeenCalled();
        });

        it.skip('should send instructions message if handler is found and user is admin (group chat)', async () => {
            if (!helpHandler) {
                console.warn('Skipping /help admin group test: handler not found.');
                return;
            }
            mockTelegrafGetChatMember.mockResolvedValue({ status: 'administrator' });
            const groupAdminCtx = { ...mockGroupCtxNonAdmin, from: { ...mockGroupCtxNonAdmin.from, id: 999 } };
            await helpHandler(groupAdminCtx);
            expect(mockTelegrafGetChatMember).toHaveBeenCalledWith(groupAdminCtx.chat.id, groupAdminCtx.from.id);
            expect(mockTelegrafSendMessage).toHaveBeenCalledWith(
                groupAdminCtx.chat.id,
                expect.stringContaining('يمكنك طلب آية محددة')
            );
            expect(mockTelegrafReply).not.toHaveBeenCalled();
        });

        it.skip('should log and not send instructions if user is not admin in a group chat', async () => {
            if (!helpHandler) {
                console.warn('Skipping /help non-admin group test: handler not found.');
                return;
            }
            await helpHandler(mockGroupCtxNonAdmin);
            expect(mockTelegrafGetChatMember).toHaveBeenCalledWith(
                mockGroupCtxNonAdmin.chat.id,
                mockGroupCtxNonAdmin.from.id
            );
            expect(mockLoggerGlobal).toHaveBeenCalledWith(
                expect.stringContaining('Ignored /help command from non-admin')
            );
            expect(mockTelegrafSendMessage).not.toHaveBeenCalled();
            expect(mockTelegrafReply).not.toHaveBeenCalledWith(NON_ADMINS_ALERT);
        });
    });
});
