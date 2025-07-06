import { jest } from '@jest/globals';

// --- Manage config.js mock manually (for dependencies like logger) ---
// config.js is effectively a dependency via logger.js,
// path from actionHandlers.js (SUT) to config.js is '../config.js'
// path from this test file (actionHandlers.test.js) to config.js is also '../config.js'
let currentConfigMock = {
    __esModule: true,
    default: { // Minimal valid config to prevent errors during SUT import via its dependencies
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
    console.log(`****** ACTION_HANDLERS_TEST: unstable_mockModule for ../config.js using currentConfigMock (branch: ${currentConfigMock.default.branch}) ******`);
    return currentConfigMock;
});

// Mock ../logger.js (direct dependency of actionHandlers.js)
const mockLoggerLog = jest.fn();
jest.unstable_mockModule('../logger.js', () => ({
    __esModule: true,
    logger: mockLoggerLog,
}));

// --- Declare module-scoped variables for actionHandlers.js exports ---
let initializeActionHandlers;
let handleGroupKhatmaAction;
let handleRecitersNavPageAction;
let handleInstructionsAction;
let handleSurpriseAyaAction;
let handleCurrAyaAction;
let handleAMenuAction;
let handleReciteAction;
let handleSetReciterAction;

// --- Mocks for functions passed as dependencies to handlers ---
let mockKhatmaUpdateFn;
// Add other specific mock functions for other handlers as needed (e.g., for recitersNavPageFn etc.)


beforeAll(async () => {
    jest.resetModules(); // Reset modules before setting config and importing SUT

    // Set currentConfigMock to use values from the global mock file for consistency
    // Correct path from src/botHandlers/actionHandlers.test.js to src/__mocks__/config.mock.js is '../__mocks__/config.mock.js'
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
    mockKhatmaUpdateFn = jest.fn(); // Initialize/reset before each test for handleGroupKhatmaAction
    // Reset any other general mocks if added
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
                            reply_markup: { inline_keyboard: [[{text: 'btn'}]] }, // Basic valid structure
                            message_id: 100
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
                reply_markup: { inline_keyboard: [[{text: 'btn'}]] },
            });
            expect(mockCtx.replyWithHTML).toHaveBeenCalledWith(
                '<a href="tg://user?id=user123">TestUser</a> ➔ 5 💪',
                { disable_notification: true, reply_to_message_id: 100 }
            );
            expect(mockCtx.answerCbQuery).toHaveBeenCalledWith(
                expect.stringContaining('Updated!'),
                { show_alert: true }
            );
        });

        it('should handle invalid Juz number', async () => {
            mockCtx.update.callback_query.data = JSON.stringify({ groupkhatma: 31 });
            await handleGroupKhatmaAction(mockCtx, { khatmaUpdateFn: mockKhatmaUpdateFn });
            expect(mockCtx.answerCbQuery).toHaveBeenCalledWith('Error: Invalid Juz number.'); // Corrected: only one argument expected
            expect(mockKhatmaUpdateFn).not.toHaveBeenCalled();
        });

        it('should handle parsing error for callback_data', async () => {
            mockCtx.update.callback_query.data = 'invalid-json';
            await handleGroupKhatmaAction(mockCtx, { khatmaUpdateFn: mockKhatmaUpdateFn });
            expect(mockCtx.answerCbQuery).toHaveBeenCalledWith('Error processing your request.'); // Corrected: only one argument expected
            expect(mockKhatmaUpdateFn).not.toHaveBeenCalled();
        });

        it('should handle no change in Khatma selection', async () => {
            mockKhatmaUpdateFn.mockReturnValue(false); // Simulate no change
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
            expect(mockKhatmaUpdateFn).toHaveBeenCalledWith(expect.objectContaining({
                firstName: 'Useruser123',
            }));
            expect(mockCtx.replyWithHTML).toHaveBeenCalledWith(
                '<a href="tg://user?id=user123">Useruser123</a> ➔ 5 💪',
                expect.any(Object)
            );
        });

        it('should handle error during ctx.editMessageText or ctx.replyWithHTML', async () => {
            mockCtx.editMessageText.mockRejectedValueOnce(new Error('Edit failed'));
            await handleGroupKhatmaAction(mockCtx, { khatmaUpdateFn: mockKhatmaUpdateFn });
            expect(mockCtx.answerCbQuery).toHaveBeenCalledWith(
                expect.stringContaining('Summary might be full'),
                { show_alert: true }
            );
        });
    });

    // Basic parsing check / availability check
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
