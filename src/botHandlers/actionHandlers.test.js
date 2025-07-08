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
const mockAyaId2suraAyaFn = jest.fn(); // Define at this scope
const mockNextAyaFn = jest.fn(); // Define at this scope

jest.unstable_mockModule('../quranService.js', () => ({
    __esModule: true,
    getQuranData: mockGetQuranDataFn,
    ayaId2suraAya: mockAyaId2suraAyaFn, // Ensure these are part of the mock if any SUT part tries to import them
    nextAya: mockNextAyaFn, // from the module directly (though handlers receive them as params)
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
    mockAyaId2suraAyaFn.mockClear().mockReturnValue({ sura: 1, aya: 1 }); // Add reset and default mock
    mockNextAyaFn.mockClear().mockImplementation((id) => id + 1); // Add reset and default mock
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

    describe('handleReciteAction', () => {
        let mockCtx;
        let dependencies;
        let mockSendAyaRecitationFn;
        // mockAyaId2suraAyaFn is available from the outer scope

        beforeEach(() => {
            mockCtx = {
                from: { id: 'userRecite' },
                chat: { id: 'chatRecite', type: 'private' },
                update: { callback_query: { data: JSON.stringify({ recite: 300, r: 'reciterZ' }) } },
                answerCbQuery: jest.fn().mockResolvedValue(true),
            };
            mockSendAyaRecitationFn = jest.fn().mockResolvedValue(undefined);

            const localMockAyaId2suraAyaFnForRecite = jest.fn().mockReturnValue({ sura: 1, aya: 1 });
            dependencies = {
                botTelegram: mockBotTelegramDependency,
                botOptions: { username: 'TestBotForRecite' },
                helperAdminConditionalAction: jest.fn(async (ctx, botTelegram, adminFn, nonAdminCb) => {
                    // Simplified mock for helperAdminConditionalAction
                    const isAdmin = await mockAdminChecker(ctx, botTelegram);
                    if (isAdmin) await adminFn(ctx);
                    else await nonAdminCb(ctx).then((url) => ctx.answerCbQuery('', { url }));
                }),
                sendAyaRecitationFn: mockSendAyaRecitationFn,
                ayaId2suraAyaFn: localMockAyaId2suraAyaFnForRecite, // Use local mock
            };
            mockAdminChecker.mockClear();
            mockCtx.answerCbQuery.mockClear();
            mockSendAyaRecitationFn.mockClear();
            mockAyaId2suraAyaFn.mockClear(); // Clear if its calls are specifically asserted per test
        });

        it('should call sendAyaRecitationFn for admin user', async () => {
            mockAdminChecker.mockResolvedValue(true);
            await handleReciteAction(mockCtx, dependencies);

            expect(dependencies.helperAdminConditionalAction).toHaveBeenCalled();
            expect(mockSendAyaRecitationFn).toHaveBeenCalledWith(mockCtx, 300, 'reciterZ');
        });

        it('should call answerCbQuery with URL for non-admin user', async () => {
            mockCtx.chat.type = 'group';
            mockAdminChecker.mockResolvedValue(false);
            // Ensure the local mock passed to the handler is the one being configured
            dependencies.ayaId2suraAyaFn.mockReturnValue({ sura: 7, aya: 77 });

            await handleReciteAction(mockCtx, dependencies);

            expect(dependencies.helperAdminConditionalAction).toHaveBeenCalled();
            // Assert on the mock that was actually passed to the SUT
            expect(dependencies.ayaId2suraAyaFn).toHaveBeenCalledWith(300);
            expect(mockCtx.answerCbQuery).toHaveBeenCalledWith('', { url: 't.me/TestBotForRecite?start=r7-77' });
            expect(mockSendAyaRecitationFn).not.toHaveBeenCalled();
        });

        it('should throw error if callback_data is invalid JSON, before calling helper', async () => {
            mockCtx.update.callback_query.data = 'invalid-json-for-recite';
            try {
                await handleReciteAction(mockCtx, dependencies);
            } catch (e) {
                expect(e).toBeInstanceOf(SyntaxError);
            }
            expect(dependencies.helperAdminConditionalAction).not.toHaveBeenCalled();
        });
    });

    describe('handleAMenuAction', () => {
        let mockCtx;
        let dependencies;
        let mockHelperAMenuButtonsFnDependency; // Specific for this handler

        beforeEach(() => {
            mockCtx = {
                from: { id: 'userAMenu' },
                chat: { id: 'chatAMenu', type: 'private' },
                update: { callback_query: { data: JSON.stringify({ aMenu: 't0', a: 200, r: 'recY' }) } },
                answerCbQuery: jest.fn().mockResolvedValue(true),
                editMessageReplyMarkup: jest.fn().mockResolvedValue(true),
            };
            mockHelperAMenuButtonsFnDependency = jest
                .fn()
                .mockReturnValue({ inline_keyboard: [[{ text: 'NewMenu' }]] });

            const localMockAyaId2suraAyaFnForAMenu = jest.fn().mockReturnValue({ sura: 1, aya: 1 });
            dependencies = {
                botTelegram: mockBotTelegramDependency,
                botOptions: { username: 'TestBotForAMenu' },
                helperAdminProtectedAction: mockHelperAdminProtectedAction, // Using the more robust one
                helperAMenuButtonsFn: mockHelperAMenuButtonsFnDependency,
                ayaId2suraAyaFn: localMockAyaId2suraAyaFnForAMenu, // Use local mock
            };
            mockAdminChecker.mockClear();
            mockCtx.answerCbQuery.mockClear();
            mockCtx.editMessageReplyMarkup.mockClear();
            mockHelperAMenuButtonsFnDependency.mockClear();
        });

        it('should toggle menu from t0 to t1 and edit markup for admin', async () => {
            mockAdminChecker.mockResolvedValue(true);
            await handleAMenuAction(mockCtx, dependencies);

            expect(mockHelperAdminProtectedAction).toHaveBeenCalled();
            expect(mockHelperAMenuButtonsFnDependency).toHaveBeenCalledWith(
                't1',
                200,
                'recY',
                'TestBotForAMenu',
                dependencies.ayaId2suraAyaFn // Use the scoped mock
            );
            expect(mockCtx.editMessageReplyMarkup).toHaveBeenCalledWith({ inline_keyboard: [[{ text: 'NewMenu' }]] });
            expect(mockCtx.answerCbQuery).toHaveBeenCalled();
        });

        it('should toggle menu from r1 to r0 and edit markup for admin', async () => {
            mockAdminChecker.mockResolvedValue(true);
            mockCtx.update.callback_query.data = JSON.stringify({ aMenu: 'r1', a: 201, r: 'recZ' });
            await handleAMenuAction(mockCtx, dependencies);

            expect(mockHelperAMenuButtonsFnDependency).toHaveBeenCalledWith(
                'r0',
                201,
                'recZ',
                'TestBotForAMenu',
                dependencies.ayaId2suraAyaFn // Use the scoped mock
            );
            expect(mockCtx.editMessageReplyMarkup).toHaveBeenCalled();
        });

        it('should alert and not proceed if user is not admin', async () => {
            mockCtx.chat.type = 'group';
            mockAdminChecker.mockResolvedValue(false);
            await handleAMenuAction(mockCtx, dependencies);

            expect(mockHelperAdminProtectedAction).toHaveBeenCalled();
            expect(mockHelperAMenuButtonsFnDependency).not.toHaveBeenCalled();
            expect(mockCtx.editMessageReplyMarkup).not.toHaveBeenCalled();
            expect(mockCtx.answerCbQuery).toHaveBeenCalledWith('NON_ADMINS_ALERT_MOCK', { show_alert: true });
        });

        it('should log warning if editMessageReplyMarkup fails', async () => {
            mockAdminChecker.mockResolvedValue(true);
            mockCtx.editMessageReplyMarkup.mockRejectedValueOnce(new Error('Edit Failed'));
            await handleAMenuAction(mockCtx, dependencies);

            expect(mockLoggerLog).toHaveBeenCalledWith(
                'Warning: Error toggling aMenu (MESSAGE_ID_INVALID or other non-critical): ',
                expect.any(Error)
            );
            // answerCbQuery is still called by helperAdminProtectedAction
            expect(mockCtx.answerCbQuery).toHaveBeenCalled();
        });

        it('should throw error if callback_data is invalid JSON, before calling helper', async () => {
            mockCtx.update.callback_query.data = 'invalid-json';
            // JSON.parse is inside the actionFn passed to helperAdminProtectedAction.
            // The mock for helperAdminProtectedAction should catch the error and call answerCbQuery.
            mockAdminChecker.mockResolvedValue(true); // Ensure admin path for helper
            await handleAMenuAction(mockCtx, dependencies);

            expect(mockHelperAdminProtectedAction).toHaveBeenCalled();
            // Verify that the helper's catch block (or the main function's if error propagates) called answerCbQuery
            // Our mock for helperAdminProtectedAction calls answerCbQuery with 'An error occurred in action.'
            expect(mockCtx.answerCbQuery).toHaveBeenCalledWith('An error occurred in action.', { show_alert: true });
        });
    });

    describe('handleCurrAyaAction', () => {
        let mockCtx;
        let dependencies;
        let mockSendAyaFn;
        // mockNextAyaFn and mockAyaId2suraAyaFn are now from outer scope

        beforeEach(() => {
            mockCtx = {
                from: { id: 'userCurrAya', language_code: 'id' },
                chat: { id: 'chatCurrAya', type: 'private' },
                update: { callback_query: { data: JSON.stringify({ currAya: 100, r: 'reciterX' }) } },
                answerCbQuery: jest.fn().mockResolvedValue(true),
            };
            mockSendAyaFn = jest.fn().mockResolvedValue(undefined);
            // mockNextAyaFn and mockAyaId2suraAyaFn are reset in the main beforeEach

            dependencies = {
                botTelegram: mockBotTelegramDependency,
                botOptions: { username: 'TestBotForUrl' },
                helperAdminConditionalAction: jest.fn(async (ctx, botTelegram, adminFn, nonAdminCb) => {
                    // Simplified mock for helperAdminConditionalAction
                    const isAdmin = await mockAdminChecker(ctx, botTelegram);
                    if (isAdmin) await adminFn(ctx);
                    else await nonAdminCb(ctx).then((url) => ctx.answerCbQuery('', { url }));
                }),
                sendAyaFn: mockSendAyaFn,
                nextAyaFn: mockNextAyaFn, // Use outer scope mock
                ayaId2suraAyaFn: mockAyaId2suraAyaFn, // Use outer scope mock
            };
            mockAdminChecker.mockClear();
            mockCtx.answerCbQuery.mockClear();
        });

        it('should call sendAyaFn with next Aya for admin user', async () => {
            mockAdminChecker.mockResolvedValue(true);
            await handleCurrAyaAction(mockCtx, dependencies);

            expect(dependencies.helperAdminConditionalAction).toHaveBeenCalled();
            expect(mockNextAyaFn).toHaveBeenCalledWith(100);
            expect(mockSendAyaFn).toHaveBeenCalledWith(
                'chatCurrAya',
                101, // nextAyaId
                'reciterX',
                'id',
                'next',
                false
            );
            // answerCbQuery is called by the mock helperAdminConditionalAction's adminFn path indirectly
        });

        it('should call answerCbQuery with URL for non-admin user', async () => {
            mockCtx.chat.type = 'group';
            mockAdminChecker.mockResolvedValue(false);
            dependencies.ayaId2suraAyaFn.mockReturnValue({ sura: 6, aya: 1 }); // For next aya (101)

            await handleCurrAyaAction(mockCtx, dependencies);

            expect(dependencies.helperAdminConditionalAction).toHaveBeenCalled();
            expect(mockNextAyaFn).toHaveBeenCalledWith(100);
            expect(dependencies.ayaId2suraAyaFn).toHaveBeenCalledWith(101); // for the next aya
            expect(mockCtx.answerCbQuery).toHaveBeenCalledWith('', { url: 't.me/TestBotForUrl?start=6-1' });
            expect(mockSendAyaFn).not.toHaveBeenCalled();
        });

        it('should throw error if callback_data is invalid JSON, before calling helper', async () => {
            mockCtx.update.callback_query.data = 'invalid-json';
            // Using a generic try-catch as the error happens before helperAdminConditionalAction
            try {
                await handleCurrAyaAction(mockCtx, dependencies);
            } catch (e) {
                expect(e).toBeInstanceOf(SyntaxError); // JSON.parse error
            }
            expect(dependencies.helperAdminConditionalAction).not.toHaveBeenCalled();
        });
    });

    describe('handleSurpriseAyaAction', () => {
        let mockCtx;
        let dependencies;
        let mockSurpriseAyaFn; // Specific mock for this handler's core function

        beforeEach(() => {
            mockCtx = {
                from: { id: 'userSurprise', first_name: 'SurpriseUser' },
                chat: { id: 'chatSurprise', type: 'private' },
                answerCbQuery: jest.fn().mockResolvedValue(true),
            };
            mockSurpriseAyaFn = jest.fn().mockResolvedValue(undefined);
            dependencies = {
                botTelegram: mockBotTelegramDependency,
                helperAdminProtectedAction: mockHelperAdminProtectedAction,
                surpriseAyaFn: mockSurpriseAyaFn,
            };
            mockAdminChecker.mockClear();
            mockCtx.answerCbQuery.mockClear();
            mockSurpriseAyaFn.mockClear();
        });

        it('should call surpriseAyaFn if user is admin', async () => {
            mockAdminChecker.mockResolvedValue(true);

            await handleSurpriseAyaAction(mockCtx, dependencies);

            expect(mockHelperAdminProtectedAction).toHaveBeenCalled();
            expect(mockAdminChecker).toHaveBeenCalledWith(mockCtx, dependencies.botTelegram);
            expect(dependencies.surpriseAyaFn).toHaveBeenCalledWith(mockCtx); // surpriseAyaFn takes ctx
            expect(mockCtx.answerCbQuery).toHaveBeenCalled();
        });

        it('should alert and not call surpriseAyaFn if user is not admin', async () => {
            mockCtx.chat.type = 'group';
            mockAdminChecker.mockResolvedValue(false);

            await handleSurpriseAyaAction(mockCtx, dependencies);

            expect(mockHelperAdminProtectedAction).toHaveBeenCalled();
            expect(mockAdminChecker).toHaveBeenCalledWith(mockCtx, dependencies.botTelegram);
            expect(dependencies.surpriseAyaFn).not.toHaveBeenCalled();
            expect(mockCtx.answerCbQuery).toHaveBeenCalledWith('NON_ADMINS_ALERT_MOCK', { show_alert: true });
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

    describe('handleInstructionsAction', () => {
        let mockCtx;
        let dependencies;

        beforeEach(() => {
            mockCtx = {
                from: { id: 'userInst', first_name: 'InstructionUser' },
                chat: { id: 'chatInst', type: 'private' }, // Default to private (admin)
                answerCbQuery: jest.fn().mockResolvedValue(true),
            };
            dependencies = {
                botTelegram: mockBotTelegramDependency, // Defined in outer scope's beforeEach
                helperAdminProtectedAction: mockHelperAdminProtectedAction, // From outer scope
                instructionsFn: mockHelperInstructions, // From outer scope
            };
            mockHelperInstructions.mockClear();
            mockAdminChecker.mockClear(); // Ensure adminChecker is clean for each test
            mockCtx.answerCbQuery.mockClear();
        });

        it('should call instructionsFn if user is admin', async () => {
            mockAdminChecker.mockResolvedValue(true); // Simulate admin user

            await handleInstructionsAction(mockCtx, dependencies);

            expect(mockHelperAdminProtectedAction).toHaveBeenCalled();
            expect(mockAdminChecker).toHaveBeenCalledWith(mockCtx, dependencies.botTelegram);
            expect(dependencies.instructionsFn).toHaveBeenCalledWith(mockCtx.chat.id);
            // Check if answerCbQuery was called (likely without specific text, meaning default success)
            expect(mockCtx.answerCbQuery).toHaveBeenCalled();
        });

        it('should alert and not call instructionsFn if user is not admin', async () => {
            mockCtx.chat.type = 'group'; // Change to group to make admin check relevant
            mockAdminChecker.mockResolvedValue(false); // Simulate non-admin user

            await handleInstructionsAction(mockCtx, dependencies);

            expect(mockHelperAdminProtectedAction).toHaveBeenCalled();
            expect(mockAdminChecker).toHaveBeenCalledWith(mockCtx, dependencies.botTelegram);
            expect(dependencies.instructionsFn).not.toHaveBeenCalled();
            expect(mockCtx.answerCbQuery).toHaveBeenCalledWith('NON_ADMINS_ALERT_MOCK', { show_alert: true });
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
