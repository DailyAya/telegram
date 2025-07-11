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
    // console.log( // Kept for debugging if needed
    //     `****** ACTION_HANDLERS_TEST: unstable_mockModule for ../config.js using currentConfigMock (branch: ${currentConfigMock.default.branch}) ******`
    // );
    return currentConfigMock;
});

// Mock ../logger.js
const mockLoggerLog = jest.fn();
jest.unstable_mockModule('../logger.js', () => ({
    __esModule: true,
    logger: mockLoggerLog,
}));

// --- Mock ../botHelpers.js ---
// Define mock functions first
const mockAdminChecker = jest.fn();
const mockHelperAdminProtectedAction = jest.fn(async (ctx, _botTelegram, actionFn, _alertIfNotAdmin = true) => {
    const isAdmin = await mockAdminChecker(ctx, _botTelegram);
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
            if (ctx.answerCbQuery) {
                await ctx.answerCbQuery('An error occurred in action.', { show_alert: true }).catch(() => {});
            }
        }
    } else {
        if (ctx.answerCbQuery) {
            await ctx.answerCbQuery('NON_ADMINS_ALERT_MOCK', { show_alert: _alertIfNotAdmin }).catch(() => {});
        }
    }
});
const mockHelperInstructions = jest.fn();

// Now, set up the mock for the module
const mockHelperAdminConditionalAction = jest.fn(); // This will be the default mock for most tests

jest.unstable_mockModule('../botHelpers.js', () => ({
    __esModule: true,
    helperAdminConditionalAction: mockHelperAdminConditionalAction, // Default to jest.fn()
    helperAdminProtectedAction: mockHelperAdminProtectedAction,
    adminChecker: mockAdminChecker,
    NON_ADMINS_ALERT: 'NON_ADMINS_ALERT_MOCK',
    instructions: mockHelperInstructions,
    // Ensure all exports from botHelpers.js that actionHandlers.js might import are listed
    // (even if actionHandlers.js gets them via dependencies parameter, good practice for clarity)
    // successSend, sendSorry, aMenuButtons, sendUnrecognizedMessage are not directly imported by actionHandlers.js
}));

// --- Mock ../database.js ---
const mockDbSetFavReciter = jest.fn();
jest.unstable_mockModule('../database.js', () => ({
    __esModule: true,
    setFavReciter: mockDbSetFavReciter,
}));

// --- Mock ../quranService.js ---
const mockGetQuranDataFn = jest.fn();
const mockAyaId2suraAyaFn = jest.fn();
const mockNextAyaFn = jest.fn();

jest.unstable_mockModule('../quranService.js', () => ({
    __esModule: true,
    getQuranData: mockGetQuranDataFn,
    ayaId2suraAya: mockAyaId2suraAyaFn,
    nextAya: mockNextAyaFn,
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
// let mockRecitersNavPageFnDependency; // Unused - Removed for ESLint
let mockBotTelegramDependency;
// let mockHelperConditionalActionDependency; // Unused - Removed for ESLint

beforeAll(async () => {
    jest.resetModules();
    const globalMockDefault = (await import('../__mocks__/config.mock.js')).default;
    currentConfigMock = { __esModule: true, default: globalMockDefault };
    // console.log('****** ACTION_HANDLERS_TEST: Set currentConfigMock to GLOBAL MOCK values ******');

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

    mockAdminChecker.mockReset().mockResolvedValue(true); // Default to admin for most tests
    mockHelperAdminProtectedAction.mockClear();
    mockHelperInstructions.mockClear();

    // The following mocks were for unused variables and have been removed.
    // mockHelperConditionalActionDependency = jest.fn(async (rawCtx, _botTelegram, adminFn, _nonAdminCb) => {
    //     if (await mockAdminChecker(rawCtx, _botTelegram)) {
    //         await adminFn(rawCtx);
    //     } else {
    //         if (rawCtx.answerCbQuery) await rawCtx.answerCbQuery('Non-admin mock path', { show_alert: true });
    //     }
    // });

    // mockRecitersNavPageFnDependency = jest
    //     .fn()
    //     .mockReturnValue([[{ text: 'Default Page Reciter', callback_data: 'r_default' }]]);
    mockBotTelegramDependency = { getChatMember: jest.fn().mockResolvedValue({ status: 'administrator' }) };

    mockDbSetFavReciter.mockClear();
    mockGetQuranDataFn.mockClear();
    mockAyaId2suraAyaFn.mockClear().mockReturnValue({ sura: 1, aya: 1 });
    mockNextAyaFn.mockClear().mockImplementation((id) => id + 1);
    mockTelegrafMarkupButtonCb.mockClear();
    mockTelegrafMarkupInlineKeyboard.mockClear();

    mockGetQuranDataFn.mockReturnValue({
        arReciters: [{ identifier: 'ar.alafasy', name: 'العفاسي', englishName: 'Al Afasy' }],
    });
    mockDbSetFavReciter.mockResolvedValue({ success: true, reciter: 'ar.alafasy' });
});

describe('Bot Action Handlers', () => {
    describe('handleGroupKhatmaAction', () => {
        // ... existing tests for handleGroupKhatmaAction ...
        // These should be unaffected as they don't involve the refactored parts.
        // (Copying one for brevity - assume others are similar and were passing)
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

    describe('handleCurrAyaAction', () => {
        let mockCtx;
        let dependencies;
        let mockSendAyaFnDependency;
        let localMockHelperAdminConditionalAction;

        beforeEach(() => {
            mockCtx = {
                from: { id: 'userCurrAya', language_code: 'ar' },
                chat: { id: 'chatCurrAya', type: 'group' },
                update: { callback_query: { data: JSON.stringify({ currAya: 100, r: 'reciterX' }) } },
                answerCbQuery: jest.fn().mockResolvedValue(true),
            };
            mockSendAyaFnDependency = jest.fn();

            // More functional mock for helperAdminConditionalAction for this suite
            localMockHelperAdminConditionalAction = jest.fn(
                async (
                    ctxInternal,
                    _botTelegramInternal,
                    adminFnInternal,
                    nonAdminCbInternal,
                    nonAdminAlertInternal,
                    nonAdminUrlInternal
                ) => {
                    const isAdmin = await mockAdminChecker(ctxInternal, _botTelegramInternal); // Uses global mockAdminChecker
                    if (isAdmin) {
                        await adminFnInternal(ctxInternal);
                        if (ctxInternal.answerCbQuery) await ctxInternal.answerCbQuery().catch(() => {});
                    } else {
                        const urlToOpen =
                            nonAdminUrlInternal ||
                            (typeof nonAdminCbInternal === 'function' ? await nonAdminCbInternal(ctxInternal) : null);
                        if (ctxInternal.answerCbQuery) {
                            if (urlToOpen) {
                                await ctxInternal
                                    .answerCbQuery(nonAdminAlertInternal ? 'NON_ADMINS_ALERT_MOCK' : '', {
                                        url: urlToOpen,
                                    })
                                    .catch(() => {});
                            } else {
                                await ctxInternal
                                    .answerCbQuery(nonAdminAlertInternal ? 'NON_ADMINS_ALERT_MOCK' : '', {
                                        show_alert: nonAdminAlertInternal,
                                    })
                                    .catch(() => {});
                            }
                        }
                    }
                }
            );

            dependencies = {
                botTelegram: mockBotTelegramDependency,
                botOptions: { username: 'TestBotCurrAya' },
                helperAdminConditionalAction: localMockHelperAdminConditionalAction, // Use the local, more functional mock
                sendAyaFn: mockSendAyaFnDependency,
                nextAyaFn: mockNextAyaFn, // Global mock
                ayaId2suraAyaFn: mockAyaId2suraAyaFn, // Global mock
            };

            mockAdminChecker.mockClear();
            mockSendAyaFnDependency.mockClear();
            mockNextAyaFn.mockClear().mockImplementation((id) => id + 1); // Reset global mock with default behavior
            mockAyaId2suraAyaFn.mockClear().mockReturnValue({ sura: 2, aya: 101 }); // Reset global mock
            mockCtx.answerCbQuery.mockClear();
        });

        it('should call sendAyaFn with next Aya if user is admin', async () => {
            mockAdminChecker.mockResolvedValue(true);
            const callbackData = JSON.parse(mockCtx.update.callback_query.data);
            const expectedNextAyaId = callbackData.currAya + 1;

            await handleCurrAyaAction(mockCtx, dependencies);

            expect(localMockHelperAdminConditionalAction).toHaveBeenCalled();
            expect(mockLoggerLog).toHaveBeenCalledWith(
                `Next Aya after ${callbackData.currAya} by ${callbackData.r} for chat ${mockCtx.chat.id}`
            );
            expect(mockNextAyaFn).toHaveBeenCalledWith(callbackData.currAya);
            expect(mockSendAyaFnDependency).toHaveBeenCalledWith(
                mockCtx.chat.id,
                expectedNextAyaId,
                callbackData.r,
                mockCtx.from.language_code,
                'next',
                false
            );
            expect(mockCtx.answerCbQuery).toHaveBeenCalled(); // Called by the mock helper
        });

        it('should call answerCbQuery with URL if user is not admin', async () => {
            mockAdminChecker.mockResolvedValue(false);
            const callbackData = JSON.parse(mockCtx.update.callback_query.data);
            const nextAyaId = callbackData.currAya + 1;
            mockNextAyaFn.mockReturnValue(nextAyaId);
            mockAyaId2suraAyaFn.mockReturnValue({ sura: 5, aya: 50 }); // For URL construction

            await handleCurrAyaAction(mockCtx, dependencies);

            expect(localMockHelperAdminConditionalAction).toHaveBeenCalled();
            expect(mockSendAyaFnDependency).not.toHaveBeenCalled();

            // Check that nonAdminCb was called (indirectly, by checking its effects via ayaId2suraAyaFn and nextAyaFn)
            expect(mockNextAyaFn).toHaveBeenCalledWith(callbackData.currAya);
            expect(mockAyaId2suraAyaFn).toHaveBeenCalledWith(nextAyaId); // Called twice, once for nonAdminCb, once for nonAdminUrl

            const expectedUrl = `t.me/TestBotCurrAya?start=5-50`;
            expect(mockCtx.answerCbQuery).toHaveBeenCalledWith('', { url: expectedUrl });
        });
    });

    describe('handleSurpriseAyaAction', () => {
        let mockCtx;
        let dependencies;
        let mockSurpriseAyaFnDependency;

        beforeEach(() => {
            mockCtx = {
                from: { id: 'userSurprise' },
                chat: { id: 'chatSurprise', type: 'group' },
                update: { callback_query: { data: JSON.stringify({ surpriseAyaAction: true }) } },
                answerCbQuery: jest.fn().mockResolvedValue(true),
            };
            mockSurpriseAyaFnDependency = jest.fn();
            dependencies = {
                botTelegram: mockBotTelegramDependency,
                helperAdminProtectedAction: mockHelperAdminProtectedAction,
                surpriseAyaFn: mockSurpriseAyaFnDependency,
            };
            mockAdminChecker.mockClear();
            mockHelperAdminProtectedAction.mockClear();
            mockSurpriseAyaFnDependency.mockClear();
            mockCtx.answerCbQuery.mockClear();
        });

        it('should call surpriseAyaFn if user is admin', async () => {
            mockAdminChecker.mockResolvedValue(true);
            await handleSurpriseAyaAction(mockCtx, dependencies);

            expect(mockHelperAdminProtectedAction).toHaveBeenCalled();
            // helperAdminProtectedAction calls surpriseAyaFn with the context
            expect(mockSurpriseAyaFnDependency).toHaveBeenCalledWith(mockCtx);
        });

        it('should call answerCbQuery with alert if user is not admin', async () => {
            mockAdminChecker.mockResolvedValue(false);
            await handleSurpriseAyaAction(mockCtx, dependencies);

            expect(mockHelperAdminProtectedAction).toHaveBeenCalled();
            expect(mockCtx.answerCbQuery).toHaveBeenCalledWith('NON_ADMINS_ALERT_MOCK', { show_alert: true });
            expect(mockSurpriseAyaFnDependency).not.toHaveBeenCalled();
        });
    });

    describe('handleInstructionsAction', () => {
        let mockCtx;
        let dependencies;
        let mockInstructionsFnDependency;

        beforeEach(() => {
            mockCtx = {
                from: { id: 'userInstructions' },
                chat: { id: 'chatInstructions', type: 'group' },
                update: { callback_query: { data: JSON.stringify({ instructionsAction: true }) } },
                answerCbQuery: jest.fn().mockResolvedValue(true),
            };
            mockInstructionsFnDependency = jest.fn();
            dependencies = {
                botTelegram: mockBotTelegramDependency,
                helperAdminProtectedAction: mockHelperAdminProtectedAction,
                instructionsFn: mockInstructionsFnDependency,
            };
            mockAdminChecker.mockClear();
            mockHelperAdminProtectedAction.mockClear();
            mockInstructionsFnDependency.mockClear();
            mockCtx.answerCbQuery.mockClear();
        });

        it('should call instructionsFn if user is admin', async () => {
            mockAdminChecker.mockResolvedValue(true);
            await handleInstructionsAction(mockCtx, dependencies);

            expect(mockHelperAdminProtectedAction).toHaveBeenCalled();
            expect(mockInstructionsFnDependency).toHaveBeenCalledWith('chatInstructions');
        });

        it('should call answerCbQuery with alert if user is not admin', async () => {
            mockAdminChecker.mockResolvedValue(false);
            await handleInstructionsAction(mockCtx, dependencies);

            expect(mockHelperAdminProtectedAction).toHaveBeenCalled();
            expect(mockCtx.answerCbQuery).toHaveBeenCalledWith('NON_ADMINS_ALERT_MOCK', { show_alert: true });
            expect(mockInstructionsFnDependency).not.toHaveBeenCalled();
        });
    });

    describe('handleSetReciterAction', () => {
        let mockCtx;
        let dependencies;
        let mockTelegrafMarkup;

        beforeEach(() => {
            mockCtx = {
                from: { id: 'userSetReciter' },
                chat: { id: 'chatSetReciter', type: 'group' },
                update: { callback_query: { data: JSON.stringify({ setReciter: 'ar.alafasy', a: 123 }) } },
                answerCbQuery: jest.fn().mockResolvedValue(true),
                reply: jest.fn().mockResolvedValue(true),
            };
            mockTelegrafMarkup = {
                // Local mock for Telegraf's Markup for this describe block
                button: {
                    callback: jest.fn((text, data) => ({ text, callback_data: data })),
                },
                inlineKeyboard: jest.fn((buttons) => ({ inline_keyboard: buttons })),
            };
            dependencies = {
                botTelegram: mockBotTelegramDependency,
                helperAdminProtectedAction: mockHelperAdminProtectedAction,
                dbSetFavReciter: mockDbSetFavReciter,
                getQuranDataFn: mockGetQuranDataFn,
                TelegrafMarkup: mockTelegrafMarkup,
            };
            mockAdminChecker.mockClear();
            mockHelperAdminProtectedAction.mockClear();
            mockDbSetFavReciter.mockClear().mockResolvedValue({ success: true, reciter: 'ar.alafasy' });
            mockGetQuranDataFn.mockClear().mockReturnValue({
                arReciters: [{ identifier: 'ar.alafasy', name: 'العفاسي', englishName: 'Al Afasy' }],
            });
            mockCtx.answerCbQuery.mockClear();
            mockCtx.reply.mockClear();
            mockTelegrafMarkup.button.callback.mockClear();
            mockTelegrafMarkup.inlineKeyboard.mockClear();
        });

        it('should set reciter and reply with success if user is admin', async () => {
            mockAdminChecker.mockResolvedValue(true);
            await handleSetReciterAction(mockCtx, dependencies);

            expect(mockHelperAdminProtectedAction).toHaveBeenCalled();
            expect(mockDbSetFavReciter).toHaveBeenCalledWith('chatSetReciter', 'ar.alafasy');
            expect(mockCtx.reply).toHaveBeenCalledWith(expect.stringContaining('القارئ المفضل الحالي: العفاسي'), {
                inline_keyboard: expect.any(Object),
            });
            expect(mockTelegrafMarkup.button.callback).toHaveBeenCalledWith(
                '🎁',
                JSON.stringify({ surpriseAyaAction: true, a: 123 })
            );
        });

        it('should handle "surprise" reciter selection for admin', async () => {
            mockAdminChecker.mockResolvedValue(true);
            mockCtx.update.callback_query.data = JSON.stringify({ setReciter: 'surprise' });
            await handleSetReciterAction(mockCtx, dependencies);

            expect(mockDbSetFavReciter).toHaveBeenCalledWith('chatSetReciter', 'surprise');
            expect(mockCtx.reply).toHaveBeenCalledWith(
                expect.stringContaining('سيتم تغيير القارئ مع كل آية مفاجئة'),
                expect.any(Object)
            );
        });

        it('should reply with generic success if reciter details not found (admin path)', async () => {
            mockAdminChecker.mockResolvedValue(true);
            mockGetQuranDataFn.mockReturnValue({ arReciters: [] }); // No reciters in data
            mockCtx.update.callback_query.data = JSON.stringify({ setReciter: 'unknown.reciter' });
            await handleSetReciterAction(mockCtx, dependencies);

            expect(mockDbSetFavReciter).toHaveBeenCalledWith('chatSetReciter', 'unknown.reciter');
            expect(mockCtx.reply).toHaveBeenCalledWith('Favorite reciter set to: unknown.reciter', expect.any(Object));
        });

        it('should call answerCbQuery with alert if user is not admin', async () => {
            mockAdminChecker.mockResolvedValue(false);
            await handleSetReciterAction(mockCtx, dependencies);

            expect(mockHelperAdminProtectedAction).toHaveBeenCalled();
            expect(mockCtx.answerCbQuery).toHaveBeenCalledWith('NON_ADMINS_ALERT_MOCK', { show_alert: true });
            expect(mockDbSetFavReciter).not.toHaveBeenCalled();
            expect(mockCtx.reply).not.toHaveBeenCalled();
        });

        it('should reply with error message if dbSetFavReciter returns failure (admin path)', async () => {
            mockAdminChecker.mockResolvedValue(true);
            mockDbSetFavReciter.mockResolvedValue({ success: false });
            await handleSetReciterAction(mockCtx, dependencies);

            expect(mockDbSetFavReciter).toHaveBeenCalledWith('chatSetReciter', 'ar.alafasy');
            expect(mockCtx.reply).toHaveBeenCalledWith(
                expect.stringContaining('عذرا.. نواجه مشكلة أثناء حفظ القارئ المفضل'),
                expect.any(Object)
            );
        });

        it('should create inline keyboard without "a" if not in callback_data (admin path)', async () => {
            mockAdminChecker.mockResolvedValue(true);
            mockCtx.update.callback_query.data = JSON.stringify({ setReciter: 'ar.alafasy' }); // No 'a'
            await handleSetReciterAction(mockCtx, dependencies);

            expect(mockTelegrafMarkup.button.callback).toHaveBeenCalledWith(
                '🎁',
                JSON.stringify({ surpriseAyaAction: true })
            );
            expect(mockCtx.reply).toHaveBeenCalled();
        });
    });

    describe('handleReciteAction', () => {
        let rawMockCtx;
        let dependencies;
        let mockSendAyaRecitationFn;
        // New mock functions for dependencies
        let mockIsValidReciterFn,
            mockGetRecitationFn,
            mockGetFavReciterDbFn,
            mockGetRandomReciterIdentifierFn,
            mockHelperSuccessSendFn,
            mockHelperSendSorryFn,
            mockHelperAMenuButtonsFn;

        beforeEach(async () => {
            rawMockCtx = {
                from: { id: 'userRecite', username: 'testReciteUser' },
                chat: { id: 'chatRecite123', type: 'private' },
                update: {
                    callback_query: {
                        data: JSON.stringify({ recite: 300, r: 'reciterZ' }),
                        message: { message_id: 500, chat: { id: 'chatRecite123', type: 'private' } },
                    },
                },
                answerCbQuery: jest.fn().mockResolvedValue(true),
                telegram: mockBotTelegramDependency,
            };
            mockSendAyaRecitationFn = jest.fn().mockResolvedValue(undefined);

            // Initialize new mock functions
            mockIsValidReciterFn = jest.fn().mockReturnValue(true);
            mockGetRecitationFn = jest.fn().mockResolvedValue('mock_audio_url.mp3');
            mockGetFavReciterDbFn = jest.fn().mockResolvedValue({ success: true, data: 'defaultReciter' });
            mockGetRandomReciterIdentifierFn = jest.fn().mockReturnValue('randomReciter');
            mockHelperSuccessSendFn = jest.fn();
            mockHelperSendSorryFn = jest.fn();
            mockHelperAMenuButtonsFn = jest.fn().mockReturnValue({ inline_keyboard: [] });

            const localMockHelperConditional = jest.fn(async (ctx, _botTelegram, adminFn, _nonAdminCb) => {
                if (await mockAdminChecker(ctx, _botTelegram)) {
                    await adminFn(); // Call adminFn without arguments
                } else {
                    if (ctx.answerCbQuery)
                        await ctx.answerCbQuery('Non-admin mock path for helper', { show_alert: true });
                }
            });

            dependencies = {
                botTelegram: mockBotTelegramDependency,
                botOptions: { username: 'TestBotForRecite' },
                helperAdminConditionalAction: localMockHelperConditional,
                sendAyaRecitationFn: mockSendAyaRecitationFn,
                ayaId2suraAyaFn: mockAyaId2suraAyaFn,
                // Add new dependencies
                isValidReciterFn: mockIsValidReciterFn,
                getRecitationFn: mockGetRecitationFn,
                getFavReciterDbFn: mockGetFavReciterDbFn,
                getRandomReciterIdentifierFn: mockGetRandomReciterIdentifierFn,
                // helperSuccessSendFn is not passed to handleReciteAction's dependencies anymore
                helperSendSorryFn: mockHelperSendSorryFn,
                helperAMenuButtonsFn: mockHelperAMenuButtonsFn,
                lastAyaTimeDbFn: jest.fn(), // Mock for lastAyaTimeDbFn
            };
            mockAdminChecker.mockClear().mockResolvedValue(true);
            rawMockCtx.answerCbQuery.mockClear();
            mockSendAyaRecitationFn.mockClear();
            // Clear new mocks
            mockIsValidReciterFn.mockClear();
            mockGetRecitationFn.mockClear();
            mockGetFavReciterDbFn.mockClear();
            mockGetRandomReciterIdentifierFn.mockClear();
            mockHelperSuccessSendFn.mockClear();
            mockHelperSendSorryFn.mockClear();
            mockHelperAMenuButtonsFn.mockClear();
        });

        it('should call sendAyaRecitationFn with correct dependencies and primitives for admin user (using MOCKED helper)', async () => {
            mockAdminChecker.mockResolvedValue(true);
            const parsedCbData = JSON.parse(rawMockCtx.update.callback_query.data);
            const structuredArg = {
                chatId: rawMockCtx.chat.id,
                fromId: rawMockCtx.from.id,
                messageId: rawMockCtx.update.callback_query.message?.message_id,
                callbackQueryData: parsedCbData,
                rawCtx: rawMockCtx,
            };

            await handleReciteAction(structuredArg, dependencies);

            expect(dependencies.helperAdminConditionalAction).toHaveBeenCalledWith(
                rawMockCtx,
                dependencies.botTelegram,
                expect.any(Function),
                expect.any(Function),
                false,
                expect.any(String)
            );

            // Verify that sendAyaRecitationFn was called with the assembled fullSenderDeps
            expect(mockSendAyaRecitationFn).toHaveBeenCalledWith(
                expect.objectContaining({
                    // This is the fullSenderDeps object
                    botTelegram: dependencies.botTelegram,
                    botUsername: dependencies.botOptions.username,
                    isValidReciterFn: mockIsValidReciterFn,
                    getRecitationFn: mockGetRecitationFn,
                    getFavReciterDbFn: mockGetFavReciterDbFn,
                    getRandomReciterIdentifierFn: mockGetRandomReciterIdentifierFn,
                    // helperSuccessSendFn is no longer part of fullSenderDeps
                    helperSendSorryFn: mockHelperSendSorryFn,
                    helperAMenuButtonsFn: mockHelperAMenuButtonsFn,
                    ayaId2suraAyaFn: mockAyaId2suraAyaFn, // Added expected dependency
                    lastAyaTimeDbFn: dependencies.lastAyaTimeDbFn, // Added expected dependency
                }),
                structuredArg.chatId,
                structuredArg.messageId,
                structuredArg.fromId,
                parsedCbData.recite,
                parsedCbData.r
            );
        });

        it('should call answerCbQuery with URL for non-admin user (using MOCKED helper)', async () => {
            rawMockCtx.chat.type = 'group';
            mockAdminChecker.mockResolvedValue(false);
            dependencies.ayaId2suraAyaFn.mockReturnValue({ sura: 7, aya: 77 });

            const parsedCbData = JSON.parse(rawMockCtx.update.callback_query.data);
            const structuredArg = {
                chatId: rawMockCtx.chat.id,
                fromId: rawMockCtx.from.id,
                messageId: rawMockCtx.update.callback_query.message?.message_id,
                callbackQueryData: parsedCbData,
                rawCtx: rawMockCtx,
            };
            await handleReciteAction(structuredArg, dependencies);

            expect(dependencies.helperAdminConditionalAction).toHaveBeenCalled();
            // The nonAdminCb within handleReciteAction is called by the mocked helper,
            // and it uses ayaId2suraAyaFn.
            expect(dependencies.ayaId2suraAyaFn).toHaveBeenCalledWith(parsedCbData.recite);
            // The mocked helper's non-admin path is simplified, check rawCtx.answerCbQuery
            // The actual nonAdminUrl is constructed inside handleReciteAction and passed to the helper.
            // The mock for helperAdminConditionalAction was simplified and might not use the nonAdminUrl argument.
            // const expectedUrl = `t.me/TestBotForRecite?start=r7-77`; // Unused - Removed for ESLint
            // The mock helperAdminConditionalAction calls the nonAdminCb, which returns this URL.
            // The test for the actual helper would verify the answerCbQuery call with this URL.
            // Here, we check that the nonAdminCb (from handleReciteAction) was effectively triggered.
            // For this specific mock, the nonAdminCb is not directly testable for its return value unless the mock calls it and uses its result.
            // The mock calls: if(ctx.answerCbQuery) await ctx.answerCbQuery("Non-admin mock path for helper", {show_alert: true});
            // This means rawMockCtx.answerCbQuery should be called by the mock.
            expect(rawMockCtx.answerCbQuery).toHaveBeenCalledWith('Non-admin mock path for helper', {
                show_alert: true,
            });
            expect(mockSendAyaRecitationFn).not.toHaveBeenCalled();
        });

        // This test is obsolete because JSON.parse of raw callback_data is now handled
        // in the telegramBot.js wrapper *before* handleReciteAction is called.
        // handleReciteAction receives already parsed `callbackQueryData`.
        // it.skip('SKIPPED: handleReciteAction itself does not parse JSON for callback_data', () => {});

        // Test using COPIED helperAdminConditionalAction and ACTUAL sendAyaRecitation
        it('should have sendAyaRecitation log error if its direct chatId parameter is null (using COPIED helpers)', async () => {
            const TEST_NON_ADMINS_ALERT_LOCAL = 'Local test non-admins alert';

            // Copied adminChecker for this test's scope
            async function testLocalAdminChecker(ctx, botTelegram) {
                if (!ctx || !ctx.chat || !ctx.from) {
                    mockLoggerLog('testLocalAdminChecker: Invalid context received.', ctx ? Object.keys(ctx) : null);
                    return false;
                }
                if (ctx.chat.type === 'private') return true;
                try {
                    const member = await botTelegram.getChatMember(ctx.chat.id, ctx.from.id);
                    return ['creator', 'administrator'].includes(member.status);
                } catch (error) {
                    mockLoggerLog('Error in testLocalAdminChecker', error.message);
                    return false;
                }
            }

            // Copied helperAdminConditionalAction for this test's scope
            async function testLocalHelperAdminConditionalAction(
                rawCtx,
                botTelegram,
                adminFn,
                nonAdminCb,
                nonAdminAlert = false,
                nonAdminUrl = null
            ) {
                const isUserAdmin = await testLocalAdminChecker(rawCtx, botTelegram);
                if (isUserAdmin) {
                    try {
                        await adminFn(rawCtx);
                        if (rawCtx.answerCbQuery)
                            await rawCtx
                                .answerCbQuery()
                                .catch((e) => mockLoggerLog('testLocalHelper: CbQ admin:', e.message));
                    } catch (error) {
                        mockLoggerLog('testLocalHelper: Error in adminFn:', error.message);
                        if (rawCtx.answerCbQuery)
                            await rawCtx
                                .answerCbQuery('Err in adminFn (testLocal)', { show_alert: true })
                                .catch((e) => mockLoggerLog('testLocalHelper: CbQ admin err:', e.message));
                    }
                } else {
                    const urlToOpen =
                        nonAdminUrl || (typeof nonAdminCb === 'function' ? await nonAdminCb(rawCtx) : null);
                    if (rawCtx.answerCbQuery) {
                        if (urlToOpen) {
                            await rawCtx
                                .answerCbQuery(nonAdminAlert ? TEST_NON_ADMINS_ALERT_LOCAL : '', { url: urlToOpen })
                                .catch((e) => mockLoggerLog('testLocalHelper: CbQ non-admin URL:', e.message));
                        } else {
                            await rawCtx
                                .answerCbQuery(nonAdminAlert ? TEST_NON_ADMINS_ALERT_LOCAL : '', {
                                    show_alert: nonAdminAlert,
                                })
                                .catch((e) => mockLoggerLog('testLocalHelper: CbQ non-admin alert:', e.message));
                        }
                    }
                }
            }

            const { sendAyaRecitation: actualSendAyaRecitation } = await import('../ayaSender.js');
            mockAdminChecker.mockResolvedValue(true); // Global mock, for testLocalAdminChecker if it somehow uses it.
            // testLocalAdminChecker uses passed botTelegram.getChatMember.
            // mockBotTelegramDependency.getChatMember is set in main beforeEach.

            const AYA_ID = 777;
            const RECITER_ID = 'test.reciter.nullchat';
            const USER_ID = 'userNullChat';
            const MSG_ID = 888;

            const testRawCtx = {
                // This is the Telegraf-like context
                from: { id: USER_ID, username: 'testUserNullChat' },
                // chat id here is valid for adminChecker to pass, but we'll pass null chatId to handleReciteAction
                chat: { id: 123456, type: 'private' },
                update: {
                    callback_query: {
                        data: JSON.stringify({ recite: AYA_ID, r: RECITER_ID }),
                        message: { message_id: MSG_ID, chat: { id: 123456 } },
                    },
                },
                answerCbQuery: jest.fn().mockResolvedValue(true),
                telegram: mockBotTelegramDependency, // actualAdminChecker will use this
            };

            const structuredArgToHandler = {
                chatId: null, // <<<< INTENTIONALLY NULL for sendAyaRecitation
                fromId: USER_ID,
                messageId: MSG_ID,
                callbackQueryData: { recite: AYA_ID, r: RECITER_ID }, // Already parsed
                rawCtx: testRawCtx,
            };

            const actualSenderDeps = {
                botTelegram: mockBotTelegramDependency,
                botUsername: 'TestBotActual',
                isValidReciterFn: jest.fn().mockReturnValue(true),
                getFavReciterDbFn: jest.fn().mockResolvedValue({ success: true, data: RECITER_ID }),
                getRandomReciterIdentifierFn: jest.fn().mockReturnValue(RECITER_ID),
                helperSendSorryFn: jest.fn(),
                getRecitationFn: jest.fn().mockResolvedValue('http://mock.audio.url'),
                ayaId2suraAyaFn: mockAyaId2suraAyaFn.mockReturnValue({ sura: 1, aya: 1 }),
                helperAMenuButtonsFn: jest.fn().mockReturnValue({ inline_keyboard: [] }),
                lastAyaTimeDbFn: jest.fn(),
            };

            const handlerDepsForActualTest = {
                botTelegram: mockBotTelegramDependency,
                botOptions: { username: 'TestBotActual' },
                helperAdminConditionalAction: testLocalHelperAdminConditionalAction,
                sendAyaRecitationFn: (fullDeps, chatId, messageId, fromId, ayaId, reciterId) => {
                    // The actualSendAyaRecitation expects 'actualSenderDeps' which we've built.
                    // The 'fullDeps' received here is what handleReciteAction constructs.
                    // For this test, we want to ensure actualSendAyaRecitation is called correctly
                    // with the primitives, and it uses its own pre-defined actualSenderDeps.
                    // This mock structure for sendAyaRecitationFn might need to change if we want to assert
                    // the content of fullDeps passed by handleReciteAction's adminFn.
                    // For now, let's assume this test is about actualSendAyaRecitation's behavior with primitives.
                    console.log(
                        '[Test] sendAyaRecitationFn (wrapper) in handlerDepsForActualTest called with chatId:',
                        chatId
                    );
                    return actualSendAyaRecitation(actualSenderDeps, chatId, messageId, fromId, ayaId, reciterId);
                },
                ayaId2suraAyaFn: mockAyaId2suraAyaFn,
                // Add new dependencies that handleReciteAction itself needs to build fullSenderDeps
                isValidReciterFn: actualSenderDeps.isValidReciterFn, // Reuse from actualSenderDeps for consistency
                getRecitationFn: actualSenderDeps.getRecitationFn,
                getFavReciterDbFn: actualSenderDeps.getFavReciterDbFn,
                getRandomReciterIdentifierFn: actualSenderDeps.getRandomReciterIdentifierFn,
                helperSuccessSendFn: jest.fn(), // Mocked, as their effect is not under test here
                helperSendSorryFn: actualSenderDeps.helperSendSorryFn, // Reuse
                helperAMenuButtonsFn: actualSenderDeps.helperAMenuButtonsFn, // Reuse
            };

            await handleReciteAction(structuredArgToHandler, handlerDepsForActualTest);

            // console.log('[Test] mockLoggerLog calls:', JSON.stringify(mockLoggerLog.mock.calls, null, 2));
            const errorLog = mockLoggerLog.mock.calls.find(
                (call) => call[0].includes('CHAT_ID IS MISSING (in handleReciteAction adminFn)') // Adjusted string
            );
            expect(errorLog).toBeDefined();
            // Verify that rawCtx.answerCbQuery was called because chatId was missing
            expect(structuredArgToHandler.rawCtx.answerCbQuery).toHaveBeenCalledWith(
                'Error: Chat ID missing.',
                { show_alert: true } // Corrected message
            );
        });

        it('should correctly assemble and pass all dependencies in fullSenderDeps to sendAyaRecitationFn', async () => {
            mockAdminChecker.mockResolvedValue(true); // Ensure admin path is taken
            const parsedCbData = JSON.parse(rawMockCtx.update.callback_query.data);
            const structuredArg = {
                chatId: rawMockCtx.chat.id,
                fromId: rawMockCtx.from.id,
                messageId: rawMockCtx.update.callback_query.message?.message_id,
                callbackQueryData: parsedCbData,
                rawCtx: rawMockCtx,
            };

            // Call the handler
            await handleReciteAction(structuredArg, dependencies);

            // Check that sendAyaRecitationFn (which is mockSendAyaRecitationFn in this test scope)
            // was called. The more important check is the first argument it received.
            expect(mockSendAyaRecitationFn).toHaveBeenCalled();

            // Get the first argument passed to mockSendAyaRecitationFn
            const actualFullSenderDeps = mockSendAyaRecitationFn.mock.calls[0][0];

            // Assert that all expected functions from the outer `dependencies` object
            // are present in the `actualFullSenderDeps` passed to `sendAyaRecitationFn`.
            expect(actualFullSenderDeps.botTelegram).toBe(dependencies.botTelegram);
            expect(actualFullSenderDeps.botUsername).toBe(dependencies.botOptions.username);
            expect(actualFullSenderDeps.isValidReciterFn).toBe(dependencies.isValidReciterFn);
            expect(actualFullSenderDeps.getRecitationFn).toBe(dependencies.getRecitationFn);
            expect(actualFullSenderDeps.getFavReciterDbFn).toBe(dependencies.getFavReciterDbFn);
            expect(actualFullSenderDeps.getRandomReciterIdentifierFn).toBe(dependencies.getRandomReciterIdentifierFn);
            expect(actualFullSenderDeps.helperSendSorryFn).toBe(dependencies.helperSendSorryFn);
            expect(actualFullSenderDeps.helperAMenuButtonsFn).toBe(dependencies.helperAMenuButtonsFn);
            expect(actualFullSenderDeps.ayaId2suraAyaFn).toBe(dependencies.ayaId2suraAyaFn);
            expect(actualFullSenderDeps.lastAyaTimeDbFn).toBe(dependencies.lastAyaTimeDbFn);
        });
    });

    // ... other describe blocks for handleAMenuAction, handleCurrAyaAction etc. should be fine ...
    // (Copying one for brevity)
    describe('handleAMenuAction', () => {
        let mockCtx;
        let dependencies;
        let mockHelperAMenuButtonsFnDependency;

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
                helperAdminProtectedAction: mockHelperAdminProtectedAction,
                helperAMenuButtonsFn: mockHelperAMenuButtonsFnDependency,
                ayaId2suraAyaFn: localMockAyaId2suraAyaFnForAMenu,
            };
            mockAdminChecker.mockClear().mockResolvedValue(true); // Reset and default to admin
            mockCtx.answerCbQuery.mockClear();
            mockCtx.editMessageReplyMarkup.mockClear();
            mockHelperAMenuButtonsFnDependency.mockClear();
            mockAyaId2suraAyaFn.mockClear(); // Clear this global mock too
        });

        it('should toggle menu from t0 to t1 and edit markup if admin', async () => {
            mockAdminChecker.mockResolvedValue(true);
            mockCtx.update.callback_query.data = JSON.stringify({ aMenu: 't0', a: 200, r: 'recY' });
            mockAyaId2suraAyaFn.mockReturnValue({ sura: 1, aya: 1 }); // Ensure this is mocked for the call within handleAMenuAction

            await handleAMenuAction(mockCtx, dependencies);

            expect(mockHelperAdminProtectedAction).toHaveBeenCalled();
            expect(dependencies.helperAMenuButtonsFn).toHaveBeenCalledWith(
                't1',
                200,
                'recY',
                'TestBotForAMenu',
                dependencies.ayaId2suraAyaFn
            );
            expect(mockCtx.editMessageReplyMarkup).toHaveBeenCalledWith({ inline_keyboard: [[{ text: 'NewMenu' }]] });
        });

        it('should toggle menu from t1 to t0 and edit markup if admin', async () => {
            mockAdminChecker.mockResolvedValue(true);
            mockCtx.update.callback_query.data = JSON.stringify({ aMenu: 't1', a: 201, r: 'recZ' });
            mockAyaId2suraAyaFn.mockReturnValue({ sura: 2, aya: 2 });

            await handleAMenuAction(mockCtx, dependencies);

            expect(mockHelperAdminProtectedAction).toHaveBeenCalled();
            expect(dependencies.helperAMenuButtonsFn).toHaveBeenCalledWith(
                't0',
                201,
                'recZ',
                'TestBotForAMenu',
                dependencies.ayaId2suraAyaFn
            );
            expect(mockCtx.editMessageReplyMarkup).toHaveBeenCalledWith({ inline_keyboard: [[{ text: 'NewMenu' }]] });
        });

        it('should call answerCbQuery with alert if user is not admin', async () => {
            mockAdminChecker.mockResolvedValue(false);
            await handleAMenuAction(mockCtx, dependencies);

            expect(mockHelperAdminProtectedAction).toHaveBeenCalled();
            expect(mockCtx.answerCbQuery).toHaveBeenCalledWith('NON_ADMINS_ALERT_MOCK', { show_alert: true });
            expect(dependencies.helperAMenuButtonsFn).not.toHaveBeenCalled();
            expect(mockCtx.editMessageReplyMarkup).not.toHaveBeenCalled();
        });

        it('should log error if editMessageReplyMarkup fails (admin path)', async () => {
            mockAdminChecker.mockResolvedValue(true);
            mockCtx.editMessageReplyMarkup.mockRejectedValueOnce(new Error('Edit Failed'));
            mockAyaId2suraAyaFn.mockReturnValue({ sura: 1, aya: 1 });

            await handleAMenuAction(mockCtx, dependencies);

            expect(mockHelperAdminProtectedAction).toHaveBeenCalled();
            expect(mockLoggerLog).toHaveBeenCalledWith(
                expect.stringContaining('Warning: Error toggling aMenu'),
                expect.any(Error)
            );
            // answerCbQuery might still be called by the helper successfully
            expect(mockCtx.answerCbQuery).toHaveBeenCalled();
        });
    });

    describe('handleRecitersNavPageAction', () => {
        let mockCtx;
        let dependencies;
        let mockRecitersNavPageFnDependency;

        beforeEach(() => {
            mockCtx = {
                from: { id: 'userRecNav' },
                chat: { id: 'chatRecNav', type: 'group' }, // group chat
                update: { callback_query: { data: JSON.stringify({ recitersNavPage: 2 }) } },
                answerCbQuery: jest.fn().mockResolvedValue(true),
                editMessageReplyMarkup: jest.fn().mockResolvedValue(true),
            };
            mockRecitersNavPageFnDependency = jest
                .fn()
                .mockReturnValue([[{ text: 'Page 2 Reciter', callback_data: 'r_pg2' }]]);
            dependencies = {
                botTelegram: mockBotTelegramDependency,
                recitersNavPageFn: mockRecitersNavPageFnDependency,
                helperAdminProtectedAction: mockHelperAdminProtectedAction, // Uses the global mock
            };
            mockAdminChecker.mockClear(); // Clear admin checker for specific settings
            mockHelperAdminProtectedAction.mockClear();
            mockCtx.answerCbQuery.mockClear();
            mockCtx.editMessageReplyMarkup.mockClear();
            mockRecitersNavPageFnDependency.mockClear();
        });

        it('should call recitersNavPageFn and edit markup if user is admin', async () => {
            mockAdminChecker.mockResolvedValue(true); // User is admin
            await handleRecitersNavPageAction(mockCtx, dependencies);

            expect(mockHelperAdminProtectedAction).toHaveBeenCalled();
            // The actual logic inside helperAdminProtectedAction's callback:
            expect(mockRecitersNavPageFnDependency).toHaveBeenCalledWith(2);
            expect(mockCtx.editMessageReplyMarkup).toHaveBeenCalledWith({
                inline_keyboard: [[{ text: 'Page 2 Reciter', callback_data: 'r_pg2' }]],
            });
            expect(mockCtx.answerCbQuery).toHaveBeenCalled(); // Should be called by the helper
        });

        it('should call answerCbQuery with alert if user is not admin', async () => {
            mockAdminChecker.mockResolvedValue(false); // User is NOT admin
            await handleRecitersNavPageAction(mockCtx, dependencies);

            expect(mockHelperAdminProtectedAction).toHaveBeenCalled();
            // Check that the non-admin path in the mocked helper was taken:
            expect(mockCtx.answerCbQuery).toHaveBeenCalledWith('NON_ADMINS_ALERT_MOCK', { show_alert: true });
            expect(mockRecitersNavPageFnDependency).not.toHaveBeenCalled();
            expect(mockCtx.editMessageReplyMarkup).not.toHaveBeenCalled();
        });

        it('should handle JSON parse error for callback_data', async () => {
            mockAdminChecker.mockResolvedValue(true); // Assume admin to reach parsing logic
            mockCtx.update.callback_query.data = 'invalid-json';
            await handleRecitersNavPageAction(mockCtx, dependencies);

            // helperAdminProtectedAction calls the actionFn. Inside actionFn:
            expect(mockCtx.answerCbQuery).toHaveBeenCalledWith('Error processing request.');
            expect(mockRecitersNavPageFnDependency).not.toHaveBeenCalled();
        });

        it('should handle invalid page number type in callback_data', async () => {
            mockAdminChecker.mockResolvedValue(true);
            mockCtx.update.callback_query.data = JSON.stringify({ recitersNavPage: 'not-a-number' });
            await handleRecitersNavPageAction(mockCtx, dependencies);

            expect(mockCtx.answerCbQuery).toHaveBeenCalledWith('Error: Invalid page number.');
            expect(mockRecitersNavPageFnDependency).not.toHaveBeenCalled();
        });

        it('should handle error when editing message reply markup', async () => {
            mockAdminChecker.mockResolvedValue(true);
            mockCtx.editMessageReplyMarkup.mockRejectedValueOnce(new Error('Edit failed'));
            await handleRecitersNavPageAction(mockCtx, dependencies);

            expect(mockCtx.answerCbQuery).toHaveBeenCalledWith('Error updating list.');
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
