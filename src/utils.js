/**
 * @module utils
 * @description Provides utility functions for various common tasks such as type conversion,
 * random number generation, text manipulation, and network checks.
 */

import axios from 'axios';
import { lookup as dnsLookup } from 'dns'; // Use named import
import { Socket as NetSocket } from 'net'; // Use named import
import { URL } from 'url';
import config from './config.js';

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
 * Checks network connectivity to a given URL by performing a DNS lookup
 * on the hostname and then attempting a TCP socket connection to the resolved IP address.
 * It retries the entire process (DNS + TCP) up to 3 times if failures occur.
 * @async
 * @function checkConnectivity
 * @param {string} url - The URL to check (e.g., "https://www.google.com").
 * @returns {Promise<boolean>} True if DNS resolution and TCP connection are successful within 3 attempts, false otherwise.
 */
export async function checkConnectivity(url) {
    const maxAttempts = 3;
    const delayBetweenAttempts = 2000;
    const tcpConnectionTimeout = 7000;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        let hostname, port;
        try {
            const parsedUrl = new URL(url);
            hostname = parsedUrl.hostname;
            port = parseInt(parsedUrl.port || (parsedUrl.protocol === 'https:' ? '443' : '80'), 10);
            if (!hostname) {
                throw new Error('Hostname could not be derived from URL.');
            }
        } catch (parseError) {
            if (attempt < maxAttempts) {
                await new Promise((resolve) => setTimeout(resolve, delayBetweenAttempts));
                continue;
            }
            return false;
        }

        let ipAddress;
        try {
            ipAddress = await new Promise((resolve, reject) => {
                dnsLookup(hostname, (err, address) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(address);
                    }
                });
            });
        } catch (dnsError) {
            if (attempt < maxAttempts) {
                await new Promise((resolve) => setTimeout(resolve, delayBetweenAttempts));
                continue;
            }
            return false;
        }

        try {
            await new Promise((resolve, reject) => {
                const socket = new NetSocket();
                socket.setTimeout(tcpConnectionTimeout);
                socket.connect(port, ipAddress, () => {
                    socket.destroy();
                    resolve(true);
                });
                socket.on('timeout', () => {
                    socket.destroy();
                    reject(
                        new Error(`TCP connection to ${ipAddress}:${port} timed out after ${tcpConnectionTimeout}ms`)
                    );
                });
                socket.on('error', (err) => {
                    socket.destroy();
                    reject(err);
                });
            });
            return true;
        } catch (tcpError) {
            if (attempt < maxAttempts) {
                await new Promise((resolve) => setTimeout(resolve, delayBetweenAttempts));
            } else {
                return false;
            }
        }
    }
    return false;
}

/**
 * Sends an emergency notification message via Telegram API directly using axios.
 * This is intended for use by bootstrapLogger when the main Telegraf instance might not be available.
 * @async
 * @function sendEmergencyNotification
 * @param {string} messageText - The text of the message to send.
 */
export async function sendEmergencyNotification(messageText) {
    if (!config.telegramToken || !config.devChatId) {
        console.error('Emergency Notifier: telegramToken or devChatId is missing in config. Cannot send notification.');
        return;
    }

    const url = `https://api.telegram.org/bot${config.telegramToken}/sendMessage`;
    const payload = {
        chat_id: config.devChatId,
        text: messageText,
        parse_mode: 'Markdown', // Using Markdown for potential simple formatting
    };

    try {
        await axios.post(url, payload, { timeout: 10000 }); // 10-second timeout
        // console.log('Emergency notification sent successfully.'); // Optional: Can be noisy
    } catch (error) {
        console.error('Failed to send emergency notification:', error.message);
        // Do not re-throw, as this is a last-effort notification
    }
}
