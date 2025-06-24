import { toBoolean, randomAyaNumber, numArabicToEnglish } from './utils.js';

// Use global mock for config.js - this will apply src/__mocks__/config.js
jest.mock('./config.js');

describe('Utils Tests', () => {
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
});
