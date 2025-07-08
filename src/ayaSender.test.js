import { jest } from '@jest/globals';

// --- Mock Logger ---
const mockLogger = jest.fn();
jest.unstable_mockModule('./logger.js', () => ({
    // Corrected path
    __esModule: true,
    logger: mockLogger,
}));

// --- Declare SUT variables ---
let sendAyaText, sendAyaRecitation;

// --- Mockable dependencies ---
let mockBotTelegram;
let mockPrepareAyaFn;
let mockHelperSendSorryFn;
let mockHelperAMenuButtonsFn;
let mockHelperSuccessSendFn;
let mockLastAyaTimeDbFn;
let mockAyaId2suraAyaFn;
let mockIsValidReciterFn;
let mockGetFavReciterDbFn;
let mockGetRandomReciterIdentifierFn;
let mockGetRecitationFn;

// Object to hold all mock dependencies for easy passing
let mockDependencies;

beforeAll(async () => {
    jest.resetModules(); // Ensure fresh modules for each test suite run

    // Dynamically import the SUT after mocks are set up
    const ayaSenderModule = await import('./ayaSender.js');
    sendAyaText = ayaSenderModule.sendAyaText;
    sendAyaRecitation = ayaSenderModule.sendAyaRecitation;
});

beforeEach(() => {
    // Reset all mocks before each test
    mockLogger.mockClear();

    mockBotTelegram = {
        sendMessage: jest.fn().mockResolvedValue({ chat: { id: 'chat123' }, message_id: 456 }),
        sendAudio: jest.fn().mockResolvedValue({ chat: { id: 'chat123' }, message_id: 789 }),
        editMessageReplyMarkup: jest.fn().mockResolvedValue(true),
        deleteMessage: jest.fn().mockResolvedValue(true),
    };
    mockPrepareAyaFn = jest.fn().mockReturnValue({ arText: 'Arabic Text', enText: 'English Text' });
    mockHelperSendSorryFn = jest.fn().mockResolvedValue(undefined);
    mockHelperAMenuButtonsFn = jest.fn().mockReturnValue({ inline_keyboard: [[{ text: 'Button' }]] });
    mockHelperSuccessSendFn = jest.fn().mockResolvedValue(undefined);
    mockLastAyaTimeDbFn = jest.fn().mockResolvedValue({ success: true });
    mockAyaId2suraAyaFn = jest.fn().mockReturnValue({ sura: 1, aya: 1 });
    mockIsValidReciterFn = jest.fn().mockReturnValue(true);
    mockGetFavReciterDbFn = jest.fn().mockResolvedValue({ success: true, data: 'fav.reciter' });
    mockGetRandomReciterIdentifierFn = jest.fn().mockReturnValue('random.reciter');
    mockGetRecitationFn = jest.fn().mockResolvedValue('http://example.com/audio.mp3');

    mockDependencies = {
        botTelegram: mockBotTelegram,
        botUsername: 'TestBot',
        prepareAyaFn: mockPrepareAyaFn,
        helperSendSorryFn: mockHelperSendSorryFn,
        helperAMenuButtonsFn: mockHelperAMenuButtonsFn,
        helperSuccessSendFn: mockHelperSuccessSendFn,
        lastAyaTimeDbFn: mockLastAyaTimeDbFn,
        ayaId2suraAyaFn: mockAyaId2suraAyaFn,
        isValidReciterFn: mockIsValidReciterFn,
        getFavReciterDbFn: mockGetFavReciterDbFn,
        getRandomReciterIdentifierFn: mockGetRandomReciterIdentifierFn,
        getRecitationFn: mockGetRecitationFn,
    };
});

describe('sendAyaText', () => {
    const chatId = 'chat123';
    const ayaId = 1;
    const reciter = 'current.reciter';
    const lang = 'en';
    const trigger = 'test';

    it('should send formatted Aya text and call success handler on successful send', async () => {
        await sendAyaText(mockDependencies, chatId, ayaId, reciter, lang, trigger);

        expect(mockPrepareAyaFn).toHaveBeenCalledWith(ayaId, 'TestBot');
        expect(mockHelperAMenuButtonsFn).toHaveBeenCalledWith('t0', ayaId, reciter, 'TestBot', mockAyaId2suraAyaFn);
        expect(mockBotTelegram.sendMessage).toHaveBeenCalledWith(
            chatId,
            'Arabic Text\n\nEnglish Text',
            expect.objectContaining({
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard: [[{ text: 'Button' }]] },
            })
        );
        expect(mockHelperSuccessSendFn).toHaveBeenCalledWith(
            { chat: { id: chatId }, message_id: 456 }, // context from sendMessage mock
            ayaId,
            lang,
            trigger,
            mockLastAyaTimeDbFn
        );
        expect(mockHelperSendSorryFn).not.toHaveBeenCalled();
    });

    it('should call sendSorryFn if prepareAyaFn returns an error', async () => {
        mockPrepareAyaFn.mockReturnValue({ arText: 'Error: Aya not found.', enText: 'Error: Aya not found.' });
        const result = await sendAyaText(mockDependencies, chatId, ayaId, reciter, lang, trigger);

        expect(mockPrepareAyaFn).toHaveBeenCalledWith(ayaId, 'TestBot');
        expect(mockHelperSendSorryFn).toHaveBeenCalledWith(mockBotTelegram, chatId, 'text');
        expect(mockBotTelegram.sendMessage).not.toHaveBeenCalled();
        expect(mockHelperSuccessSendFn).not.toHaveBeenCalled();
        expect(result).toBeNull();
    });

    it('should log and use fallback if botUsername is missing', async () => {
        mockDependencies.botUsername = null;
        await sendAyaText(mockDependencies, chatId, ayaId, reciter, lang, trigger);

        expect(mockLogger).toHaveBeenCalledWith(
            'sendAyaText: botUsername is not available for prepareAya.',
            expect.any(Error)
        );
        expect(mockPrepareAyaFn).toHaveBeenCalledWith(ayaId, 'DailyAyaBot'); // Fallback username
        expect(mockBotTelegram.sendMessage).toHaveBeenCalled(); // Should still attempt to send
    });

    it('should handle "migrate to supergroup" error by calling lastAyaTime and retrying', async () => {
        const migrateError = new Error('Migrate to supergroup');
        migrateError.response = {
            description: 'Bad Request: group chat was upgraded to a supergroup chat',
            parameters: { migrate_to_chat_id: 'supergroup123' },
        };
        mockBotTelegram.sendMessage.mockRejectedValueOnce(migrateError);

        // To prevent infinite recursion in test, ensure the second call succeeds.
        // The mock for sendMessage is reset in beforeEach, so the default mock will apply for the recursive call.
        // We need to ensure the recursive call doesn't also throw the migrateError.
        // For this test, we'll just check the first error handling.
        // If we wanted to test the successful recursive call, we'd need more complex mock setup.

        await sendAyaText(mockDependencies, chatId, ayaId, reciter, lang, trigger);

        expect(mockLastAyaTimeDbFn).toHaveBeenCalledWith(chatId, 'blocked');
        // Check if sendMessage was called again with the new chat ID
        expect(mockBotTelegram.sendMessage).toHaveBeenCalledWith(
            'supergroup123', // New chat ID
            'Arabic Text\n\nEnglish Text',
            expect.any(Object)
        );
        expect(mockHelperSuccessSendFn).toHaveBeenCalledTimes(1); // Should be called once after successful retry
    });

    it('should re-throw other Telegram API errors', async () => {
        const apiError = new Error('Some other API error');
        apiError.response = { description: 'Forbidden: bot was kicked' };
        mockBotTelegram.sendMessage.mockRejectedValueOnce(apiError);

        await expect(sendAyaText(mockDependencies, chatId, ayaId, reciter, lang, trigger)).rejects.toThrow(
            'Some other API error'
        );
        expect(mockHelperSuccessSendFn).not.toHaveBeenCalled();
    });
});

describe('sendAyaRecitation', () => {
    let mockCtx;
    const ayaId = 10;
    const initialReciter = 'initial.reciter';

    beforeEach(() => {
        mockCtx = {
            chat: { id: 'chatAudio' },
            from: { id: 'userAudio' },
            // For callback query context
            update: { callback_query: { message: { chat: { id: 'chatAudioCb' }, message_id: 100 } } },
            message: { message_id: 200 }, // For direct message context
        };
        mockDependencies.botUsername = 'AudioTestBot';
    });

    it('should send audio with specified valid reciter', async () => {
        mockIsValidReciterFn.mockReturnValueOnce(true); // initialReciter is valid
        await sendAyaRecitation(mockDependencies, mockCtx, ayaId, initialReciter);

        expect(mockGetRecitationFn).toHaveBeenCalledWith(ayaId, initialReciter);
        expect(mockBotTelegram.sendAudio).toHaveBeenCalledWith(
            mockCtx.chat.id, // or mockCtx.update.callback_query.message.chat.id
            'http://example.com/audio.mp3',
            expect.objectContaining({ parse_mode: 'HTML' })
        );
        expect(mockHelperSendSorryFn).not.toHaveBeenCalled();
    });

    it('should use favorite reciter if initial reciter is invalid', async () => {
        mockIsValidReciterFn.mockReturnValueOnce(false); // initialReciter is invalid
        mockIsValidReciterFn.mockReturnValueOnce(true); // fav.reciter is valid
        mockDependencies.getFavReciterDbFn.mockResolvedValueOnce({ success: true, data: 'fav.reciter' });

        await sendAyaRecitation(mockDependencies, mockCtx, ayaId, initialReciter);

        expect(mockIsValidReciterFn).toHaveBeenCalledWith(initialReciter);
        expect(mockDependencies.getFavReciterDbFn).toHaveBeenCalledWith(mockCtx.chat.id);
        expect(mockIsValidReciterFn).toHaveBeenCalledWith('fav.reciter');
        expect(mockGetRecitationFn).toHaveBeenCalledWith(ayaId, 'fav.reciter');
        expect(mockBotTelegram.sendAudio).toHaveBeenCalled();
    });

    it('should use random reciter if initial and favorite are invalid', async () => {
        mockIsValidReciterFn.mockReturnValue(false); // Both initial and fav are invalid
        mockDependencies.getFavReciterDbFn.mockResolvedValueOnce({ success: true, data: 'invalid.fav.reciter' });
        mockDependencies.getRandomReciterIdentifierFn.mockReturnValueOnce('random.reciter.ok');

        await sendAyaRecitation(mockDependencies, mockCtx, ayaId, initialReciter);

        expect(mockDependencies.getRandomReciterIdentifierFn).toHaveBeenCalled();
        expect(mockGetRecitationFn).toHaveBeenCalledWith(ayaId, 'random.reciter.ok');
        expect(mockBotTelegram.sendAudio).toHaveBeenCalled();
    });

    it('should call sendSorryFn if no valid reciter can be found', async () => {
        mockIsValidReciterFn.mockReturnValue(false);
        mockDependencies.getFavReciterDbFn.mockResolvedValueOnce({ success: false, data: null });
        mockDependencies.getRandomReciterIdentifierFn.mockReturnValueOnce(null); // No random reciter available

        await sendAyaRecitation(mockDependencies, mockCtx, ayaId, initialReciter);

        expect(mockGetRecitationFn).not.toHaveBeenCalled();
        expect(mockBotTelegram.sendAudio).not.toHaveBeenCalled();
        expect(mockHelperSendSorryFn).toHaveBeenCalledWith(mockBotTelegram, mockCtx.chat.id, 'audio');
    });

    it('should call sendSorryFn if getRecitationFn throws an error', async () => {
        mockGetRecitationFn.mockRejectedValueOnce(new Error('Failed to get audio URL'));

        await sendAyaRecitation(mockDependencies, mockCtx, ayaId, initialReciter);

        expect(mockHelperSendSorryFn).toHaveBeenCalledWith(mockBotTelegram, mockCtx.chat.id, 'audio');
    });

    it('should handle Telegram API "blocked by user" error during sendAudio', async () => {
        const blockError = new Error('Blocked by user');
        blockError.response = { description: 'Forbidden: bot was blocked by the user' };
        mockBotTelegram.sendAudio.mockRejectedValueOnce(blockError);

        await sendAyaRecitation(mockDependencies, mockCtx, ayaId, initialReciter);

        expect(mockLastAyaTimeDbFn).toHaveBeenCalledWith(mockCtx.chat.id, 'blocked');
        expect(mockHelperSendSorryFn).not.toHaveBeenCalled(); // Specific block error doesn't trigger sorry
    });

    it('should call sendSorryFn for other Telegram API errors during sendAudio', async () => {
        const apiError = new Error('Some API error');
        apiError.response = { description: 'Internal server error' };
        mockBotTelegram.sendAudio.mockRejectedValueOnce(apiError);

        await sendAyaRecitation(mockDependencies, mockCtx, ayaId, initialReciter);
        expect(mockLastAyaTimeDbFn).not.toHaveBeenCalledWith(mockCtx.chat.id, 'blocked');
        expect(mockHelperSendSorryFn).toHaveBeenCalledWith(mockBotTelegram, mockCtx.chat.id, 'audio');
    });

    it('should attempt to edit/delete messages correctly when original messageId is from ctx.message', async () => {
        // Simulating sentAudioCtx.message_id is originalMessageId + 1
        mockBotTelegram.sendAudio.mockResolvedValue({
            chat: { id: mockCtx.chat.id },
            message_id: mockCtx.message.message_id + 1,
        });
        await sendAyaRecitation(mockDependencies, mockCtx, ayaId, initialReciter);

        expect(mockBotTelegram.editMessageReplyMarkup).toHaveBeenNthCalledWith(
            1,
            mockCtx.chat.id,
            mockCtx.message.message_id,
            undefined,
            undefined
        );
        expect(mockBotTelegram.editMessageReplyMarkup).toHaveBeenNthCalledWith(
            2,
            mockCtx.chat.id,
            mockCtx.message.message_id + 1,
            undefined,
            expect.any(Object)
        );
        expect(mockBotTelegram.deleteMessage).not.toHaveBeenCalled();
    });

    it('should attempt to reply and delete if sentAudio message_id is not sequential (ctx.message)', async () => {
        // Simulating sentAudioCtx.message_id is NOT originalMessageId + 1
        mockBotTelegram.sendAudio.mockResolvedValueOnce({ chat: { id: mockCtx.chat.id }, message_id: 999 }); // Initial sendAudio
        mockBotTelegram.sendAudio.mockResolvedValueOnce({ chat: { id: mockCtx.chat.id }, message_id: 1000 }); // Second sendAudio (reply)

        await sendAyaRecitation(mockDependencies, mockCtx, ayaId, initialReciter);

        expect(mockBotTelegram.deleteMessage).toHaveBeenCalledWith(mockCtx.chat.id, 999);
        expect(mockBotTelegram.sendAudio).toHaveBeenLastCalledWith(
            mockCtx.chat.id,
            'http://example.com/audio.mp3',
            expect.objectContaining({
                reply_to_message_id: mockCtx.message.message_id, // from ctx.message
                reply_markup: expect.any(Object),
            })
        );
        expect(mockBotTelegram.editMessageReplyMarkup).toHaveBeenCalledWith(
            mockCtx.chat.id,
            mockCtx.message.message_id,
            undefined,
            undefined
        );
    });

    it('should attempt to edit/delete messages correctly when original messageId is from callback_query', async () => {
        const cbCtx = { update: { callback_query: { message: { chat: { id: 'chatAudioCb' }, message_id: 100 } } } };
        // Simulating sentAudioCtx.message_id is originalMessageId + 1
        mockBotTelegram.sendAudio.mockResolvedValue({ chat: { id: 'chatAudioCb' }, message_id: 101 });
        await sendAyaRecitation(mockDependencies, cbCtx, ayaId, initialReciter);

        expect(mockBotTelegram.editMessageReplyMarkup).toHaveBeenNthCalledWith(
            1,
            'chatAudioCb',
            100,
            undefined,
            undefined
        );
        expect(mockBotTelegram.editMessageReplyMarkup).toHaveBeenNthCalledWith(
            2,
            'chatAudioCb',
            101,
            undefined,
            expect.any(Object)
        );
        expect(mockBotTelegram.deleteMessage).not.toHaveBeenCalled();
    });

    it('should log and return if chatId cannot be determined, logging ctx.update', async () => {
        const emptyCtx = { update: { update_id: 999, some_other_field: 'test' } }; // No chat.id or callback_query.message.chat.id
        await sendAyaRecitation(mockDependencies, emptyCtx, ayaId, initialReciter);
        expect(mockLogger).toHaveBeenCalledWith(
            'sendAyaRecitation: Could not determine chatId from context. Update object:',
            JSON.stringify(emptyCtx.update, null, 2)
        );
        expect(mockGetRecitationFn).not.toHaveBeenCalled();
    });

    it('should log "ctx.update is undefined" if ctx.update is missing when chatId cannot be determined', async () => {
        const ctxWithoutUpdate = {}; // No chat.id and no ctx.update
        await sendAyaRecitation(mockDependencies, ctxWithoutUpdate, ayaId, initialReciter);
        expect(mockLogger).toHaveBeenCalledWith(
            'sendAyaRecitation: Could not determine chatId from context. Update object:',
            'ctx.update is undefined'
        );
        expect(mockGetRecitationFn).not.toHaveBeenCalled();
    });
});
