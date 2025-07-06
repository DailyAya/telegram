import { jest } from '@jest/globals'; // Explicit import for clarity

// --- Manage config.js mock manually ---
// config.js is imported by utils.js as './config.js'
let currentConfigMock = {
    __esModule: true,
    default: { // Minimal valid config to prevent errors during utils.js import
        telegramToken: 'UTILS_TEST_INITIAL_TOKEN',
        devChatId: 'UTILS_TEST_INITIAL_DEV_CHAT_ID',
        mongoDbCredentials: 'test-user:test-pass', // Required by config.js checks
        mongoSubdomain: 'test-cluster.mongodb.net', // Required by config.js checks
        mongoURI: 'mongodb+srv://test-user:test-pass@test-cluster.mongodb.net/?retryWrites=true&w=majority',
        // Add other fields utils.js might directly or indirectly access if any
        // For now, focusing on what config.js itself requires.
        // Other fields will use their defaults from the mock if not specified here.
        branch: 'test-branch',
        inst: 'test-inst',
        host: 'test-host',
        totalInst: '1',
        debugging: false,
        codeVer: 'test-v0.0.0',
        instActiveUntil: '2000-01-01',
        port: 3003, // Different from other test files to avoid potential conflicts if tests run in parallel in future
        timerCheckMinutes: 60,
        timerSendHours: 24,
        pingTargetGeneral: 'http://test.example.com',
        pingTargetAlternative: 'http://test.example.org',
        pingTargetTelegramApiBase: 'http://test.api.telegram.org',
        botLaunchRetryDelay: 1000,
        maxBotLaunchRetries: 1,
    },
};
jest.unstable_mockModule('./config.js', () => { // Path relative to utils.test.js
    console.log(`****** unstable_mockModule for ./config.js (utils.test.js) using currentConfigMock (branch: ${currentConfigMock.default.branch}) ******`);
    return currentConfigMock;
});


// Declare variables for the functions to be tested
let toBoolean, randomAyaNumber, numArabicToEnglish;
// checkConnectivity and sendEmergencyNotification are not tested here yet.

beforeAll(async () => {
    jest.resetModules(); // Reset modules before setting config and importing SUT

    // Set currentConfigMock to use values from the global mock file for consistency in tests
    // Path from src/utils.test.js to src/__mocks__/config.mock.js is './__mocks__/config.mock.js'
    const globalMockDefault = (await import('./__mocks__/config.mock.js')).default;
    currentConfigMock = { __esModule: true, default: globalMockDefault };
    console.log('****** Set currentConfigMock to GLOBAL MOCK values for utils.test.js ******');

    // Dynamically import the module under test AFTER mocks are set up
    const utilsModule = await import('./utils.js');
    toBoolean = utilsModule.toBoolean;
    randomAyaNumber = utilsModule.randomAyaNumber;
    numArabicToEnglish = utilsModule.numArabicToEnglish;
});

describe('Utils Tests', () => {
    describe('toBoolean', () => {
        it('should convert truthy strings to true', () => {
            expect(toBoolean('true')).toBe(true);
            expect(toBoolean('yes')).toBe(true);
            expect(toBoolean('1')).toBe(true);
            expect(toBoolean('on')).toBe(true);
            expect(toBoolean('anyrandomstring')).toBe(true); // Non-empty strings are truthy
        });

        it('should convert falsy strings to false', () => {
            expect(toBoolean('false')).toBe(false);
            expect(toBoolean('no')).toBe(false);
            expect(toBoolean('0')).toBe(false);
            expect(toBoolean('off')).toBe(false);
            expect(toBoolean('')).toBe(false);
        });

        it('should convert numbers correctly', () => {
            expect(toBoolean(1)).toBe(true);
            expect(toBoolean(0)).toBe(false);
            expect(toBoolean(-1)).toBe(true); // Non-zero numbers are truthy
        });

        it('should convert objects correctly', () => {
            expect(toBoolean({})).toBe(false); // Empty object
            expect(toBoolean({ a: 1 })).toBe(true); // Non-empty object
        });

        it('should handle null and undefined', () => {
            expect(toBoolean(null)).toBe(false);
            expect(toBoolean(undefined)).toBe(false);
        });

        it('should handle boolean inputs', () => {
            expect(toBoolean(true)).toBe(true);
            expect(toBoolean(false)).toBe(false);
        });
    });

    describe('randomAyaNumber', () => {
        it('should return a number between 1 and 6236', () => {
            for (let i = 0; i < 100; i++) {
                // Test multiple times for randomness
                const num = randomAyaNumber();
                expect(num).toBeGreaterThanOrEqual(1);
                expect(num).toBeLessThanOrEqual(6236);
            }
        });
    });

    describe('numArabicToEnglish', () => {
        it('should convert Arabic numerals to English numerals', () => {
            expect(numArabicToEnglish('٠١٢٣٤٥٦٧٨٩')).toBe('0123456789');
            expect(numArabicToEnglish('آية ١٢٣')).toBe('آية 123');
            expect(numArabicToEnglish('سورة ٢ آية ١٠')).toBe('سورة 2 آية 10');
        });

        it('should return the same string if no Arabic numerals', () => {
            expect(numArabicToEnglish('Aya 123')).toBe('Aya 123');
            expect(numArabicToEnglish('No numbers here!')).toBe('No numbers here!');
        });

        it('should handle mixed English and Arabic numerals', () => {
            expect(numArabicToEnglish('Test ١2٣ end')).toBe('Test 123 end');
        });

        it('should handle empty string', () => {
            expect(numArabicToEnglish('')).toBe('');
        });

        it('should handle non-string input by returning it', () => {
            expect(numArabicToEnglish(123)).toBe(123);
            expect(numArabicToEnglish(null)).toBe(null);
            expect(numArabicToEnglish(undefined)).toBe(undefined);
        });
    });
});
