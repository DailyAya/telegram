import { jest } from '@jest/globals';

// --- Manage config.js mock manually (for dependencies like logger) ---
let currentConfigMock = {
    __esModule: true,
    default: {
        telegramToken: 'ACTION_TEST_INITIAL_TOKEN',
        devChatId: 'ACTION_TEST_INITIAL_DEV_CHAT_ID',
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
        port: 3006,
        timerCheckMinutes: 60,
        timerSendHours: 24,
        pingTargetGeneral: 'http://test.example.com',
        pingTargetAlternative: 'http://test.example.org',
        pingTargetTelegramApiBase: 'http://test.api.telegram.org',
        botLaunchRetryDelay: 1000,
        maxBotLaunchRetries: 1,
    },
};
jest.unstable_mockModule('../config.js', () => {
    console.log(
        `****** ACTION_HANDLERS_TEST: unstable_mockModule for ../config.js using currentConfigMock (branch: ${currentConfigMock.default.branch}) ******`
    );
    return currentConfigMock;
});

// Mock ../logger.js
const mockLoggerLog = jest.fn();
jest.unstable_mockModule('../logger.js', () => ({
    __esModule: true,
    logger: mockLoggerLog,
}));

// --- Mock ../botHelpers.js ---
const mockAdminChecker = jest.fn();
const mockHelperAdminProtectedAction = jest.fn(async (ctx, botTelegram, actionFn, alertIfNotAdmin = true) => {
    const isAdmin = await mockAdminChecker(ctx, botTelegram);
    if (isAdmin) {
        try {
            await actionFn(ctx);
            if (
                ctx.answerCbQuery &&
                !ctx.answerCbQuery.mock.calls.some((call) => call[0] !== undefined && call[0] !== '')
            ) {
                await ctx.answerCbQuery().catch(() => {});
            }
        } catch {
            // Removed unused _e
            // Prefix with _ to indicate unused
            if (ctx.answerCbQuery) {
                await ctx.answerCbQuery('An error occurred in action.', { show_alert: true }).catch(() => {});
            }
        }
    } else {
        if (ctx.answerCbQuery) {
            await ctx.answerCbQuery('NON_ADMINS_ALERT_MOCK', { show_alert: alertIfNotAdmin }).catch(() => {});
        }
    }
});
const mockHelperInstructions = jest.fn();

jest.unstable_mockModule('../botHelpers.js', () => ({
    __esModule: true,
    helperAdminProtectedAction: mockHelperAdminProtectedAction,
    adminChecker: mockAdminChecker,
    NON_ADMINS_ALERT: 'NON_ADMINS_ALERT_MOCK',
    instructions: mockHelperInstructions,
}));

// --- Mock ../database.js ---
const mockDbSetFavReciter = jest.fn();
jest.unstable_mockModule('../database.js', () => ({
    __esModule: true,
    setFavReciter: mockDbSetFavReciter,
}));

// --- Mock ../quranService.js ---
const mockGetQuranDataFn = jest.fn();
jest.unstable_mockModule('../quranService.js', () => ({
    __esModule: true,
    getQuranData: mockGetQuranDataFn,
}));

// --- Mock telegraf ---
const mockTelegrafMarkupButtonCb = jest.fn((text, data) => ({ text, callback_data: data }));
const mockTelegrafMarkupInlineKeyboard = jest.fn((buttons) => ({ inline_keyboard: buttons }));
jest.unstable_mockModule('telegraf', () => ({
    __esModule: true,
    Markup: {
        inlineKeyboard: mockTelegrafMarkupInlineKeyboard,
        button: {
            callback: mockTelegrafMarkupButtonCb,
        },
    },
}));

// --- Declare module-scoped variables for actionHandlers.js exports ---
let initializeActionHandlers,
    handleGroupKhatmaAction,
    handleRecitersNavPageAction,
    handleInstructionsAction,
    handleSurpriseAyaAction,
    handleCurrAyaAction,
    handleAMenuAction,
    handleReciteAction,
    handleSetReciterAction;

// --- Mocks for functions passed as dependencies to handlers ---
let mockKhatmaUpdateFn;
let mockRecitersNavPageFnDependency;
let mockBotTelegramDependency;

beforeAll(async () => {
    jest.resetModules();
    const globalMockDefault = (await import('../__mocks__/config.mock.js')).default;
    currentConfigMock = { __esModule: true, default: globalMockDefault };
    console.log('****** ACTION_HANDLERS_TEST: Set currentConfigMock to GLOBAL MOCK values ******');

    const actionHandlersModule = await import('./actionHandlers.js');
    initializeActionHandlers = actionHandlersModule.initializeActionHandlers;
    handleGroupKhatmaAction = actionHandlersModule.handleGroupKhatmaAction;
    handleRecitersNavPageAction = actionHandlersModule.handleRecitersNavPageAction;
    handleInstructionsAction = actionHandlersModule.handleInstructionsAction;
    handleSurpriseAyaAction = actionHandlersModule.handleSurpriseAyaAction;
    handleCurrAyaAction = actionHandlersModule.handleCurrAyaAction;
    handleAMenuAction = actionHandlersModule.handleAMenuAction;
    handleReciteAction = actionHandlersModule.handleReciteAction;
    handleSetReciterAction = actionHandlersModule.handleSetReciterAction;
});

beforeEach(() => {
    mockLoggerLog.mockClear();
    mockKhatmaUpdateFn = jest.fn();

    mockAdminChecker.mockReset();
    mockHelperAdminProtectedAction.mockClear();
    mockHelperInstructions.mockClear();

    mockRecitersNavPageFnDependency = jest
        .fn()
        .mockReturnValue([[{ text: 'Default Page Reciter', callback_data: 'r_default' }]]);
    mockBotTelegramDependency = { getChatMember: jest.fn() };

    mockDbSetFavReciter.mockClear();
    mockGetQuranDataFn.mockClear();
    mockTelegrafMarkupButtonCb.mockClear();
    mockTelegrafMarkupInlineKeyboard.mockClear();

    mockGetQuranDataFn.mockReturnValue({
        arReciters: [{ identifier: 'ar.alafasy', name: 'العفاسي', englishName: 'Al Afasy' }],
    });
    mockDbSetFavReciter.mockResolvedValue({ success: true, reciter: 'ar.alafasy' });
});

describe('Bot Action Handlers', () => {
    describe('handleGroupKhatmaAction', () => {
        let mockCtx;
        beforeEach(() => {
            mockCtx = {
                from: { id: 'user123', first_name: 'TestUser' },
                update: {
                    callback_query: {
                        data: JSON.stringify({ groupkhatma: 5 }),
                        message: {
                            text: 'Khatma\n\nUserOld ➔ 2 💪',
                            entities: [],
                            reply_markup: { inline_keyboard: [[{ text: 'btn' }]] },
                            message_id: 100,
                        },
                    },
                },
                answerCbQuery: jest.fn().mockResolvedValue(true),
                editMessageText: jest.fn().mockResolvedValue(true),
                replyWithHTML: jest.fn().mockResolvedValue(true),
            };
            mockKhatmaUpdateFn.mockReturnValue('New Khatma Text');
        });

        it('should successfully update khatma and reply', async () => {
            await handleGroupKhatmaAction(mockCtx, { khatmaUpdateFn: mockKhatmaUpdateFn });
            expect(mockKhatmaUpdateFn).toHaveBeenCalledWith({
                userId: 'user123',
                firstName: 'TestUser',
                currentText: 'Khatma\n\nUserOld ➔ 2 💪',
                currentEntities: [],
                juz: 5,
            });
            expect(mockCtx.editMessageText).toHaveBeenCalledWith('New Khatma Text', {
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard: [[{ text: 'btn' }]] },
            });
            expect(mockCtx.replyWithHTML).toHaveBeenCalledWith('<a href="tg://user?id=user123">TestUser</a> ➔ 5 💪', {
                disable_notification: true,
                reply_to_message_id: 100,
            });
            expect(mockCtx.answerCbQuery).toHaveBeenCalledWith(expect.stringContaining('Updated!'), {
                show_alert: true,
            });
        });
        it('should handle invalid Juz number', async () => {
            mockCtx.update.callback_query.data = JSON.stringify({ groupkhatma: 31 });
            await handleGroupKhatmaAction(mockCtx, { khatmaUpdateFn: mockKhatmaUpdateFn });
            expect(mockCtx.answerCbQuery).toHaveBeenCalledWith('Error: Invalid Juz number.');
            expect(mockKhatmaUpdateFn).not.toHaveBeenCalled();
        });
        it('should handle parsing error for callback_data', async () => {
            mockCtx.update.callback_query.data = 'invalid-json';
            await handleGroupKhatmaAction(mockCtx, { khatmaUpdateFn: mockKhatmaUpdateFn });
            expect(mockCtx.answerCbQuery).toHaveBeenCalledWith('Error processing your request.');
            expect(mockKhatmaUpdateFn).not.toHaveBeenCalled();
        });
        it('should handle no change in Khatma selection', async () => {
            mockKhatmaUpdateFn.mockReturnValue(false);
            await handleGroupKhatmaAction(mockCtx, { khatmaUpdateFn: mockKhatmaUpdateFn });
            expect(mockCtx.answerCbQuery).toHaveBeenCalledWith(
                expect.stringContaining('already your current selection'),
                { show_alert: true }
            );
            expect(mockCtx.editMessageText).not.toHaveBeenCalled();
        });
        it('should use default first_name if ctx.from.first_name is null', async () => {
            mockCtx.from.first_name = null;
            await handleGroupKhatmaAction(mockCtx, { khatmaUpdateFn: mockKhatmaUpdateFn });
            expect(mockKhatmaUpdateFn).toHaveBeenCalledWith(expect.objectContaining({ firstName: 'Useruser123' }));
            expect(mockCtx.replyWithHTML).toHaveBeenCalledWith(
                '<a href="tg://user?id=user123">Useruser123</a> ➔ 5 💪',
                expect.any(Object)
            );
        });
        it('should handle error during ctx.editMessageText or ctx.replyWithHTML', async () => {
            mockCtx.editMessageText.mockRejectedValueOnce(new Error('Edit failed'));
            await handleGroupKhatmaAction(mockCtx, { khatmaUpdateFn: mockKhatmaUpdateFn });
            expect(mockCtx.answerCbQuery).toHaveBeenCalledWith(expect.stringContaining('Summary might be full'), {
                show_alert: true,
            });
        });
    });

    describe('handleRecitersNavPageAction', () => {
        let mockCtx;
        beforeEach(() => {
            mockCtx = {
                from: { id: 'adminUser', first_name: 'Admin' },
                chat: { id: 'chat123', type: 'group' },
                update: {
                    callback_query: {
                        data: JSON.stringify({ recitersNavPage: 2 }),
                        message: { reply_markup: { inline_keyboard: [] } },
                    },
                },
                answerCbQuery: jest.fn().mockResolvedValue(true),
                editMessageReplyMarkup: jest.fn().mockResolvedValue(true),
            };
            mockAdminChecker.mockResolvedValue(true);
            mockRecitersNavPageFnDependency.mockReturnValue([[{ text: 'Page 2 Reciter', callback_data: 'r2' }]]);
        });

        it('should navigate to the requested page for an admin', async () => {
            await handleRecitersNavPageAction(mockCtx, {
                botTelegram: mockBotTelegramDependency,
                recitersNavPageFn: mockRecitersNavPageFnDependency,
                helperAdminProtectedAction: mockHelperAdminProtectedAction,
            });
            expect(mockHelperAdminProtectedAction).toHaveBeenCalled();
            expect(mockAdminChecker).toHaveBeenCalledWith(mockCtx, mockBotTelegramDependency);
            expect(mockRecitersNavPageFnDependency).toHaveBeenCalledWith(2);
            expect(mockCtx.editMessageReplyMarkup).toHaveBeenCalledWith({
                inline_keyboard: [[{ text: 'Page 2 Reciter', callback_data: 'r2' }]],
            });
            expect(
                mockCtx.answerCbQuery.mock.calls.some(
                    (call) => call.length === 0 || call[0] === undefined || call[0] === ''
                )
            ).toBe(true);
        });
        it('should not proceed if user is not admin', async () => {
            mockAdminChecker.mockResolvedValue(false);
            await handleRecitersNavPageAction(mockCtx, {
                botTelegram: mockBotTelegramDependency,
                recitersNavPageFn: mockRecitersNavPageFnDependency,
                helperAdminProtectedAction: mockHelperAdminProtectedAction,
            });
            expect(mockHelperAdminProtectedAction).toHaveBeenCalled();
            expect(mockAdminChecker).toHaveBeenCalledWith(mockCtx, mockBotTelegramDependency);
            expect(mockRecitersNavPageFnDependency).not.toHaveBeenCalled();
            expect(mockCtx.editMessageReplyMarkup).not.toHaveBeenCalled();
            expect(mockCtx.answerCbQuery).toHaveBeenCalledWith('NON_ADMINS_ALERT_MOCK', { show_alert: true });
        });
        it('should handle JSON parse error for callback_data', async () => {
            mockCtx.update.callback_query.data = 'invalid-json';
            await handleRecitersNavPageAction(mockCtx, {
                botTelegram: mockBotTelegramDependency,
                recitersNavPageFn: mockRecitersNavPageFnDependency,
                helperAdminProtectedAction: mockHelperAdminProtectedAction,
            });
            expect(mockLoggerLog).toHaveBeenCalledWith(
                'recitersNavPage (action): Failed to parse callback_data',
                expect.any(Error)
            );
            expect(mockCtx.answerCbQuery).toHaveBeenCalledWith('Error processing request.');
            expect(mockRecitersNavPageFnDependency).not.toHaveBeenCalled();
        });
        it('should handle invalid page number type in callback_data', async () => {
            mockCtx.update.callback_query.data = JSON.stringify({ recitersNavPage: 'not-a-number' });
            await handleRecitersNavPageAction(mockCtx, {
                botTelegram: mockBotTelegramDependency,
                recitersNavPageFn: mockRecitersNavPageFnDependency,
                helperAdminProtectedAction: mockHelperAdminProtectedAction,
            });
            expect(mockLoggerLog).toHaveBeenCalledWith(
                'recitersNavPage (action): requestedRecitersNavPage is not a number.',
                expect.any(Error)
            );
            expect(mockCtx.answerCbQuery).toHaveBeenCalledWith('Error: Invalid page number.');
            expect(mockRecitersNavPageFnDependency).not.toHaveBeenCalled();
        });
        it('should handle error during editMessageReplyMarkup', async () => {
            mockCtx.editMessageReplyMarkup.mockRejectedValueOnce(new Error('Edit failed'));
            await handleRecitersNavPageAction(mockCtx, {
                botTelegram: mockBotTelegramDependency,
                recitersNavPageFn: mockRecitersNavPageFnDependency,
                helperAdminProtectedAction: mockHelperAdminProtectedAction,
            });
            expect(mockLoggerLog).toHaveBeenCalledWith(
                'recitersNavPage (action): Error editing message reply markup',
                expect.any(Error)
            );
            expect(mockCtx.answerCbQuery).toHaveBeenCalledWith('Error updating list.');
        });
    });

    describe('handleSetReciterAction', () => {
        let mockCtx;
        let TelegrafMarkup;

        beforeEach(async () => {
            TelegrafMarkup = (await import('telegraf')).Markup;
            mockCtx = {
                from: { id: 'adminUser', first_name: 'Admin' },
                chat: { id: 'chat123', type: 'group' },
                update: {
                    callback_query: { data: JSON.stringify({ setReciter: 'ar.alafasy', a: 123 }) },
                },
                answerCbQuery: jest.fn().mockResolvedValue(true),
                reply: jest.fn().mockResolvedValue(true),
            };
            mockAdminChecker.mockResolvedValue(true);
        });

        it('should set favorite reciter and reply with confirmation for an admin', async () => {
            await handleSetReciterAction(mockCtx, {
                botTelegram: mockBotTelegramDependency,
                helperAdminProtectedAction: mockHelperAdminProtectedAction,
                dbSetFavReciter: mockDbSetFavReciter,
                getQuranDataFn: mockGetQuranDataFn,
                TelegrafMarkup,
            });
            expect(mockHelperAdminProtectedAction).toHaveBeenCalled();
            expect(mockAdminChecker).toHaveBeenCalledWith(mockCtx, mockBotTelegramDependency);
            expect(mockDbSetFavReciter).toHaveBeenCalledWith('chat123', 'ar.alafasy');
            expect(mockCtx.reply).toHaveBeenCalledWith(
                'القارئ المفضل الحالي: العفاسي\n\nCurrent Favorit Reciter: Al Afasy',
                expect.objectContaining({
                    inline_keyboard: [
                        [{ text: '🎁', callback_data: JSON.stringify({ surpriseAyaAction: true, a: 123 }) }],
                    ],
                })
            );
            expect(mockTelegrafMarkupButtonCb).toHaveBeenCalledWith(
                '🎁',
                JSON.stringify({ surpriseAyaAction: true, a: 123 })
            );
            expect(mockTelegrafMarkupInlineKeyboard).toHaveBeenCalledWith(expect.any(Array));
        });

        it('should set favorite reciter to "surprise" and reply accordingly', async () => {
            mockCtx.update.callback_query.data = JSON.stringify({ setReciter: 'surprise' });
            mockDbSetFavReciter.mockResolvedValueOnce({ success: true, reciter: 'surprise' });
            await handleSetReciterAction(mockCtx, {
                botTelegram: mockBotTelegramDependency,
                helperAdminProtectedAction: mockHelperAdminProtectedAction,
                dbSetFavReciter: mockDbSetFavReciter,
                getQuranDataFn: mockGetQuranDataFn,
                TelegrafMarkup,
            });
            expect(mockDbSetFavReciter).toHaveBeenCalledWith('chat123', 'surprise');
            expect(mockCtx.reply).toHaveBeenCalledWith(
                'سيتم تغيير القارئ مع كل آية مفاجئة.\n\nReciter will be changed with each surprise Aya.',
                expect.objectContaining({
                    inline_keyboard: [[{ text: '🎁', callback_data: JSON.stringify({ surpriseAyaAction: true }) }]],
                })
            );
        });

        it('should not proceed and alert if user is not admin', async () => {
            mockAdminChecker.mockResolvedValue(false);
            await handleSetReciterAction(mockCtx, {
                botTelegram: mockBotTelegramDependency,
                helperAdminProtectedAction: mockHelperAdminProtectedAction,
                dbSetFavReciter: mockDbSetFavReciter,
                getQuranDataFn: mockGetQuranDataFn,
                TelegrafMarkup,
            });
            expect(mockDbSetFavReciter).not.toHaveBeenCalled();
            expect(mockCtx.reply).not.toHaveBeenCalled();
            expect(mockCtx.answerCbQuery).toHaveBeenCalledWith('NON_ADMINS_ALERT_MOCK', { show_alert: true });
        });

        it('should reply with error message if dbSetFavReciter fails', async () => {
            mockDbSetFavReciter.mockResolvedValueOnce({ success: false, error: new Error('DB fail') });
            await handleSetReciterAction(mockCtx, {
                botTelegram: mockBotTelegramDependency,
                helperAdminProtectedAction: mockHelperAdminProtectedAction,
                dbSetFavReciter: mockDbSetFavReciter,
                getQuranDataFn: mockGetQuranDataFn,
                TelegrafMarkup,
            });
            expect(mockCtx.reply).toHaveBeenCalledWith(
                expect.stringContaining("Sorry.. There's an issue while setting favorite reciters"),
                expect.any(Object)
            );
        });

        it('should correctly use reciter name if reciterData found, otherwise use identifier', async () => {
            mockCtx.update.callback_query.data = JSON.stringify({ setReciter: 'unknown.reciter' });
            mockDbSetFavReciter.mockResolvedValueOnce({ success: true, reciter: 'unknown.reciter' });
            await handleSetReciterAction(mockCtx, {
                botTelegram: mockBotTelegramDependency,
                helperAdminProtectedAction: mockHelperAdminProtectedAction,
                dbSetFavReciter: mockDbSetFavReciter,
                getQuranDataFn: mockGetQuranDataFn,
                TelegrafMarkup,
            });
            expect(mockCtx.reply).toHaveBeenCalledWith('Favorite reciter set to: unknown.reciter', expect.any(Object));
        });
    });

    it('should make all action handler functions available', () => {
        expect(typeof initializeActionHandlers).toBe('function');
        expect(typeof handleGroupKhatmaAction).toBe('function');
        expect(typeof handleRecitersNavPageAction).toBe('function');
        expect(typeof handleInstructionsAction).toBe('function');
        expect(typeof handleSurpriseAyaAction).toBe('function');
        expect(typeof handleCurrAyaAction).toBe('function');
        expect(typeof handleAMenuAction).toBe('function');
        expect(typeof handleReciteAction).toBe('function');
        expect(typeof handleSetReciterAction).toBe('function');
    });
});
