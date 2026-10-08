import request from 'supertest';
import { jest } from '@jest/globals'; // Explicitly import jest
// import app from '../../src/expressApp.js'; // Import will be dynamic

// Config mock removed - will be handled by moduleNameMapper in jest.config.mjs
// jest.unstable_mockModule('../../src/config.js', () => ({ ... }));

// Mock logger using unstable_mockModule
const mockLoggerFn = jest.fn();
const mockBootstrapLoggerFn = jest.fn();
jest.unstable_mockModule('../../src/logger.js', () => ({
    __esModule: true,
    logger: mockLoggerFn,
    bootstrapLogger: mockBootstrapLoggerFn,
}));

// Variable to hold the current config mock, changeable per test
let currentConfigMock = {
    __esModule: true,
    default: {
        /* initial minimal valid config */ telegramToken: 'INITIAL_MOCK_TOKEN',
        devChatId: 'INITIAL_MOCK_DEV_CHAT_ID',
        mongoDbCredentials: 'initial-user:initial-pass',
        mongoSubdomain: 'initial-cluster.mongodb.net',
        mongoURI: 'mongodb+srv://initial-user:initial-pass@initial-cluster.mongodb.net/?retryWrites=true&w=majority',
        branch: 'initial-branch',
        inst: 'initial-inst',
        host: 'initial-host',
        totalInst: '1',
        debugging: false,
        codeVer: 'initial-v0.0.0',
        instActiveUntil: '1999-01-01',
        port: 3000,
        timerCheckMinutes: 60,
        timerSendHours: 24,
        pingTargetGeneral: 'http://initial.example.com',
        pingTargetAlternative: 'http://initial.example.org',
        pingTargetTelegramApiBase: 'http://initial.api.telegram.org',
        botLaunchRetryDelay: 1000,
        maxBotLaunchRetries: 1,
    },
};

// unstable_mockModule's factory will return the content of currentConfigMock
jest.unstable_mockModule('../../src/config.js', () => {
    console.log(
        `****** unstable_mockModule for ./config.js using currentConfigMock (branch: ${currentConfigMock.default.branch}) ******`
    );
    return currentConfigMock;
});

describe('Express App Tests', () => {
    // `app` will be imported within each isolated test context

    describe('GET /', () => {
        it('should return the instance state message with status 200 and expected content from global mock', async () => {
            await jest.isolateModulesAsync(async () => {
                jest.resetModules(); // Crucial: reset module cache before setting new mock state

                // Set currentConfigMock to the global mock values
                const globalMockDefault = (await import('../../src/__mocks__/config.mock.js')).default;
                currentConfigMock = { __esModule: true, default: globalMockDefault };
                console.log('****** Set currentConfigMock to GLOBAL MOCK values (branch: global-mock-branch) ******');

                const app = (await import('../../src/expressApp.js')).default;
                const response = await request(app).get('/');

                expect(response.status).toBe(200);
                expect(response.type).toMatch(/text\/html/);

                expect(response.text).toContain(
                    'DailyAyaTelegram global-mock-branch instance global-mock-inst@global-mock-host'
                );
                expect(response.text).toContain('(of total 1)');
                expect(response.text).toContain('normal mode of version global-mock-v1.0.0 until 2099-12-31');
                expect(response.text).toMatch(/Memory Used: \d+ MB/);
                expect(response.text).toMatch(/Uptime: \d+(\.\d+)? hours/);
            });
        });

        it('should return status 200 and debugging mode message when config.debugging is true', async () => {
            await jest.isolateModulesAsync(async () => {
                jest.resetModules(); // Crucial: reset module cache before setting new mock state

                const mockDebugConfigData = {
                    telegramToken: 'MOCK_TELEGRAM_TOKEN_DEBUG',
                    devChatId: 'MOCK_DEV_CHAT_ID_DEBUG',
                    mongoDbCredentials: 'debug-creds',
                    mongoSubdomain: 'debug-sub.mongodb.net',
                    mongoURI: 'mongodb+srv://debug-creds@debug-sub.mongodb.net/?retryWrites=true&w=majority',
                    branch: 'debug-branch',
                    inst: 'debug-inst',
                    host: 'debug-host',
                    totalInst: '1',
                    debugging: true,
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

                // Set currentConfigMock to the debug config values
                currentConfigMock = { __esModule: true, default: mockDebugConfigData };
                console.log('****** Set currentConfigMock to DEBUG values (branch: debug-branch) ******');

                const app = (await import('../../src/expressApp.js')).default;
                const response = await request(app).get('/');

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
    //         jest.mock('../../src/config.js', () => ({ /* ... problematic config ... */ }));
    //         const appWithBadConfig = require('../../src/expressApp.js').default; // Re-import
    //         const response = await request(appWithBadConfig).get('/');
    //         expect(response.status).toBe(500);
    //         expect(response.text).toBe('Error generating instance status.');
    //     });
    // });
});
