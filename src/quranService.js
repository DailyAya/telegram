import axios from 'axios';
import rasmifize from 'rasmify.js';
import logger from './logger.js';
import config from './config.js';
import fs from 'fs';

// Create a global Axios instance with default timeout and User-Agent
const apiClient = axios.create({
    timeout: 15000, // 15-second default timeout
    headers: {
        'User-Agent': `DailyAyaBot/${config.codeVer || 'unknown_version'}`, // Construct a User-Agent
    },
});

// Allow apiClient to be replaced for testing
let currentApiClient = apiClient;

// Development/Test only export to allow overriding the apiClient
export function __setApiClientForTest(mockClient) {
    // Ensure this is only effective in test/dev environments for safety
    if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') {
        currentApiClient = mockClient;
    } else {
        console.warn('__setApiClientForTest should only be used in test/development environments.');
    }
}
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * @module quranService
 * @description Provides functions for accessing and processing Quranic data,
 * including text, translations, recitations, and metadata. It loads Quran data
 * from local JSON files and interacts with external APIs for audio and source checks.
 */

// Determine base path for loading JSON files
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadJsonData(filePath) {
    const absolutePath = path.resolve(__dirname, '..', filePath); // Goes one level up from src
    const fileContent = fs.readFileSync(absolutePath, 'utf8');
    return JSON.parse(fileContent);
}

// Load Quran data using fs
const arQuranData = loadJsonData('quran-uthmani.json');
const enQuranData = loadJsonData('en.ahmedraza.json');
const audioData = loadJsonData('audio.json');

/**
 * Arabic Quran surah data, loaded from JSON.
 * @private
 * @type {Array<object>}
 */
const arQuran = arQuranData.data.surahs;
/**
 * English translated Quran surah data, loaded from JSON.
 * @private
 * @type {Array<object>}
 */
const enQuran = enQuranData.data.surahs;
/**
 * List of Arabic reciters and their audio sources, loaded from JSON.
 * @private
 * @type {Array<object>}
 */
const arReciters = audioData.data.filter((i) => i.language === 'ar');

// --- Text Normalization ---
// rasmifize is imported from 'rasmify.js' and re-exported at the end of this module.

/**
 * An array of Sura names normalized using `rasmifize`.
 * This is used for matching Sura names from user input against the Quran data.
 * The Sura names are taken from the English Quran data (`enQuran`) and have "Surat " prefix removed before normalization.
 * @type {string[]}
 */
export const normalizedSurasArNames = enQuran.map((s) => rasmifize(s.name.substr(8)));

// --- Quranic Calculation and Data Retrieval Functions ---

/**
 * Converts a global Aya ID (1-6236) to its Sura number and Aya number within that Sura.
 * @function ayaId2suraAya
 * @param {number} ayaId - The global Aya ID (e.g., 262 for Ayat al-Kursi).
 * @returns {{sura: number, aya: number}} An object containing the Sura number (1-114)
 *                                         and Aya number within that Sura.
 *                                         Returns `{sura: 0, aya: 0}` if the `ayaId` is invalid or not found.
 * @example
 * // returns { sura: 2, aya: 255 }
 * ayaId2suraAya(262);
 */
export function ayaId2suraAya(ayaId) {
    let sura = 0,
        aya = 0;
    if (Number.isInteger(ayaId) && ayaId >= 1 && ayaId <= 6236) {
        const suraData = enQuran.find((s) => s.ayahs.find((a) => a.number === ayaId));
        if (suraData) {
            sura = suraData.number;
            const ayaData = suraData.ayahs.find((a) => a.number === ayaId);
            if (ayaData) {
                aya = ayaData.numberInSurah;
            }
        }
    }
    return { sura, aya };
}

/**
 * Converts Sura number and Aya number (within that Sura) to a global Aya ID.
 * @function suraAya2ayaId
 * @param {{sura: number, aya: number}} suraAya - An object containing the Sura number (1-114)
 *                                                 and Aya number within that Sura.
 * @returns {number} The global Aya ID (1-6236).
 *                   Returns `0` if the Sura is valid but the Aya number is not found within that Sura.
 *                   Returns `-1` if the Sura number is invalid (outside 1-114).
 *                   Returns `-2` if the input `suraAya` object is malformed or types are incorrect.
 * @example
 * // returns 262
 * suraAya2ayaId({ sura: 2, aya: 255 });
 */
export function suraAya2ayaId(suraAya) {
    if (!suraAya || typeof suraAya.sura !== 'number' || typeof suraAya.aya !== 'number') {
        return -2; // Invalid input type or structure
    }
    const { sura, aya } = suraAya;
    let ayaId;

    if (sura >= 1 && sura <= 114) {
        if (sura - 1 < enQuran.length && enQuran[sura - 1].ayahs) {
            const ayaData = enQuran[sura - 1].ayahs.find((a) => a.numberInSurah === aya);
            ayaId = ayaData ? ayaData.number : 0;
        } else {
            ayaId = 0;
        }
    } else {
        ayaId = -1;
    }
    return ayaId;
}

/**
 * Converts a number string to Arabic numerals.
 * @private
 * @function toArabicNumerals
 * @param {string|number} numberString - The number or string representation of a number.
 * @returns {string} The number string with Arabic numerals.
 */
function toArabicNumerals(numberString) {
    return numberString.toString().replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
}

/**
 * Prepares the Arabic and English text for a given Aya ID, including formatted links.
 * @function prepareAya
 * @param {number} ayaId - The global Aya ID.
 * @param {string} botUsername - The Telegram bot's username, used for generating t.me links.
 * @returns {{arText: string, enText: string}} An object containing the formatted Arabic and English texts.
 *                                            Returns error messages in `arText` and `enText` if Aya data is not found or incomplete.
 */
export function prepareAya(ayaId, botUsername) {
    if (!botUsername) {
        logger.log('prepareAya: botUsername is required for generating links.', new Error('botUsername missing'));
        botUsername = 'DailyAyaBot'; // Defaulting as a fallback
    }

    const { sura: suraNum, aya: ayaNum } = ayaId2suraAya(ayaId);

    if (suraNum === 0 || ayaNum === 0) {
        logger.log(`prepareAya: Could not find Sura/Aya for ayaId ${ayaId}`);
        return { arText: 'Error: Aya not found.', enText: 'Error: Aya not found.' };
    }

    const arAya = arQuran[suraNum - 1]?.ayahs[ayaNum - 1]?.text;
    const enTranslatedAya = enQuran[suraNum - 1]?.ayahs[ayaNum - 1]?.text;

    const arSuraName = enQuran[suraNum - 1]?.name.substr(8);
    const enSuraName = enQuran[suraNum - 1]?.englishName;
    const enSuraNameTranslation = enQuran[suraNum - 1]?.englishNameTranslation;

    if (!arAya || !enTranslatedAya || !arSuraName || !enSuraName || !enSuraNameTranslation) {
        logger.log(`prepareAya: Missing data for ayaId ${ayaId}, Sura ${suraNum}, Aya ${ayaNum}`);
        return { arText: 'Error: Aya data incomplete.', enText: 'Error: Aya data incomplete.' };
    }

    const arIndex = `﴿<a href="t.me/${botUsername}?start=${suraNum}-${ayaNum}">${arSuraName}؜ ${toArabicNumerals(ayaNum)}</a>﴾`;
    const enIndex = `<a href="t.me/${botUsername}?start=${suraNum}-${ayaNum}">"${enSuraName}: ${enSuraNameTranslation}", Sura ${suraNum} Aya ${ayaNum}</a>`;

    const arText = `<b>${arAya}</b>\n${arIndex}`;
    const enText = `${enTranslatedAya}\n<i>{An interpretation of ${enIndex}}</i>`;

    return { arText, enText };
}

/**
 * Checks if a given reciter identifier is valid based on the loaded reciter data.
 * @function isValidReciter
 * @param {string} reciterIdentifier - The identifier of the reciter (e.g., "ar.alafasy").
 * @returns {boolean} True if the reciter is valid, false otherwise.
 */
export function isValidReciter(reciterIdentifier) {
    return arReciters.some((reciter) => reciter.identifier === reciterIdentifier);
}

/**
 * Gets a random reciter identifier from the list of available Arabic reciters.
 * @function getRandomReciterIdentifier
 * @returns {string|null} A random reciter identifier, or null if no reciters are available.
 */
export function getRandomReciterIdentifier() {
    if (!arReciters || arReciters.length === 0) {
        logger.log('getRandomReciterIdentifier: No reciters available.', new Error('arReciters empty'));
        return null;
    }
    const randomIndex = Math.floor(Math.random() * arReciters.length);
    return arReciters[randomIndex].identifier;
}

/**
 * Calculates the next global Aya ID in sequence.
 * If the current Aya ID is the last one in the Quran, it loops back to the first Aya ID (1).
 * @function nextAya
 * @param {number} ayaId - The current global Aya ID.
 * @returns {number} The next global Aya ID.
 */
export function nextAya(ayaId) {
    const MAX_AYA_ID = 6236; // Total number of Ayas in the Quran
    return Number.isInteger(ayaId) && ayaId === MAX_AYA_ID ? 1 : ayaId + 1;
}

/**
 * Checks if an audio URL is accessible by making a HEAD request.
 * @async
 * @function audioUrlCheck
 * @param {string} url - The URL of the audio file to check.
 * @returns {Promise<boolean>} True if the URL is accessible (status 200-299), false otherwise.
 */
export async function audioUrlCheck(url) {
    try {
        const response = await currentApiClient.head(url, { timeout: 5000 }); // Use specific timeout for HEAD
        logger.log(`audioUrlCheck: HEAD request to ${url} status: ${response.status}`);
        return response.status >= 200 && response.status < 300;
    } catch (error) {
        logger.log(`audioUrlCheck: Failed HEAD request to ${url}`, error.message);
        return false;
    }
}

/**
 * Tries to find an accessible audio URL from a list of URLs.
 * It checks URLs one by one until an accessible one is found or the list is exhausted.
 * @async
 * @function audioPicker
 * @param {string[]} audioUrlArray - An array of audio URLs to check.
 * @param {number} [index=0] - The current index in the array to check (used for recursion).
 * @returns {Promise<string>} A promise that resolves to the first accessible audio URL.
 * @throws {string} If no accessible URL is found in the array.
 */
export async function audioPicker(audioUrlArray, index = 0) {
    if (!audioUrlArray || audioUrlArray.length === 0 || index >= audioUrlArray.length) {
        logger('audioPicker: No valid audio URL found or array exhausted.');
        return Promise.reject('All audio files are not available or array is empty.');
    }

    const currentUrl = audioUrlArray[index];
    logger(`audioPicker: Checking URL: ${currentUrl}`);

    try {
        const isAvailable = await audioUrlCheck(currentUrl);
        if (isAvailable) {
            logger(`audioPicker: URL available: ${currentUrl}`);
            return currentUrl;
        } else {
            logger(`audioPicker: URL not available, trying next: ${currentUrl}`);
            return audioPicker(audioUrlArray, index + 1);
        }
    } catch (error) {
        logger(`audioPicker: Error checking URL ${currentUrl}`, error);
        return audioPicker(audioUrlArray, index + 1); // Continue to next URL on error
    }
}

/**
 * @private
 * @type {Object<string, number>}
 * @description Keeps track of recitation fetch attempts for a given Aya and reciter combination.
 * Key is "ayaId/reciterIdentifier", value is the count of attempts.
 * This helps in implementing a retry mechanism with a maximum number of tries.
 */
let recitationTries = {};

/**
 * Fetches the recitation audio URL for a given Aya ID and reciter.
 * If the specified reciter is invalid, a random one is chosen.
 * Implements a retry mechanism (up to 3 tries) for fetching the audio URL.
 * @async
 * @function getRecitation
 * @param {number} ayaId - The global Aya ID.
 * @param {string} reciterIdentifier - The identifier for the reciter.
 * @returns {Promise<string>} A promise that resolves to the audio URL.
 * @throws {string|Error} If no valid reciter is available, max retries are exceeded,
 *                        the API returns no audio URLs, or an API error occurs.
 */
export async function getRecitation(ayaId, reciterIdentifier) {
    const chosenReciter = isValidReciter(reciterIdentifier) ? reciterIdentifier : getRandomReciterIdentifier();
    if (!chosenReciter) {
        logger(`getRecitation: No valid reciter could be determined for ayaId ${ayaId}.`);
        return Promise.reject('No valid reciter available.');
    }

    const tryKey = `${ayaId}/${chosenReciter}`;
    recitationTries[tryKey] = (recitationTries[tryKey] || 0) + 1;

    if (recitationTries[tryKey] > 3) {
        logger(`getRecitation: Max retries exceeded for ${tryKey}`);
        delete recitationTries[tryKey]; // Clean up after max retries
        return Promise.reject(`Max retries for ${tryKey}`);
    }

    logger(`getRecitation: Attempt ${recitationTries[tryKey]} for ${tryKey}`);

    try {
        const response = await currentApiClient.get(`http://api.alquran.cloud/v1/ayah/${ayaId}/${chosenReciter}`);
        delete recitationTries[tryKey]; // Reset tries on successful API call

        const allAudio = [response.data.data.audio].concat(response.data.data.audioSecondary || []);
        // Filter out null or empty string URLs before passing to audioPicker
        const validAudioUrls = allAudio.filter((url) => url && typeof url === 'string' && url.trim() !== '');

        if (validAudioUrls.length === 0) {
            logger(`getRecitation: No valid audio URLs returned from API for ${tryKey}. Response:`, response.data);
            return Promise.reject(`No valid audio URLs from API for ${tryKey}`);
        }
        return await audioPicker(validAudioUrls);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger(`getRecitation: API error for ${tryKey}`, errorMessage);
        // Note: Retry logic is primarily handled by subsequent calls if this attempt fails.
        // The `recitationTries` counter will increment on the next attempt for the same key.
        return Promise.reject(`API error for ${tryKey}: ${errorMessage}`);
    }
}

/**
 * Checks remote Quran data sources (Arabic text, English translation, reciters list)
 * against local JSON files and sends a notification via the provided Telegram send message function
 * if differences are found.
 * @async
 * @function checkSource
 * @param {function(string, string): Promise<any>} botTelegramSendMsgFunc - An async function to send a message
 *        via Telegram. It should accept `chatId` and `message` as arguments.
 */
export async function checkSource(botTelegramSendMsgFunc) {
    if (typeof botTelegramSendMsgFunc !== 'function') {
        logger.log(
            'checkSource: botTelegramSendMsgFunc is not a function. Cannot send update messages.',
            new Error('Invalid argument')
        );
        return;
    }

    const devChatId = config.devChatId;
    if (!devChatId) {
        logger.log('checkSource: devChatId is not configured. Cannot send update messages.');
        return;
    }

    const sources = [
        {
            name: 'arQuran',
            url: 'http://api.alquran.cloud/v1/quran/quran-uthmani',
            localData: arQuranData.data.surahs,
        },
        {
            name: 'enQuran',
            url: 'http://api.alquran.cloud/v1/quran/en.ahmedraza',
            localData: enQuranData.data.surahs,
        },
        {
            name: 'arReciters',
            url: 'http://api.alquran.cloud/edition/format/audio',
            localData: audioData.data.filter((i) => i.language === 'ar'),
            transformResponse: (response) => response.data.data.filter((i) => i.language === 'ar'),
        },
    ];

    for (const source of sources) {
        const downloadStart = Date.now();
        try {
            const response = await currentApiClient.get(source.url);
            const remoteData = source.transformResponse
                ? source.transformResponse(response)
                : response.data.data.surahs;

            if (JSON.stringify(remoteData) !== JSON.stringify(source.localData)) {
                const message = `Remote ${source.name} has changed. Please update the cached JSON file.`;
                logger.log(message);
                botTelegramSendMsgFunc(devChatId, message).catch((e) =>
                    logger.log(`checkSource: Error sending Telegram message for ${source.name}`, e)
                );
            } else {
                logger.log(
                    `Remote ${source.name} is the same as the cached JSON file. Checked in ${((Date.now() - downloadStart) / 1000).toFixed(2)} seconds.`
                );
            }
        } catch (error) {
            logger.log(`Error while checking ${source.name} cached vs remote:`, error.message);
        }
    }
}

/**
 * Provides access to the loaded Quran data.
 * @function getQuranData
 * @returns {{arQuran: Array<object>, enQuran: Array<object>, arReciters: Array<object>}} An object containing
 * the Arabic Quran text, English translation, and list of Arabic reciters.
 */
export function getQuranData() {
    return {
        arQuran,
        enQuran,
        arReciters,
    };
}

/**
 * Re-export of `rasmifize` function from `rasmify.js` library.
 * Used for normalizing Arabic text by removing diacritics and standardizing certain characters.
 * @function rasmifize
 * @param {string} text - The Arabic text to normalize.
 * @returns {string} The normalized Arabic text.
 */
export { rasmifize };
