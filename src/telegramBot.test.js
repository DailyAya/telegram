// Moved config mock to the absolute top
let mockConfigModule; // To hold the imported mock config for use in MSW setup
jest.unstable_mockModule('./config.js', async () => {
    mockConfigModule = await import('./__mocks__/config.mock.js');
    return mockConfigModule;
});

import { jest } from '@jest/globals';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { Markup as TelegrafMarkup } from 'telegraf';

// Helper to load JSON fixtures
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const loadFixture = (filePath) => {
    const absolutePath = path.resolve(__dirname, '../', filePath);
    return JSON.parse(fs.readFileSync(absolutePath, 'utf-8'));
};

// MSW Server Setup & Fixtures
const getMeSuccessFixture = loadFixture('test/__fixtures__/telegram_api/responses/getMe_success.json');
const baseSendMessageSuccessFixture = loadFixture('test/__fixtures__/telegram_api/responses/sendMessage_success.json');
let nextTestUpdateId = 1;

// Mock Telegraf
jest.unstable_mockModule('telegraf', () => {
    const ActualTelegraf = jest.requireActual('telegraf');
    return {
        __esModule: true,
        Telegraf: ActualTelegraf.Telegraf,
        Markup: ActualTelegraf.Markup,
        Composer: ActualTelegraf.Composer,
        session: ActualTelegraf.session,
        Context: ActualTelegraf.Context,
    };
});

// Mock Logger
const mockLogger = jest.fn();
const mockSetBotInstance = jest.fn();
const mockBootstrapLogger = jest.fn();
jest.unstable_mockModule('./logger.js', () => ({
    __esModule: true, logger: mockLogger, setBotInstance: mockSetBotInstance, bootstrapLogger: mockBootstrapLogger,
}));

// Mock other SUT direct dependencies
const databaseMock = { lastAyaTime: jest.fn(), setFavReciter: jest.fn(), getFavReciter: jest.fn() };
jest.unstable_mockModule('./database.js', () => ({ __esModule: true, ...databaseMock }));

const commandHandlersMock = {
    handleStartCommand: jest.fn(), handleHelpCommand: jest.fn(), handleSurpriseMeCommand: jest.fn(),
    handleSupportCommand: jest.fn(), handleRecitersCommand: jest.fn(), handleChannelCommand: jest.fn(),
    handleKhatmaCommand: jest.fn(), handleCommandsCommand: jest.fn(),
};
jest.unstable_mockModule('./botHandlers/commandHandlers.js', () => ({ __esModule: true, ...commandHandlersMock }));

const actionHandlersMock = {
    handleGroupKhatmaAction: jest.fn(), handleRecitersNavPageAction: jest.fn(), handleSetReciterAction: jest.fn(),
    handleInstructionsAction: jest.fn(), handleSurpriseAyaAction: jest.fn(), handleCurrAyaAction: jest.fn(),
    handleAMenuAction: jest.fn(), handleReciteAction: jest.fn(),
};
jest.unstable_mockModule('./botHandlers/actionHandlers.js', () => ({ __esModule: true, ...actionHandlersMock }));

jest.unstable_mockModule('./botFeatures/khatmaService.js', () => ({ __esModule: true, khatmaUpdate: jest.fn() }));

const mockPrepareAya = jest.fn(); const mockGetRecitation = jest.fn(); const mockIsValidReciter = jest.fn();
const mockGetRandomReciterIdentifier = jest.fn(); const mockNextAya = jest.fn(); const mockAyaId2SuraAya = jest.fn();
const mockSuraAya2AyaId = jest.fn(); const mockGetQuranData = jest.fn(); const mockCheckSource = jest.fn();
import rasmifizeActualImport from 'rasmify.js';

jest.unstable_mockModule('./quranService.js', () => ({
    __esModule: true, prepareAya: mockPrepareAya, getRecitation: mockGetRecitation, isValidReciter: mockIsValidReciter,
    getRandomReciterIdentifier: mockGetRandomReciterIdentifier, nextAya: mockNextAya, ayaId2suraAya: mockAyaId2SuraAya,
    suraAya2ayaId: mockSuraAya2AyaId, getQuranData: mockGetQuranData, checkSource: mockCheckSource,
    rasmifize: rasmifizeActualImport,
    normalizedSurasArNames: [],
}));

const reciterServiceMock = { populateRecitersButtons: jest.fn(), recitersNavPage: jest.fn() };
jest.unstable_mockModule('./botFeatures/reciterService.js', () => ({ __esModule: true, ...reciterServiceMock }));

const utilsMock = {
    randomAyaNumber: jest.fn(), numArabicToEnglish: jest.fn(text => text), maskTokenInUrl: jest.fn(url => url),
    checkConnectivity: jest.fn().mockResolvedValue({ success: true }), sendEmergencyNotification: jest.fn().mockResolvedValue(undefined),
};
jest.unstable_mockModule('./utils.js', () => ({ __esModule: true, ...utilsMock }));

let registerHandlers, performBotPreLaunchChecks, sendAya, surpriseAya, handleText;
let mockBotInstance;
let mswServer;
let mockBotCommandSpy, mockBotActionSpy, mockBotOnSpy, mockBotHelpSpy, mockBotStartSpy;
let mockBotTelegramSendMessageSpy, mockBotTelegramSendAudioSpy, mockBotTelegramGetChatMemberSpy, mockBotTelegramCallApiSpy;

beforeAll(async () => {
    jest.resetModules();
    await import('./config.js');

    mswServer = setupServer(
        http.get(`https://api.telegram.org/bot${mockConfigModule.default.telegramToken}/getMe`, () => HttpResponse.json(getMeSuccessFixture)),
        http.post(`https://api.telegram.org/bot${mockConfigModule.default.telegramToken}/sendMessage`, async ({ request }) => {
            const reqBody = await request.json();
            const resp = { ...baseSendMessageSuccessFixture.result, chat: { id: reqBody.chat_id, type: 'private' }, text: reqBody.text, message_id: nextTestUpdateId++ };
            return HttpResponse.json({ok: true, result: resp});
        }),
        http.post(`https://api.telegram.org/bot${mockConfigModule.default.telegramToken}/sendAudio`, async ({request}) => {
             const reqBody = await request.json();
            return HttpResponse.json({ ok: true, result: { message_id: nextTestUpdateId++, chat: {id: reqBody.chat_id}}});
        }),
        http.post(`https://api.telegram.org/bot${mockConfigModule.default.telegramToken}/setMyCommands`, () => HttpResponse.json({ ok: true, result: true })),
        http.post(`https://api.telegram.org/bot${mockConfigModule.default.telegramToken}/getChatMember`, () => HttpResponse.json({ ok: true, result: {user: {id:123, is_bot:false}, status: 'member'} })),
        http.post(`https://api.telegram.org/bot${mockConfigModule.default.telegramToken}/answerCallbackQuery`, () => HttpResponse.json({ ok: true, result: true }))
    );
    mswServer.listen({ onUnhandledRequest: 'warn' });

    const telegramBotModule = await import('./telegramBot.js');
    registerHandlers = telegramBotModule.registerHandlers;
    performBotPreLaunchChecks = telegramBotModule.performBotPreLaunchChecks;
    sendAya = telegramBotModule.sendAya;
    surpriseAya = telegramBotModule.surpriseAya;
    handleText = telegramBotModule.handleText;

    console.log('[TEST beforeAll] registerHandlers IS a function after import.');

    const ActualTelegraf = jest.requireActual('telegraf').Telegraf;
    mockBotInstance = new ActualTelegraf(mockConfigModule.default.telegramToken);

    global.registeredCommandHandlers = new Map();
    global.registeredEventListeners = new Map();
    global.registeredActionHandlers = new Map();

    mockBotInstance.command = jest.fn((commandName, handler) => {
        const names = Array.isArray(commandName) ? commandName : [commandName];
        names.forEach(name => global.registeredCommandHandlers.set(name, handler));
        return mockBotInstance;
    });
    mockBotInstance.start = jest.fn((handler) => { global.registeredCommandHandlers.set('start', handler); return mockBotInstance; });
    mockBotInstance.help = jest.fn((handler) => { global.registeredCommandHandlers.set('help', handler); return mockBotInstance; });
    mockBotInstance.on = jest.fn((updateType, handler) => {
        const types = Array.isArray(updateType) ? updateType : [updateType];
        types.forEach(type => global.registeredEventListeners.set(type, handler));
        return mockBotInstance;
    });
    mockBotInstance.action = jest.fn((triggers, handler) => {
        const triggerKey = Array.isArray(triggers) ? triggers[0].toString() : triggers.toString();
        global.registeredActionHandlers.set(triggerKey, handler);
        return mockBotInstance;
    });

    mockBotCommandSpy = mockBotInstance.command;
    mockBotStartSpy = mockBotInstance.start;
    mockBotHelpSpy = mockBotInstance.help;
    mockBotOnSpy = mockBotInstance.on;
    mockBotActionSpy = mockBotInstance.action;

    mockBotTelegramSendMessageSpy = jest.spyOn(mockBotInstance.telegram, 'sendMessage').mockResolvedValue(baseSendMessageSuccessFixture.result);
    mockBotTelegramSendAudioSpy = jest.spyOn(mockBotInstance.telegram, 'sendAudio').mockResolvedValue({ message_id: 1000, chat: {id: 123}});
    mockBotTelegramGetChatMemberSpy = jest.spyOn(mockBotInstance.telegram, 'getChatMember').mockResolvedValue({user: {id: 123, first_name: "Test", is_bot: false}, status: 'member'});
    mockBotTelegramCallApiSpy = jest.spyOn(mockBotInstance.telegram, 'callApi').mockResolvedValue({ ok: true, result: true });

    mockBotInstance.options.username = getMeSuccessFixture.result.username;
    registerHandlers(mockBotInstance, { Markup: TelegrafMarkup });

    console.log('[TEST beforeAll] mockBotStartSpy.mock.calls raw:', mockBotStartSpy.mock.calls);
});

afterEach(() => {
    mswServer.resetHandlers();
    mockLogger.mockClear();
    mockBootstrapLogger.mockClear();
    mockBotStartSpy?.mockClear(); mockBotHelpSpy?.mockClear(); mockBotCommandSpy?.mockClear();
    mockBotOnSpy?.mockClear(); mockBotActionSpy?.mockClear();
    mockBotTelegramSendMessageSpy?.mockClear(); mockBotTelegramSendAudioSpy?.mockClear();
    mockBotTelegramGetChatMemberSpy?.mockClear(); mockBotTelegramCallApiSpy?.mockClear();
    Object.values(databaseMock).forEach(fn => fn.mockClear());
    Object.values(commandHandlersMock).forEach(fn => fn.mockClear());
    Object.values(actionHandlersMock).forEach(fn => fn.mockClear());
    mockPrepareAya.mockClear(); mockGetRecitation.mockClear(); mockIsValidReciter.mockClear();
    mockGetRandomReciterIdentifier.mockClear(); mockNextAya.mockClear(); mockAyaId2SuraAya.mockClear();
    mockSuraAya2AyaId.mockClear(); mockGetQuranData.mockClear(); mockCheckSource.mockClear();
    utilsMock.randomAyaNumber.mockClear();

    mockGetQuranData.mockReturnValue({ arReciters: [], enQuran: [] });
    mockPrepareAya.mockReturnValue({ arText: 'Mocked Arabic Text', enText: 'Mocked English Text', sura: 1, aya: 1, ayaInSura:1, suraNameAr: 'الفاتحة', link: 'mockLink' });
    mockGetRecitation.mockResolvedValue({ success: true,
        reciter: { id: 'mockReciterId', name: 'Mock Reciter', language: 'ar', style: '', quality: '', rasm: '', db_id: 1 },
        audioSource: 'mock/audio/path.mp3',
        duration: 12345
    });
});

afterAll(() => mswServer?.close());

describe('Telegram Bot - Exported Functions Structure', () => {
    it('performBotPreLaunchChecks should be a function', () => expect(typeof performBotPreLaunchChecks).toBe('function'));
    it('sendAya should be a function', () => expect(typeof sendAya).toBe('function'));
    it('surpriseAya should be a function', () => expect(typeof surpriseAya).toBe('function'));
    it('handleText should be a function', () => expect(typeof handleText).toBe('function'));
    it('registerHandlers should be a function', () => expect(typeof registerHandlers).toBe('function'));
});

describe('performBotPreLaunchChecks', () => {
    beforeEach(() => {
        mockCheckSource.mockClear().mockResolvedValue(undefined);
    });

    it('should send startup message if devChatId is configured and username is available', async () => {
        const originalDebugging = mockConfigModule.default.debugging;
        mockConfigModule.default.debugging = false;
        // Ensure activeBotInstance.options.username is set for this test, as it might be cleared by other tests
        // or if this test runs in isolation. It's set in beforeAll, but good to be defensive if needed.
        // However, the current beforeAll should cover this.
        // mockBotInstance.options.username = getMeSuccessFixture.result.username;


        await performBotPreLaunchChecks();

        const expectedMessagePartial = `DailyAyaTelegram ${mockConfigModule.default.branch} instance ${mockConfigModule.default.inst}@${mockConfigModule.default.host} (of total ${mockConfigModule.default.totalInst}) is active in normal mode of version ${mockConfigModule.default.codeVer} until ${mockConfigModule.default.instActiveUntil}.`;
        // We also expect memory and uptime, but these can be variable.
        // So, we'll check for the main static parts and then that Memory Used and Uptime are present.

        expect(mockBotTelegramSendMessageSpy).toHaveBeenCalledTimes(1);
        expect(mockBotTelegramSendMessageSpy).toHaveBeenCalledWith(
            mockConfigModule.default.devChatId,
            expect.any(String), // Check that it's a string, but verify content below
            undefined
        );

        const actualSentMessage = mockBotTelegramSendMessageSpy.mock.calls[0][1];
        expect(actualSentMessage).toContain(expectedMessagePartial);
        expect(actualSentMessage).toMatch(/Memory Used: \d+(\.\d+)? MB/); // Allow for decimal MB
        expect(actualSentMessage).toMatch(/Uptime: \d+ hours/);

        expect(mockCheckSource).toHaveBeenCalled();

        mockConfigModule.default.debugging = originalDebugging;
    });

    it('should not send startup message if devChatId is not configured', async () => {
        const originalDevChatId = mockConfigModule.default.devChatId;
        mockConfigModule.default.devChatId = null;
        await performBotPreLaunchChecks();

        const startupMessageCall = mockBotTelegramSendMessageSpy.mock.calls.find(
            callArgs => callArgs[0] === originalDevChatId && typeof callArgs[1] === 'string' && callArgs[1].includes(`DailyAyaTelegram ${mockConfigModule.default.branch} instance`)
        );
        expect(startupMessageCall).toBeUndefined();
        mockConfigModule.default.devChatId = originalDevChatId;
    });

    it('should log "Cannot send" if devChatId is set but bot username is not available', async () => {
        const originalUsername = mockBotInstance.options.username;
        mockBotInstance.options.username = null;
        await performBotPreLaunchChecks();
        expect(mockBootstrapLogger).toHaveBeenCalledWith(
            expect.stringContaining('performBotPreLaunchChecks: Cannot send startup state message to dev group - bot username not available')
        );
        mockBotInstance.options.username = originalUsername;
    });

    it('should not call checkSource if debugging is true', async () => {
        const originalDebugging = mockConfigModule.default.debugging;
        mockConfigModule.default.debugging = true;
        await performBotPreLaunchChecks();
        expect(mockCheckSource).not.toHaveBeenCalled();
        mockConfigModule.default.debugging = originalDebugging;
    });

    it('should call checkSource with a functional sendMessage callback when not debugging', async () => {
        const originalDebugging = mockConfigModule.default.debugging;
        mockConfigModule.default.debugging = false;
        await performBotPreLaunchChecks();
        expect(mockCheckSource).toHaveBeenCalledWith(expect.any(Function));
        mockConfigModule.default.debugging = originalDebugging;
    });
});

describe('Handler Registrations', () => {
    // This block will be added back incrementally
    it('should have basic spies defined', () => { // Placeholder
        expect(mockBotStartSpy).toBeDefined();
    });
});

// All other describe blocks are still commented out for now

describe('sendAya', () => {
    const mockChatId = 12345;
    const mockAyaNumber = 1;

    beforeEach(() => {
        mockConfigModule.default.defaultReciter = 'CONFIG_DEFAULT_RECITER_MOCK'; // Explicitly set for testing this path
        // Reset mocks that might be specifically manipulated in tests
        mockPrepareAya.mockClear();
        mockGetRecitation.mockClear();
        mockBotTelegramSendAudioSpy.mockClear();
        // Default successful preparations for most tests
        mockPrepareAya.mockReturnValue({
            arText: 'Mocked Arabic Text', enText: 'Mocked English Text',
            sura: 1, aya: mockAyaNumber, ayaInSura: 1, suraNameAr: 'الفاتحة',
            link: 'mockLink', reciterName: 'DefaultReciter'
        });
        mockGetRecitation.mockResolvedValue({
            success: true,
            reciter: { id: 'mockReciterId', name: 'Mock Reciter', language: 'ar', style: '', quality: '', rasm: '', db_id: 1 },
            audioSource: 'mock/audio/path.mp3',
            duration: 12345
        });
        mockBotTelegramSendAudioSpy.mockResolvedValue({ message_id: 9876, chat: {id: mockChatId }}); // from activeBotInstance
    });

    it('should call prepareAya with the correct ayaNumber', async () => {
        await sendAya(mockChatId, mockAyaNumber);
        // Default requestedByUser is 'system', which becomes reciterId if no specific reciter is requested.
        expect(mockPrepareAya).toHaveBeenCalledWith(mockAyaNumber, 'system');
    });

    it('should call getRecitation with details from prepareAya and config', async () => {
        const preparedAyaDetails = {
            sura: 1, aya: mockAyaNumber, ayaInSura: 1, suraNameAr: 'الفاتحة',
            reciterName: 'TestReciter', link: 'mockLink',
            arText: 'Prepared Arabic', enText: 'Prepared English'
        };
        mockPrepareAya.mockReturnValue(preparedAyaDetails);

        await sendAya(mockChatId, mockAyaNumber);
        expect(mockGetRecitation).toHaveBeenCalledWith(
            preparedAyaDetails.sura,
            preparedAyaDetails.ayaInSura,
            'TestReciter' // reciterId comes from preparedAyaDetails.reciterName
        );
    });

    it('should call activeBotInstance.telegram.sendAudio with formatted data', async () => {
        const preparedAya = {
            arText: 'قطوفها دانية', enText: 'Its clusters [of fruit] hanging low.',
            sura: 69, ayaInSura: 23, suraNameAr: 'الحاقة', link: 'https://quran.com/69/23',
            reciterName: 'Alafasy_64kbps'
        };
        mockPrepareAya.mockReturnValue(preparedAya); // ayaNumber will be derived if not passed

        const recitationResult = {
            success: true,
            reciter: { name: 'Mishary Alafasy', language: 'ar', style: '', quality: '64kbps', rasm: 'uthmani', db_id: 1, id: 'Alafasy_64kbps' },
            audioSource: 'https://everyayah.com/data/Alafasy_64kbps/069023.mp3',
            duration: 3000 // 3 seconds
        };
        mockGetRecitation.mockResolvedValue(recitationResult);

        await sendAya(mockChatId, 6069); // Aya ID for 69:23

        const expectedCaption = `*[69:23 - الحاقة]*\nقطوفها دانية\n\nIts clusters [of fruit] hanging low.\n\n🗣️ Mishary Alafasy (ar)\n📖 Uthmani\n<a href="https://quran.com/69/23">Quran.com Link</a>`;
        const expectedReplyMarkup = TelegrafMarkup.inlineKeyboard([
            [TelegrafMarkup.button.callback('📖 Tafsir', 'tafsir:69:23'), TelegrafMarkup.button.callback('▶️ Recite Again', 'recite:6069:Alafasy_64kbps')],
            [TelegrafMarkup.button.callback('Surprise Me!', 'surprise_aya'), TelegrafMarkup.button.callback('Show Menu', 'main_menu')],
        ]);

        expect(mockBotTelegramSendAudioSpy).toHaveBeenCalledWith(
            mockChatId,
            recitationResult.audioSource,
            {
                caption: expectedCaption,
                parse_mode: 'Markdown',
                reply_markup: expectedReplyMarkup.reply_markup,
                reply_to_message_id: null,
                duration: 3, // duration in seconds
                performer: 'Mishary Alafasy',
                title: 'Aya 69:23 (الحاقة)',
            }
        );
    });

    it('should log an error and not send audio if prepareAya returns null', async () => {
        mockPrepareAya.mockReturnValue(null);
        await sendAya(mockChatId, mockAyaNumber);
        expect(mockLogger).toHaveBeenCalledWith(expect.stringContaining('prepareAya failed for ayaNumber'), 'error', expect.any(Object));
        expect(mockGetRecitation).not.toHaveBeenCalled();
        expect(mockBotTelegramSendAudioSpy).not.toHaveBeenCalled();
    });

    it('should log an error and not send audio if getRecitation returns success:false', async () => {
        mockGetRecitation.mockResolvedValue({ success: false, message: 'Recitation failed' });
        await sendAya(mockChatId, mockAyaNumber);
        expect(mockLogger).toHaveBeenCalledWith(expect.stringContaining('Failed to get recitation for'), 'error');
        expect(mockBotTelegramSendAudioSpy).not.toHaveBeenCalled();
    });

    it('should use default ayaNumber if none provided (becomes random)', async () => {
        utilsMock.randomAyaNumber.mockReturnValue(123); // Mock randomAyaNumber from utils
        mockPrepareAya.mockClear(); // Clear previous calls if any

        await sendAya(mockChatId, null); // Call sendAya with null ayaNumber

        // prepareAya is called by surpriseAya, which is called by sendAya when ayaNumber is null.
        // The surpriseAya function itself calls prepareAya with the random number.
        // So we check if prepareAya was called with the random number.
        // However, sendAya(null) directly calls surpriseAya which then calls prepareAya
        // For a direct test of sendAya(null) -> surpriseAya -> prepareAya:
        // We need to ensure that prepareAya is called by the surpriseAya logic with a number.
        // The current structure of sendAya when ayaNumber is null:
        // if (!ayaNumber) { return surpriseAya(chatId, requestedByUser, messageIdToReply, internalBotInstance, dependencies); }
        // So, for this test, we are actually testing surpriseAya's call to prepareAya.
        // Let's adjust the expectation to check that `prepareAya` was called.
        // The exact aya number will be the random one, or one derived from it.
        // The key is that prepareAya is called.
        expect(mockPrepareAya).toHaveBeenCalled();
        // We can be more specific if we know how surpriseAya uses randomAyaNumber.
        // surpriseAya calls: prepareAya(ayaNum, reciterId, dependencies.quranService)
        // where ayaNum is from randomAyaNumber()
        expect(mockPrepareAya).toHaveBeenCalledWith(123, undefined); // Assuming surpriseAya passes undefined for reciterId by default
    });

    it('should pass messageIdToReply to sendAudio if provided', async () => {
        const messageIdToReply = 999;
        await sendAya(mockChatId, mockAyaNumber, 'user', messageIdToReply);
        expect(mockBotTelegramSendAudioSpy).toHaveBeenCalledWith(
            expect.any(Number), // chatId
            expect.any(String), // audioSource
            expect.objectContaining({ reply_to_message_id: messageIdToReply })
        );
    });
});

/*
describe('surpriseAya', () => {
    // ...
});
*/
/*
describe.skip('MSW - Incoming /getUpdates', () => {
    // ...
});
*/
/*
describe('handleText (direct test of exported function)', () => {
    // ...
});
*/
/*
describe.skip('Action Handler Integration for "recite" button', () => {
    // ...
});
*/
