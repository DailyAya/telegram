// src/botFeatures/reciterService.js
import { logger } from '../logger.js';
import { getQuranData } from '../quranService.js'; // To get arReciters

/**
 * Cache for inline keyboard buttons for reciter selection.
 * Populated by {@link populateRecitersButtons}.
 * @private
 * @type {Array<Array<import('telegraf/typings/core/types/typegram').InlineKeyboardButton.CallbackButton>>}
 */
let recitersInlineButtonsCache = [];

/**
 * Populates the `recitersInlineButtonsCache` with buttons for each available Arabic reciter.
 * This function is intended to be called once at bot setup.
 * It fetches Quran data to access the list of Arabic reciters and logs the process.
 * @export
 * @function populateRecitersButtons
 */
export function populateRecitersButtons() {
    const quranData = getQuranData(); // Get data when needed
    if (!quranData.arReciters || quranData.arReciters.length === 0) {
        logger('populateRecitersButtons: No Arabic reciters loaded.', new Error('arReciters data missing'));
        recitersInlineButtonsCache = [];
        return;
    }
    recitersInlineButtonsCache = quranData.arReciters.map((reciter) => [
        {
            text: `${reciter.englishName} ${reciter.name}`,
            callback_data: JSON.stringify({ setReciter: reciter.identifier }),
        },
    ]);
    logger('Reciters buttons populated and cached.');
}

/**
 * Generates the navigation page markup for selecting Quran reciters.
 * It paginates the list of reciters stored in `recitersInlineButtonsCache`.
 * @export
 * @function recitersNavPage
 * @param {number} page - The desired page number to display (1-indexed).
 * @returns {Array<Array<object>>} An array of button rows suitable for Telegraf's inline keyboard markup.
 *                                  Includes navigation buttons (🎲, ＜, page/total, ＞).
 */
export function recitersNavPage(page) {
    const recitersPerPage = 5;
    if (!recitersInlineButtonsCache || recitersInlineButtonsCache.length === 0) {
        logger('recitersNavPage: recitersInlineButtonsCache is empty or not initialized.');
        return [
            [
                { text: `🎲`, callback_data: JSON.stringify({ setReciter: 'surprise' }) },
                { text: `＜`, callback_data: JSON.stringify({ recitersNavPage: 1 }) },
                { text: `1/1`, callback_data: JSON.stringify({ inactive: true }) },
                { text: `＞`, callback_data: JSON.stringify({ recitersNavPage: 1 }) },
            ],
        ];
    }

    const totalPages = Math.max(1, Math.ceil(recitersInlineButtonsCache.length / recitersPerPage));
    const currentPage = Math.min(Math.max(page, 1), totalPages);

    const buttonsSlice = recitersInlineButtonsCache.slice(
        (currentPage - 1) * recitersPerPage,
        currentPage * recitersPerPage
    );

    const navRow = [
        { text: `🎲`, callback_data: JSON.stringify({ setReciter: 'surprise' }) },
        {
            text: `＜`,
            callback_data: JSON.stringify({ recitersNavPage: currentPage > 1 ? currentPage - 1 : totalPages }),
        },
        { text: `${currentPage}/${totalPages}`, callback_data: JSON.stringify({ inactive: true }) },
        {
            text: `＞`,
            callback_data: JSON.stringify({ recitersNavPage: currentPage < totalPages ? currentPage + 1 : 1 }),
        },
    ];

    return [...buttonsSlice, navRow];
}
