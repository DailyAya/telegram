import { MongoClient, ServerApiVersion } from 'mongodb';
import config from './config.js';
import { logger, bootstrapLogger } from './logger.js';

/**
 * @module database
 * @description Manages all MongoDB database interactions, including connection,
 * and CRUD operations for chat and user data.
 */

/** @type {import('mongodb').Db | null} */
let dbInstance = null;
const DB_NAME = 'dailyAyaTelegram';
const CHATS_COLLECTION = 'chats';

/**
 * Establishes a connection to the MongoDB database using the URI from config.
 * If already connected, it returns the existing database instance.
 * @async
 * @function connectDB
 * @returns {Promise<import('mongodb').Db>} A promise that resolves to the database instance.
 * @throws {Error} If the database connection fails, the error is re-thrown after logging.
 */
export async function connectDB() {
    if (dbInstance) {
        bootstrapLogger('Database already connected.');
        return dbInstance;
    }
    try {
        // Note: useNewUrlParser and useUnifiedTopology are deprecated in driver v4+
        // and are no longer needed. The driver handles these aspects automatically.
        // Kept serverApi for compatibility if specific features are used.
        const client = new MongoClient(config.mongoURI, {
            serverApi: ServerApiVersion.v1,
            maxPoolSize: 50, // Added maxPoolSize
        });
        await client.connect();
        dbInstance = client.db(DB_NAME);
        bootstrapLogger('MongoDB connected successfully!');
        // The original code called timerSend() here. That will be moved to app.js.
        return dbInstance;
    } catch (e) {
        bootstrapLogger('MongoDB connection ERROR:', e);
        // Consider if process.exit(1) is desired for critical DB connection failure on startup
        throw e; // Re-throw to allow app.js (or calling module) to handle startup failure
    }
}

export function getDB() {
    if (!dbInstance) {
        const err = new Error('Database not connected. Ensure connectDB() is called and awaited on startup.');
        logger('Database not connected yet. Call connectDB first.', err);
        throw err;
    }
    return dbInstance;
}

/**
 * Records or updates information about a chat's interaction, specifically the last time an Aya was sent.
 * It also updates chat metadata and trigger counts.
 * @async
 * @function lastAyaTime
 * @param {number|string} chatId - The ID of the chat.
 * @param {string} [status="success"] - The status of the interaction (e.g., "success", "blocked").
 * @param {string} [chatName] - The name or title of the chat.
 * @param {string} [chatType] - The type of chat (e.g., "private", "group").
 * @param {string} [lang] - The language code associated with the chat or user.
 * @param {string} [trigger] - The trigger for the Aya sending (e.g., "timer", "request", "surprise").
 * @returns {Promise<{success: boolean, error?: Error}>} An object indicating success or failure.
 */
export async function lastAyaTime(chatId, status, chatName, chatType, lang, trigger) {
    const db = getDB();
    let setObj = {};
    status = status ?? 'success';

    setObj.since = { $cond: [{ $not: ['$since'] }, new Date(), '$since'] }; // Add "Since" date only once
    setObj.lastAyaTime = Date.now();
    setObj.blocked = status.toLowerCase().includes('block');

    // Only update fields if they are provided
    if (chatName) setObj.name = { $literal: chatName }; // Use $literal to prevent interpreting "$"
    if (lang) setObj.language_code = lang;
    if (chatType) setObj.chatType = chatType;

    if (trigger) {
        setObj.lastTrigger = trigger;
        // Dynamically create field for incrementing based on trigger type
        // e.g., if trigger is 'surprise', field becomes 'surprises'
        const incrementField = trigger.toLowerCase() + 's';
        setObj[incrementField] = { $cond: [{ $not: [`$${incrementField}`] }, 1, { $add: [`$${incrementField}`, 1] }] };
    }

    try {
        await db.collection(CHATS_COLLECTION).updateOne(
            { chatId: chatId },
            [{ $set: setObj }], // Using aggregation pipeline for $set to allow $literal and $cond
            { upsert: true }
        );
        logger(`Recorded Last Aya Time for chat ${chatId} as ${setObj.blocked ? 'blocked.' : 'successful.'}`);
        return { success: true };
    } catch (e) {
        logger('Failed to record Last Aya Time for chat ' + chatId, e);
        return { success: false, error: e };
    }
}

export async function setFavReciter(chatId, reciterIdentifier) {
    const db = getDB();
    logger(`Database: Chat ${chatId} fav reciter request: ${reciterIdentifier}`); // Validation happens upstream

    const setObj = { favReciter: reciterIdentifier };

    try {
        await db.collection(CHATS_COLLECTION).updateOne(
            { chatId: chatId },
            [{ $set: setObj }], // Using aggregation pipeline for $set
            { upsert: true }
        );
        logger(`Database: Favorite reciter "${reciterIdentifier}" has been set for chat ${chatId}.`);
        // Return success and the reciter that was set.
        // The calling function will handle sending Telegram messages.
        return { success: true, reciter: reciterIdentifier };
    } catch (e) {
        logger(`Database: Error while setting favorite reciter "${reciterIdentifier}" for chat ${chatId}:`, e);
        return { success: false, error: e, reciter: reciterIdentifier };
    }
}

export async function getFavReciter(chatId) {
    const db = getDB();
    logger(`Database: Getting fav reciter for Chat ${chatId}`);

    if (!chatId) {
        logger('Database: getFavReciter called without chatId.');
        return { success: false, error: new Error('No chatId provided'), data: null };
    }

    try {
        const result = await db.collection(CHATS_COLLECTION).findOne({ chatId: chatId });
        // Default to "surprise" if favReciter is not found or not set in the document
        const favReciter = result?.favReciter ?? 'surprise';
        logger(`Database: Found favReciter "${favReciter}" for chat ${chatId}.`);
        return { success: true, data: favReciter };
    } catch (e) {
        logger(`Database: Error while getting favReciter for chat ${chatId}:`, e);
        return { success: false, error: e, data: null };
    }
}
