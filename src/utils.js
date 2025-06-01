/**
 * @module utils
 * @description Provides utility functions for various common tasks such as type conversion,
 * random number generation, text manipulation, and network checks.
 */

import axios from 'axios';

/**
 * Converts a value to its boolean representation with extended string handling.
 * Strings like "true", "1", "yes", "on" are considered true.
 * Strings like "false", "0", "no", "off", "" (empty string) are considered false.
 * For objects, it checks if the object is non-null and has at least one enumerable property.
 * For other types, it uses the standard JavaScript boolean conversion.
 * @function toBoolean
 * @param {*} value - The value to convert to a boolean.
 * @returns {boolean} The boolean representation of the value.
 * @example
 * toBoolean("true"); // true
 * toBoolean("0");    // false
 * toBoolean({});     // false (empty object)
 * toBoolean({a:1});  // true (non-empty object)
 * toBoolean(null);   // false
 */
export function toBoolean(value) {
    if (typeof value === 'string') {
        value = value.toLowerCase();
        // Check against common falsy strings. Any other non-empty string is truthy by this logic.
        return value !== 'false' && value !== '0' && value !== 'no' && value !== 'off' && value !== '';
    }
    if (typeof value === 'number') {
        return value !== 0;
    }
    if (typeof value === 'object' && value !== null) {
        // Consider an object truthy if it has any own enumerable properties
        for (const i in value) {
            if (Object.prototype.hasOwnProperty.call(value, i)) {
                return true;
            }
        }
        return false;
    }
    // Standard boolean conversion for other types (undefined, boolean itself)
    return Boolean(value);
}

/**
 * Generates a random Aya ID.
 * The Quran has 6236 Ayas, so this function returns a number between 1 and 6236, inclusive.
 * @function randomAyaNumber
 * @returns {number} A random integer between 1 and 6236.
 */
export function randomAyaNumber() {
    const MAX_AYA_ID = 6236;
    return Math.floor(Math.random() * MAX_AYA_ID) + 1;
}

/**
 * Converts Arabic numerals (٠-٩) in a string to their English numeral equivalents (0-9).
 * If the input is not a string, it's returned unchanged.
 * @function numArabicToEnglish
 * @param {string|*} string - The input string potentially containing Arabic numerals.
 * @returns {string|*} The string with Arabic numerals converted to English numerals,
 *                     or the original input if it's not a string.
 * @example
 * numArabicToEnglish("سورة ١٢ آية ٣٤"); // "سورة 12 آية 34"
 */
export function numArabicToEnglish(string) {
    if (typeof string !== 'string') return string;
    return string.replace(/[٠-٩]/g, function (c) {
        return c.charCodeAt(0) - 0x0660;
    });
}

/**
 * Checks network connectivity to a given URL using a GET request.
 * @async
 * @function checkConnectivity
 * @param {string} url - The URL to check.
 * @param {number} [timeout=5000] - Timeout in milliseconds.
 * @returns {Promise<boolean>} True if the URL is reachable (status 200-299), false otherwise.
 */
export async function checkConnectivity(url, timeout = 5000) {
    try {
        const response = await axios.get(url, {
            timeout: timeout,
            // `validateStatus` defaults to `status >= 200 && status < 300`.
            // If the request completes with a status outside this range, it will throw an error
            // and be caught by the catch block, returning false, which is the desired behavior.
        });
        return true; // If axios.get doesn't throw, status is implicitly 200-299
    } catch (error) {
        // Minimal logging, or let the caller decide on logging strategy.
        // console.error(`Connectivity check to ${url} failed: ${error.message}`);
        return false;
    }
}
