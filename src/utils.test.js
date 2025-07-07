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
        branch: 'test-branch',
        inst: 'test-inst',
        host: 'test-host',
        totalInst: '1',
        debugging: false,
        codeVer: 'test-v0.0.0',
        instActiveUntil: '2000-01-01',
        port: 3003,
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

// Declare variables for the functions to be tested
let toBoolean, randomAyaNumber, numArabicToEnglish;
let checkConnectivity;
// sendEmergencyNotification is also exported but tested implicitly or needs specific setup

beforeAll(async () => {
    jest.resetModules();
    const globalMockDefault = (await import('./__mocks__/config.mock.js')).default;
    currentConfigMock = { __esModule: true, default: globalMockDefault };

    const utilsModule = await import('./utils.js');
    toBoolean = utilsModule.toBoolean;
    randomAyaNumber = utilsModule.randomAyaNumber;
    numArabicToEnglish = utilsModule.numArabicToEnglish;
});

describe('Utils Tests', () => {
    beforeEach(() => {
        // For tests not in checkConnectivity describe block
    });

    describe('toBoolean', () => {
        it('should convert truthy strings to true', () => {
            expect(toBoolean('true')).toBe(true);
            expect(toBoolean('yes')).toBe(true);
            expect(toBoolean('1')).toBe(true);
            expect(toBoolean('on')).toBe(true);
            expect(toBoolean('anyrandomstring')).toBe(true);
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
            expect(toBoolean(-1)).toBe(true);
        });

        it('should convert objects correctly', () => {
            expect(toBoolean({})).toBe(false);
            expect(toBoolean({ a: 1 })).toBe(true);
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
        const testUrl = 'https://www.example.com';
        let mockDnsLookup;
        let mockNetSocketInstance;
        let mockNetSocketConstructor;

        beforeAll(async () => {
            jest.resetModules();

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

            jest.unstable_mockModule('dns', () => {
                return { lookup: mockDnsLookup };
            });
            jest.unstable_mockModule('net', () => {
                return { Socket: mockNetSocketConstructor };
            });

            // Re-mock config specifically for this scope if needed, though top-level should be fine
            // jest.unstable_mockModule('./config.js', () => ({ __esModule: true, default: currentConfigMock.default }));

            const utilsModule = await import('./utils.js');
            checkConnectivity = utilsModule.checkConnectivity;
        });

        beforeEach(() => {
            mockDnsLookup.mockReset();
            mockNetSocketConstructor.mockClear();

            mockNetSocketInstance.connect.mockReset().mockImplementation((port, ip, cb) => {
                if (cb && typeof cb === 'function') {
                    cb();
                }
            });
            mockNetSocketInstance.on.mockReset().mockImplementation(function (event, handler) {
                if (event === 'error') {
                    this._errorCb = handler;
                } else if (event === 'timeout') {
                    this._timeoutCb = handler;
                }
                return this;
            });
            mockNetSocketInstance.setTimeout.mockReset();
            mockNetSocketInstance.destroy.mockReset();
            mockNetSocketInstance._connectCb = null;
            mockNetSocketInstance._timeoutCb = null;
            mockNetSocketInstance._errorCb = null;
        });

        it('should return true if DNS lookup and TCP connection are successful on first attempt', async () => {
            mockDnsLookup.mockImplementation((hostname, callback) => {
                callback(null, '1.2.3.4');
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
            expect(mockDnsLookup).toHaveBeenCalledTimes(3);
            expect(mockNetSocketInstance.connect).not.toHaveBeenCalled();
        });

        it('should return false if TCP connection fails (error) on all attempts', async () => {
            mockDnsLookup.mockImplementation((hostname, callback) => {
                callback(null, '1.2.3.4');
            });

            mockNetSocketInstance.connect.mockImplementation((port, ip, connectCb) => {
                // Do NOT call connectCb()
            });

            mockNetSocketInstance.on.mockImplementation(function (event, handler) {
                if (event === 'error') {
                    setImmediate(() => handler(new Error('TCP Connection Error')));
                } else if (event === 'timeout') {
                    this._timeoutCb = () => {};
                }
                return this;
            });

            const result = await checkConnectivity(testUrl);
            expect(result).toBe(false);
            expect(mockDnsLookup).toHaveBeenCalledTimes(3);
            expect(mockNetSocketInstance.connect).toHaveBeenCalledTimes(3);
            expect(mockNetSocketInstance.destroy).toHaveBeenCalledTimes(3);
        });

        it('should return false if TCP connection times out on all attempts', async () => {
            mockDnsLookup.mockImplementation((hostname, callback) => {
                callback(null, '1.2.3.4');
            });

            mockNetSocketInstance.connect.mockImplementation((port, ip, connectCb) => {
                // Do NOT call connectCb()
            });

            mockNetSocketInstance.on.mockImplementation(function (event, handler) {
                if (event === 'timeout') {
                    setImmediate(() => handler());
                } else if (event === 'error') {
                    this._errorCb = () => {};
                }
                return this;
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

            // Default connect mock from beforeEach should work for success
            mockNetSocketInstance.on.mockImplementation((event, cb) => {
                // Simplified .on for success
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
