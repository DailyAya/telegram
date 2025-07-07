import { jest } from '@jest/globals'; // Explicit import for clarity

// mockDnsLookup, mockNetSocketInstance, mockNetSocketConstructor will be defined
// within the 'checkConnectivity' describe block's beforeAll/beforeEach.

// --- Manage config.js mock manually ---
// config.js is imported by utils.js as './config.js'
let currentConfigMock = {
    __esModule: true,
    default: {
        // Minimal valid config to prevent errors during utils.js import
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
jest.unstable_mockModule('./config.js', () => {
    // Path relative to utils.test.js
    console.log(
        `****** unstable_mockModule for ./config.js (utils.test.js) using currentConfigMock (branch: ${currentConfigMock.default.branch}) ******`
    );
    return currentConfigMock;
});

// Declare variables for the functions to be tested
let toBoolean, randomAyaNumber, numArabicToEnglish;
let checkConnectivity; // To be assigned in its own describe block's beforeAll
// sendEmergencyNotification is also exported but tested implicitly or needs specific setup

beforeAll(async () => {
    // This beforeAll is now primarily for functions NOT requiring complex native module mocks
    jest.resetModules();

    // Set config mock for utils.js import (needed by all functions if config is top-level in utils.js)
    const globalMockDefault = (await import('./__mocks__/config.mock.js')).default;
    currentConfigMock = { __esModule: true, default: globalMockDefault };
    console.log('****** Set currentConfigMock to GLOBAL MOCK values for utils.test.js (top-level beforeAll) ******');

    // Import utils for functions not needing dns/net mocks
    const utilsModule = await import('./utils.js');
    toBoolean = utilsModule.toBoolean;
    randomAyaNumber = utilsModule.randomAyaNumber;
    numArabicToEnglish = utilsModule.numArabicToEnglish;
});

// All net and dns mocks are now at the top using jest.doMock.
// The redundant declarations and unstable_mockModule calls below were removed.

describe('Utils Tests', () => {
    // This beforeEach is now for tests OTHER than checkConnectivity,
    // or for mocks that are truly global to all util tests if any.
    beforeEach(() => {
        // mockDnsLookup and net mocks are handled by the checkConnectivity describe block's beforeEach
        // If config is modified by toBoolean etc., it should be reset here.
        // For now, assuming toBoolean, randomAyaNumber, numArabicToEnglish don't modify shared mocks.
    });

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

    describe('checkConnectivity', () => {
        // Skipping this entire describe block for now
        const testUrl = 'https://www.example.com';
        let mockDnsLookup;
        let mockNetSocketInstance;
        let mockNetSocketConstructor;

        beforeAll(async () => {
            jest.resetModules(); // Ensure a clean slate for module imports

            // Define mocks here, before they are used by jest.unstable_mockModule
            mockDnsLookup = jest.fn();
            mockNetSocketInstance = {
                connect: jest.fn(),
                on: jest.fn((event, cb) => {
                    if (event === 'connect') mockNetSocketInstance._connectCb = cb;
                    if (event === 'timeout') mockNetSocketInstance._timeoutCb = cb;
                    if (event === 'error') mockNetSocketInstance._errorCb = cb;
                    return mockNetSocketInstance;
                }),
                setTimeout: jest.fn(),
                destroy: jest.fn(),
                _connectCb: null,
                _timeoutCb: null,
                _errorCb: null,
            };
            mockNetSocketConstructor = jest.fn(() => mockNetSocketInstance);

            // Mock native modules before importing the SUT (utils.js)
            jest.unstable_mockModule('dns', () => ({
                __esModule: true,
                lookup: mockDnsLookup,
            }));
            jest.unstable_mockModule('net', () => ({
                __esModule: true,
                Socket: mockNetSocketConstructor,
            }));

            // Config is already mocked at the top level with unstable_mockModule,
            // and jest.resetModules() should not clear it if it's correctly handled by Jest for ESM.
            // If config needs to be re-asserted for this scope:
            // jest.unstable_mockModule('./config.js', () => ({ __esModule: true, default: currentConfigMock.default }));

            const utilsModule = await import('./utils.js');
            checkConnectivity = utilsModule.checkConnectivity;
        });

        // The existing beforeEach inside "Utils Tests" resets these mocks.
        // This is fine as they are re-defined in the beforeAll of this inner describe block.
        // Or, move the mock reset logic into a beforeEach specific to this describe block if preferred.
        beforeEach(() => {
            // Reset mocks defined in the outer scope if they were used by other tests,
            // or ensure mocks specific to this block are reset.
            mockDnsLookup.mockReset();
            mockNetSocketConstructor.mockClear();
            mockNetSocketInstance.connect.mockReset();
            mockNetSocketInstance.on.mockReset();
            mockNetSocketInstance.setTimeout.mockReset();
            mockNetSocketInstance.destroy.mockReset();
            mockNetSocketInstance._connectCb = null;
            mockNetSocketInstance._timeoutCb = null;
            mockNetSocketInstance._errorCb = null;
        });

        it('should return true if DNS lookup and TCP connection are successful on first attempt', async () => {
            mockDnsLookup.mockImplementation((hostname, callback) => callback(null, '1.2.3.4'));
            mockNetSocketInstance.connect.mockImplementation((port, ip, cb) => {
                cb(); // Simulate immediate successful connection for the connect callback
            });
            // Simulate the 'connect' event being emitted by the socket
            mockNetSocketInstance.on.mockImplementation((event, cb) => {
                if (event === 'connect') {
                    setImmediate(() => cb()); // Call the connect handler
                }
                return mockNetSocketInstance;
            });

            const result = await checkConnectivity(testUrl);
            expect(result).toBe(true);
            expect(mockDnsLookup).toHaveBeenCalledTimes(1);
            expect(mockNetSocketInstance.connect).toHaveBeenCalledTimes(1);
            expect(mockNetSocketInstance.destroy).toHaveBeenCalled();
        });

        it('should return false if DNS lookup fails on all attempts', async () => {
            mockDnsLookup.mockImplementation((hostname, callback) => callback(new Error('DNS Failed')));

            const result = await checkConnectivity(testUrl);
            expect(result).toBe(false);
            expect(mockDnsLookup).toHaveBeenCalledTimes(3); // Default 3 attempts
            expect(mockNetSocketInstance.connect).not.toHaveBeenCalled();
        });

        it('should return false if TCP connection fails (error) on all attempts', async () => {
            mockDnsLookup.mockImplementation((hostname, callback) => callback(null, '1.2.3.4'));
            mockNetSocketInstance.on.mockImplementation((event, cb) => {
                if (event === 'error') {
                    // Simulate error event being emitted for each connection attempt
                    setImmediate(() => cb(new Error('TCP Connection Error')));
                }
                return mockNetSocketInstance;
            });

            const result = await checkConnectivity(testUrl);
            expect(result).toBe(false);
            expect(mockDnsLookup).toHaveBeenCalledTimes(3); // DNS might be tried per outer loop attempt
            expect(mockNetSocketInstance.connect).toHaveBeenCalledTimes(3);
            expect(mockNetSocketInstance.destroy).toHaveBeenCalledTimes(3);
        });

        it('should return false if TCP connection times out on all attempts', async () => {
            mockDnsLookup.mockImplementation((hostname, callback) => callback(null, '1.2.3.4'));
            mockNetSocketInstance.on.mockImplementation((event, cb) => {
                if (event === 'timeout') {
                    setImmediate(() => cb()); // Simulate timeout event
                }
                return mockNetSocketInstance;
            });

            const result = await checkConnectivity(testUrl);
            expect(result).toBe(false);
            expect(mockDnsLookup).toHaveBeenCalledTimes(3);
            expect(mockNetSocketInstance.connect).toHaveBeenCalledTimes(3);
            expect(mockNetSocketInstance.destroy).toHaveBeenCalledTimes(3);
        });

        it('should return true if DNS fails then succeeds, and TCP succeeds', async () => {
            mockDnsLookup
                .mockImplementationOnce((hostname, callback) => callback(new Error('DNS Failed Attempt 1')))
                .mockImplementationOnce((hostname, callback) => callback(null, '1.2.3.4'));

            mockNetSocketInstance.on.mockImplementation((event, cb) => {
                if (event === 'connect') {
                    setImmediate(() => cb());
                }
                return mockNetSocketInstance;
            });

            const result = await checkConnectivity(testUrl);
            expect(result).toBe(true);
            expect(mockDnsLookup).toHaveBeenCalledTimes(2);
            expect(mockNetSocketInstance.connect).toHaveBeenCalledTimes(1);
        });

        it('should return false for an invalid URL (parsing failure)', async () => {
            const invalidUrl = 'htp:/invalid-url';
            const result = await checkConnectivity(invalidUrl);
            expect(result).toBe(false);
            expect(mockDnsLookup).not.toHaveBeenCalled();
        });
    });
});
