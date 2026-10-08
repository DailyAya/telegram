import { jest } from '@jest/globals'; // Explicitly import jest

// --- Manage config.js mock manually ---
// config.js is imported by database.js as '../../src/config.js'
let currentConfigMock = {
    __esModule: true,
    default: {
        // Minimal valid config
        telegramToken: 'DB_TEST_INITIAL_TOKEN',
        devChatId: 'DB_TEST_INITIAL_DEV_CHAT_ID',
        mongoDbCredentials: 'test-user:test-pass',
        mongoSubdomain: 'test-cluster.mongodb.net',
        mongoURI: 'mongodb+srv://test-user:test-pass@test-cluster.mongodb.net/?retryWrites=true&w=majority',
        branch: 'test-branch',
        inst: 'test-inst',
        host: 'test-host',
        totalInst: '1',
        debugging: false,
        codeVer: 'test-v0.0.0',
        instActiveUntil: '2000-01-01',
        port: 3005, // Different port
        timerCheckMinutes: 60,
        timerSendHours: 24,
        pingTargetGeneral: 'http://test.example.com',
        pingTargetAlternative: 'http://test.example.org',
        pingTargetTelegramApiBase: 'http://test.api.telegram.org',
        botLaunchRetryDelay: 1000,
        maxBotLaunchRetries: 1,
    },
};
jest.unstable_mockModule('../../src/config.js', () => {
    // Path relative to database.test.js
    console.log(
        `****** unstable_mockModule for ./config.js (database.test.js) using currentConfigMock (branch: ${currentConfigMock.default.branch}) ******`
    );
    return currentConfigMock;
});

// --- Other Mocks ---
// Define mock implementations first
const mockCollection = {
    updateOne: jest.fn(),
    findOne: jest.fn(),
    countDocuments: jest.fn(),
};
const mockDbInstance = {
    collection: jest.fn(() => mockCollection),
};
const mockMongoClientInstance = {
    connect: jest.fn(),
    db: jest.fn(() => mockDbInstance),
    close: jest.fn(),
};

// Use jest.unstable_mockModule for ESM compliance
jest.unstable_mockModule('mongodb', () => ({
    __esModule: true,
    MongoClient: jest.fn(() => mockMongoClientInstance),
    ServerApiVersion: { v1: '1' }, // This remains the same, affects how ServerApiVersion.v1 is resolved
}));

jest.unstable_mockModule('../../src/logger.js', () => ({
    __esModule: true,
    logger: jest.fn(),
    bootstrapLogger: jest.fn(),
}));

// Dynamically import after mocks are set up
let connectDB, getDB, lastAyaTime, setFavReciter, getFavReciter;
let ActualMongoClient; // Will hold the mocked MongoClient constructor
let actualLogger, actualBootstrapLogger; // Will hold mocked logger functions

beforeAll(async () => {
    jest.resetModules(); // Reset modules before setting config and importing SUT

    // Set currentConfigMock to use values from the global mock file
    // Path from src/database.test.js to src/__mocks__/config.mock.js is '../../src/__mocks__/config.mock.js'
    const globalMockDefault = (await import('../../src/__mocks__/config.mock.js')).default;
    currentConfigMock = { __esModule: true, default: globalMockDefault };
    console.log('****** Set currentConfigMock to GLOBAL MOCK values for database.test.js ******');

    const dbModule = await import('../../src/database.js');
    connectDB = dbModule.connectDB;
    getDB = dbModule.getDB; // This should now be defined
    lastAyaTime = dbModule.lastAyaTime;
    setFavReciter = dbModule.setFavReciter;
    getFavReciter = dbModule.getFavReciter;

    const mongodbMock = await import('mongodb');
    ActualMongoClient = mongodbMock.MongoClient; // This is the mocked constructor

    const loggerMock = await import('../../src/logger.js');
    actualLogger = loggerMock.logger;
    actualBootstrapLogger = loggerMock.bootstrapLogger;
});

// --- Test Suite ---
describe('Database Service Tests', () => {
    // Removed unused helper function resetInternalDbInstance

    beforeEach(() => {
        // Reset mocks before each test
        mockMongoClientInstance.connect.mockClear();
        mockMongoClientInstance.db.mockClear();
        mockMongoClientInstance.close.mockClear();
        mockDbInstance.collection.mockClear();
        mockCollection.updateOne.mockClear();
        mockCollection.findOne.mockClear();
        mockCollection.countDocuments.mockClear();

        if (actualLogger) actualLogger.mockClear();
        if (actualBootstrapLogger) actualBootstrapLogger.mockClear();
        if (ActualMongoClient) ActualMongoClient.mockClear();
    });

    describe('connectDB and getDB', () => {
        it('should connect to MongoDB successfully and allow getting DB instance', async () => {
            mockMongoClientInstance.connect.mockResolvedValueOnce(mockMongoClientInstance);

            const db = await connectDB();

            const { default: resolvedMockedConfig } = await import('../../src/config.js'); // get it again here for the assertion value

            expect(ActualMongoClient).toHaveBeenCalledTimes(1);
            // The actual call includes maxPoolSize and serverApi resolves to '1' due to the mock of ServerApiVersion
            expect(ActualMongoClient).toHaveBeenCalledWith(resolvedMockedConfig.mongoURI, {
                serverApi: '1',
                maxPoolSize: 50,
            });
            expect(mockMongoClientInstance.connect).toHaveBeenCalledTimes(1);
            expect(mockMongoClientInstance.db).toHaveBeenCalledTimes(1);
            expect(mockMongoClientInstance.db).toHaveBeenCalledWith('dailyAyaTelegram'); // Assuming DB_NAME is 'dailyAyaTelegram'
            expect(actualBootstrapLogger).toHaveBeenCalledWith('MongoDB connected successfully!');

            const gottenDb = getDB();
            expect(gottenDb).toBe(mockDbInstance);
            expect(db).toBe(mockDbInstance); // connectDB should also return the instance
        });

        it('should handle MongoDB connection failure', async () => {
            jest.resetModules(); // Reset modules to get fresh database.js state
            const dbModuleFresh = await import('../../src/database.js');
            const freshConnectDB = dbModuleFresh.connectDB;
            // Mocks for mongodb and logger are top-level and should apply to the fresh import.
            // We use the globally defined mockMongoClientInstance for setting mock behavior.

            const connectionError = new Error('Mock DB connection error');
            mockMongoClientInstance.connect.mockReset(); // Reset any previous mock settings for connect
            mockMongoClientInstance.connect.mockRejectedValueOnce(connectionError);

            // We also need to re-import ActualMongoClient and actualBootstrapLogger if they were module-scoped after reset
            // Re-import (or rather, get handles to) the mocks as they would be seen by freshDbModule
            const { MongoClient: FreshActualMongoClient } = await import('mongodb');
            const { bootstrapLogger: freshActualBootstrapLogger } = await import('../../src/logger.js');

            const connectionErrorInstance = new Error('Mock DB connection error'); // Use a different name
            mockMongoClientInstance.connect.mockReset();
            mockMongoClientInstance.connect.mockRejectedValueOnce(connectionErrorInstance);

            await expect(freshConnectDB()).rejects.toThrow('Mock DB connection error');

            expect(FreshActualMongoClient).toHaveBeenCalledTimes(1);
            expect(mockMongoClientInstance.connect).toHaveBeenCalledTimes(1);
            expect(freshActualBootstrapLogger).toHaveBeenCalledWith('MongoDB connection ERROR:', connectionError);
        });

        it('getDB should throw error if called before connectDB (or after connection failed)', async () => {
            jest.resetModules();
            const freshDbModule = await import('../../src/database.js');
            const freshConnectDB = freshDbModule.connectDB;
            const freshGetDB = freshDbModule.getDB;
            const { logger: freshActualLogger } = await import('../../src/logger.js');

            mockMongoClientInstance.connect.mockReset();
            freshActualLogger.mockClear();

            mockMongoClientInstance.connect.mockRejectedValueOnce(new Error('Simulated fail'));
            try {
                await freshConnectDB();
                // eslint-disable-next-line no-unused-vars
            } catch (_e) {
                // Expected failure
            }

            expect(() => freshGetDB()).toThrow(
                'Database not connected. Ensure connectDB() is called and awaited on startup.'
            );
            expect(freshActualLogger).toHaveBeenCalledWith(
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
