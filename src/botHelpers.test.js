import { jest } from '@jest/globals';

// --- Mock Logger ---
const mockLoggerLog = jest.fn(); // Renamed to avoid conflict
jest.unstable_mockModule('./logger.js', () => ({
    // Corrected path
    __esModule: true,
    logger: mockLoggerLog,
}));

// --- SUT Functions ---
// Import functions from botHelpers.js after mocks are set up
let adminChecker,
    instructions,
    successSend,
    sendSorry,
    aMenuButtons,
    sendUnrecognizedMessage,
    helperAdminProtectedAction,
    helperAdminConditionalAction,
    NON_ADMINS_ALERT_CONST; // To access the constant

beforeAll(async () => {
    jest.resetModules();
    const botHelpersModule = await import('./botHelpers.js');
    adminChecker = botHelpersModule.adminChecker;
    instructions = botHelpersModule.instructions;
    successSend = botHelpersModule.successSend;
    sendSorry = botHelpersModule.sendSorry;
    aMenuButtons = botHelpersModule.aMenuButtons;
    sendUnrecognizedMessage = botHelpersModule.sendUnrecognizedMessage;
    helperAdminProtectedAction = botHelpersModule.helperAdminProtectedAction;
    helperAdminConditionalAction = botHelpersModule.helperAdminConditionalAction;
    NON_ADMINS_ALERT_CONST = botHelpersModule.NON_ADMINS_ALERT;
});

// --- Mock Telegraf objects and other dependencies ---
let mockBotTelegram;
let mockCtx;
let mockLastAyaTimeDbFn;
let mockAyaId2suraAyaFn;

beforeEach(() => {
    mockLoggerLog.mockClear();
    mockBotTelegram = {
        getChatMember: jest.fn(),
        sendMessage: jest.fn().mockResolvedValue({}),
    };
    mockCtx = {
        chat: { id: 'testChatId', type: 'private', first_name: 'TestUser' },
        from: { id: 'testUserId', first_name: 'TestUser' },
        answerCbQuery: jest.fn().mockResolvedValue(true),
    };
    mockLastAyaTimeDbFn = jest.fn().mockResolvedValue({ success: true });
    mockAyaId2suraAyaFn = jest.fn().mockReturnValue({ sura: 1, aya: 1 });
});

describe('adminChecker', () => {
    it('should return true for private chats', async () => {
        mockCtx.chat.type = 'private';
        const isAdmin = await adminChecker(mockCtx, mockBotTelegram);
        expect(isAdmin).toBe(true);
        expect(mockBotTelegram.getChatMember).not.toHaveBeenCalled();
    });

    it('should return true if user is admin in group chat', async () => {
        mockCtx.chat.type = 'group';
        mockBotTelegram.getChatMember.mockResolvedValue({ status: 'administrator' });
        const isAdmin = await adminChecker(mockCtx, mockBotTelegram);
        expect(isAdmin).toBe(true);
        expect(mockBotTelegram.getChatMember).toHaveBeenCalledWith('testChatId', 'testUserId');
    });

    it('should return true if user is creator in group chat', async () => {
        mockCtx.chat.type = 'supergroup';
        mockBotTelegram.getChatMember.mockResolvedValue({ status: 'creator' });
        const isAdmin = await adminChecker(mockCtx, mockBotTelegram);
        expect(isAdmin).toBe(true);
    });

    it('should return false if user is member in group chat', async () => {
        mockCtx.chat.type = 'group';
        mockBotTelegram.getChatMember.mockResolvedValue({ status: 'member' });
        const isAdmin = await adminChecker(mockCtx, mockBotTelegram);
        expect(isAdmin).toBe(false);
    });

    it('should return false and log error if getChatMember fails', async () => {
        mockCtx.chat.type = 'group';
        mockBotTelegram.getChatMember.mockRejectedValue(new Error('API error'));
        const isAdmin = await adminChecker(mockCtx, mockBotTelegram);
        expect(isAdmin).toBe(false);
        expect(mockLoggerLog).toHaveBeenCalledWith(
            `Error in adminChecker while calling getChatMember for chat ${mockCtx.chat.id}, user ${mockCtx.from.id}:`,
            expect.any(Error)
        );
    });

    it('should return false and log specific message for CHAT_ADMIN_REQUIRED error', async () => {
        mockCtx.chat.type = 'group';
        const chatAdminRequiredError = new Error('Forbidden: CHAT_ADMIN_REQUIRED');
        // Simulate Telegraf's error structure
        chatAdminRequiredError.response = { description: 'Forbidden: CHAT_ADMIN_REQUIRED' };
        chatAdminRequiredError.code = 403; // Or 400, depending on how Telegram sends it

        mockBotTelegram.getChatMember.mockRejectedValue(chatAdminRequiredError);
        const isAdmin = await adminChecker(mockCtx, mockBotTelegram);
        expect(isAdmin).toBe(false);
        expect(mockLoggerLog).toHaveBeenCalledWith(
            `adminChecker: Bot lacks admin rights in chat ${mockCtx.chat.id} to check member status for user ${mockCtx.from.id}. Assuming user is not admin for this check.`
        );
    });

    it('should return false if context is invalid', async () => {
        expect(await adminChecker(null, mockBotTelegram)).toBe(false);
        expect(await adminChecker({}, mockBotTelegram)).toBe(false);
        expect(await adminChecker({ chat: {} }, mockBotTelegram)).toBe(false);
        expect(mockLoggerLog).toHaveBeenCalledWith('adminChecker: Invalid context received.', expect.anything());
    });
});

describe('instructions', () => {
    it('should send the instructions message', async () => {
        await instructions('chat123', mockBotTelegram);
        expect(mockBotTelegram.sendMessage).toHaveBeenCalledWith('chat123', expect.any(String));
        expect(mockLoggerLog).toHaveBeenCalledWith('Sent instructions message to chat chat123');
    });

    it('should log an error if sendMessage fails', async () => {
        mockBotTelegram.sendMessage.mockRejectedValue(new Error('Send failed'));
        await instructions('chat123', mockBotTelegram);
        expect(mockLoggerLog).toHaveBeenCalledWith(
            'Failed to send instructions message to chat chat123',
            expect.any(Error)
        );
    });
});

describe('successSend', () => {
    it('should call lastAyaTimeDbFn with correct parameters for private chat', async () => {
        mockCtx.chat.type = 'private';
        mockCtx.chat.first_name = 'PrivateUserName';
        await successSend(mockCtx, 123, 'en', 'testTrigger', mockLastAyaTimeDbFn);
        expect(mockLastAyaTimeDbFn).toHaveBeenCalledWith(
            'testChatId',
            'success',
            'PrivateUserName',
            'private',
            'en',
            'testTrigger'
        );
        expect(mockLoggerLog).toHaveBeenCalledWith(
            'Successfully sent Aya 123 to chat testChatId (PrivateUserName). Trigger: testTrigger'
        );
    });

    it('should call lastAyaTimeDbFn with title for group chat', async () => {
        mockCtx.chat.type = 'group';
        mockCtx.chat.title = 'GroupTitle';
        await successSend(mockCtx, 123, 'ar', 'timer', mockLastAyaTimeDbFn);
        expect(mockLastAyaTimeDbFn).toHaveBeenCalledWith('testChatId', 'success', 'GroupTitle', 'group', 'ar', 'timer');
    });

    it('should log error if lastAyaTimeDbFn fails', async () => {
        mockLastAyaTimeDbFn.mockRejectedValue(new Error('DB update failed'));
        await successSend(mockCtx, 123, 'en', 'test', mockLastAyaTimeDbFn);
        expect(mockLoggerLog).toHaveBeenCalledWith('Error in successSend for chat testChatId:', expect.any(Error));
    });
});

describe('sendSorry', () => {
    it('should send "audio" sorry message', async () => {
        await sendSorry(mockBotTelegram, 'chatId', 'audio');
        expect(mockBotTelegram.sendMessage).toHaveBeenCalledWith(
            'chatId',
            expect.stringContaining("Sorry.. There's an issue in audio files"),
            { disable_notification: true }
        );
    });
    it('should send "text" sorry message', async () => {
        await sendSorry(mockBotTelegram, 'chatId', 'text');
        expect(mockBotTelegram.sendMessage).toHaveBeenCalledWith(
            'chatId',
            expect.stringContaining("Sorry.. There's an issue in Aya texts"),
            { disable_notification: true }
        );
    });
    it('should send "unknown" sorry message for other reasons', async () => {
        await sendSorry(mockBotTelegram, 'chatId', 'some_other_reason');
        expect(mockBotTelegram.sendMessage).toHaveBeenCalledWith(
            'chatId',
            expect.stringContaining('Sorry.. An unknown issue happened'),
            { disable_notification: true }
        );
    });
    it('should log error if sendMessage fails', async () => {
        mockBotTelegram.sendMessage.mockRejectedValue(new Error('Send failed'));
        await sendSorry(mockBotTelegram, 'chatId', 'audio');
        expect(mockLoggerLog).toHaveBeenCalledWith('Failed to send sorry message to chatId:', expect.any(Error));
    });
});

// More tests for aMenuButtons, sendUnrecognizedMessage, helperAdminProtectedAction, helperAdminConditionalAction
// will be added in subsequent steps.

describe('aMenuButtons', () => {
    it('should return basic menu for t0 state', () => {
        const buttons = aMenuButtons('t0', 1, 'reciter1', 'TestBot', mockAyaId2suraAyaFn);
        expect(buttons.inline_keyboard[0]).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ text: '···' }),
                expect.objectContaining({ text: '🔊' }),
                expect.objectContaining({ text: '▼' }),
            ])
        );
        expect(JSON.parse(buttons.inline_keyboard[0][0].callback_data)).toEqual({ aMenu: 't0', a: 1, r: 'reciter1' });
    });

    it('should include report, tafsir, and set reciter buttons for r1 state', () => {
        mockAyaId2suraAyaFn.mockReturnValue({ sura: 2, aya: 255 });
        const buttons = aMenuButtons('r1', 262, 'reciter2', 'TestBot', mockAyaId2suraAyaFn);
        expect(buttons.inline_keyboard[0]).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ text: '•••' }),
                expect.objectContaining({ text: '⚠️' }), // Report
                expect.objectContaining({ text: '🗣️' }), // Set reciter
                expect.objectContaining({ text: '📖' }), // Tafsir
                expect.objectContaining({ text: '▼' }),
            ])
        );
        // Check for key components of the URL instead of exact encoding
        expect(buttons.inline_keyboard[0][1].url).toContain('https://sherbeeny.t.me');
        expect(buttons.inline_keyboard[0][1].url).toContain('Please');
        expect(buttons.inline_keyboard[0][1].url).toContain('revise');
        expect(buttons.inline_keyboard[0][1].url).toContain('Aya%202%3A255'); // Correctly URL encoded colon
        expect(JSON.parse(buttons.inline_keyboard[0][2].callback_data)).toEqual({ setReciter: 'reciter2', a: 262 });
    });

    it('should use fallback botUsername if not provided and log warning', () => {
        aMenuButtons('t0', 1, 'reciter1', null, mockAyaId2suraAyaFn);
        expect(mockLoggerLog).toHaveBeenCalledWith(
            'aMenuButtons: botUsername is not set. Using default.',
            expect.any(Error)
        );
        // Check if a button using botUsername was created with fallback (e.g. report button)
        mockAyaId2suraAyaFn.mockReturnValue({ sura: 2, aya: 255 });
        const buttons = aMenuButtons('r1', 262, 'reciter2', undefined, mockAyaId2suraAyaFn);
        expect(buttons.inline_keyboard[0][1].url).toContain('https://sherbeeny.t.me'); // Corrected domain
    });
});

describe('sendUnrecognizedMessage', () => {
    beforeEach(() => {
        // Reset adminChecker mock for each test
        mockBotTelegram.getChatMember.mockClear();
        // Reset sendMessage mock
        mockBotTelegram.sendMessage.mockClear();
    });

    it('should send reason 1 message if user is admin', async () => {
        mockBotTelegram.getChatMember.mockResolvedValue({ status: 'administrator' }); // User is admin
        await sendUnrecognizedMessage(mockCtx, 1, mockBotTelegram);
        expect(mockBotTelegram.sendMessage).toHaveBeenCalledWith(
            'testChatId',
            expect.stringContaining("couldn't recognize a Sura name"),
            expect.any(Object)
        );
    });

    it('should send reason 2 message if user is admin', async () => {
        mockBotTelegram.getChatMember.mockResolvedValue({ status: 'administrator' });
        await sendUnrecognizedMessage(mockCtx, 2, mockBotTelegram);
        expect(mockBotTelegram.sendMessage).toHaveBeenCalledWith(
            'testChatId',
            expect.stringContaining('Aya number is not in the requested Sura'),
            expect.any(Object)
        );
    });

    it('should send reason 3 message if user is admin', async () => {
        mockBotTelegram.getChatMember.mockResolvedValue({ status: 'administrator' });
        await sendUnrecognizedMessage(mockCtx, 3, mockBotTelegram);
        expect(mockBotTelegram.sendMessage).toHaveBeenCalledWith(
            'testChatId',
            expect.stringContaining('only recognize Sura names in Arabic or numbers'),
            expect.any(Object)
        );
    });

    it('should send default error message for other reasons if user is admin', async () => {
        mockBotTelegram.getChatMember.mockResolvedValue({ status: 'administrator' });
        await sendUnrecognizedMessage(mockCtx, 99, mockBotTelegram); // Unknown reason
        expect(mockBotTelegram.sendMessage).toHaveBeenCalledWith(
            'testChatId',
            expect.stringContaining('Unknown error!'),
            expect.any(Object)
        );
    });

    it('should not send message if user is not admin', async () => {
        mockCtx.chat.type = 'group'; // Ensure it's a group for admin check to matter
        mockBotTelegram.getChatMember.mockResolvedValue({ status: 'member' }); // User is not admin
        await sendUnrecognizedMessage(mockCtx, 1, mockBotTelegram);
        expect(mockBotTelegram.sendMessage).not.toHaveBeenCalled();
        expect(mockLoggerLog).toHaveBeenCalledWith(
            'Ignored unrecognized message from non-admin user testUserId in chat testChatId.'
        );
    });

    it('should log error if sendMessage fails', async () => {
        mockBotTelegram.getChatMember.mockResolvedValue({ status: 'administrator' });
        mockBotTelegram.sendMessage.mockRejectedValue(new Error('Send failed'));
        await sendUnrecognizedMessage(mockCtx, 1, mockBotTelegram);
        expect(mockLoggerLog).toHaveBeenCalledWith(
            'Failed to send reason of unrecognized request to chat testChatId',
            expect.any(Error)
        );
    });
});

describe('helperAdminProtectedAction', () => {
    let actionFn;
    beforeEach(() => {
        actionFn = jest.fn().mockResolvedValue(undefined);
        mockCtx.answerCbQuery.mockClear();
        mockBotTelegram.getChatMember.mockClear();
    });

    it('should execute actionFn and answer CbQuery if user is admin', async () => {
        mockBotTelegram.getChatMember.mockResolvedValue({ status: 'administrator' });
        await helperAdminProtectedAction(mockCtx, mockBotTelegram, actionFn);
        expect(actionFn).toHaveBeenCalledWith(mockCtx);
        expect(mockCtx.answerCbQuery).toHaveBeenCalledWith(); // Default answer
    });

    it('should not execute actionFn and alert if user is not admin (default alert)', async () => {
        mockCtx.chat.type = 'group';
        mockBotTelegram.getChatMember.mockResolvedValue({ status: 'member' });
        await helperAdminProtectedAction(mockCtx, mockBotTelegram, actionFn);
        expect(actionFn).not.toHaveBeenCalled();
        expect(mockCtx.answerCbQuery).toHaveBeenCalledWith(NON_ADMINS_ALERT_CONST, { show_alert: true });
    });

    it('should not execute actionFn and silently answer CbQuery if alertIfNotAdmin is false', async () => {
        mockCtx.chat.type = 'group';
        mockBotTelegram.getChatMember.mockResolvedValue({ status: 'member' });
        await helperAdminProtectedAction(mockCtx, mockBotTelegram, actionFn, false); // alertIfNotAdmin = false
        expect(actionFn).not.toHaveBeenCalled();
        expect(mockCtx.answerCbQuery).toHaveBeenCalledWith();
    });

    it('should answer CbQuery with error if actionFn throws', async () => {
        mockBotTelegram.getChatMember.mockResolvedValue({ status: 'administrator' });
        actionFn.mockRejectedValue(new Error('Action failed'));
        await helperAdminProtectedAction(mockCtx, mockBotTelegram, actionFn);
        expect(actionFn).toHaveBeenCalledWith(mockCtx);
        expect(mockCtx.answerCbQuery).toHaveBeenCalledWith('An error occurred.', { show_alert: true });
        expect(mockLoggerLog).toHaveBeenCalledWith(
            'Error in helperAdminProtectedAction executing actionFn:',
            expect.any(Error)
        );
    });
});

describe('helperAdminConditionalAction', () => {
    let adminFn, nonAdminCb;
    beforeEach(() => {
        adminFn = jest.fn().mockResolvedValue(undefined);
        nonAdminCb = jest.fn().mockResolvedValue('http://non.admin.url');
        mockCtx.answerCbQuery.mockClear();
        mockBotTelegram.getChatMember.mockClear();
    });

    it('should execute adminFn if user is admin', async () => {
        mockBotTelegram.getChatMember.mockResolvedValue({ status: 'administrator' });
        await helperAdminConditionalAction(mockCtx, mockBotTelegram, adminFn, nonAdminCb);
        expect(adminFn).toHaveBeenCalledWith(mockCtx);
        expect(nonAdminCb).not.toHaveBeenCalled();
        expect(mockCtx.answerCbQuery).toHaveBeenCalledWith();
    });

    it('should call nonAdminCb and answer CbQuery with URL if user is not admin', async () => {
        mockCtx.chat.type = 'group';
        mockBotTelegram.getChatMember.mockResolvedValue({ status: 'member' });
        await helperAdminConditionalAction(mockCtx, mockBotTelegram, adminFn, nonAdminCb);
        expect(adminFn).not.toHaveBeenCalled();
        expect(nonAdminCb).toHaveBeenCalledWith(mockCtx);
        expect(mockCtx.answerCbQuery).toHaveBeenCalledWith('', { url: 'http://non.admin.url' });
    });

    it('should use pre-calculated nonAdminUrl if provided for non-admin', async () => {
        mockCtx.chat.type = 'group';
        mockBotTelegram.getChatMember.mockResolvedValue({ status: 'member' });
        await helperAdminConditionalAction(mockCtx, mockBotTelegram, adminFn, null, false, 'http://pre.calculated.url');
        expect(adminFn).not.toHaveBeenCalled();
        expect(nonAdminCb).not.toHaveBeenCalled(); // nonAdminCb should not be called if nonAdminUrl is given
        expect(mockCtx.answerCbQuery).toHaveBeenCalledWith('', { url: 'http://pre.calculated.url' });
    });

    it('should show alert for non-admin if nonAdminAlert is true', async () => {
        mockCtx.chat.type = 'group';
        mockBotTelegram.getChatMember.mockResolvedValue({ status: 'member' });
        await helperAdminConditionalAction(mockCtx, mockBotTelegram, adminFn, nonAdminCb, true); // nonAdminAlert = true
        expect(mockCtx.answerCbQuery).toHaveBeenCalledWith(NON_ADMINS_ALERT_CONST, { url: 'http://non.admin.url' });
    });

    it('should answer CbQuery with alert if nonAdminCb returns null/undefined (non-admin)', async () => {
        mockCtx.chat.type = 'group';
        mockBotTelegram.getChatMember.mockResolvedValue({ status: 'member' });
        nonAdminCb.mockResolvedValue(null);
        await helperAdminConditionalAction(mockCtx, mockBotTelegram, adminFn, nonAdminCb, true);
        expect(mockCtx.answerCbQuery).toHaveBeenCalledWith(NON_ADMINS_ALERT_CONST, { show_alert: true });
    });

    it('should answer CbQuery with error if adminFn throws', async () => {
        mockBotTelegram.getChatMember.mockResolvedValue({ status: 'administrator' });
        adminFn.mockRejectedValue(new Error('Admin action failed'));
        await helperAdminConditionalAction(mockCtx, mockBotTelegram, adminFn, nonAdminCb);
        expect(adminFn).toHaveBeenCalledWith(mockCtx);
        expect(mockCtx.answerCbQuery).toHaveBeenCalledWith('An error occurred.', { show_alert: true });
        expect(mockLoggerLog).toHaveBeenCalledWith(
            'Error in helperAdminConditionalAction executing adminFn:',
            expect.any(Error)
        );
    });
});
