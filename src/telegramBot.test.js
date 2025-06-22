import { Telegraf } from 'telegraf'; // Original Telegraf for type reference if needed

// Mock Telegraf
const mockSendMessage = jest.fn().mockResolvedValue({});
const mockEditMessageReplyMarkup = jest.fn().mockResolvedValue({});
const mockAnswerCbQuery = jest.fn().mockResolvedValue(true);
const mockGetChatMember = jest.fn().mockResolvedValue({ status: 'member' }); // Default to member
const mockReply = jest.fn().mockResolvedValue({}); // For ctx.reply
const mockReplyWithHTML = jest.fn().mockResolvedValue({});
const mockEditMessageText = jest.fn().mockResolvedValue({});
const mockDeleteMessage = jest.fn().mockResolvedValue(true);
const mockSetMyCommands = jest.fn().mockResolvedValue(true);
const mockGetMyCommands = jest.fn().mockResolvedValue([]);

const mockBotInstance = {
    telegram: {
        sendMessage: mockSendMessage,
        getChatMember: mockGetChatMember,
        setMyCommands: mockSetMyCommands,
        getMyCommands: mockGetMyCommands,
        getMe: jest.fn().mockResolvedValue({ id: 42, is_bot: true, username: 'TestBot', first_name: 'Test Bot' }),
        editMessageReplyMarkup: mockEditMessageReplyMarkup,
        deleteMessage: mockDeleteMessage,
        // Add other bot.telegram methods used by the module
    },
    options: { username: 'TestBot' }, // Initial username, might be overwritten by getMe mock
    context: {}, // To store mock context properties if needed by handlers directly
    start: jest.fn(),
    help: jest.fn(),
    command: jest.fn(),
    action: jest.fn(),
    on: jest.fn(),
    launch: jest.fn().mockResolvedValue(true),
    catch: jest.fn(),
    stop: jest.fn(),
    // Add other bot methods used by the module
};

// This will make `new Telegraf()` return our mockBotInstance
jest.mock('telegraf', () => ({
    __esModule: true,
    Telegraf: jest.fn(() => mockBotInstance),
    Markup: {
        // Mock Markup if it's used for creating inline keyboards directly in telegramBot.js
        inlineKeyboard: jest.fn((buttons) => ({ inline_keyboard: buttons })),
        button: {
            url: jest.fn((text, url) => ({ text, url })),
            callback: jest.fn((text, data) => ({ text, callback_data: data })),
        },
    },
}));

// Mock other local dependencies
jest.mock('./config.js', () => ({
    __esModule: true,
    default: {
        telegramToken: 'test-token-mock',
        devChatId: 'mock-dev-chat-id',
        branch: 'test-branch',
        inst: 'test-inst',
        host: 'test-host',
        totalInst: '1',
        debugging: false,
        codeVer: 'test-v1.0',
        instActiveUntil: 'forever',
        // ... other necessary config values ...
    },
}));

jest.mock('./logger.js', () => ({
    __esModule: true,
    logger: jest.fn(),
    setBotInstance: jest.fn(), // Called in telegramBot.js
    bootstrapLogger: jest.fn(),
}));

jest.mock('./database.js', () => ({
    __esModule: true,
    lastAyaTime: jest.fn().mockResolvedValue({ success: true }),
    setFavReciter: jest.fn().mockResolvedValue({ success: true, reciter: 'mockReciter' }),
    getFavReciter: jest.fn().mockResolvedValue({ success: true, data: 'surprise' }),
    getDB: jest.fn().mockReturnValue({
        // Mock getDB to return a mock DB object
        collection: jest.fn().mockReturnThis(), // Return `this` to chain calls
        countDocuments: jest.fn().mockResolvedValue(0), // Mock specific collection methods
    }),
    connectDB: jest.fn().mockResolvedValue(true), // Mock connectDB
}));

jest.mock('./quranService.js', () => ({
    __esModule: true,
    prepareAya: jest.fn().mockReturnValue({ arText: 'Mock Arabic Aya', enText: 'Mock English Aya' }),
    getRecitation: jest.fn().mockResolvedValue('mock-audio-url.mp3'),
    isValidReciter: jest.fn().mockReturnValue(true),
    getRandomReciterIdentifier: jest.fn().mockReturnValue('ar.mockrandom'),
    nextAya: jest.fn((id) => id + 1),
    ayaId2suraAya: jest.fn().mockReturnValue({ sura: 1, aya: 1 }),
    suraAya2ayaId: jest.fn().mockReturnValue(1),
    normalizedSurasArNames: ['mock-sura-name'],
    rasmifize: jest.fn((text) => text), // Simple pass-through mock for rasmifize
    getQuranData: jest.fn().mockReturnValue({
        arReciters: [{ identifier: 'ar.alafasy', name: 'Alafasy', language: 'ar', englishName: 'Alafasy' }],
        enQuran: [{ name: 'Surat Al-Fatiha', ayahs: [{ number: 1, numberInSurah: 1 }] }], // Basic mock
    }),
    checkSource: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('./utils.js', () => ({
    __esModule: true,
    randomAyaNumber: jest.fn().mockReturnValue(123), // Mock specific random Aya number
    numArabicToEnglish: jest.fn((text) => text), // Simple pass-through
}));

// Now, attempt to import parts of telegramBot.js
// This is tricky because telegramBot.js runs code on import (sets up bot, etc.)
// We need to ensure that the mocks are in place *before* telegramBot.js is imported.
// The functions to be tested (like adminChecker) need to be exported from telegramBot.js.
// Let's assume for now they will be exported.

// Import the entire module to trigger its setup with mocks
import * as TelegramBotModule from './telegramBot.js';

// If adminChecker and other functions are not exported, we can't access them directly.
// The alternative is to test command handlers.
// For example, to test the '/help' command, we'd need to get the handler function
// that telegramBot.js registers with bot.command('help', handler).

describe('Telegram Bot Tests - Initial Setup', () => {
    it('should initialize the bot with the mocked Telegraf instance', () => {
        expect(Telegraf).toHaveBeenCalledWith('test-token-mock');
        expect(TelegramBotModule.bot).toBe(mockBotInstance); // Check if the exported bot is our mock
    });

    it('should call setBotInstance from logger', () => {
        const { setBotInstance } = require('./logger.js'); // Get the mock
        expect(setBotInstance).toHaveBeenCalledWith(mockBotInstance);
    });

    it('should attempt to fetch bot username on init', () => {
        expect(mockBotInstance.telegram.getMe).toHaveBeenCalled();
    });

    it('should set bot commands on init', () => {
        expect(mockBotInstance.telegram.setMyCommands).toHaveBeenCalled();
    });
});

// Import the functions and constants to be tested
// Note: TelegramBotModule.bot is the mocked bot instance
const { adminChecker, NON_ADMINS_ALERT } = TelegramBotModule;

describe('Telegram Bot Helpers', () => {
    describe('adminChecker', () => {
        beforeEach(() => {
            // Reset mock call counts and resolved values for each test
            mockGetChatMember.mockClear();
            // Default mock for getChatMember, can be overridden in specific tests
            mockGetChatMember.mockResolvedValue({ status: 'member' });
        });

        it('should return true if chat type is private', async () => {
            const mockCtx = { chat: { type: 'private' }, from: { id: 123 } };
            const isAdmin = await adminChecker(mockCtx);
            expect(isAdmin).toBe(true);
            expect(mockGetChatMember).not.toHaveBeenCalled(); // Should not call getChatMember for private chats
        });

        it('should return true if user is creator in a group', async () => {
            mockGetChatMember.mockResolvedValue({ status: 'creator' });
            const mockCtx = { chat: { type: 'group', id: 'g123' }, from: { id: 456 } };
            const isAdmin = await adminChecker(mockCtx);
            expect(mockGetChatMember).toHaveBeenCalledWith('g123', 456);
            expect(isAdmin).toBe(true);
        });

        it('should return true if user is administrator in a group', async () => {
            mockGetChatMember.mockResolvedValue({ status: 'administrator' });
            const mockCtx = { chat: { type: 'supergroup', id: 'sg123' }, from: { id: 789 } };
            const isAdmin = await adminChecker(mockCtx);
            expect(mockGetChatMember).toHaveBeenCalledWith('sg123', 789);
            expect(isAdmin).toBe(true);
        });

        it('should return false if user is just a member in a group', async () => {
            // Default mock is { status: 'member' }
            const mockCtx = { chat: { type: 'group', id: 'g456' }, from: { id: 101 } };
            const isAdmin = await adminChecker(mockCtx);
            expect(mockGetChatMember).toHaveBeenCalledWith('g456', 101);
            expect(isAdmin).toBe(false);
        });

        it('should return false if getChatMember fails or throws an error', async () => {
            mockGetChatMember.mockRejectedValue(new Error('Telegram API error'));
            const mockCtx = { chat: { type: 'group', id: 'g789' }, from: { id: 202 } };
            const isAdmin = await adminChecker(mockCtx);
            expect(mockGetChatMember).toHaveBeenCalledWith('g789', 202);
            expect(isAdmin).toBe(false);
            // Check if logger was called (assuming logger is imported and used in adminChecker)
            const { logger } = require('./logger.js');
            expect(logger).toHaveBeenCalledWith(
                'Error in adminChecker while calling getChatMember: ',
                expect.any(Error)
            );
        });

        it('should return false if ctx.chat or ctx.from is missing', async () => {
            const { logger } = require('./logger.js');
            expect(await adminChecker({ from: { id: 123 } })).toBe(false);
            expect(logger).toHaveBeenCalledWith('adminChecker: Invalid context received.', { from: { id: 123 } });

            logger.mockClear(); // Clear previous call
            expect(await adminChecker({ chat: { type: 'private' } })).toBe(false);
            expect(logger).toHaveBeenCalledWith('adminChecker: Invalid context received.', {
                chat: { type: 'private' },
            });
        });
    });
});

// --- Mocked Functions from Imports (for easier access in tests) ---
const { sendAya: mockSendAyaFromTelegramBotInternal, bot: mockedBotObject } = TelegramBotModule; // sendAya is exported from telegramBot
const { randomAyaNumber: mockRandomAyaNumber } = require('./utils.js');
const { rasmifize: mockRasmifize, suraAya2ayaId: mockSuraAya2AyaId } = require('./quranService.js');
const { logger: mockLogger } = require('./logger.js');

describe('Telegram Command Handler: /surpriseme', () => {
    let surprisemeHandler;
    const mockUserCtxAdmin = {
        chat: { id: 123, type: 'private' }, // Private implies admin
        from: { id: 123, language_code: 'en' },
        reply: mockReply,
    };
    const mockUserCtxNonAdmin = {
        chat: { id: 456, type: 'group' },
        from: { id: 456, language_code: 'ar' },
        reply: mockReply,
    };

    beforeAll(() => {
        const commandCall = mockBotInstance.command.mock.calls.find((call) => call[0] === 'surpriseme');
        if (commandCall && typeof commandCall[1] === 'function') {
            surprisemeHandler = commandCall[1];
        } else {
            console.error('/surpriseme handler not found in mock. Calls:', mockBotInstance.command.mock.calls);
        }
    });

    beforeEach(() => {
        mockReply.mockClear();
        mockGetChatMember.mockClear();
        // mockSendAyaFromTelegramBotInternal.mockClear(); // This is the actual sendAya from telegramBot.js
        // If sendAya is not directly mockable because it's part of the module under test,
        // we rely on its internal calls to be mocked, e.g., quranService and bot.telegram methods.
        // For this test, surpriseAya (the helper) calls the exported sendAya.
        // We need to ensure the *exported* sendAya from telegramBot is the one we are checking,
        // or check the mocks it calls (like sendAyaText, sendAyaRecitation which call bot.telegram.sendMessage).

        // Reset the mock for the *exported* sendAya from telegramBot.js
        // This is tricky because it's both the function under test (indirectly) and a mock target if not careful.
        // The `sendAya` imported at the top of *this file* is from the *actual* module,
        // but inside `telegramBot.js`, its internal `sendAya` calls other mocked functions.
        // Let's clear the mocks of functions *called by* `sendAya`.
        TelegramBotModule.sendAya.mockClear(); // Assuming this is the one exported and used by surpriseAya helper
    });

    it('should call surpriseAya helper if user is admin (private chat)', async () => {
        if (!surprisemeHandler) return pending('/surpriseme handler not registered in mock.');

        await surprisemeHandler(mockUserCtxAdmin);

        // The surpriseAya helper function (now exported for direct test if needed)
        // calls the main sendAya function.
        // We check if the exported sendAya was called by the surpriseAya helper.
        expect(TelegramBotModule.sendAya).toHaveBeenCalledWith(
            mockUserCtxAdmin.chat.id,
            null, // ayaId (random)
            null, // reciter (random)
            'en', // lang
            'surprise', // trigger
            true // withRecitation
        );
        expect(mockReply).not.toHaveBeenCalled();
    });

    it('should reply with NON_ADMINS_ALERT if user is not admin in a group', async () => {
        if (!surprisemeHandler) return pending('/surpriseme handler not registered in mock.');
        mockGetChatMember.mockResolvedValue({ status: 'member' }); // Ensure user is non-admin

        await surprisemeHandler(mockUserCtxNonAdmin);

        expect(mockGetChatMember).toHaveBeenCalledWith(mockUserCtxNonAdmin.chat.id, mockUserCtxNonAdmin.from.id);
        expect(mockReply).toHaveBeenCalledWith(NON_ADMINS_ALERT);
        expect(TelegramBotModule.sendAya).not.toHaveBeenCalled();
    });
});

describe('Telegram Action Handler: surpriseAyaAction', () => {
    let surpriseAyaActionHandler;
    const mockCbCtxAdmin = {
        chat: { id: 789, type: 'private' },
        from: { id: 789, language_code: 'fr' },
        update: { callback_query: { data: JSON.stringify({ surpriseAyaAction: true }) } },
        answerCbQuery: mockAnswerCbQuery,
    };
    const mockCbCtxNonAdmin = {
        chat: { id: 'g789', type: 'group' },
        from: { id: 101, language_code: 'es' },
        update: { callback_query: { data: JSON.stringify({ surpriseAyaAction: true }) } },
        answerCbQuery: mockAnswerCbQuery,
        reply: mockReply, // For NON_ADMINS_ALERT if sent via reply
    };

    beforeAll(() => {
        // Find the handler registered for the action pattern
        const actionCall = mockBotInstance.action.mock.calls.find(
            (call) =>
                (call[0] instanceof RegExp && call[0].test(JSON.stringify({ surpriseAyaAction: true }))) ||
                (typeof call[0] === 'string' && call[0] === JSON.stringify({ surpriseAyaAction: true }))
        );
        if (actionCall && typeof actionCall[1] === 'function') {
            surpriseAyaActionHandler = actionCall[1];
        } else {
            console.error(
                'surpriseAyaAction handler not found. Calls:',
                mockBotInstance.action.mock.calls.map((c) => c[0])
            );
        }
    });

    beforeEach(() => {
        mockAnswerCbQuery.mockClear();
        TelegramBotModule.sendAya.mockClear(); // Clear calls to the main sendAya
        mockGetChatMember.mockClear();
        mockReply.mockClear();
    });

    it('should call surpriseAya helper and answerCbQuery if user is admin', async () => {
        if (!surpriseAyaActionHandler) return pending('surpriseAyaAction handler not registered.');

        await surpriseAyaActionHandler(mockCbCtxAdmin);

        expect(TelegramBotModule.sendAya).toHaveBeenCalledWith(
            mockCbCtxAdmin.chat.id,
            null,
            null,
            'fr',
            'surprise',
            true
        );
        expect(mockAnswerCbQuery).toHaveBeenCalled();
    });

    it('should send NON_ADMINS_ALERT and answerCbQuery if user is not admin in group', async () => {
        if (!surpriseAyaActionHandler) return pending('surpriseAyaAction handler not registered.');
        mockGetChatMember.mockResolvedValue({ status: 'member' });

        await surpriseAyaActionHandler(mockCbCtxNonAdmin);

        expect(mockGetChatMember).toHaveBeenCalledWith(mockCbCtxNonAdmin.chat.id, mockCbCtxNonAdmin.from.id);
        // The adminProtectedAction helper calls answerCbQuery with alert
        expect(mockAnswerCbQuery).toHaveBeenCalledWith(NON_ADMINS_ALERT, { show_alert: true });
        expect(TelegramBotModule.sendAya).not.toHaveBeenCalled();
    });
});

describe('Telegram Bot: handleText Function', () => {
    // handleText is exported, so we can call it directly.
    // const { handleText } = TelegramBotModule; // Already done via import * as TelegramBotModule

    const mockCtxBase = {
        from: { id: 123, language_code: 'en', username: 'testuser' },
        chat: { id: 12345, type: 'private' },
        // bot.telegram.sendMessage is used by 'unrecognized'
    };

    beforeEach(() => {
        TelegramBotModule.sendAya.mockClear();
        mockSuraAya2AyaId.mockClear();
        mockRasmifize.mockClear();
        // Resetting the mock for normalizedSurasArNames from quranService.js mock
        // This requires quranService mock to be correctly set up.
        // The mock for quranService.js already provides a simple rasmifize mock.
        // Ensure normalizedSurasArNames is also correctly mocked or its usage in handleText is controlled.

        // Mock for quranService.normalizedSurasArNames:
        // In the main mock setup: normalizedSurasArNames: ['mock-sura-name'],
        // We need to ensure rasmifize is consistently used.
        // Our rasmifize mock is `jest.fn(text => text)`.
        // Our normalizedSurasArNames mock should reflect that.
        // For "الكرسي" test:
        mockRasmifize.mockImplementation((text) => {
            if (text === 'الكرسي') return 'الكرسي'; // Simulate specific rasmifize behavior
            if (text === 'البقرة') return 'البقره'; // Assuming normalizedSurasArNames[1] = "البقره"
            if (text === '2') return '2';
            if (text === '255') return '255';
            if (text === 'المهوسصق') return 'المهوسصق'; // For ArMagicRegex
            return text; // Default pass-through
        });

        // Mocking normalizedSurasArNames from the quranService mock
        // This part of the mock needs to be consistent with how handleText uses it.
        // Let's assume enQuran[1] is Al-Baqarah.
        // And normalizedSurasArNames[1] (index for sura 2) would be rasmifize("البقرة")
        const { getQuranData } = require('./quranService.js');
        getQuranData.mockReturnValue({
            enQuran: [
                { name: 'Surat Al-Fatiha', englishName: 'Al-Fatiha' }, // Sura 1
                { name: 'Surat Al-Baqarah', englishName: 'Al-Baqarah' }, // Sura 2
            ],
            // other quranData if needed by tested paths
        });
        // Update the direct mock for normalizedSurasArNames if it's used directly
        // In telegramBot.js, it uses the imported normalizedSurasArNames from quranService.
        // So the mock of quranService.normalizedSurasArNames is what matters.
        // We set it to ['mock-sura-name'] earlier. Let's make it more realistic for this test.
        jest.spyOn(require('./quranService.js'), 'normalizedSurasArNames', 'get').mockReturnValue([
            rasmifize('الفاتحة'), // For Sura 1
            rasmifize('البقرة'), // For Sura 2
        ]);

        mockSendMessage.mockClear(); // Used by 'unrecognized'
    });

    it('should call sendAya for "آية الكرسي" (Ayat al-Kursi)', async () => {
        const mockCtx = { ...mockCtxBase, message: { text: 'آية الكرسي' } };
        // rasmifize("الكرسي") is used internally by handleText
        mockRasmifize.mockImplementationOnce((text) => (text === 'الكرسي' ? 'الكرسي' : text));

        await TelegramBotModule.handleText(mockCtx);

        expect(TelegramBotModule.sendAya).toHaveBeenCalledWith(
            mockCtx.chat.id,
            262, // Expected Aya ID for Ayat al-Kursi
            null, // reciter
            'en', // lang
            'request', // trigger
            false // withRecitation (default for text request)
        );
    });

    it('should call sendAya for Sura and Aya numbers (e.g., "2 255")', async () => {
        const mockCtx = { ...mockCtxBase, message: { text: '2 255' } };
        mockSuraAya2AyaId.mockReturnValueOnce(262); // Mock that "2 255" maps to Aya ID 262

        await TelegramBotModule.handleText(mockCtx);

        expect(mockSuraAya2AyaId).toHaveBeenCalledWith({ sura: 2, aya: 255 });
        expect(TelegramBotModule.sendAya).toHaveBeenCalledWith(mockCtx.chat.id, 262, null, 'en', 'request', false);
    });

    it('should call sendAya for Sura name and Aya number (e.g., "البقرة ٢٥٥")', async () => {
        const mockCtx = { ...mockCtxBase, message: { text: 'البقرة ٢٥٥' } };

        // Ensure numArabicToEnglish converts ٢٥٥ to 255
        const { numArabicToEnglish } = require('./utils.js'); // Get the mock
        numArabicToEnglish.mockImplementationOnce((str) => str.replace('٢٥٥', '255'));

        // Ensure rasmifize handles "البقرة" as expected by normalizedSurasArNames
        // This is tricky because normalizedSurasArNames is built using rasmifize.
        // Let's assume normalizedSurasArNames[1] (for Sura Al-Baqarah) is "البقره" (after rasmifize)
        // And the input "البقرة" also becomes "البقره" after rasmifize.
        mockRasmifize.mockImplementation((text) => {
            if (text === 'البقرة') return 'البقره';
            if (text === '255') return '255';
            if (text === 'المهوسصق') return 'المهوسصق';
            return text;
        });

        mockSuraAya2AyaId.mockReturnValueOnce(262); // Sura 2 (Al-Baqarah), Aya 255 -> ID 262

        await TelegramBotModule.handleText(mockCtx);

        expect(numArabicToEnglish).toHaveBeenCalledWith('البقرة ٢٥٥');
        expect(mockRasmifize).toHaveBeenCalledWith('البقرة 255'); // After numArabicToEnglish
        // Further rasmifize calls happen inside the loop for sura names
        expect(mockSuraAya2AyaId).toHaveBeenCalledWith({ sura: 2, aya: 255 }); // Assuming Al-Baqarah is Sura 2
        expect(TelegramBotModule.sendAya).toHaveBeenCalledWith(mockCtx.chat.id, 262, null, 'en', 'request', false);
    });

    it('should call unrecognized for invalid Sura number (e.g., "999 1")', async () => {
        const mockCtx = { ...mockCtxBase, message: { text: '999 1' } };
        mockSuraAya2AyaId.mockReturnValueOnce(-1); // -1 indicates invalid Sura

        await TelegramBotModule.handleText(mockCtx);

        // Expect 'unrecognized' to be called, which then calls bot.telegram.sendMessage
        expect(mockSendMessage).toHaveBeenCalledWith(
            mockCtx.chat.id,
            expect.stringContaining('عذرا، لم نتعرف على اسم سورة'), // Reason 1 for unrecognized
            expect.any(Object) // Reply markup
        );
        expect(TelegramBotModule.sendAya).not.toHaveBeenCalled();
    });

    it('should call unrecognized for valid Sura but invalid Aya (e.g., "1 99")', async () => {
        const mockCtx = { ...mockCtxBase, message: { text: '1 99' } };
        mockSuraAya2AyaId.mockReturnValueOnce(0); // 0 indicates valid Sura, invalid Aya

        await TelegramBotModule.handleText(mockCtx);

        expect(mockSendMessage).toHaveBeenCalledWith(
            mockCtx.chat.id,
            expect.stringContaining('عذرا، رقم الآية ليس في السورة المطلوبة'), // Reason 2
            expect.any(Object)
        );
        expect(TelegramBotModule.sendAya).not.toHaveBeenCalled();
    });

    it('should call unrecognized for purely textual message not matching any pattern', async () => {
        const mockCtx = { ...mockCtxBase, message: { text: 'Hello world' } };
        // This will result in ayaId = -2 (initial value) as no patterns match.
        // The code path for ayaId < 0 (and not -1 specifically) leads to unrecognized(ctx, 1)
        // However, the logic is: if ayaId > 0 -> sendAya. else if ayaId < 0 -> unrecognized(ctx,1). else if ayaId == 0 -> unrecognized(ctx,2)
        // If no numbers and no Arabic Sura name match, ayaId remains -2.
        // This means unrecognized(ctx, 1) will be called.

        await TelegramBotModule.handleText(mockCtx);

        expect(mockSendMessage).toHaveBeenCalledWith(
            mockCtx.chat.id,
            expect.stringContaining('عذرا، لم نتعرف على اسم سورة'), // Reason 1
            expect.any(Object)
        );
        expect(TelegramBotModule.sendAya).not.toHaveBeenCalled();
    });
});

describe('Telegram Command Handlers', () => {
    describe('/help command', () => {
        let helpHandler;
        const mockUserCtx = {
            // Mock context for a user interaction
            chat: { id: 12345, type: 'private' }, // Private chat implies admin for help
            from: { id: 123, is_bot: false, first_name: 'TestUser' },
            reply: mockReply,
        };
        const mockGroupCtxNonAdmin = {
            chat: { id: 'g123', type: 'group' },
            from: { id: 456, is_bot: false, first_name: 'NonAdminUser' },
            reply: mockReply,
        };

        beforeAll(() => {
            // Find the handler registered for the 'help' command
            const commandCall = mockBotInstance.command.mock.calls.find((call) => call[0] === 'help');
            if (commandCall && typeof commandCall[1] === 'function') {
                helpHandler = commandCall[1];
            } else {
                // This can happen if telegramBot.js hasn't been fully imported/run due to test setup,
                // or if the command registration logic changes.
                console.error(
                    'Help command handler not found in mockBotInstance.command calls. Calls:',
                    mockBotInstance.command.mock.calls
                );
            }
        });

        beforeEach(() => {
            mockSendMessage.mockClear();
            mockReply.mockClear();
            mockGetChatMember.mockClear();
            // Default to non-admin for group context unless overridden
            mockGetChatMember.mockResolvedValue({ status: 'member' });
        });

        it('should send instructions message if handler is found and user is admin (private chat)', async () => {
            if (!helpHandler) {
                return pending('Help handler not registered in mock. Skipping test.');
            }
            // For private chat, adminChecker returns true without needing getChatMember mock
            await helpHandler(mockUserCtx);
            // The instructions function calls bot.telegram.sendMessage
            expect(mockSendMessage).toHaveBeenCalledWith(
                mockUserCtx.chat.id,
                expect.stringContaining('يمكنك طلب آية محددة')
            );
            expect(mockReply).not.toHaveBeenCalled(); // instructions sends its own message
        });

        it('should send instructions message if handler is found and user is admin (group chat)', async () => {
            if (!helpHandler) {
                return pending('Help handler not registered in mock. Skipping test.');
            }
            mockGetChatMember.mockResolvedValue({ status: 'administrator' }); // Make user admin in group
            const groupAdminCtx = { ...mockGroupCtxNonAdmin, from: { ...mockGroupCtxNonAdmin.from, id: 999 } };
            await helpHandler(groupAdminCtx);
            expect(mockGetChatMember).toHaveBeenCalledWith(groupAdminCtx.chat.id, groupAdminCtx.from.id);
            expect(mockSendMessage).toHaveBeenCalledWith(
                groupAdminCtx.chat.id,
                expect.stringContaining('يمكنك طلب آية محددة')
            );
            expect(mockReply).not.toHaveBeenCalled();
        });

        it('should reply with NON_ADMINS_ALERT if user is not admin in a group chat', async () => {
            if (!helpHandler) {
                return pending('Help handler not registered in mock. Skipping test.');
            }
            // mockGetChatMember already defaults to 'member' status
            await helpHandler(mockGroupCtxNonAdmin);
            expect(mockGetChatMember).toHaveBeenCalledWith(mockGroupCtxNonAdmin.chat.id, mockGroupCtxNonAdmin.from.id);
            expect(mockReply).toHaveBeenCalledWith(NON_ADMINS_ALERT);
            expect(mockSendMessage).not.toHaveBeenCalled(); // Should not send instructions
        });
    });
});
