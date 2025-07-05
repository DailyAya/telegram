import request from 'supertest';
import { jest } from '@jest/globals'; // Explicitly import jest
// import app from './expressApp.js'; // Import will be dynamic

// Default mock config values
let currentMockConfig = {
    telegramToken: 'MOCK_TELEGRAM_TOKEN_VALID',
    devChatId: 'MOCK_DEV_CHAT_ID_VALID',
    mongoDbCredentials: 'mockuser:mockpassword',
    mongoSubdomain: 'mockcluster.mongodb.net',
    mongoURI: 'mongodb+srv://mockuser:mockpassword@mockcluster.mongodb.net/?retryWrites=true&w=majority',
    branch: 'test-branch',
    inst: 'test-inst-01',
    host: 'test-host-server',
    totalInst: '2',
    debugging: false,
    codeVer: 'v1.2.3-test',
    instActiveUntil: '2099-12-31',
    port: 3000,
};

// Mock config.js using unstable_mockModule
jest.unstable_mockModule('./config.js', () => ({
    __esModule: true,
    default: currentMockConfig,
}));

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

    beforeEach(async () => {
        // Reset properties of currentMockConfig to default
        Object.assign(currentMockConfig, {
            telegramToken: 'MOCK_TELEGRAM_TOKEN_VALID',
            devChatId: 'MOCK_DEV_CHAT_ID_VALID',
            mongoDbCredentials: 'mockuser:mockpassword',
            mongoSubdomain: 'mockcluster.mongodb.net',
            mongoURI: 'mongodb+srv://mockuser:mockpassword@mockcluster.mongodb.net/?retryWrites=true&w=majority',
            branch: 'test-branch',
            inst: 'test-inst-01',
            host: 'test-host-server',
            totalInst: '2',
            debugging: false,
            codeVer: 'v1.2.3-test',
            instActiveUntil: '2099-12-31',
            port: 3000,
        });
        // Dynamically import app to get a fresh instance with current mock config
        // This app instance will be used by tests that don't need to change config mid-test
        app = (await import('./expressApp.js')).default;
    });

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
            const originalValues = { ...currentMockConfig }; // Deep copy for full restoration

            // Modify properties of the existing currentMockConfig object
            currentMockConfig.branch = 'debug-branch';
            currentMockConfig.inst = 'debug-inst';
            currentMockConfig.host = 'debug-host';
            currentMockConfig.totalInst = '1';
            currentMockConfig.debugging = true;
            currentMockConfig.codeVer = 'v-debug';
            currentMockConfig.instActiveUntil = 'debug-active';
            currentMockConfig.port = 3003;
            // Assuming critical token/chatId are part of currentMockConfig and don't need separate handling if restored fully

            // Use jest.isolateModules to ensure a fresh import of expressApp with the modified currentMockConfig
            await jest.isolateModules(async () => {
                // Override the config mock specifically for this isolated scope
                const mockDebugConfig = {
                    ...currentMockConfig, // Start with potentially already modified values if needed, or a clean default
                    branch: 'debug-branch',
                    inst: 'debug-inst',
                    host: 'debug-host',
                    totalInst: '1',
                    debugging: true,
                    codeVer: 'v-debug',
                    instActiveUntil: 'debug-active',
                    port: 3003,
                    // Ensure critical fields are present
                    telegramToken: currentMockConfig.telegramToken || 'MOCK_TELEGRAM_TOKEN_VALID_DEBUG',
                    devChatId: currentMockConfig.devChatId || 'MOCK_DEV_CHAT_ID_VALID_DEBUG',
                    mongoDbCredentials: currentMockConfig.mongoDbCredentials || 'mockuser:mockpassword',
                    mongoSubdomain: currentMockConfig.mongoSubdomain || 'mockcluster.mongodb.net',
                    mongoURI:
                        currentMockConfig.mongoURI ||
                        'mongodb+srv://mockuser:mockpassword@mockcluster.mongodb.net/?retryWrites=true&w=majority',
                };
                jest.doMock('./config.js', () => ({
                    // jest.doMock is hoisted within isolateModules
                    __esModule: true,
                    default: mockDebugConfig,
                }));

                const appWithDebugConfig = (await import('./expressApp.js')).default;
                const response = await request(appWithDebugConfig).get('/');
                expect(response.status).toBe(200);
                expect(response.text).toContain('DailyAyaTelegram debug-branch instance debug-inst@debug-host');
                expect(response.text).toContain('debugging mode of version v-debug until debug-active');
            });

            // Restore all original values to currentMockConfig
            Object.assign(currentMockConfig, originalValues);
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
