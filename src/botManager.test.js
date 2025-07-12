import { jest } from '@jest/globals';

// Mock dependencies
const mockGetMe = jest.fn();
const mockTelegrafInstance = {
  telegram: {
    getMe: mockGetMe,
  },
  options: {},
};
const mockTelegrafConstructor = jest.fn(() => mockTelegrafInstance);

jest.unstable_mockModule('telegraf', () => ({
  Telegraf: mockTelegrafConstructor,
  Markup: {
    inlineKeyboard: jest.fn(() => ({})), // Add other Markup methods if needed by botManager directly
  },
}));

const mockConfig = {
  telegramToken: 'test-token-123',
  devChatId: '12345',
  debugging: true,
};
jest.unstable_mockModule('./config', () => ({ // Corrected path
  default: mockConfig,
  __esModule: true,
}));

const mockLogger = jest.fn();
const mockBootstrapLogger = jest.fn();
const mockSetBotInstance = jest.fn(); // Added mock for setBotInstance
jest.unstable_mockModule('./logger', () => ({ // Corrected path
  logger: mockLogger,
  bootstrapLogger: mockBootstrapLogger,
  setBotInstance: mockSetBotInstance, // Export the mock function
  __esModule: true,
}));

describe('Bot Manager - initializeBot', () => {
  let initializeBot;
  let botManagerModule;

  beforeEach(async () => {
    jest.resetModules(); // Reset modules before each test to clear state
    mockTelegrafConstructor.mockClear();
    mockGetMe.mockClear();
    mockLogger.mockClear();
    mockBootstrapLogger.mockClear();
    mockSetBotInstance.mockClear(); // Clear the new mock
    // Reset options on the shared mock instance
    mockTelegrafInstance.options = {};

    // Dynamically import after mocks are set up
    botManagerModule = await import('./botManager.js');
    initializeBot = botManagerModule.initializeBot;
  });

  test('should successfully initialize the bot, call getMe, and resolve botUsernameReady', async () => {
    const mockUser = { id: 123456, username: 'TestBot', first_name: 'Test Bot' };
    mockGetMe.mockResolvedValue(mockUser);

    const { bot, botUsernameReady } = await initializeBot();
    const username = await botUsernameReady;

    expect(mockTelegrafConstructor).toHaveBeenCalledTimes(1);
    expect(mockTelegrafConstructor).toHaveBeenCalledWith(
      mockConfig.telegramToken,
      expect.objectContaining({
        telegram: expect.objectContaining({
          agent: expect.any(Object), // Or be more specific if needed
        }),
      })
    );
    expect(mockGetMe).toHaveBeenCalledTimes(1);
    expect(bot).toBe(mockTelegrafInstance);
    expect(username).toBe('TestBot');
    expect(mockTelegrafInstance.options.username).toBe('TestBot');
    expect(mockBootstrapLogger.mock.calls).toContainEqual([expect.stringContaining(`bot.telegram.getMe() successful. Bot username set to: ${mockUser.username}`)]);
  });

  test('should handle getMe failure, log error, and resolve botUsernameReady with null', async () => {
    const getMeError = new Error('Network Error');
    mockGetMe.mockRejectedValue(getMeError);

    const { bot, botUsernameReady } = await initializeBot();
    const username = await botUsernameReady;

    expect(mockTelegrafConstructor).toHaveBeenCalledTimes(1);
    expect(mockGetMe).toHaveBeenCalledTimes(1);
    expect(bot).toBe(mockTelegrafInstance);
    expect(username).toBeNull();
    expect(mockTelegrafInstance.options.username).toBeUndefined(); // or null, depending on implementation
    expect(mockBootstrapLogger.mock.calls).toContainEqual([
      expect.stringContaining('CRITICAL - bot.telegram.getMe() failed. Error:'),
      getMeError
    ]);
  });

  test('should handle getMe returning undefined username, log error, and resolve botUsernameReady with null', async () => {
    const mockUserNoUsername = { id: 123456, first_name: 'Test Bot' }; // No username
    mockGetMe.mockResolvedValue(mockUserNoUsername);

    const { bot, botUsernameReady } = await initializeBot();
    const username = await botUsernameReady;

    expect(username).toBeNull();
    expect(mockTelegrafInstance.options.username).toBeUndefined();
    // botManager.js logs the botInfo object as the second argument in this case
    expect(mockBootstrapLogger.mock.calls).toContainEqual([
        expect.stringContaining('[BOT_MANAGER] bot.telegram.getMe() did not return expected botInfo or username.'),
        mockUserNoUsername
    ]);
  });

  test('should handle getMe returning empty username string, log error, and resolve botUsernameReady with null', async () => {
    const mockUserEmptyUsername = { id: 123456, username: '', first_name: 'Test Bot' };
    mockGetMe.mockResolvedValue(mockUserEmptyUsername);

    const { bot, botUsernameReady } = await initializeBot();
    const username = await botUsernameReady;

    expect(username).toBeNull();
    expect(mockTelegrafInstance.options.username).toBeUndefined();
    // botManager.js logs the botInfo object as the second argument in this case
    expect(mockBootstrapLogger.mock.calls).toContainEqual([
        expect.stringContaining('[BOT_MANAGER] bot.telegram.getMe() did not return expected botInfo or username.'),
        mockUserEmptyUsername
    ]);
  });

  test('should be idempotent: calling initializeBot multiple times returns the same instance and resolves same username', async () => {
    const mockUser = { id: 789, username: 'PersistentBot', first_name: 'Persistent' };
    mockGetMe.mockResolvedValue(mockUser);

    // First call
    const result1 = await initializeBot();
    const username1 = await result1.botUsernameReady;

    expect(mockTelegrafConstructor).toHaveBeenCalledTimes(1);
    expect(mockGetMe).toHaveBeenCalledTimes(1);
    expect(username1).toBe('PersistentBot');
    expect(result1.bot).toBe(mockTelegrafInstance);
    expect(mockTelegrafInstance.options.username).toBe('PersistentBot');

    // Second call
    const result2 = await initializeBot();
    const username2 = await result2.botUsernameReady;

    expect(mockTelegrafConstructor).toHaveBeenCalledTimes(1); // Still 1
    expect(mockGetMe).toHaveBeenCalledTimes(1); // Still 1
    expect(username2).toBe('PersistentBot');
    expect(result2.bot).toBe(mockTelegrafInstance); // Same instance
    expect(result1.botUsernameReady).toBe(result2.botUsernameReady); // Same promise instance
  });

  test('should handle unexpected error during Telegraf instantiation', async () => {
    const instantiationError = new Error('Telegraf constructor failed'); // Define error here
    mockTelegrafConstructor.mockImplementationOnce(() => {
      throw instantiationError; // Throw it from the mock
    });

    // `jest.resetModules()` in `beforeEach` ensures `initializeBot` will run afresh.
    // The module-level variables in botManager.js (bot, botUsernameReadyPromise, etc.)
    // will be in their initial state due to the reset.

    const { bot, botUsernameReady } = await initializeBot(); // This call will trigger the mock's throw
    const username = await botUsernameReady;

    expect(mockTelegrafConstructor).toHaveBeenCalledTimes(1);
    expect(mockGetMe).not.toHaveBeenCalled();
    expect(bot).toBeNull();
    expect(username).toBeNull();
    expect(mockBootstrapLogger.mock.calls).toContainEqual([
      expect.stringContaining('CRITICAL: Failed to initialize Telegraf bot instance'),
      instantiationError
    ]);
  });
});
