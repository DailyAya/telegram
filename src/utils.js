/**
 * @module utils
 * @description Provides utility functions for various common tasks such as type conversion,
 * random number generation, text manipulation, and network checks.
 */

import dns from 'dns';
import net from 'net';
import { URL } from 'url';

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
    const delayBetweenAttempts = 2000; // 2 seconds
    const tcpConnectionTimeout = 7000; // 7 seconds for each TCP connection attempt (increased from 5s)

    let lastError = null; // To store the last error message for logging, if needed

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        let hostname, port;
        try {
            const parsedUrl = new URL(url);
            hostname = parsedUrl.hostname;
            // Ensure port is an integer; default to 443 for https, 80 for http
            port = parseInt(parsedUrl.port || (parsedUrl.protocol === 'https:' ? '443' : '80'), 10);
            if (!hostname) { // Basic validation for hostname
                throw new Error('Hostname could not be derived from URL.');
            }
        } catch (parseError) {
            lastError = `URL parsing error: ${parseError.message}`;
            // In a real scenario, log this: logger.warn(`Connectivity Check Attempt ${attempt}/${maxAttempts}: Invalid URL "${url}". Error: ${lastError}`);
            if (attempt < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, delayBetweenAttempts));
                continue; // Move to the next attempt
            }
            return false; // All attempts failed due to URL parse error
        }

        let ipAddress;
        try {
            // logger.debug(`Connectivity Check Attempt ${attempt}/${maxAttempts}: Resolving DNS for ${hostname}`);
            ipAddress = await new Promise((resolve, reject) => {
                // dns.lookup can sometimes be slow, give it its own reasonable timeout if possible, though Node's default is OS-dependent
                dns.lookup(hostname, (err, address) => {
                    if (err) reject(err);
                    else resolve(address);
                });
            });
            // logger.debug(`Connectivity Check Attempt ${attempt}/${maxAttempts}: DNS for ${hostname} resolved to ${ipAddress}`);
        } catch (dnsError) {
            lastError = `DNS lookup for ${hostname} failed: ${dnsError.message}`;
            // logger.warn(`Connectivity Check Attempt ${attempt}/${maxAttempts}: ${lastError}`);
            if (attempt < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, delayBetweenAttempts));
                continue; // Move to the next attempt
            }
            return false; // All attempts failed due to DNS error
        }

        try {
            // logger.debug(`Connectivity Check Attempt ${attempt}/${maxAttempts}: Attempting TCP connection to ${ipAddress}:${port}`);
            await new Promise((resolve, reject) => {
                const socket = new net.Socket();
                socket.setTimeout(tcpConnectionTimeout);
                socket.connect(port, ipAddress, () => {
                    socket.destroy(); // Clean up the socket
                    resolve(true);  // TCP connection successful
                });
                socket.on('timeout', () => {
                    socket.destroy(); // Clean up the socket
                    reject(new Error(`TCP connection to ${ipAddress}:${port} timed out after ${tcpConnectionTimeout}ms`));
                });
                socket.on('error', (err) => {
                    socket.destroy(); // Clean up the socket
                    reject(err);     // TCP connection error
                });
            });
            // logger.info(`Connectivity Check Attempt ${attempt}/${maxAttempts}: TCP connection to ${ipAddress}:${port} for URL "${url}" successful.`);
            return true; // Successfully connected
        } catch (tcpError) {
            lastError = `TCP connection to ${ipAddress}:${port} (for ${hostname}) failed: ${tcpError.message}`;
            // logger.warn(`Connectivity Check Attempt ${attempt}/${maxAttempts}: ${lastError}`);
            if (attempt < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, delayBetweenAttempts));
                // Continue to the next attempt (handled by the loop)
            } else {
                // All TCP attempts failed for this DNS resolution
                // logger.error(`Connectivity Check: All ${maxAttempts} TCP attempts to connect to "${url}" (IP: ${ipAddress}) failed. Last error: ${lastError}`);
                return false; // All attempts for this cycle failed
            }
        }
    }
    // If loop finishes, all attempts failed for different reasons or last one failed.
    // logger.error(`Connectivity Check: All ${maxAttempts} attempts to connect to "${url}" failed. Last error: ${lastError || 'Unknown error after loop completion.'}`);
    return false;
}
