// Import actuals for type hinting or if some parts are not fully mocked (though here, they are)
import { MongoClient as ActualMongoClient, ServerApiVersion as ActualServerApiVersion } from 'mongodb';
import actualConfig from './config.js';
import { logger as actualLogger, bootstrapLogger as actualBootstrapLogger } from './logger.js';

// --- Mocks ---
const mockCollection = {
    updateOne: jest.fn(),
    findOne: jest.fn(),
    // Add other collection methods if used by database.js, e.g., countDocuments
    countDocuments: jest.fn(),
};
const mockDbInstance = {
    collection: jest.fn(() => mockCollection),
};
const mockMongoClientInstance = {
    // Renamed to avoid confusion with MongoClient constructor
    connect: jest.fn(),
    db: jest.fn(() => mockDbInstance),
    close: jest.fn(), // Added for potential disconnectDB tests later
};

jest.mock('mongodb', () => ({
    __esModule: true,
    MongoClient: jest.fn(() => mockMongoClientInstance), // Mock constructor to return our instance
    ServerApiVersion: { v1: '1' },
}));

// Removed jest.mock('./config.js'); - will rely on env variables set by setup script

jest.mock('./logger.js', () => ({
    __esModule: true,
    logger: jest.fn(),
    bootstrapLogger: jest.fn(),
}));

// Import the module to be tested *after* mocks are set up
import { connectDB, getDB, lastAyaTime, setFavReciter, getFavReciter } from './database.js';

// --- Test Suite ---
describe('Database Service Tests', () => {
    // Helper to reset dbInstance internal to database.js if needed.
    // This is a bit of a hack; ideally, database.js would export a disconnect/reset function.
    async function resetInternalDbInstance() {
        // This relies on connectDB re-assigning dbInstance.
        // If connectDB fails or if there's no way to nullify dbInstance from outside,
        // tests for getDB before connect might be tricky or need jest.resetModules().
        // For now, we'll assume tests run in an order or connectDB is called first.
        // If jest.resetModules is needed:
        // jest.resetModules();
        // mockMongoClientInstance.connect.mockClear(); // etc. for all mocks
        // return require('./database.js'); // Re-require to get fresh state
    }

    beforeEach(() => {
        // Reset mocks before each test
        mockMongoClientInstance.connect.mockClear();
        mockMongoClientInstance.db.mockClear();
        mockMongoClientInstance.close.mockClear();
        mockDbInstance.collection.mockClear();
        mockCollection.updateOne.mockClear();
        mockCollection.findOne.mockClear();
        mockCollection.countDocuments.mockClear();

        // Clear logger mocks
        actualLogger.mockClear(); // Assuming logger is the default export from './logger.js'
        actualBootstrapLogger.mockClear(); // Assuming bootstrapLogger is a named export

        // Reset the MongoClient constructor mock calls too
        ActualMongoClient.mockClear(); // Using the imported ActualMongoClient name for the mock constructor
    });

    describe('connectDB and getDB', () => {
        it('should connect to MongoDB successfully and allow getting DB instance', async () => {
            mockMongoClientInstance.connect.mockResolvedValueOnce(mockMongoClientInstance); // connect resolves with the client instance

            const db = await connectDB();

            expect(ActualMongoClient).toHaveBeenCalledTimes(1);
            expect(ActualMongoClient).toHaveBeenCalledWith(actualConfig.mongoURI, { serverApi: { v1: '1' } });
            expect(mockMongoClientInstance.connect).toHaveBeenCalledTimes(1);
            expect(mockMongoClientInstance.db).toHaveBeenCalledTimes(1);
            expect(mockMongoClientInstance.db).toHaveBeenCalledWith('dailyAyaTelegram'); // Assuming DB_NAME is 'dailyAyaTelegram'
            expect(actualBootstrapLogger).toHaveBeenCalledWith('MongoDB connected successfully!');

            const gottenDb = getDB();
            expect(gottenDb).toBe(mockDbInstance);
            expect(db).toBe(mockDbInstance); // connectDB should also return the instance
        });

        it('should handle MongoDB connection failure', async () => {
            const connectionError = new Error('Mock DB connection error');
            mockMongoClientInstance.connect.mockRejectedValueOnce(connectionError);

            await expect(connectDB()).rejects.toThrow('Mock DB connection error');

            expect(ActualMongoClient).toHaveBeenCalledTimes(1);
            expect(mockMongoClientInstance.connect).toHaveBeenCalledTimes(1);
            expect(actualBootstrapLogger).toHaveBeenCalledWith('MongoDB connection ERROR:', connectionError);
        });

        it('getDB should throw error if called before connectDB (or after connection failed)', async () => {
            // This test's reliability depends on dbInstance being null initially or after a failed connect.
            // We can simulate a failed connection's state.
            mockMongoClientInstance.connect.mockRejectedValueOnce(new Error('Simulated fail'));
            try {
                await connectDB();
            } catch (e) {
                // Expected failure
            }
            // Now dbInstance should effectively be null OR connectDB threw before setting it.
            // To be absolutely sure for this test, we might need jest.resetModules() if dbInstance is not reset.
            // However, database.js is structured so connectDB throws on error *before* setting dbInstance.

            expect(() => getDB()).toThrow(
                'Database not connected. Ensure connectDB() is called and awaited on startup.'
            );
            expect(actualLogger).toHaveBeenCalledWith(
                'Database not connected yet. Call connectDB first.',
                expect.any(Error)
            );
        });
    });

    describe('lastAyaTime', () => {
        beforeAll(async () => {
            // Ensure a "successful" connection for these tests
            mockMongoClientInstance.connect.mockResolvedValue(mockMongoClientInstance);
            await connectDB();
            // Clear mocks that might have been called by the above connectDB
            actualBootstrapLogger.mockClear();
            ActualMongoClient.mockClear();
            mockMongoClientInstance.connect.mockClear();
            mockMongoClientInstance.db.mockClear();
        });

        it('should update chat data successfully', async () => {
            mockCollection.updateOne.mockResolvedValueOnce({
                acknowledged: true,
                modifiedCount: 1,
                upsertedId: null,
                upsertedCount: 0,
                matchedCount: 1,
            });

            const chatId = 123;
            const status = 'success';
            const chatName = 'Test Chat';
            const chatType = 'private';
            const lang = 'en';
            const trigger = 'timer';

            const result = await lastAyaTime(chatId, status, chatName, chatType, lang, trigger);

            expect(mockDbInstance.collection).toHaveBeenCalledWith('chats');
            expect(mockCollection.updateOne).toHaveBeenCalledWith(
                { chatId: chatId },
                expect.arrayContaining([
                    expect.objectContaining({
                        $set: expect.objectContaining({
                            lastAyaTime: expect.any(Number),
                            blocked: false,
                            name: { $literal: chatName },
                            language_code: lang,
                            chatType: chatType,
                            lastTrigger: trigger,
                            timers: { $cond: [{ $not: ['$timers'] }, 1, { $add: ['$timers', 1] }] },
                        }),
                    }),
                ]),
                { upsert: true }
            );
            expect(actualLogger).toHaveBeenCalledWith(`Recorded Last Aya Time for chat ${chatId} as successful.`);
            expect(result).toEqual({ success: true });
        });

        it('should handle blocked status correctly', async () => {
            mockCollection.updateOne.mockResolvedValueOnce({ acknowledged: true });
            await lastAyaTime(12345, 'blocked by user', 'Blocker Chat', 'group', 'ar', 'request');

            expect(mockCollection.updateOne).toHaveBeenCalledWith(
                { chatId: 12345 },
                expect.arrayContaining([
                    expect.objectContaining({
                        $set: expect.objectContaining({ blocked: true, requests: expect.anything() }),
                    }),
                ]),
                { upsert: true }
            );
            expect(actualLogger).toHaveBeenCalledWith(`Recorded Last Aya Time for chat 12345 as blocked.`);
        });

        it('should handle database update failure', async () => {
            const dbError = new Error('DB update failed');
            mockCollection.updateOne.mockRejectedValueOnce(dbError);

            const result = await lastAyaTime(678, 'success', 'Fail Chat', 'private', 'en', 'surprise');

            expect(actualLogger).toHaveBeenCalledWith('Failed to record Last Aya Time for chat 678', dbError);
            expect(result).toEqual({ success: false, error: dbError });
        });
    });

    describe('setFavReciter', () => {
        // Assuming connectDB was successful in a beforeAll or similar setup for the parent describe
        it('should set favorite reciter successfully', async () => {
            mockCollection.updateOne.mockResolvedValueOnce({ acknowledged: true });
            const chatId = 789;
            const reciterId = 'ar.alafasy';

            const result = await setFavReciter(chatId, reciterId);

            expect(mockDbInstance.collection).toHaveBeenCalledWith('chats');
            expect(mockCollection.updateOne).toHaveBeenCalledWith(
                { chatId: chatId },
                expect.arrayContaining([expect.objectContaining({ $set: { favReciter: reciterId } })]),
                { upsert: true }
            );
            expect(actualLogger).toHaveBeenCalledWith(
                `Database: Favorite reciter "${reciterId}" has been set for chat ${chatId}.`
            );
            expect(result).toEqual({ success: true, reciter: reciterId });
        });

        it('should handle database failure when setting reciter', async () => {
            const dbError = new Error('DB error setting reciter');
            mockCollection.updateOne.mockRejectedValueOnce(dbError);
            const chatId = 101;
            const reciterId = 'ar.minshawi';

            const result = await setFavReciter(chatId, reciterId);

            expect(actualLogger).toHaveBeenCalledWith(
                `Database: Error while setting favorite reciter "${reciterId}" for chat ${chatId}:`,
                dbError
            );
            expect(result).toEqual({ success: false, error: dbError, reciter: reciterId });
        });
    });

    describe('getFavReciter', () => {
        it('should return favorite reciter if found', async () => {
            const mockReciterData = { chatId: 222, favReciter: 'ar.husary' };
            mockCollection.findOne.mockResolvedValueOnce(mockReciterData);

            const result = await getFavReciter(222);

            expect(mockDbInstance.collection).toHaveBeenCalledWith('chats');
            expect(mockCollection.findOne).toHaveBeenCalledWith({ chatId: 222 });
            expect(actualLogger).toHaveBeenCalledWith(
                `Database: Found favReciter "${mockReciterData.favReciter}" for chat 222.`
            );
            expect(result).toEqual({ success: true, data: mockReciterData.favReciter });
        });

        it('should return "surprise" if reciter not set in DB document', async () => {
            mockCollection.findOne.mockResolvedValueOnce({ chatId: 333 }); // No favReciter field

            const result = await getFavReciter(333);
            expect(actualLogger).toHaveBeenCalledWith(`Database: Found favReciter "surprise" for chat 333.`);
            expect(result).toEqual({ success: true, data: 'surprise' });
        });

        it('should return "surprise" if chat document not found', async () => {
            mockCollection.findOne.mockResolvedValueOnce(null); // Chat not found

            const result = await getFavReciter(404);
            expect(actualLogger).toHaveBeenCalledWith(`Database: Found favReciter "surprise" for chat 404.`);
            expect(result).toEqual({ success: true, data: 'surprise' });
        });

        it('should handle database failure when getting reciter', async () => {
            const dbError = new Error('DB error getting reciter');
            mockCollection.findOne.mockRejectedValueOnce(dbError);

            const result = await getFavReciter(555);

            expect(actualLogger).toHaveBeenCalledWith(
                `Database: Error while getting favReciter for chat 555:`,
                dbError
            );
            expect(result).toEqual({ success: false, error: dbError, data: null });
        });

        it('should handle missing chatId argument', async () => {
            const result = await getFavReciter(null); // or undefined
            expect(actualLogger).toHaveBeenCalledWith('Database: getFavReciter called without chatId.');
            expect(result).toEqual({ success: false, error: expect.any(Error), data: null });
            expect(result.error.message).toBe('No chatId provided');
            expect(mockCollection.findOne).not.toHaveBeenCalled();
        });
    });
});
