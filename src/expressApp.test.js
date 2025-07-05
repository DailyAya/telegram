import request from 'supertest';
import { jest } from '@jest/globals'; // Explicitly import jest
// import app from './expressApp.js'; // Import will be dynamic

// Config mock removed - will be handled by moduleNameMapper in jest.config.mjs
// jest.unstable_mockModule('./config.js', () => ({ ... }));

// Mock logger using unstable_mockModule
const mockLoggerFn = jest.fn();
const mockBootstrapLoggerFn = jest.fn();
jest.unstable_mockModule('./logger.js', () => ({
    __esModule: true,
    logger: mockLoggerFn,
    bootstrapLogger: mockBootstrapLoggerFn,
}));

describe('Express App Tests', () => {
    let app;

    // Import app once for tests that use the global mock config
    beforeAll(async () => {
        app = (await import('./expressApp.js')).default;
    });

    describe('GET /', () => {
        it('should return the instance state message with status 200 and expected content from global mock', async () => {
            // This test will now use the config from src/__mocks__/config.mock.js
            const response = await request(app).get('/');

            expect(response.status).toBe(200);
            expect(response.type).toMatch(/text\/html/); // Or text/plain if that's what it sends

            // Check for specific parts of the message based on the global mock config
            expect(response.text).toContain(
                'DailyAyaTelegram global-mock-branch instance global-mock-inst@global-mock-host'
            );
            expect(response.text).toContain('(of total 1)'); // global mock has totalInst: '1'
            expect(response.text).toContain('normal mode of version global-mock-v1.0.0 until 2099-12-31');

            // Check for dynamic parts (Memory Used, Uptime) - just their presence
            expect(response.text).toMatch(/Memory Used: \d+ MB/);
            expect(response.text).toMatch(/Uptime: \d+(\.\d+)? hours/);
        });

        it('should return status 200 and debugging mode message when config.debugging is true', async () => {
            await jest.isolateModules(async () => {
                const mockDebugConfig = {
                    telegramToken: 'MOCK_TELEGRAM_TOKEN_DEBUG', // Must be valid
                    devChatId: 'MOCK_DEV_CHAT_ID_DEBUG', // Must be valid
                    mongoDbCredentials: 'debug-creds',
                    mongoSubdomain: 'debug-sub.mongodb.net',
                    mongoURI: 'mongodb+srv://debug-creds@debug-sub.mongodb.net/?retryWrites=true&w=majority',
                    branch: 'debug-branch',
                    inst: 'debug-inst',
                    host: 'debug-host',
                    totalInst: '1',
                    debugging: true, // Key change for this test
                    codeVer: 'v-debug',
                    instActiveUntil: 'debug-active',
                    port: 3003,
                    timerCheckMinutes: 60,
                    timerSendHours: 24,
                    pingTargetGeneral: 'http://debug.example.com',
                    pingTargetAlternative: 'http://debug.example.org',
                    pingTargetTelegramApiBase: 'http://debug.api.telegram.org',
                    botLaunchRetryDelay: 1000,
                    maxBotLaunchRetries: 1,
                };
                jest.doMock('./config.js', () => ({
                    __esModule: true,
                    default: mockDebugConfig,
                }));

                const appWithDebugConfig = (await import('./expressApp.js')).default;
                const response = await request(appWithDebugConfig).get('/');

                expect(response.status).toBe(200);
                expect(response.text).toContain('DailyAyaTelegram debug-branch instance debug-inst@debug-host');
                expect(response.text).toContain('debugging mode of version v-debug until debug-active');
            });
        });
    });

    // Test for error handling in the route (if getInstStateMsg were to throw an error)
    // This requires being able to make getInstStateMsg throw an error.
    // Since getInstStateMsg is internal to expressApp.js and not easily mockable from here
    // without refactoring expressApp.js, this test is more complex.
    // For now, we assume getInstStateMsg is robust or its config dependencies are handled.
    // If it could fail (e.g., process.memoryUsage() fails), that would be an integration concern.

    // describe('GET / - Error Handling', () => {
    //     it('should return 500 if getInstStateMsg fails', async () => {
    //         // Need a way to make getInstStateMsg throw an error.
    //         // This might involve deeper mocking or specific setup.
    //         // For example, if config was structured to be problematic.
    //         jest.mock('./config.js', () => ({ /* ... problematic config ... */ }));
    //         const appWithBadConfig = require('./expressApp.js').default; // Re-import
    //         const response = await request(appWithBadConfig).get('/');
    //         expect(response.status).toBe(500);
    //         expect(response.text).toBe('Error generating instance status.');
    //     });
    // });
});
