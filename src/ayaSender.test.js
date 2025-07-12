import { jest } from '@jest/globals';

// --- Manage config.js mock manually ---
let currentConfigMock = {
    __esModule: true,
    default: {
        telegramToken: 'AYASENDER_TEST_TOKEN',
        devChatId: 'AYASENDER_DEV_CHAT_ID',
        mongoDbCredentials: 'test-user:test-pass',
        mongoSubdomain: 'test-cluster.mongodb.net',
        mongoURI: 'mongodb+srv://test-user:test-pass@test-cluster.mongodb.net/?retryWrites=true&w=majority',
        branch: 'test-branch',
        inst: 'test-inst',
        host: 'test-host',
        totalInst: '1',
        debugging: false, // Default to false, can be overridden in tests
        codeVer: 'test-v0.0.0',
        instActiveUntil: '2000-01-01',
        port: 3008,
        timerCheckMinutes: 60,
        timerSendHours: 24,
        pingTargetGeneral: 'http://test.example.com',
        pingTargetAlternative: 'http://test.example.org',
        pingTargetTelegramApiBase: 'http://test.api.telegram.org',
        botLaunchRetryDelay: 1000,
        maxBotLaunchRetries: 1,
    },
};
jest.unstable_mockModule('./config.js', () => {
    return currentConfigMock;
});

// --- Mock Logger ---
const mockLogger = jest.fn();
jest.unstable_mockModule('./logger.js', () => ({
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

        expect(mockPrepareAyaFn).toHaveBeenCalledWith(ayaId, reciter);
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

        expect(mockPrepareAyaFn).toHaveBeenCalledWith(ayaId, reciter);
        expect(mockHelperSendSorryFn).toHaveBeenCalledWith(mockBotTelegram, chatId, 'text');
        expect(mockBotTelegram.sendMessage).not.toHaveBeenCalled();
        expect(mockHelperSuccessSendFn).not.toHaveBeenCalled();
        expect(result).toBeNull();
    });

    it('should log and use fallback if botUsername is missing', async () => {
        mockDependencies.botUsername = null;
        const originalDebugging = currentConfigMock.default.debugging; // Save original
        currentConfigMock.default.debugging = true; // Set for this test

        await sendAyaText(mockDependencies, chatId, ayaId, reciter, lang, trigger);

        expect(mockLogger).toHaveBeenCalledWith(
            'sendAyaText: botUsername is not available for prepareAya. Using fallback.',
            expect.any(Error)
        );
        expect(mockPrepareAyaFn).toHaveBeenCalledWith(ayaId, reciter);
        currentConfigMock.default.debugging = originalDebugging; // Restore
        expect(mockBotTelegram.sendMessage).toHaveBeenCalled(); // Should still attempt to send
    });

    it('should log and use fallback if botUsername is missing and debugging is false', async () => {
        mockDependencies.botUsername = null;
        const originalDebugging = currentConfigMock.default.debugging;
        currentConfigMock.default.debugging = false; // Set for this test

        await sendAyaText(mockDependencies, chatId, ayaId, null, lang, trigger);

        expect(mockLogger).toHaveBeenCalledWith(
            'sendAyaText: botUsername is not available for prepareAya. Using fallback.'
            // No second argument (Error object) expected when debugging is false
        );
        expect(mockLogger).not.toHaveBeenCalledWith(expect.any(String), expect.any(Error));
        expect(mockPrepareAyaFn).toHaveBeenCalledWith(ayaId, 'system');
        currentConfigMock.default.debugging = originalDebugging; // Restore
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
        await sendAyaRecitation(
            mockDependencies,
            mockCtx.chat.id,
            mockCtx.update.callback_query.message?.message_id,
            mockCtx.from?.id,
            ayaId,
            initialReciter
        );

        expect(mockGetRecitationFn).toHaveBeenCalledWith(ayaId, initialReciter);
        expect(mockBotTelegram.sendAudio).toHaveBeenCalledWith(
            mockCtx.chat.id, // or mockCtx.update.callback_query.message.chat.id
            'http://example.com/audio.mp3',
            expect.objectContaining({ parse_mode: 'HTML' })
        );
        expect(mockHelperSendSorryFn).not.toHaveBeenCalled();
    });

    it('should use favorite reciter if initial reciter is invalid', async () => {
        mockIsValidReciterFn.mockReturnValueOnce(false);
        mockIsValidReciterFn.mockReturnValueOnce(true);
        mockDependencies.getFavReciterDbFn.mockResolvedValueOnce({ success: true, data: 'fav.reciter' });

        await sendAyaRecitation(
            mockDependencies,
            mockCtx.chat.id,
            mockCtx.update.callback_query.message?.message_id,
            mockCtx.from?.id,
            ayaId,
            initialReciter
        );

        expect(mockIsValidReciterFn).toHaveBeenCalledWith(initialReciter);
        expect(mockDependencies.getFavReciterDbFn).toHaveBeenCalledWith(mockCtx.chat.id);
        expect(mockIsValidReciterFn).toHaveBeenCalledWith('fav.reciter');
        expect(mockGetRecitationFn).toHaveBeenCalledWith(ayaId, 'fav.reciter');
        expect(mockBotTelegram.sendAudio).toHaveBeenCalled();
    });

    it('should use random reciter if initial and favorite are invalid', async () => {
        mockIsValidReciterFn.mockReturnValue(false);
        mockDependencies.getFavReciterDbFn.mockResolvedValueOnce({ success: true, data: 'invalid.fav.reciter' });
        mockDependencies.getRandomReciterIdentifierFn.mockReturnValueOnce('random.reciter.ok');

        await sendAyaRecitation(
            mockDependencies,
            mockCtx.chat.id,
            mockCtx.update.callback_query.message?.message_id,
            mockCtx.from?.id,
            ayaId,
            initialReciter
        );

        expect(mockDependencies.getRandomReciterIdentifierFn).toHaveBeenCalled();
        expect(mockGetRecitationFn).toHaveBeenCalledWith(ayaId, 'random.reciter.ok');
        expect(mockBotTelegram.sendAudio).toHaveBeenCalled();
    });

    it('should call sendSorryFn if no valid reciter can be found', async () => {
        mockIsValidReciterFn.mockReturnValue(false);
        mockDependencies.getFavReciterDbFn.mockResolvedValueOnce({ success: false, data: null });
        mockDependencies.getRandomReciterIdentifierFn.mockReturnValueOnce(null);

        await sendAyaRecitation(
            mockDependencies,
            mockCtx.chat.id,
            mockCtx.update.callback_query.message?.message_id,
            mockCtx.from?.id,
            ayaId,
            initialReciter
        );

        expect(mockGetRecitationFn).not.toHaveBeenCalled();
        expect(mockBotTelegram.sendAudio).not.toHaveBeenCalled();
        expect(mockHelperSendSorryFn).toHaveBeenCalledWith(mockBotTelegram, mockCtx.chat.id, 'audio');
    });

    it('should call sendSorryFn if getRecitationFn throws an error', async () => {
        mockGetRecitationFn.mockRejectedValueOnce(new Error('Failed to get audio URL'));

        await sendAyaRecitation(
            mockDependencies,
            mockCtx.chat.id,
            mockCtx.update.callback_query.message?.message_id,
            mockCtx.from?.id,
            ayaId,
            initialReciter
        );

        expect(mockHelperSendSorryFn).toHaveBeenCalledWith(mockBotTelegram, mockCtx.chat.id, 'audio');
    });

    it('should handle Telegram API "blocked by user" error during sendAudio', async () => {
        const blockError = new Error('Blocked by user');
        blockError.response = { description: 'Forbidden: bot was blocked by the user' };
        mockBotTelegram.sendAudio.mockRejectedValueOnce(blockError);

        await sendAyaRecitation(
            mockDependencies,
            mockCtx.chat.id,
            mockCtx.update.callback_query.message?.message_id,
            mockCtx.from?.id,
            ayaId,
            initialReciter
        );

        expect(mockLastAyaTimeDbFn).toHaveBeenCalledWith(mockCtx.chat.id, 'blocked');
        expect(mockHelperSendSorryFn).not.toHaveBeenCalled();
    });

    it('should call sendSorryFn for other Telegram API errors during sendAudio', async () => {
        const apiError = new Error('Some API error');
        apiError.response = { description: 'Internal server error' };
        mockBotTelegram.sendAudio.mockRejectedValueOnce(apiError);

        await sendAyaRecitation(
            mockDependencies,
            mockCtx.chat.id,
            mockCtx.update.callback_query.message?.message_id,
            mockCtx.from?.id,
            ayaId,
            initialReciter
        );

        expect(mockLastAyaTimeDbFn).not.toHaveBeenCalledWith(mockCtx.chat.id, 'blocked');
        expect(mockHelperSendSorryFn).toHaveBeenCalledWith(mockBotTelegram, mockCtx.chat.id, 'audio');
    });

    it('should attempt to edit/delete messages correctly when original messageId is provided', async () => {
        const chatId = 'chatMsgEdit';
        const messageId = 200; // This is the original message with buttons
        const fromId = 'userEdit';

        mockBotTelegram.sendAudio.mockResolvedValue({
            chat: { id: chatId },
            message_id: messageId + 1, // Sequential audio message
        });
        await sendAyaRecitation(mockDependencies, chatId, messageId, fromId, ayaId, initialReciter);

        expect(mockBotTelegram.editMessageReplyMarkup).toHaveBeenNthCalledWith(
            1,
            chatId,
            messageId, // Original message
            undefined,
            undefined
        );
        expect(mockBotTelegram.editMessageReplyMarkup).toHaveBeenNthCalledWith(
            2,
            chatId,
            messageId + 1, // Audio message
            undefined,
            expect.any(Object)
        );
        expect(mockBotTelegram.deleteMessage).not.toHaveBeenCalled();
    });

    it('should attempt to reply and delete if sentAudio message_id is not sequential', async () => {
        const chatId = 'chatMsgReplyDel';
        const messageId = 200; // Original message
        const fromId = 'userReplyDel';

        mockBotTelegram.sendAudio.mockResolvedValueOnce({ chat: { id: chatId }, message_id: 999 }); // Initial sendAudio (non-sequential)
        // The second call to sendAudio (the reply) will use the default mock from beforeEach
        // which is mockBotTelegram.sendAudio.mockResolvedValue({ chat: { id: 'chat123' }, message_id: 789 })
        // This is fine for this test as we are checking the reply_to_message_id.

        await sendAyaRecitation(mockDependencies, chatId, messageId, fromId, ayaId, initialReciter);

        expect(mockBotTelegram.deleteMessage).toHaveBeenCalledWith(chatId, 999);
        expect(mockBotTelegram.sendAudio).toHaveBeenLastCalledWith(
            chatId,
            'http://example.com/audio.mp3',
            expect.objectContaining({
                reply_to_message_id: messageId,
                reply_markup: expect.any(Object),
            })
        );
        expect(mockBotTelegram.editMessageReplyMarkup).toHaveBeenCalledWith(
            chatId,
            messageId, // Original message
            undefined,
            undefined
        );
    });

    it('should edit only the new audio message if messageId is undefined (e.g. direct call)', async () => {
        const chatId = 'chatDirectAudio';
        const messageId = undefined; // No original message context
        const fromId = 'userDirect';

        mockBotTelegram.sendAudio.mockResolvedValue({ chat: { id: chatId }, message_id: 1001 });

        await sendAyaRecitation(mockDependencies, chatId, messageId, fromId, ayaId, initialReciter);

        // Only one editMessageReplyMarkup call on the new audio message
        expect(mockBotTelegram.editMessageReplyMarkup).toHaveBeenCalledTimes(1);
        expect(mockBotTelegram.editMessageReplyMarkup).toHaveBeenCalledWith(
            chatId,
            1001, // The new audio message's ID
            undefined,
            expect.any(Object) // The new buttons
        );
        expect(mockBotTelegram.deleteMessage).not.toHaveBeenCalled();
    });

    // New/Revised tests for direct chatId handling
    describe('chatId parameter handling in sendAyaRecitation', () => {
        it('should proceed if chatId is valid', async () => {
            const validChatId = 'validChat123';
            await sendAyaRecitation(mockDependencies, validChatId, 100, 'user1', ayaId, initialReciter);
            expect(mockGetRecitationFn).toHaveBeenCalledWith(ayaId, initialReciter);
            expect(mockBotTelegram.sendAudio).toHaveBeenCalledWith(validChatId, expect.anything(), expect.anything());
        });

        it('should log error and return if chatId is null', async () => {
            await sendAyaRecitation(mockDependencies, null, 100, 'user1', ayaId, initialReciter);
            expect(mockLogger).toHaveBeenCalledWith(
                'sendAyaRecitation: Received null or undefined chatId. Cannot send recitation.',
                { ayaId, reciterIdentifier: initialReciter }
            );
            expect(mockGetRecitationFn).not.toHaveBeenCalled();
        });

        it('should log error and return if chatId is undefined', async () => {
            await sendAyaRecitation(mockDependencies, undefined, 100, 'user1', ayaId, initialReciter);
            expect(mockLogger).toHaveBeenCalledWith(
                'sendAyaRecitation: Received null or undefined chatId. Cannot send recitation.',
                { ayaId, reciterIdentifier: initialReciter }
            );
            expect(mockGetRecitationFn).not.toHaveBeenCalled();
        });
    });
});
