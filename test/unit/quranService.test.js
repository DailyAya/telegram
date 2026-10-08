import { jest } from '@jest/globals'; // Explicitly import jest

// --- Manage config.js mock manually ---
// config.js is imported by quranService.js as '../../src/config.js'
let currentConfigMock = {
    __esModule: true,
    default: {
        // Minimal valid config to prevent errors
        telegramToken: 'QURAN_TEST_INITIAL_TOKEN',
        devChatId: 'QURAN_TEST_INITIAL_DEV_CHAT_ID',
        mongoDbCredentials: 'test-user:test-pass',
        mongoSubdomain: 'test-cluster.mongodb.net',
        mongoURI: 'mongodb+srv://test-user:test-pass@test-cluster.mongodb.net/?retryWrites=true&w=majority',
        branch: 'test-branch',
        inst: 'test-inst',
        host: 'test-host',
        totalInst: '1',
        debugging: false,
        codeVer: 'test-v0.0.0',
        instActiveUntil: '2000-01-01',
        port: 3004, // Different port
        timerCheckMinutes: 60,
        timerSendHours: 24,
        pingTargetGeneral: 'http://test.example.com',
        pingTargetAlternative: 'http://test.example.org',
        pingTargetTelegramApiBase: 'http://test.api.telegram.org',
        botLaunchRetryDelay: 1000,
        maxBotLaunchRetries: 1,
    },
};
jest.unstable_mockModule('../../src/config.js', () => {
    // Path relative to quranService.test.js
    console.log(
        `****** unstable_mockModule for ./config.js (quranService.test.js) using currentConfigMock (branch: ${currentConfigMock.default.branch}) ******`
    );
    return currentConfigMock;
});

// Declare variables for the functions to be tested
let rasmifize,
    actualGetQuranDataOriginal,
    normalizedSurasArNames,
    isValidReciter,
    getRandomReciterIdentifier,
    ayaId2suraAya,
    suraAya2ayaId,
    nextAya,
    prepareAya,
    getRecitation,
    audioUrlCheck,
    audioPicker,
    checkSource,
    __setApiClientForTest;

// Initialize API client mocks at module scope
const mockApiGet = jest.fn();
const mockApiHead = jest.fn();

beforeAll(async () => {
    jest.resetModules(); // Reset modules before setting config and importing SUT

    // Set currentConfigMock to use values from the global mock file
    // Path from src/quranService.test.js to src/__mocks__/config.mock.js is '../../src/__mocks__/config.mock.js'
    const globalMockDefault = (await import('../../src/__mocks__/config.mock.js')).default;
    currentConfigMock = { __esModule: true, default: globalMockDefault };
    console.log('****** Set currentConfigMock to GLOBAL MOCK values for quranService.test.js ******');

    // Dynamically import the module under test AFTER mocks are set up
    const quranServiceModule = await import('../../src/quranService.js');
    rasmifize = quranServiceModule.rasmifize;
    actualGetQuranDataOriginal = quranServiceModule.getQuranData; // This is fine
    normalizedSurasArNames = quranServiceModule.normalizedSurasArNames;
    isValidReciter = quranServiceModule.isValidReciter;
    getRandomReciterIdentifier = quranServiceModule.getRandomReciterIdentifier;
    ayaId2suraAya = quranServiceModule.ayaId2suraAya;
    suraAya2ayaId = quranServiceModule.suraAya2ayaId;
    nextAya = quranServiceModule.nextAya;
    prepareAya = quranServiceModule.prepareAya;
    getRecitation = quranServiceModule.getRecitation;
    audioUrlCheck = quranServiceModule.audioUrlCheck;
    audioPicker = quranServiceModule.audioPicker;
    checkSource = quranServiceModule.checkSource;
    __setApiClientForTest = quranServiceModule.__setApiClientForTest;

    // Set the mock apiClient using the already initialized mocks
    if (__setApiClientForTest) {
        __setApiClientForTest({
            get: mockApiGet,
            head: mockApiHead,
        });
    } else {
        console.error(
            'Warning: __setApiClientForTest was not available in the main beforeAll for quranService.test.js'
        );
    }
});

// import config from '../../src/config.js'; // REMOVED

// mockApiGet and mockApiHead are initialized at module scope.

describe('Quran Service Tests', () => {
    // No redundant beforeAll here.

    // beforeEach for resetting currentMockConfig is no longer needed as the mock is static.
    // If tests need to modify config behavior, they'd have to re-mock or use other techniques.

    // Removed describe block for 'normalizeArabicText'

    describe('Data Loading and Basic Accessors', () => {
        let quranData; // Declare here

        beforeAll(() => {
            // Initialize after dynamic imports are done
            if (typeof actualGetQuranDataOriginal !== 'function') {
                // This would indicate the dynamic import in the outer beforeAll failed.
                console.error(
                    "Error: actualGetQuranDataOriginal is not a function in 'Data Loading and Basic Accessors' beforeAll. Dynamic import might have failed."
                );
                // Potentially throw an error or ensure tests fail clearly.
                // For now, quranData will remain undefined, and tests will likely fail.
            } else {
                quranData = actualGetQuranDataOriginal();
            }
        });

        it('getQuranData() should return expected structures', () => {
            // Add a check for quranData to make test failure clearer if beforeAll had issues
            if (!quranData) throw new Error('quranData was not initialized. Check beforeAll for this describe block.');
            expect(quranData).toHaveProperty('arQuran');
            expect(quranData).toHaveProperty('enQuran');
            expect(quranData).toHaveProperty('arReciters');
            expect(Array.isArray(quranData.arQuran)).toBe(true);
            expect(Array.isArray(quranData.enQuran)).toBe(true);
            expect(Array.isArray(quranData.arReciters)).toBe(true);
            expect(quranData.arQuran.length).toBeGreaterThan(0); // Assuming JSONs are not empty
            expect(quranData.enQuran.length).toBeGreaterThan(0);
            expect(quranData.arReciters.length).toBeGreaterThan(0);
        });

        it('normalizedSurasArNames should be populated', () => {
            expect(Array.isArray(normalizedSurasArNames)).toBe(true);
            expect(normalizedSurasArNames.length).toBe(quranData.enQuran.length); // Should match number of suras
            // Example check (assuming first sura is Al-Fatiha)
            // The substr(8) in quranService removes "Surat " from the Sura name before normalization
            // "سُورَةُ ٱلْفَاتِحَةِ" -> "ٱلْفَاتِحَةِ" -> "الفاتحه"
            expect(normalizedSurasArNames[0]).toBe(rasmifize(quranData.enQuran[0].name.substr(8))); // Changed to rasmifize
        });

        it('isValidReciter should work correctly', () => {
            const validReciter = quranData.arReciters[0]?.identifier;
            if (validReciter) {
                expect(isValidReciter(validReciter)).toBe(true);
            }
            expect(isValidReciter('invalid.reciter.id')).toBe(false);
            expect(isValidReciter(undefined)).toBe(false);
        });

        it('getRandomReciterIdentifier should return a valid identifier', () => {
            const randomReciter = getRandomReciterIdentifier();
            if (quranData.arReciters.length > 0) {
                expect(randomReciter).not.toBeNull();
                expect(quranData.arReciters.some((r) => r.identifier === randomReciter)).toBe(true);
            } else {
                expect(randomReciter).toBeNull();
            }
        });
    });

    describe('Quranic Calculation Functions', () => {
        it('ayaId2suraAya should convert global Aya ID to Sura/Aya numbers', () => {
            expect(ayaId2suraAya(1)).toEqual({ sura: 1, aya: 1 }); // Al-Fatiha 1
            expect(ayaId2suraAya(7)).toEqual({ sura: 1, aya: 7 }); // Al-Fatiha 7
            expect(ayaId2suraAya(8)).toEqual({ sura: 2, aya: 1 }); // Al-Baqarah 1
            expect(ayaId2suraAya(262)).toEqual({ sura: 2, aya: 255 }); // Ayat al-Kursi
            expect(ayaId2suraAya(6236)).toEqual({ sura: 114, aya: 6 }); // An-Nas 6 (last aya)
            // Invalid IDs
            expect(ayaId2suraAya(0)).toEqual({ sura: 0, aya: 0 });
            expect(ayaId2suraAya(6237)).toEqual({ sura: 0, aya: 0 });
            expect(ayaId2suraAya(-10)).toEqual({ sura: 0, aya: 0 });
            expect(ayaId2suraAya(null)).toEqual({ sura: 0, aya: 0 });
            expect(ayaId2suraAya(undefined)).toEqual({ sura: 0, aya: 0 });
            expect(ayaId2suraAya('abc')).toEqual({ sura: 0, aya: 0 });
        });

        it('suraAya2ayaId should convert Sura/Aya numbers to global Aya ID', () => {
            expect(suraAya2ayaId({ sura: 1, aya: 1 })).toBe(1);
            expect(suraAya2ayaId({ sura: 1, aya: 7 })).toBe(7);
            expect(suraAya2ayaId({ sura: 2, aya: 1 })).toBe(8);
            expect(suraAya2ayaId({ sura: 2, aya: 255 })).toBe(262); // Ayat al-Kursi
            expect(suraAya2ayaId({ sura: 114, aya: 6 })).toBe(6236);
            // Invalid Sura/Aya
            expect(suraAya2ayaId({ sura: 0, aya: 1 })).toBe(-1); // Invalid Sura
            expect(suraAya2ayaId({ sura: 115, aya: 1 })).toBe(-1); // Invalid Sura
            expect(suraAya2ayaId({ sura: 1, aya: 0 })).toBe(0); // Valid Sura, invalid Aya
            expect(suraAya2ayaId({ sura: 1, aya: 8 })).toBe(0); // Valid Sura, invalid Aya (Al-Fatiha has 7)
            expect(suraAya2ayaId({ sura: 'abc', aya: 1 })).toBe(-2); // Invalid input type
            expect(suraAya2ayaId({})).toBe(-2);
            expect(suraAya2ayaId(null)).toBe(-2);
        });

        it('nextAya should return the next Aya ID', () => {
            expect(nextAya(1)).toBe(2);
            expect(nextAya(262)).toBe(263);
            expect(nextAya(6235)).toBe(6236);
            expect(nextAya(6236)).toBe(1); // Loop back from last Aya
            // Non-integer or invalid input handling (based on current implementation: adds 1)
            // Consider if strict type checking is desired here. For now, test existing behavior.
            expect(nextAya(null)).toBe(1); // null + 1 = 1
            expect(nextAya(undefined)).toBeNaN(); // undefined + 1 = NaN
        });
    });

    describe('prepareAya', () => {
        it('should produce correct Arabic and English text structure', () => {
            const botUsername = 'TestBot';
            // Test with Ayat al-Kursi (2:255, global ID 262)
            const result = prepareAya(262, botUsername);

            expect(result.arText).toContain('<b>ٱللَّهُ لَآ إِلَٰهَ إِلَّا هُوَ ٱلْحَىُّ ٱلْقَيُّومُ'); // Start of Ayat al-Kursi
            expect(result.arText).toContain(`href="t.me/${botUsername}?start=2-255"`);
            // Corrected expectation for the Sura name and Aya number part within the link
            expect(result.arText).toContain('البَقَرَةِ؜ ٢٥٥'.replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]));

            expect(result.enText).toContain(
                'Allah – there is no God except Him; He is Alive (eternally, on His own) and the Upholder' // Adjusted to match actual start of translation
            );
            expect(result.enText).toContain(`href="t.me/${botUsername}?start=2-255"`);
            // More precise check for the linked part including the interpretation wrapper
            expect(result.enText).toContain(
                `<i>{An interpretation of <a href="t.me/${botUsername}?start=2-255">"Al-Baqara: The Cow", Sura 2 Aya 255</a>}</i>`
            );
        });

        it('should handle missing botUsername gracefully (uses default)', () => {
            const result = prepareAya(1, null); // Al-Fatiha 1
            expect(result.arText).toContain(`href="t.me/DailyAyaBot?start=1-1"`); // Default username
            expect(result.enText).toContain(`href="t.me/DailyAyaBot?start=1-1"`);
        });

        it('should return error message for invalid ayaId', () => {
            const result = prepareAya(9999, 'TestBot');
            expect(result.arText).toBe('Error: Aya not found.');
            expect(result.enText).toBe('Error: Aya not found.');
        });
    });

    describe('audioUrlCheck', () => {
        beforeEach(() => {
            mockApiHead.mockReset();
        });

        it('should return true for a successful HEAD request (status 200-299)', async () => {
            mockApiHead.mockResolvedValue({ status: 200 });
            const isAvailable = await audioUrlCheck('http://example.com/valid.mp3');
            expect(mockApiHead).toHaveBeenCalledWith('http://example.com/valid.mp3', { timeout: 5000 });
            expect(isAvailable).toBe(true);
        });

        it('should return false for a failed HEAD request (status not 200-299)', async () => {
            mockApiHead.mockResolvedValue({ status: 404 });
            const isAvailable = await audioUrlCheck('http://example.com/invalid.mp3');
            expect(isAvailable).toBe(false);
        });

        it('should return false if HEAD request throws an error', async () => {
            mockApiHead.mockRejectedValue(new Error('Network error'));
            const isAvailable = await audioUrlCheck('http://example.com/error.mp3');
            expect(isAvailable).toBe(false);
        });
    });

    describe('audioPicker', () => {
        beforeEach(() => {
            mockApiHead.mockReset(); // audioUrlCheck uses mockApiHead, audioPicker calls audioUrlCheck
        });

        it('should pick the first available URL', async () => {
            mockApiHead // This is what audioUrlCheck will use
                .mockResolvedValueOnce({ status: 404 }) // URL1 fails
                .mockResolvedValueOnce({ status: 200 }) // URL2 succeeds
                .mockResolvedValueOnce({ status: 200 }); // URL3 (not called)

            const urls = ['http://fail.mp3', 'http://success.mp3', 'http://alsosuccess.mp3'];
            const pickedUrl = await audioPicker(urls);
            expect(pickedUrl).toBe('http://success.mp3');
            expect(mockApiHead).toHaveBeenCalledTimes(2);
            expect(mockApiHead).toHaveBeenCalledWith('http://fail.mp3', { timeout: 5000 });
            expect(mockApiHead).toHaveBeenCalledWith('http://success.mp3', { timeout: 5000 });
        });

        it('should reject if all URLs fail', async () => {
            mockApiHead.mockResolvedValue({ status: 404 });
            const urls = ['http://fail1.mp3', 'http://fail2.mp3'];
            await expect(audioPicker(urls)).rejects.toMatch('All audio files are not available or array is empty.');
            expect(mockApiHead).toHaveBeenCalledTimes(2);
        });

        it('should reject for an empty URL array', async () => {
            await expect(audioPicker([])).rejects.toMatch('All audio files are not available or array is empty.');
            expect(mockApiHead).not.toHaveBeenCalled();
        });
    });

    describe('getRecitation', () => {
        beforeEach(() => {
            // Ensure the mock client is freshly set for these tests
            __setApiClientForTest({
                get: mockApiGet,
                head: mockApiHead,
            });
            mockApiGet.mockReset();
            mockApiHead.mockReset();
            // Reset recitationTries if it's exposed or manage its state if it's internal
            // For this test, we assume it's internal and its effects are tested via retries
        });

        it('should reject with "Max retries" after 3 failed API calls', async () => {
            // mockApiGet is the global mock jest.fn() from the test file's scope.
            mockApiGet.mockReset();
            mockApiGet.mockRejectedValue(new Error('Simulated API Error'));

            await jest.isolateModulesAsync(async () => {
                const isolatedQuranService = await import('../../src/quranService.js');
                const freshGetRecitation = isolatedQuranService.getRecitation;
                const freshSetApiClientForTest = isolatedQuranService.__setApiClientForTest;

                // Set the API client for THIS isolated instance of quranService
                // mockApiHead is also from the global scope of the test file
                freshSetApiClientForTest({ get: mockApiGet, head: mockApiHead });

                const ayaId = 1;
                const reciter = 'ar.alafasy';

                // Call 1
                try {
                    await freshGetRecitation(ayaId, reciter);
                    // If it reaches here, the test should fail because an error was expected.
                    throw new Error('freshGetRecitation was expected to throw but did not.');
                } catch (e) {
                    expect(e).toBe(`API error for ${ayaId}/${reciter}: Simulated API Error`);
                }

                // Call 2 - Revert to .rejects.toThrow for subsequent calls for cleaner syntax if the first one passes.
                // Or keep try/catch for all if preferred for consistency. Let's try .rejects.toThrow.
                await expect(freshGetRecitation(ayaId, reciter)).rejects.toBe(
                    `API error for ${ayaId}/${reciter}: Simulated API Error`
                );

                // Call 3
                await expect(freshGetRecitation(ayaId, reciter)).rejects.toBe(
                    `API error for ${ayaId}/${reciter}: Simulated API Error`
                );

                expect(mockApiGet).toHaveBeenCalledTimes(3);

                // Call 4 - should now hit max retries
                await expect(freshGetRecitation(ayaId, reciter)).rejects.toBe(`Max retries for ${ayaId}/${reciter}`); // Changed to .toBe for string rejection

                // mockApiGet should still have been called 3 times, as the 4th freshGetRecitation call
                // should reject before making an API call due to the retry limit.
                expect(mockApiGet).toHaveBeenCalledTimes(3);
            });
        });

        it('should fetch and return recitation URL for a valid reciter', async () => {
            const mockAudioUrl = 'http://example.com/audio.mp3';
            mockApiGet.mockResolvedValue({
                // Use mockApiGet
                data: { data: { audio: mockAudioUrl, audioSecondary: [] } },
            });
            mockApiHead.mockResolvedValue({ status: 200 }); // For audioPicker -> audioUrlCheck

            const recitation = await getRecitation(262, 'ar.alafasy');
            expect(mockApiGet).toHaveBeenCalledWith('http://api.alquran.cloud/v1/ayah/262/ar.alafasy');
            expect(recitation).toBe(mockAudioUrl);
        });

        it('should use a random reciter if provided one is invalid', async () => {
            const mockAudioUrl = 'http://example.com/random_reciter.mp3';
            const quranData = actualGetQuranDataOriginal();
            // const firstReciterId = quranData.arReciters[0]?.identifier || 'ar.default'; // Unused variable

            mockApiGet.mockResolvedValue({
                // Use mockApiGet
                data: { data: { audio: mockAudioUrl, audioSecondary: [] } },
            });
            mockApiHead.mockResolvedValue({ status: 200 });

            const recitation = await getRecitation(1, 'invalid.reciter');
            expect(mockApiGet).toHaveBeenCalledWith(expect.stringContaining(`http://api.alquran.cloud/v1/ayah/1/`));
            expect(quranData.arReciters.some((r) => mockApiGet.mock.calls[0][0].endsWith(r.identifier))).toBe(true);
            expect(recitation).toBe(mockAudioUrl);
        });

        it('should try secondary audio if primary fails', async () => {
            const primaryUrl = 'http://primary-fail.mp3';
            const secondaryUrl = 'http://secondary-success.mp3';
            mockApiGet.mockResolvedValue({
                // Use mockApiGet
                data: { data: { audio: primaryUrl, audioSecondary: [secondaryUrl, 'http://another.mp3'] } },
            });
            mockApiHead // Use mockApiHead
                .mockResolvedValueOnce({ status: 404 }) // Primary fails
                .mockResolvedValueOnce({ status: 200 }); // Secondary succeeds

            const recitation = await getRecitation(10, 'ar.alafasy');
            expect(recitation).toBe(secondaryUrl);
            expect(mockApiHead).toHaveBeenCalledWith(primaryUrl, { timeout: 5000 });
            expect(mockApiHead).toHaveBeenCalledWith(secondaryUrl, { timeout: 5000 });
        });

        // This is the non-skipped duplicate that should be removed.
        // The .skip version is above.
        // it('should reject if API call fails and no retries are left (mocking internal retry state is hard without exposing it)', async () => {
        //     mockApiGet.mockImplementationOnce(() => Promise.reject(new Error('API Error'))); // More explicit rejection
        //     await expect(getRecitation(1, 'ar.alafasy')).rejects.toThrow('API error for 1/ar.alafasy: API Error');
        // });

        it('should reject if all audio URLs (primary and secondary) are invalid', async () => {
            mockApiGet.mockResolvedValue({
                // Use mockApiGet
                data: { data: { audio: 'http://fail1.mp3', audioSecondary: ['http://fail2.mp3'] } },
            });
            mockApiHead.mockResolvedValue({ status: 404 }); // All head calls fail using mockApiHead

            await expect(getRecitation(1, 'ar.alafasy')).rejects.toMatch(
                'All audio files are not available or array is empty.'
            );
        });
    });

    describe('checkSource', () => {
        let mockBotSendMsg;

        beforeEach(() => {
            mockApiGet.mockReset(); // Use mockApiGet
            mockBotSendMsg = jest.fn().mockResolvedValue({}); // Ensure it returns a promise for .catch()
        });

        let quranData; // Declare here
        beforeEach(() => {
            // Use beforeEach if quranData needs to be fresh for each test in this describe, or beforeAll if it can be shared
            if (typeof actualGetQuranDataOriginal === 'function') {
                quranData = actualGetQuranDataOriginal(); // Get actual local data for comparison
            } else {
                // This case should ideally not be hit if the outer beforeAll works.
                console.error(
                    "Error: actualGetQuranDataOriginal is not a function in 'checkSource' beforeEach. Dynamic import might have failed."
                );
                quranData = { arQuran: [], enQuran: [], arReciters: [] }; // Provide a default to prevent further crashes
            }
        });

        it('should not call send message if remote data matches local', async () => {
            mockApiGet.mockImplementation((url) => {
                // Use mockApiGet
                if (url.includes('quran-uthmani'))
                    return Promise.resolve({ data: { data: { surahs: quranData.arQuran } } });
                if (url.includes('en.ahmedraza'))
                    return Promise.resolve({ data: { data: { surahs: quranData.enQuran } } });
                if (url.includes('edition/format/audio'))
                    return Promise.resolve({ data: { data: quranData.arReciters } }); // Note: structure is different
                return Promise.reject(new Error('Unknown URL in mock'));
            });

            await checkSource(mockBotSendMsg);
            expect(mockBotSendMsg).not.toHaveBeenCalled();
        });

        it('should call send message if arQuran remote data differs', async () => {
            const modifiedArQuran = JSON.parse(JSON.stringify(quranData.arQuran)); // Deep clone
            modifiedArQuran[0].ayahs[0].text = 'Modified Text';

            mockApiGet.mockImplementation((url) => {
                // Use mockApiGet
                if (url.includes('quran-uthmani'))
                    return Promise.resolve({ data: { data: { surahs: modifiedArQuran } } });
                if (url.includes('en.ahmedraza'))
                    return Promise.resolve({ data: { data: { surahs: quranData.enQuran } } });
                if (url.includes('edition/format/audio'))
                    return Promise.resolve({ data: { data: quranData.arReciters } });
                return Promise.reject(new Error('Unknown URL'));
            });

            await checkSource(mockBotSendMsg);
            expect(mockBotSendMsg).toHaveBeenCalledWith(
                'GLOBAL_MOCK_DEV_CHAT_ID_CONFIG_FILE',
                'Remote arQuran has changed. Please update the cached JSON file.'
            );
        });

        it('should call send message if enQuran remote data differs', async () => {
            const modifiedEnQuran = JSON.parse(JSON.stringify(quranData.enQuran));
            modifiedEnQuran[0].ayahs[0].text = 'Modified English Text';

            mockApiGet.mockImplementation((url) => {
                // Use mockApiGet
                if (url.includes('quran-uthmani'))
                    return Promise.resolve({ data: { data: { surahs: quranData.arQuran } } });
                if (url.includes('en.ahmedraza'))
                    return Promise.resolve({ data: { data: { surahs: modifiedEnQuran } } });
                if (url.includes('edition/format/audio'))
                    return Promise.resolve({ data: { data: quranData.arReciters } });
                return Promise.reject(new Error('Unknown URL'));
            });

            await checkSource(mockBotSendMsg);
            expect(mockBotSendMsg).toHaveBeenCalledWith(
                'GLOBAL_MOCK_DEV_CHAT_ID_CONFIG_FILE',
                'Remote enQuran has changed. Please update the cached JSON file.'
            );
        });

        it('should call send message if arReciters remote data differs', async () => {
            const modifiedArReciters = JSON.parse(JSON.stringify(quranData.arReciters));
            if (modifiedArReciters.length > 0) modifiedArReciters[0].name = 'New Reciter Name';
            else modifiedArReciters.push({ identifier: 'new.id', name: 'New Reciter', language: 'ar' });

            mockApiGet.mockImplementation((url) => {
                // Use mockApiGet
                if (url.includes('quran-uthmani'))
                    return Promise.resolve({ data: { data: { surahs: quranData.arQuran } } });
                if (url.includes('en.ahmedraza'))
                    return Promise.resolve({ data: { data: { surahs: quranData.enQuran } } });
                // The transformResponse in checkSource expects response.data.data
                if (url.includes('edition/format/audio'))
                    return Promise.resolve({ data: { data: modifiedArReciters } });
                return Promise.reject(new Error('Unknown URL'));
            });

            await checkSource(mockBotSendMsg);
            expect(mockBotSendMsg).toHaveBeenCalledWith(
                'GLOBAL_MOCK_DEV_CHAT_ID_CONFIG_FILE',
                'Remote arReciters has changed. Please update the cached JSON file.'
            );
        });

        it('should handle API errors gracefully during checkSource', async () => {
            mockApiGet.mockRejectedValue(new Error('API Network Error')); // Use mockApiGet
            await checkSource(mockBotSendMsg);
            expect(mockBotSendMsg).not.toHaveBeenCalled(); // Should log error but not send Telegram message for API failure
        });
        // Removing this test for now as it requires dynamic changes to the statically mocked config,
        // or a more complex per-test mocking setup.
        // it('should not call send message if devChatId is not configured', async () => {
        //     // This test would require config.devChatId to be null in the mock.
        //     // The current static mock provides a devChatId.
        // });
    });
});
