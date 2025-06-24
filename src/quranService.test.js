import axios from 'axios';
import {
    rasmifize, // Changed from normalizeArabicText
    getQuranData,
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
} from './quranService.js';
import config from './config.js'; // Needed for checkSource tests (devChatId)

// Mock axios at the top level
jest.mock('axios');

// Removed jest.mock('./config.js'); - will rely on env variables set by setup script

describe('Quran Service Tests', () => {
    // Removed describe block for 'normalizeArabicText'

    describe('Data Loading and Basic Accessors', () => {
        const quranData = getQuranData();

        it('getQuranData() should return expected structures', () => {
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
            expect(result.arText).toContain('سُورَةُ البَقَرَةِ؜ ٢٥٥'.replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d])); // Check Sura name and Aya number in Arabic numerals

            expect(result.enText).toContain(
                'Allah! La ilaha illa Huwa (none has the right to be worshipped but He), the Ever Living, the One Who sustains and protects all that exists.'
            );
            expect(result.enText).toContain(`href="t.me/${botUsername}?start=2-255"`);
            expect(result.enText).toContain('Sura Al-Baqara, Aya 255');
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
            axios.head.mockReset();
        });

        it('should return true for a successful HEAD request (status 200-299)', async () => {
            axios.head.mockResolvedValue({ status: 200 });
            const isAvailable = await audioUrlCheck('http://example.com/valid.mp3');
            expect(axios.head).toHaveBeenCalledWith('http://example.com/valid.mp3', { timeout: 5000 });
            expect(isAvailable).toBe(true);
        });

        it('should return false for a failed HEAD request (status not 200-299)', async () => {
            axios.head.mockResolvedValue({ status: 404 });
            const isAvailable = await audioUrlCheck('http://example.com/invalid.mp3');
            expect(isAvailable).toBe(false);
        });

        it('should return false if HEAD request throws an error', async () => {
            axios.head.mockRejectedValue(new Error('Network error'));
            const isAvailable = await audioUrlCheck('http://example.com/error.mp3');
            expect(isAvailable).toBe(false);
        });
    });

    describe('audioPicker', () => {
        beforeEach(() => {
            axios.head.mockReset();
        });

        it('should pick the first available URL', async () => {
            axios.head
                .mockResolvedValueOnce({ status: 404 }) // URL1 fails
                .mockResolvedValueOnce({ status: 200 }) // URL2 succeeds
                .mockResolvedValueOnce({ status: 200 }); // URL3 (not called)

            const urls = ['http://fail.mp3', 'http://success.mp3', 'http://alsosuccess.mp3'];
            const pickedUrl = await audioPicker(urls);
            expect(pickedUrl).toBe('http://success.mp3');
            expect(axios.head).toHaveBeenCalledTimes(2);
            expect(axios.head).toHaveBeenCalledWith('http://fail.mp3', { timeout: 5000 });
            expect(axios.head).toHaveBeenCalledWith('http://success.mp3', { timeout: 5000 });
        });

        it('should reject if all URLs fail', async () => {
            axios.head.mockResolvedValue({ status: 404 });
            const urls = ['http://fail1.mp3', 'http://fail2.mp3'];
            await expect(audioPicker(urls)).rejects.toMatch('All audio files are not available or array is empty.');
            expect(axios.head).toHaveBeenCalledTimes(2);
        });

        it('should reject for an empty URL array', async () => {
            await expect(audioPicker([])).rejects.toMatch('All audio files are not available or array is empty.');
            expect(axios.head).not.toHaveBeenCalled();
        });
    });

    describe('getRecitation', () => {
        beforeEach(() => {
            axios.get.mockReset();
            axios.head.mockReset();
            // Reset recitationTries if it's exposed or manage its state if it's internal
            // For this test, we assume it's internal and its effects are tested via retries
        });

        it('should fetch and return recitation URL for a valid reciter', async () => {
            const mockAudioUrl = 'http://example.com/audio.mp3';
            axios.get.mockResolvedValue({
                data: { data: { audio: mockAudioUrl, audioSecondary: [] } },
            });
            axios.head.mockResolvedValue({ status: 200 }); // For audioPicker -> audioUrlCheck

            const recitation = await getRecitation(262, 'ar.alafasy');
            expect(axios.get).toHaveBeenCalledWith('http://api.alquran.cloud/v1/ayah/262/ar.alafasy');
            expect(recitation).toBe(mockAudioUrl);
        });

        it('should use a random reciter if provided one is invalid', async () => {
            const mockAudioUrl = 'http://example.com/random_reciter.mp3';
            // Ensure getRandomReciterIdentifier() will be called and provide a reciter
            const quranData = getQuranData();
            const firstReciterId = quranData.arReciters[0]?.identifier || 'ar.default'; // Fallback if arReciters is empty

            axios.get.mockResolvedValue({
                data: { data: { audio: mockAudioUrl, audioSecondary: [] } },
            });
            axios.head.mockResolvedValue({ status: 200 });

            const recitation = await getRecitation(1, 'invalid.reciter');
            // Check if axios.get was called with *some* valid reciter from the list
            expect(axios.get).toHaveBeenCalledWith(expect.stringContaining(`http://api.alquran.cloud/v1/ayah/1/`));
            expect(quranData.arReciters.some((r) => axios.get.mock.calls[0][0].endsWith(r.identifier))).toBe(true);
            expect(recitation).toBe(mockAudioUrl);
        });

        it('should try secondary audio if primary fails', async () => {
            const primaryUrl = 'http://primary-fail.mp3';
            const secondaryUrl = 'http://secondary-success.mp3';
            axios.get.mockResolvedValue({
                data: { data: { audio: primaryUrl, audioSecondary: [secondaryUrl, 'http://another.mp3'] } },
            });
            axios.head
                .mockResolvedValueOnce({ status: 404 }) // Primary fails
                .mockResolvedValueOnce({ status: 200 }); // Secondary succeeds

            const recitation = await getRecitation(10, 'ar.alafasy');
            expect(recitation).toBe(secondaryUrl);
            expect(axios.head).toHaveBeenCalledWith(primaryUrl, { timeout: 5000 });
            expect(axios.head).toHaveBeenCalledWith(secondaryUrl, { timeout: 5000 });
        });

        it('should reject if API call fails and no retries are left (mocking internal retry state is hard without exposing it)', async () => {
            axios.get.mockRejectedValue(new Error('API Error'));
            // To test retry logic, we'd need to call it multiple times or expose/mock the retry counter.
            // For simplicity, testing a single failure. The internal retry logic in quranService.js handles this.
            // This test essentially checks that if all retries (internally) were to fail, it would reject.
            await expect(getRecitation(1, 'ar.alafasy')).rejects.toThrow('API error for 1/ar.alafasy: API Error');
        });

        it('should reject if all audio URLs (primary and secondary) are invalid', async () => {
            axios.get.mockResolvedValue({
                data: { data: { audio: 'http://fail1.mp3', audioSecondary: ['http://fail2.mp3'] } },
            });
            axios.head.mockResolvedValue({ status: 404 }); // All head calls fail

            await expect(getRecitation(1, 'ar.alafasy')).rejects.toMatch(
                'All audio files are not available or array is empty.'
            );
        });
    });

    describe('checkSource', () => {
        let mockBotSendMsg;

        beforeEach(() => {
            axios.get.mockReset();
            mockBotSendMsg = jest.fn(); // Mock the Telegram send message function
        });

        const quranData = getQuranData(); // Get actual local data for comparison

        it('should not call send message if remote data matches local', async () => {
            axios.get.mockImplementation((url) => {
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

            axios.get.mockImplementation((url) => {
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
                config.devChatId, // Uses the mocked config
                'Remote arQuran has changed. Please update the cached JSON file.'
            );
        });

        it('should call send message if enQuran remote data differs', async () => {
            const modifiedEnQuran = JSON.parse(JSON.stringify(quranData.enQuran));
            modifiedEnQuran[0].ayahs[0].text = 'Modified English Text';

            axios.get.mockImplementation((url) => {
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
                config.devChatId,
                'Remote enQuran has changed. Please update the cached JSON file.'
            );
        });

        it('should call send message if arReciters remote data differs', async () => {
            const modifiedArReciters = JSON.parse(JSON.stringify(quranData.arReciters));
            if (modifiedArReciters.length > 0) modifiedArReciters[0].name = 'New Reciter Name';
            else modifiedArReciters.push({ identifier: 'new.id', name: 'New Reciter', language: 'ar' });

            axios.get.mockImplementation((url) => {
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
                config.devChatId,
                'Remote arReciters has changed. Please update the cached JSON file.'
            );
        });

        it('should handle API errors gracefully during checkSource', async () => {
            axios.get.mockRejectedValue(new Error('API Network Error'));
            await checkSource(mockBotSendMsg);
            expect(mockBotSendMsg).not.toHaveBeenCalled(); // Should log error but not send Telegram message for API failure
        });
        it('should not call send message if devChatId is not configured', async () => {
            // Temporarily mock config to have no devChatId
            const originalConfig = jest.requireActual('./config.js').default;
            jest.spyOn(config, 'devChatId', 'get').mockReturnValueOnce(null);

            const modifiedArQuran = JSON.parse(JSON.stringify(quranData.arQuran));
            modifiedArQuran[0].ayahs[0].text = 'Modified Text';
            axios.get.mockResolvedValue({ data: { data: { surahs: modifiedArQuran } } }); // Only mock arQuran for this test

            await checkSource(mockBotSendMsg);
            expect(mockBotSendMsg).not.toHaveBeenCalled();

            // Restore if needed, or rely on jest.resetModules() if tests are isolated
            jest.restoreAllMocks(); // Or specific mock restore
        });
    });
});
