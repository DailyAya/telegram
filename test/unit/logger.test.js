// src/logger.test.js
import { jest } from '@jest/globals';

// Mock config first
const mockConfig = {
    debugging: false,
    devChatId: 'dev-chat-id-123',
    telegramToken: 'mock-token', // for bootstrapLogger's sendEmergencyNotification
};
jest.unstable_mockModule('../../src/config.js', () => ({
    default: mockConfig,
}));

// Mock utils for sendEmergencyNotification
// Ensure it returns a promise to prevent .catch is not a function error
const mockSendEmergencyNotification = jest.fn().mockResolvedValue(undefined);
jest.unstable_mockModule('../../src/utils.js', () => ({
    sendEmergencyNotification: mockSendEmergencyNotification,
    // Add any other utils exports if logger starts using them, keeping it minimal for now
}));

describe('Logger Module', () => {
    let logger;
    let setBotInstance;
    let bootstrapLogger;
    let mockBotInstance;
    let consoleLogSpy;
    let consoleErrorSpy;
    let consoleWarnSpy;

    beforeEach(async () => {
        jest.resetModules(); // Ensure fresh modules for each test

        // Re-import config and utils mocks if necessary, or ensure they are applied correctly
        // Forcing re-evaluation of the config mock for each test if needed:
        jest.unstable_mockModule('../../src/config.js', () => ({ default: mockConfig }));
        jest.unstable_mockModule('../../src/utils.js', () => ({
            sendEmergencyNotification: mockSendEmergencyNotification,
        }));

        const loggerModule = await import('../../src/logger.js');
        logger = loggerModule.logger;
        setBotInstance = loggerModule.setBotInstance;
        bootstrapLogger = loggerModule.bootstrapLogger;

        mockBotInstance = {
            telegram: {
                sendMessage: jest.fn().mockResolvedValue(true),
            },
        };
        setBotInstance(mockBotInstance);

        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
        mockConfig.debugging = false; // Reset config changes
        mockSendEmergencyNotification.mockClear();
    });

    describe('logger', () => {
        it('should log informational messages to console if debugging is true', () => {
            mockConfig.debugging = true;
            logger('Info message');
            expect(consoleLogSpy).toHaveBeenCalledWith('Info message');
            expect(consoleErrorSpy).not.toHaveBeenCalled();
            expect(mockBotInstance.telegram.sendMessage).not.toHaveBeenCalled();
        });

        it('should not log informational messages to console if debugging is false', () => {
            mockConfig.debugging = false;
            logger('Info message');
            expect(consoleLogSpy).not.toHaveBeenCalled();
        });

        it('should log errors to console.error', () => {
            const error = new Error('Test error');
            logger('Error occurred', error);
            expect(consoleErrorSpy).toHaveBeenCalledWith('Error occurred', error);
        });

        it('should send non-benign errors to devChatId if botInstance and devChatId are set', () => {
            const error = new Error('Critical failure');
            logger('Real error', error);
            expect(mockBotInstance.telegram.sendMessage).toHaveBeenCalledWith(
                'dev-chat-id-123',
                // Match the message part and optionally the stack trace that follows
                expect.stringMatching(/Real error Error: Critical failure(\n\s+at\s.*)?$/s)
            );
        });

        it('should stringify non-Error objects for Telegram message', () => {
            const error = { customError: true, details: 'Some details' };
            logger('Object error', error);
            expect(mockBotInstance.telegram.sendMessage).toHaveBeenCalledWith(
                'dev-chat-id-123',
                expect.stringContaining('Object error {\n  "customError": true,\n  "details": "Some details"\n}')
            );
        });

        describe('Benign TelegramError Handling', () => {
            const benignErrorCases = [
                { code: 403, description: 'Forbidden: user is deactivated' },
                { code: 403, description: 'Forbidden: bot was blocked by the user' },
                { code: 400, description: 'Bad Request: chat not found' },
                { code: 403, description: 'Forbidden: bot was kicked from the group chat' },
            ];

            benignErrorCases.forEach(({ code, description }) => {
                it(`should treat TelegramError (${code}: ${description}) as benign, log to console if debugging, and not send to devChat`, () => {
                    mockConfig.debugging = true;
                    const telegramError = {
                        response: { error_code: code, description: description },
                        message: description, // often included
                        stack: `Error: ${description}\n at someplace`,
                    };
                    logger('Benign error scenario', telegramError);

                    expect(consoleLogSpy).toHaveBeenCalledWith(
                        expect.stringContaining(
                            `Logger: Benign Telegram error for message "Benign error scenario": ${description.toLowerCase()}`
                        ),
                        telegramError
                    );
                    expect(consoleErrorSpy).not.toHaveBeenCalled(); // Not logged as a standard error
                    expect(mockBotInstance.telegram.sendMessage).not.toHaveBeenCalled();
                });

                it(`should treat TelegramError (${code}: ${description}) as benign and not log to console if not debugging, and not send to devChat`, () => {
                    mockConfig.debugging = false;
                    const telegramError = {
                        response: { error_code: code, description: description },
                    };
                    logger('Benign error scenario', telegramError);

                    expect(consoleLogSpy).not.toHaveBeenCalled();
                    expect(consoleErrorSpy).not.toHaveBeenCalled();
                    expect(mockBotInstance.telegram.sendMessage).not.toHaveBeenCalled();
                });
            });

            it('should treat a non-benign TelegramError (e.g., 500) as a regular error', () => {
                const telegramError = {
                    response: { error_code: 500, description: 'Internal server error' },
                };
                logger('Server error', telegramError);

                expect(consoleErrorSpy).toHaveBeenCalledWith('Server error', telegramError);
                expect(mockBotInstance.telegram.sendMessage).toHaveBeenCalledWith(
                    'dev-chat-id-123',
                    expect.stringContaining('Server error')
                );
            });

            it('should treat a TelegramError with non-matching description as a regular error', () => {
                const telegramError = {
                    response: { error_code: 403, description: 'Forbidden: some other reason' },
                };
                logger('Other 403 error', telegramError);

                expect(consoleErrorSpy).toHaveBeenCalledWith('Other 403 error', telegramError);
                expect(mockBotInstance.telegram.sendMessage).toHaveBeenCalledWith(
                    'dev-chat-id-123',
                    expect.stringContaining('Other 403 error')
                );
            });
        });

        it('should warn if botInstance is not set when trying to log an error', () => {
            setBotInstance(null); // Remove bot instance
            const error = new Error('Test error');
            logger('Error without bot instance', error);
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                'Logger: Bot instance not set. Cannot send log to Telegram. Error details:',
                'Error without bot instance',
                error
            );
            expect(mockBotInstance.telegram.sendMessage).not.toHaveBeenCalled();
        });

        it('should warn if devChatId is not configured when trying to log an error', () => {
            mockConfig.devChatId = null;
            const error = new Error('Test error');
            logger('Error without devChatId', error);
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                'Logger: devChatId not configured. Cannot send log to Telegram. Error details:',
                'Error without devChatId',
                error
            );
            expect(mockBotInstance.telegram.sendMessage).not.toHaveBeenCalled();
        });
    });

    describe('bootstrapLogger', () => {
        it('should log informational messages to console.log with timestamp', () => {
            bootstrapLogger('Bootstrap info');
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringMatching(/\[.*\] Bootstrap info/));
        });

        it('should log error messages to console.error with timestamp', () => {
            const error = new Error('Bootstrap error');
            bootstrapLogger('Bootstrap failure', error);
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringMatching(/\[.*\] Bootstrap failure/),
                expect.stringContaining('Bootstrap error')
            );
        });

        it('should call sendEmergencyNotification for errors if devChatId and token are set', () => {
            mockConfig.devChatId = 'emergency-id';
            mockConfig.telegramToken = 'emergency-token';
            const error = new Error('Bootstrap emergency');
            bootstrapLogger('Critical bootstrap event', error);

            expect(mockSendEmergencyNotification).toHaveBeenCalledWith(
                expect.stringContaining('[BOOTSTRAP ERROR] Critical bootstrap event\nError: Bootstrap emergency')
            );
        });

        it('should not call sendEmergencyNotification if devChatId is not set', () => {
            mockConfig.devChatId = null;
            mockConfig.telegramToken = 'emergency-token';
            const error = new Error('Bootstrap no dev id');
            bootstrapLogger('Bootstrap event', error);
            expect(mockSendEmergencyNotification).not.toHaveBeenCalled();
        });

        it('should not call sendEmergencyNotification if telegramToken is not set', () => {
            mockConfig.devChatId = 'emergency-id';
            mockConfig.telegramToken = null;
            const error = new Error('Bootstrap no token');
            bootstrapLogger('Bootstrap event', error);
            expect(mockSendEmergencyNotification).not.toHaveBeenCalled();
        });
    });
});
