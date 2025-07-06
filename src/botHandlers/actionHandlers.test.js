import { jest } from '@jest/globals';

// Global config is mocked via moduleNameMapper

// Mock ../logger.js
const mockLogger = jest.fn();
jest.unstable_mockModule('../logger.js', () => ({
    __esModule: true,
    logger: mockLogger,
}));

// Mock ../database.js (Only what's needed for potential future tests, not groupKhatma)
const mockDbSetFavReciter = jest.fn().mockResolvedValue({ success: true });
jest.unstable_mockModule('../database.js', () => ({
    __esModule: true,
    setFavReciter: mockDbSetFavReciter,
}));

// Mock ../quranService.js (Only what's needed for potential future tests)
const mockAyaId2SuraAya = jest.fn().mockReturnValue({ sura: 1, aya: 1 });
const mockNextAya = jest.fn((id) => id + 1);
const mockGetQuranData = jest.fn().mockReturnValue({ arReciters: [], enQuran: [] });
jest.unstable_mockModule('../quranService.js', () => ({
    __esModule: true,
    getQuranData: mockGetQuranData,
    ayaId2suraAya: mockAyaId2SuraAya,
    nextAya: mockNextAya,
}));

// Mock telegraf's Markup (used by some handlers that might be tested later)
const mockMarkupButtonCb = jest.fn((text, data) => ({ text, callback_data: data }));
const mockMarkupButtonUrl = jest.fn((text, url) => ({ text, url }));
const mockMarkupInlineKeyboard = jest.fn((buttons) => ({ inline_keyboard: buttons }));
jest.mock('telegraf', () => ({
    __esModule: true,
    Markup: {
        inlineKeyboard: mockMarkupInlineKeyboard,
        button: {
            callback: mockMarkupButtonCb,
            url: mockMarkupButtonUrl,
        },
    },
}));

// --- Declare module-scoped variables for actionHandlers.js exports ---
// Only importing what's being tested for now to keep it simple
let handleGroupKhatmaAction;
// Prefixed other handlers as they are not tested yet
let _handleRecitersNavPageAction,
    _handleSetReciterAction,
    _handleInstructionsAction,
    _handleSurpriseAyaAction,
    _handleCurrAyaAction,
    _handleAMenuAction,
    _handleReciteAction;

// --- Mocks for functions passed as dependencies ---
let mockKhatmaUpdateFn;
// Prefixed other mock functions
let _mockRecitersNavPageFn;
let _mockSurpriseAyaFn;
let _mockSendAyaFn;
let _mockSendAyaRecitationFn;

beforeAll(async () => {
    const actionHandlersModule = await import('./actionHandlers.js');
    handleGroupKhatmaAction = actionHandlersModule.handleGroupKhatmaAction;
    _handleRecitersNavPageAction = actionHandlersModule.handleRecitersNavPageAction;
    _handleSetReciterAction = actionHandlersModule.handleSetReciterAction;
    _handleInstructionsAction = actionHandlersModule.handleInstructionsAction;
    _handleSurpriseAyaAction = actionHandlersModule.handleSurpriseAyaAction;
    _handleCurrAyaAction = actionHandlersModule.handleCurrAyaAction;
    _handleAMenuAction = actionHandlersModule.handleAMenuAction;
    _handleReciteAction = actionHandlersModule.handleReciteAction;
});

beforeEach(() => {
    mockLogger.mockClear();
    mockKhatmaUpdateFn = jest.fn();

    // Clear other mocks if they were used by other tests
    _mockRecitersNavPageFn = jest.fn().mockReturnValue([[{ text: 'Page 1 Reciter', callback_data: 'r1' }]]);
    _mockSurpriseAyaFn = jest.fn();
    _mockSendAyaFn = jest.fn();
    _mockSendAyaRecitationFn = jest.fn();
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
                        message: { text: 'Khatma\n\nUserOld ➔ 2 💪', entities: [] },
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
            expect(mockCtx.editMessageText).toHaveBeenCalledWith('New Khatma Text', expect.any(Object));
            expect(mockCtx.replyWithHTML).toHaveBeenCalled();
            expect(mockCtx.answerCbQuery).toHaveBeenCalledWith(expect.stringContaining('Updated!'), {
                show_alert: true,
            });
        });

        it('should handle invalid Juz number', async () => {
            mockCtx.update.callback_query.data = JSON.stringify({ groupkhatma: 31 });
            await handleGroupKhatmaAction(mockCtx, { khatmaUpdateFn: mockKhatmaUpdateFn });
            expect(mockCtx.answerCbQuery).toHaveBeenCalledWith('Error: Invalid Juz number.', expect.anything());
            expect(mockKhatmaUpdateFn).not.toHaveBeenCalled();
        });

        it('should handle parsing error for callback_data', async () => {
            mockCtx.update.callback_query.data = 'invalid-json';
            await handleGroupKhatmaAction(mockCtx, { khatmaUpdateFn: mockKhatmaUpdateFn });
            expect(mockCtx.answerCbQuery).toHaveBeenCalledWith('Error processing your request.', expect.anything());
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
    });
    // Other describe blocks for other action handlers would go here later.
});
