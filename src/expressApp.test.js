import request from 'supertest';
import app from './expressApp.js'; // app is the default export

// Use global mock for config.js - this will apply src/__mocks__/config.js
jest.mock('./config.js');

// Mock logger to prevent actual logging during tests and allow assertions on logs if needed
jest.mock('./logger.js', () => ({
    __esModule: true,
    logger: jest.fn(),
    bootstrapLogger: jest.fn(),
}));

describe('Express App Tests', () => {
    describe('GET /', () => {
        it('should return the instance state message with status 200 and expected content', async () => {
            const response = await request(app).get('/');

            expect(response.status).toBe(200);
            expect(response.type).toMatch(/text\/html/); // Or text/plain if that's what it sends

            // Check for specific parts of the message based on the mocked config
            expect(response.text).toContain('DailyAyaTelegram test-branch instance test-inst-01@test-host-server');
            expect(response.text).toContain('(of total 2)');
            expect(response.text).toContain('normal mode of version v1.2.3-test until 2099-12-31');

            // Check for dynamic parts (Memory Used, Uptime) - just their presence
            expect(response.text).toMatch(/Memory Used: \d+ MB/);
            expect(response.text).toMatch(/Uptime: \d+(\.\d+)? hours/);
        });

        it('should return status 200 and debugging mode message when config.debugging is true', async () => {
            // Temporarily override the mock for this specific test
            // Note: jest.isolateModules will isolate the default mock from src/__mocks__/config.js as well.
            // This inline mock inside isolateModules will take precedence for this isolated scope.
            jest.isolateModules(async () => {
                const mockDebugConfig = {
                    branch: 'debug-branch',
                    inst: 'debug-inst',
                    host: 'debug-host',
                    totalInst: '1',
                    debugging: true, // Test with debugging true
                    codeVer: 'v-debug',
                    instActiveUntil: 'debug-active',
                    port: 3003,
                    // Ensure all critical fields from the global mock are present if expressApp needs them
                    telegramToken: 'MOCK_TELEGRAM_TOKEN_VALID',
                    devChatId: 'MOCK_DEV_CHAT_ID_VALID',
                    mongoDbCredentials: 'mockuser:mockpassword',
                    mongoSubdomain: 'mockcluster.mongodb.net',
                    mongoURI: 'mongodb+srv://mockuser:mockpassword@mockcluster.mongodb.net/?retryWrites=true&w=majority',
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
