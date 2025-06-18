# DailyAya Telegram Bot

## For Users

The DailyAyaBot sends you a random verse (Aya) from the Holy Quran every day. You can also interact with the bot to get specific Ayas, listen to recitations, and participate in group Quran readings (Khatma).

### Key Features:

*   **Daily Random Aya:** Receive an Aya automatically. After your first interaction or if you request an Aya, subsequent timed Ayas are typically sent around the same hour each day, aligning to the start of the hour (e.g., if your last Aya was at 10:20 AM, your next timed one will likely be at 10:00 AM or 11:00 AM the following day, depending on when the hourly check runs relative to your 24-hour cycle).
*   **Request Specific Aya:** Ask for a particular Sura and Aya number (e.g., "2 255" or "Al-Baqarah 255").
*   **Set Favorite Reciter:** Choose your preferred reciter for audio recitations.
*   **Surprise Me:** Get a random Aya with recitation on demand.
*   **Group Khatma:** Participate in collaborative Quran readings by selecting Juz' to read.

### Available Commands:

*   `/start`: Start interacting with the bot and see the welcome message.
*   `/help`: Get instructions on how to use the bot and request Ayas.
*   `/surpriseme`: Receive a random Aya with recitation.
*   `/reciters`: Choose and set your favorite reciter.
*   `/khatma`: Participate in a group Khatma by selecting a Juz'.
*   `/commands`: Show all available commands.
*   `/support`: Find ways to support the bot.
*   `/channel`: Get a link to the DailyAya channel.

## For Developers

This project is a Node.js application using the Telegraf.js library for Telegram Bot API interactions and MongoDB for database storage.

### Project Structure Overview:

*   **`src/app.js`**: The main entry point of the application. Handles initialization, timer scheduling, and overall application lifecycle.
*   **`src/telegramBot.js`**: Contains all the Telegram bot logic, including command handlers, action handlers (callback queries), and message processing.
*   **`src/quranService.js`**: Responsible for fetching and processing Quran text, translations, and reciter information.
*   **`src/database.js`**: Manages interactions with the MongoDB database (storing chat information, user preferences, etc.).
*   **`src/config.js`**: Handles application configuration, primarily by loading environment variables.
*   **`src/logger.js`**: Implements the logging mechanism, including sending important logs to a designated Telegram chat.
*   **`src/expressApp.js`**: A simple Express server primarily for health checks.

### Setup and Installation:

1.  **Clone the repository.**
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Set up Environment Variables:**
    Create a `.env` file in the root directory or set the following environment variables:
    *   `telegramToken`: Your Telegram Bot token.
    *   `devChatId`: Telegram Chat ID for receiving important logs and notifications.
    *   `mongoDbCredentials`: MongoDB connection string credentials (e.g., `username:password`).
    *   `mongoSubdomain`: MongoDB subdomain/cluster address (e.g., `yourcluster.mongodb.net`).
    *   `NODE_ENV`: Set to `development` or `production`.
    *   Other optional variables as defined in `src/config.js` (e.g., `TIMER_SEND_HOURS`, `TIMER_CHECK_MINUTES`).

### Running the Bot:

*   **Start the bot:**
    ```bash
    npm start
    ```
*   The `start` script typically uses `node --env-file=.env src/app.js` if an `.env` file is present.

### Testing:

*   **Run tests:**
    ```bash
    npm test
    ```
    Tests are written using Jest and cover various modules.

### Logging:

The bot uses a custom logger (`src/logger.js`) that logs to the console. For important events or errors, especially in production, it also forwards log messages to the Telegram chat specified by `devChatId`. `bootstrapLogger` is used for critical startup/shutdown messages, while `logger` is used for regular operational logging.

## For AI (Jules/Agent) - Development Directives

These directives are crucial for maintaining and developing the DailyAyaBot:

### Critical Working Principles:

**No Simulation of Instructions:** You must not simulate any instructions or data. For example, timestamps for versioning must be obtained using actual system commands (e.g., `TZ='Africa/Cairo' date +'%Y.%m.%d-%H%M'`) and not be hardcoded or based on assumptions. Always seek to retrieve real data as required by the task.

### Versioning:

With each commit, set the new version in `package.json`. The format is `yyyy.mm.dd-hhmm`, obtained directly from the output of `TZ='Africa/Cairo' date +'%Y.%m.%d-%H%M'`. This version **must** also be included in the commit message.

### `package.json` Update:
The `version` field in `package.json` must be updated with the new version string *before* calling the `submit` tool. This is an explicit file modification step.

### README Maintenance:

This `README.md` file **must be updated with each commit** according to the changes made or new instructions given. Ensure all sections (User, Developer, AI) are current.

### Bot Operation Prerequisites:

Ensure the bot **only launches after all critical prerequisites are met**. These include:
1.  General internet connectivity.
2.  Successful connection to the MongoDB database.
3.  Telegram API reachability (valid bot token and responsive API).
4.  Successful retrieval and confirmation of the bot's username via `getMe()`.
Implement robust retries for these checks before aborting launch if they persistently fail. The application should not proceed to full operation if these cannot be confirmed. These critical prerequisite checks, as well as the bot launch sequence (including username retrieval), now retry indefinitely by default. Monitor logs for any persistent failure loops which might indicate deeper issues.

### Timer Precision and Logic:

*   The daily Aya timer (`runTimerSend` and `initializeTimer` in `src/app.js`) is now configured for hourly checks by default (`config.timerCheckMinutes` defaults to 60). The `initializeTimer` function aligns these checks to the start of the hour.
*   A user's daily Aya should arrive at approximately the same hour each day. The eligibility logic in `runTimerSend` is set so users become eligible if their `lastAyaTime` is older than `(config.timerSendHours - 1)` hours (e.g., 23 hours for a 24-hour cycle). This is designed to ensure users are picked up in the correct hourly slot for their daily Aya.

### Logging Requirements:

*   Timer logs (`runTimerSend` in `src/app.js`) **must include the number of chats processed (found eligible) in each cycle**. This log should use the standard `logger` for potential forwarding.
*   All significant operations, errors, and state changes (especially related to bot launch, DB connection, API interactions, and timer cycles) should be logged appropriately using `logger` or `bootstrapLogger` based on severity and context.
*   An emergency notification system (`sendEmergencyNotification` in `utils.js`) using `axios` attempts to send critical `bootstrapLogger` errors to `devChatId` directly. This acts as a fallback for early startup errors when the main Telegraf instance might be unavailable, providing an additional layer of error reporting.

### General Instruction:

Always ask for clarification instead of making assumptions. Refer to previous instructions, context provided in the issue, and existing code patterns.

### Current Issue Context / Refactoring Goals:

This bot is undergoing refactoring to improve robustness, fix bugs, and enhance maintainability. Key areas of focus include:
*   Ensuring reliable startup and prerequisite checks.
*   Correcting timer logic for accurate and consistent daily Aya delivery.
*   Improving error handling and logging across the application.
*   Standardizing development and deployment procedures (including versioning and README updates).
Refer to the specific GitHub issue for detailed tasks and objectives for the current development cycle.
