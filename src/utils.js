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
        } catch {
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
        } catch {
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
        } catch {
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
    // Mask parts of the token for security in logs
    const maskedToken = config.telegramToken
        ? `${config.telegramToken.substring(0, 6)}...${config.telegramToken.substring(config.telegramToken.length - 4)}`
        : 'NOT_SET';
    console.log(
        `Emergency Notifier: Attempting to send message. Token (masked): ${maskedToken}, Target devChatId: ${config.devChatId || 'NOT_SET'}`
    );

    if (!config.telegramToken || !config.devChatId) {
        console.error('Emergency Notifier: telegramToken or devChatId is missing in config. Cannot send notification.');
        return;
    }

    const url = `https://api.telegram.org/bot${config.telegramToken}/sendMessage`;
    // Use maskTokenInUrl for logging the URL
    console.log(`Emergency Notifier: Posting to URL: ${maskTokenInUrl(url)}`);
    const payload = {
        chat_id: config.devChatId,
        text: messageText,
        parse_mode: 'Markdown', // Using Markdown for potential simple formatting
    };

    try {
        console.log('Emergency Notifier: Payload:', JSON.stringify(payload));
        const response = await axios.post(url, payload, { timeout: 10000 }); // 10-second timeout
        console.log(
            `Emergency Notifier: Notification sent successfully. Response status: ${response.status}, Data: ${JSON.stringify(response.data)}`
        );
    } catch (error) {
        if (error.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            console.error(
                `Failed to send emergency notification. Server responded with status ${error.response.status}:`,
                JSON.stringify(error.response.data)
            );
        } else if (error.request) {
            // The request was made but no response was received
            console.error('Failed to send emergency notification. No response received from server:', error.request);
        } else {
            // Something happened in setting up the request that triggered an Error
            console.error('Failed to send emergency notification. Error during request setup:', error.message);
        }
        // Do not re-throw, as this is a last-effort notification
    }
}

/**
 * Masks a bot token within a URL string.
 * Example: "https://api.telegram.org/bot12345:ABCDEF/getMe" becomes "https://api.telegram.org/bot12345:...CDEF/getMe"
 * If no token is found, or the token is too short, it might return a generic mask or the original URL.
 * @param {string} url The URL string to process.
 * @returns {string} The URL with the token masked, or the original URL if no token pattern is matched.
 */
export function maskTokenInUrl(url) {
    if (typeof url !== 'string') {
        return url;
    }
    // Regex to find "bot" followed by digits (the ID part), a colon, and then the token string until the next slash.
    // It captures the "bot<ID>:" part and the actual token separately.
    const regex = /(bot\d+:)([^\s/]+)/g;
    return url.replace(regex, (match, botIdPart, tokenPart) => {
        if (tokenPart.length > 10) {
            // Ensure token is long enough to mask meaningfully
            const firstPart = tokenPart.substring(0, 6);
            const lastPart = tokenPart.substring(tokenPart.length - 4);
            return `${botIdPart}${firstPart}...${lastPart}`;
        }
        // If token is short or for any other reason, use a generic mask for the token part
        return `${botIdPart}<TOKEN_MASKED>`;
    });
}
