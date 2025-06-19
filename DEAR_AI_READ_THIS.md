# DEAR AI: PLEASE READ AND ADHERE TO THESE INSTRUCTIONS!

**This file (`DEAR_AI_READ_THIS.md`) is the primary source of development directives and guidelines for AI agents working on the DailyAyaBot project. You MUST consult and adhere to the instructions herein before and during your work.**

---

## For AI (Jules/Agent) - Development Directives

These directives are crucial for maintaining and developing the DailyAyaBot:

### Critical Working Principles:

**No Simulation of Instructions:** You must not simulate any instructions or data. For example, timestamps for versioning must be obtained using actual system commands (e.g., `TZ='Africa/Cairo' date +'%Y.%m.%d-%H%M'`) and not be hardcoded or based on assumptions. Always seek to retrieve real data as required by the task.

**Consult Documentation:** Always strive to consult relevant, specific documentation (e.g., for external APIs, platforms like Northflank, or libraries used) *before* proposing detailed solutions or configurations. Prioritize official documentation to ensure advice is accurate and up-to-date.

### Versioning Principle:

Each set of submitted changes (commit) **must be associated with a new version** recorded in `package.json`. The version format is `yyyy.mm.dd-hhmm` (Timezone: Africa/Cairo). This version string **must** also be included in the commit message. For the specific steps and timing of version updates, refer to the "Pre-commit Routine" section.

### `package-lock.json` Importance and Synchronization Principle:

The `package-lock.json` file is critical for ensuring reproducible builds by locking down the exact versions of all dependencies. It **must be kept synchronized** with `package.json`. Whenever `package.json` is modified (either dependency list or project version), `package-lock.json` must be updated accordingly. For the specific steps, refer to the "Pre-commit Routine" section.

### Pre-commit Routine:

Before submitting any changes, the following steps **must be performed in order**:

1.  **Finalize Code Implementation:** Ensure all planned code modifications for the current task are complete, tested (conceptually or actually, if possible), and meet requirements.
2.  **Update `README.md` (if applicable):** If changes impact user-facing features, general developer information, or setup instructions, update `README.md` accordingly.
3.  **Update `DEAR_AI_READ_THIS.md` (if applicable):** If AI operational guidelines, refactoring goals, or key development procedures documented herein have changed or been completed, update this file.
4.  **Dependency Update (if applicable):** If `package.json` dependencies were added, removed, or changed:
    *   Run `npm install`. This will update `package-lock.json` to reflect these dependency changes.
5.  **Generate Version Timestamp:** Obtain the current timestamp using `TZ='Africa/Cairo' date +'%Y.%m.%d-%H%M'`.
6.  **Update `package.json` Version:** Modify the `version` field in `package.json` with the newly generated timestamp.
7.  **Synchronize `package-lock.json`:** Run `npm install` again. This step is crucial even if run in step 4 (or for the first time if only the version in `package.json` changed). It ensures that `package-lock.json` is fully synchronized, particularly its internal `name` and `version` fields which should mirror `package.json`.
8.  **Prepare Commit Message:** Draft a descriptive commit message that includes the new version string (e.g., "Version: yyyy.mm.dd-hhmm").
9.  **Submit Changes:** Commit all modified files, which typically include any changed source code files, `README.md` (if updated), `DEAR_AI_READ_THIS.md` (if updated), `package.json`, and `package-lock.json`.

### AI Guidelines Maintenance:

This `DEAR_AI_READ_THIS.md` file **must be reviewed and updated with each commit if AI operational guidelines change**. Ensure all directives herein are current. For general project documentation updates (for users or human developers), the main `README.md` file must be updated. (This is also covered in the Pre-commit Routine).

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
    *   Added a `/health` endpoint to `src/expressApp.js` to provide a dedicated health check for deployment platforms like Northflank.
*   Correcting timer logic for accurate and consistent daily Aya delivery.
*   Improving error handling and logging across the application.
    *   Enhanced logging for non-critical Telegram API errors like "message not modified" and "MESSAGE_ID_INVALID" in `src/telegramBot.js`.
    *   Implemented a global Axios instance (`apiClient`) in `src/quranService.js` with a default 15-second timeout and a User-Agent header to improve robustness of interactions with `api.alquran.cloud`.
    *   Confirmed that emergency notifications in `src/utils.js` use Axios with a timeout.
*   Standardizing development and deployment procedures (including versioning and README updates).
    *   Updated AI agent directives (`DEAR_AI_READ_THIS.md`) to include the principle of consulting specific documentation before proposing solutions.
    *   Added `.env` to `.gitignore` to prevent accidental commitment of secrets.
    *   Established a routine of running `npm install` after `package.json` version changes to ensure `package-lock.json` is synchronized.
    *   Restructured AI guidelines within `DEAR_AI_READ_THIS.md` to introduce a dedicated "Pre-commit Routine" section with logically ordered steps, and clarified related principles.
Refer to the specific GitHub issue for detailed tasks and objectives for the current development cycle.
