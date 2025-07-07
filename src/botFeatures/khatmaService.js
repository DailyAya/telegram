// src/botFeatures/khatmaService.js
// Currently, this service will only contain the khatmaUpdate function.
// It has no external dependencies other than what's passed into khatmaUpdate.

/**
 * Updates the text of a Khatma progress message based on a user's Juz selection.
 * It parses existing user entries (HTML links) and inserts/updates the current user's selection
 * in a sorted manner.
 * @param {object} params - The parameters for updating the Khatma.
 * @param {number|string} params.userId - The ID of the user making the selection.
 * @param {string} params.firstName - The first name of the user.
 * @param {string} params.currentText - The current text of the Khatma message.
 * @param {Array<import('telegraf/typings/core/types/typegram').MessageEntity>} [params.currentEntities] - Optional entities from the current message, used to preserve existing HTML mentions.
 * @param {number} params.juz - The Juz number selected by the user.
 * @returns {string|false} The updated message text with HTML links, or `false` if no change was made (user selected the same Juz).
 */
export function khatmaUpdate({ userId, firstName, currentText, currentEntities, juz }) {
    let textOffset = 0;
    let newText = currentText;

    (currentEntities || []).forEach((entity) => {
        if (entity.type === 'text_mention' && entity.user) {
            const mention = `<a href="tg://user?id=${entity.user.id}">${entity.user.first_name}</a>`;
            newText =
                newText.substring(0, textOffset + entity.offset) +
                mention +
                newText.substring(textOffset + entity.offset + entity.length);
            textOffset += mention.length - entity.length;
        }
    });

    const userUpdateLine = `<a href="tg://user?id=${userId}">${firstName}</a> ➔ ${juz} ${juz === 30 ? '🏆' : '💪'}`;
    const textArray = newText.split('\n\n');
    const header = textArray.shift();

    const existingUserEntryIndex = textArray.findIndex((item) => item.includes(`<a href="tg://user?id=${userId}">`));
    if (existingUserEntryIndex !== -1 && textArray[existingUserEntryIndex] === userUpdateLine) {
        return false; // No change needed
    }

    const filteredArray = textArray.filter((item) => !item.includes(`<a href="tg://user?id=${userId}">`));

    let insertAtIndex = filteredArray.findIndex((item) => {
        const match = item.match(/(\d+)(?: .{1,2})$/); // Matches Juz number at the end of the line
        return match && parseInt(match[1], 10) < juz; // Sort in descending order of Juz for display
    });

    // Correction: The original logic seems to sort in ascending order of Juz for display.
    // If we find an item with a juz number SMALLER than the current juz, we want to insert BEFORE it.
    // Or, more simply, find the first item whose Juz is GREATER OR EQUAL, and insert there.
    // If none, push to end.
    // The original logic for insertAtIndex seems to be finding where to insert to keep it sorted by Juz number.
    // "find an item whose juz number is smaller than the current juz" - this means it finds the *last* item
    // that is smaller, and then it would insert *after* it. If it's -1, it means all are larger or list is empty, so push.
    // Let's stick to the original logic which seemed to work.
    // The original logic: findIndex for item where item_juz < current_juz.
    // If found, it means we want to insert before the *next* item if that next item is larger, or at the end of this block of smaller items.
    // This is effectively sorting by Juz number.

    // Simpler: Collect all entries, add the new one, then sort by Juz number.
    // However, to match the original logic precisely for now:
    insertAtIndex = filteredArray.findIndex((item) => {
        const match = item.match(/➔\s*(\d+)\s*(?:🏆|💪)?$/); // Extract Juz number
        return match && parseInt(match[1], 10) > juz; // Find first entry with a LARGER juz number
    });

    if (insertAtIndex === -1) {
        // All existing ajzaa are smaller or list is empty
        filteredArray.push(userUpdateLine);
    } else {
        filteredArray.splice(insertAtIndex, 0, userUpdateLine);
    }

    return [header, ...filteredArray].join('\n\n');
}
