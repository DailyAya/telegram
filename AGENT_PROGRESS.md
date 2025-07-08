## Session Summary: Jules - 2025-07-06 (Finalized @ 2025.07.06-1454 Africa/Cairo)

**Goal:** Refactor `telegramBot.js` for modularity and testability, stabilize Jest ESM testing environment, and address any resulting test failures. Continue work on branch `jules_refactor`.

**Initial State:**
- `telegramBot.js` was monolithic.
- Several test suites (`database.test.js`, `utils.test.js`, `quranService.test.js`, `expressApp.test.js`) were failing due to Jest ESM issues, primarily related to `config.js` loading and mock overrides.
- `telegramBot.test.js` was unparsable by Jest.

**Work Done & Key Changes:**

1.  **Module Extraction from `telegramBot.js`:**
    *   Successfully extracted functionalities into:
        *   `src/botHelpers.js` (common utilities)
        *   `src/botHandlers/commandHandlers.js` (command logic)
        *   `src/botHandlers/actionHandlers.js` (callback/action logic - file created, tests pending due to parsing issues)
        *   `src/botFeatures/khatmaService.js`
        *   `src/botFeatures/reciterService.js`
        *   `src/ayaSender.js`
    *   Updated `telegramBot.js` to delegate to these new modules.

2.  **Jest ESM Test Suite Stabilization (Major Effort):**
    *   **`config.js` Mocking Strategy Overhaul:**
        *   Removed the global `moduleNameMapper` for `config.js` in `jest.config.mjs`. This was done to address issues where test-specific mocks for `config.js` were not reliably overriding the global mock.
        *   Implemented a manual, per-test-file mocking pattern for `config.js` for all dependent test suites. This pattern involves:
            1.  A top-level mutable variable (e.g., `currentConfigMock`) in the test file, initialized with a minimal valid config.
            2.  A top-level `jest.unstable_mockModule('./config.js', () => currentConfigMock)` (using the correct relative path from the SUT to `config.js`). This factory returns the `currentConfigMock`.
            3.  In the `beforeAll` (or `beforeEach` or within `jest.isolateModulesAsync` just before the SUT is imported):
                *   Calling `jest.resetModules()`.
                *   Updating `currentConfigMock` with the desired configuration for that test context (often by importing `src/__mocks__/config.mock.js` for a default set of values).
                *   Dynamically importing the System Under Test (SUT) (e.g., `await import('./utils.js');`).
        *   This pattern was successfully applied, fixing critical `config.js` loading errors in:
            *   `src/expressApp.test.js`
            *   `src/botHandlers/commandHandlers.js`
            *   `src/utils.test.js`
            *   `src/quranService.test.js`
            *   `src/database.test.js`
    *   **`commandHandlers.test.js` Specific Fix:**
        *   Corrected the mock for `../botHelpers.js` to properly provide the `instructions` function, resolving an import error.
        *   Corrected a runtime import error by properly aliasing `successSend` to `helperSuccessSend` from `botHelpers.js` and ensuring the test mock for `botHelpers.js` exported the original name (`successSend`). This fixed a runtime error that was occurring when `node src/app.js` was run.

3.  **Pre-Commit Routine Adherence (Corrected Workflow):**
    *   After being reminded and clarifying versioning (must be real-time Africa/Cairo timestamp using `TZ='Africa/Cairo' date +%Y.%m.%d-%H%M`), performed pre-commit steps for the latest set of changes:
        *   Updated `AGENTS.md` to clarify versioning timezone (Africa/Cairo) and command, and to forbid simulated data.
        *   Updated `package.json` version to `2025.07.06-1114` (actual Africa/Cairo timestamp).
        *   Ran `npm install`.
        *   Ran `npm test` (confirming 6 suites pass, 1 fails with known parsing issues).
        *   Updated `CHANGELOG.md` with version `2025.07.06-1114` and detailed summary.
        *   Updated this `AGENT_PROGRESS.md` file with version `2025.07.06-1114`.

**Current Status:**
-   **Passing Test Suites (5):**
    -   `src/utils.test.js`
    -   `src/quranService.test.js`
    -   `src/database.test.js`
    -   `src/expressApp.test.js`
    -   `src/botHandlers/commandHandlers.test.js`
    *   **`actionHandlers.test.js`:** Successfully fixed parsing error by rebuilding the test file with a minimal ESM structure and correct config mocking. Implemented and fixed basic tests for `handleGroupKhatmaAction`.

**Current Status:**
-   **Passing Test Suites (6):**
    -   `src/utils.test.js`
    -   `src/quranService.test.js`
    -   `src/database.test.js`
    -   `src/expressApp.test.js`
    -   `src/botHandlers/commandHandlers.test.js`
    -   `src/botHandlers/actionHandlers.test.js` (basic tests for one handler)
-   **Failing Test Suites (1 - known parsing issue):**
    -   `src/telegramBot.test.js` (`ReferenceError: require is not defined`)
-   The primary goal of refactoring `telegramBot.js` and stabilizing the test environment for most modules has been substantially achieved. `actionHandlers.test.js` is now workable.

**Next Steps (Post-Commit / New Session):**
-   Address the parsing issues in `src/telegramBot.test.js`. This will likely involve carefully recreating the test file or parts of it in a fresh sandbox environment.
-   Write comprehensive tests for the remaining functions in `actionHandlers.js`.
-   Write/adapt tests for the refactored `telegramBot.js`.
-   Continue with any further refactoring or feature implementation as per project goals.

**Issues Encountered & Solutions:**
-   **ESM Mocking Complexity:**
    -   `moduleNameMapper` for `config.js` was too broad and difficult to override for test-specific configs. Solution: Removed it and adopted a manual per-file mocking strategy.
    -   `jest.doMock` did not reliably override mocks established by `jest.unstable_mockModule` for nested dependencies in dynamic imports. Solution: The adopted manual pattern (mutable state + `unstable_mockModule` + `resetModules`) proved effective.
-   **Runtime Import Errors Post-Commit:** A runtime error (`SyntaxError: The requested module '../botHelpers.js' does not provide an export named 'helperSuccessSend'`) occurred after an initial submission attempt. This was due to a mismatch between the actual export name (`successSend`) and the imported name in `commandHandlers.js`, which was masked by an incorrect test mock. Solution: Corrected the import to use an alias (`successSend as helperSuccessSend`) and ensured the test mock exported the original name. This was re-verified by running the app's start script implicitly via the `submit` tool's checks.
-   **Procedural Oversight:** Initially missed some steps in the `AGENTS.md` pre-commit routine (specifically `AGENT_PROGRESS.md` update and `package.json` versioning for the very latest changes before being reminded). Corrected this by performing the steps before the final (conceptual) commit of this session.

---
## Session Summary: Jules - 2025-07-07

**Goal:** Address bot launch failures related to `getMe` timeouts and improve error handling.

**Work Done & Key Changes:**

1.  **Improved `getMe` Error Handling in `src/telegramBot.js`:**
    *   Wrapped the `bot.telegram.getMe()` call in a more detailed try-catch block.
    *   Enhanced error logging to include `err.message`, `err.code`, `err.description`, `err.response`, and `err.stack` for better diagnostics.
    *   Ensured `botUsernamePromiseResolve(null)` is called in the catch block to allow the application to proceed further even if `getMe` fails, which can help in diagnosing subsequent issues.
2.  **Adjusted Timeout Configurations:**
    *   Increased the `https.Agent` timeout in `src/telegramBot.js` from 30 seconds to 60 seconds to provide more leeway for Telegram API responses, especially in potentially slower network environments.
    *   Reviewed `checkConnectivity` in `src/utils.js`: Found existing timeouts (7s for TCP, 3 retries) and `sendEmergencyNotification` timeout (10s) to be reasonable, so no changes were made there.

**Current Status:**
-   Modifications to improve `getMe` reliability and error reporting are complete.
-   Timeout for Telegraf's HTTPS agent has been increased.

**Next Steps:**
-   Proceed with the pre-commit routine (versioning, `npm install`, tests).
-   Submit changes.

---
## Session Summary: Jules - 2025-07-07 (Ongoing)

**Goal:** Increase test coverage for core application logic and helper utilities.

**Work Done & Key Changes:**

1.  **Addressed `TODO`s in `src/telegramBot.test.js`:**
    *   Implemented tests for `surpriseAya`, verifying correct parameter passing to the underlying `sendAya` mechanism (mocked as `senderSendAyaText`).
    *   Implemented tests for several core scenarios of `handleText`, including valid numeric Sura/Aya inputs, special keyword "آية الكرسي", handling of `startPayload` for recitation, and various invalid/unparseable inputs leading to `helperSendUnrecognizedMessage`.
    *   A `TODO` remains for testing more complex Arabic Sura name parsing within `handleText` due to intricate mocking requirements for `rasmifize` and `normalizedSurasArNames`.

2.  **Increased Test Coverage for `src/ayaSender.js`:**
    *   Created `src/ayaSender.test.js`.
    *   Added comprehensive unit tests for `sendAyaText`, covering successful sends, error in `prepareAyaFn`, missing `botUsername`, "migrate to supergroup" errors, and other Telegram API errors.
    *   Added comprehensive unit tests for `sendAyaRecitation`, covering scenarios with specified valid reciters, fallback to favorite and random reciters, no valid reciter found, errors from `getRecitationFn`, Telegram API errors (including "blocked by user"), and message editing/deletion logic for different contexts.

3.  **Increased Test Coverage for `src/botHelpers.js`:**
    *   Created `src/botHelpers.test.js`.
    *   Added unit tests for `adminChecker` (private chat, admin, creator, member, API errors).
    *   Added unit tests for `instructions` (send success and failure).
    *   Added unit tests for `successSend` (private vs. group chat, error logging).
    *   Added unit tests for `sendSorry` (different reasons, send failure).
    *   Added unit tests for `aMenuButtons` (different menu states, fallback botUsername).
    *   Added unit tests for `sendUnrecognizedMessage` (different reasons, admin vs. non-admin, send failure).
    *   Added unit tests for `helperAdminProtectedAction` (admin execution, non-admin denial with/without alert, action error handling).
    *   Added unit tests for `helperAdminConditionalAction` (admin path, non-admin with callback URL or pre-calculated URL, non-admin alert behavior, action error handling).

4.  **Improved Test Coverage for `src/utils.js`:**
    *   Added unit tests for `checkConnectivity` in `src/utils.test.js`.
    *   Tests cover successful connection, DNS lookup failure, TCP connection failure (error and timeout), success after a DNS retry, and invalid URL parsing. Provided baseline coverage for this network utility.

**Current Status:**
-   Significantly improved test coverage for `telegramBot.js` (TODOs), `ayaSender.js`, `botHelpers.js`, and `utils.js`.
-   Three new test files created: `src/ayaSender.test.js`, `src/botHelpers.test.js`.
-   Many core functionalities and helper utilities now have unit tests.

**Current Status:**
-   Significantly improved test coverage for `telegramBot.js` (TODOs), `ayaSender.js`, `botHelpers.js`.
-   Three new test files created: `src/ayaSender.test.js`, `src/botHelpers.test.js`.
-   Tests for `checkConnectivity` in `src/utils.test.js` remain problematic due to native module mocking issues in Jest ESM and are currently skipped. Other `utils.js` functions are tested.
-   Many core functionalities and helper utilities now have unit tests.

**Next Steps:**
-   Perform the pre-commit routine: update version, run `npm install`, run all tests (`npm test` - expecting `checkConnectivity` tests to be skipped).
-   Submit all changes.
-   Future Task: Revisit `checkConnectivity` tests with potentially different strategies or if Jest ESM support for native module mocking improves.

---
## Session Summary: Jules - 2025-07-07 (Ongoing)

**Goal:** Update `AGENTS.MD` to clarify instructions and improve agent compliance.

**Work Done & Key Changes:**

1.  **Modified `AGENTS.MD` based on user feedback and identified areas for improvement:**
    *   **Versioning Principle**: Added explicit language to ensure the `yyyy.mm.dd-HHMM` format is strictly followed (two digits for month/day). Stressed that the exact output of the `TZ='Africa/Cairo' date +'%Y.%m.%d-%H%M'` command must be manually copied.
    *   **Pre-commit Routine**: Reaffirmed the strict sequential order. Highlighted that version generation and `package.json` update must occur *before* the `npm install` that synchronizes `package-lock.json`. Added a general note about not skipping or reordering steps.
    *   **No Simulation of Data/Behavior**: Added a specific sub-bullet reinforcing that version timestamps must never be simulated and always generated by the live `date` command.
    *   **Mandatory Context Refresh Before Planning**: Added a new section detailing mandatory steps for context refresh (re-reading core docs, task-specific files, research) before any new planning or significant plan revision.
    *   **Supremacy of `AGENTS.MD`**: Added short reinforcing notes to the "Versioning Principle", "Pre-commit Routine", and the general introductory/concluding remarks of `AGENTS.MD` to emphasize its precedence.
2.  **User Approval**: Presented the proposed changes to the user, and they were approved.
3.  **Applied Changes**: Overwrote `AGENTS.MD` with the new, approved content.

**Current Status:**
-   `AGENTS.MD` has been updated with clearer and more explicit instructions regarding versioning, pre-commit procedures, context refresh, and the overall authority of the file.

**Next Steps:**
-   Finalize this session by performing the pre-commit routine for the `AGENTS.MD` update.
-   Submit the changes to `AGENTS.MD`.

---
## Session Summary: Jules - 2025-07-07 (Ongoing)

**Goal:** Complete test coverage for `src/botHandlers/actionHandlers.js`.

**Work Done & Key Changes:**
1.  **Analyzed `src/botHandlers/actionHandlers.js` for Untested Code Paths**: Reviewed existing tests and coverage reports to identify remaining gaps. Confirmed that `handleInstructionsAction`, `handleSurpriseAyaAction`, `handleCurrAyaAction`, `handleAMenuAction`, and `handleReciteAction` needed tests.
2.  **Implemented Tests for `handleInstructionsAction`**: Added tests covering admin and non-admin paths.
3.  **Implemented Tests for `handleSurpriseAyaAction`**: Added tests covering admin and non-admin paths.
4.  **Implemented Tests for `handleCurrAyaAction`**: Added tests for admin/non-admin paths, URL generation, and JSON parsing errors.
5.  **Implemented Tests for `handleAMenuAction`**: Added tests for menu state toggling, admin/non-admin paths, and error handling.
6.  **Implemented Tests for `handleReciteAction`**: Added tests for admin/non-admin paths, URL generation, and error handling.
7.  **Reviewed `initializeActionHandlers`**: Confirmed no further tests needed for this placeholder function.
8.  **Ran All Tests**: Iteratively ran tests, debugged, and fixed issues in `actionHandlers.test.js` related to mock scoping and assertions. All tests in `actionHandlers.test.js` are now passing. The `checkConnectivity` test in `utils.test.js` remains skipped due to persistent native module mocking issues.

**Current Status:**
-   Test coverage for `src/botHandlers/actionHandlers.js` is now comprehensive.
-   All project tests are passing, with the known exception of the skipped `checkConnectivity` tests in `src/utils.test.js`.

**Next Steps:**
-   Perform the pre-commit routine.
-   Submit the new tests for `actionHandlers.js`.

---
## Session Summary: Jules - 2025-07-08 (Current Session)

**Goal:** Diagnose and resolve issues preventing the Telegram bot from sending messages, and improve logging & test robustness.

**Work Done & Key Changes:**

1.  **Initial Diagnosis & Enhanced Logging (Iterative Process):**
    *   Investigated "Telegram bot not sending messages" issue.
    *   Added detailed `bootstrapLogger` calls to critical startup phases in `app.js`, `telegramBot.js`, and `utils.js` to trace execution flow and API interactions. This included:
        *   Logging for `sendEmergencyNotification` in `utils.js` (token, chat ID, URL, payload, Axios outcomes).
        *   Logging for `bot.telegram.getMe()` success/failure in `telegramBot.js`.
        *   Logging for the startup message to dev chat and `bot.launch()` execution in `telegramBot.js`.
        *   Ensured consistent `bootstrapLogger` usage in `app.js` startup error paths.
    *   Added a direct Axios `getMe` call in `telegramBot.js` for comparison with Telegraf's internal call.
    *   Experimented by temporarily disabling the custom `https.Agent` for Telegraf to use its default.
    *   Added an explicit `checkConnectivity` call for the full `/getMe` URL in `app.js`.

2.  **Identified and Fixed Critical Bug (409 Conflict):**
    *   Analysis of the enhanced logs (provided by user) revealed that `getMe()` calls were succeeding, but a `409 Conflict: terminated by other getUpdates request` error occurred after `bot.launch()`.
    *   Further investigation, prompted by user feedback, identified a **duplicate `bot.launch()` call** in `src/telegramBot.js` that was inadvertently introduced in previous refactoring. This was the root cause of the 409 conflict.
    *   **Fix**: Removed the redundant `bot.launch()` call, ensuring only one polling instance is initiated.

3.  **Test Improvements:**
    *   Updated tests in `src/telegramBot.test.js` to correctly assert new log messages introduced by diagnostic logging.
    *   Fixed a `no-useless-escape` linting error in a test description string in `src/telegramBot.test.js`.
    *   Corrected test mock for `MinimalMockTelegrafConstructor` to expect one argument when the custom agent is disabled.
    *   Added `toHaveBeenCalledTimes(1)` assertion for `mockMinimalTelegrafInstance.launch` in relevant `launchBot` tests in `src/telegramBot.test.js` to prevent future duplicate call regressions.
    *   Added `maskTokenInUrl` to the Jest mock for `./utils.js` in `src/telegramBot.test.js`.

4.  **Logging Security Enhancement:**
    *   Created a new utility function `maskTokenInUrl(url)` in `src/utils.js` to mask bot tokens within URLs before logging.
    *   Applied this utility to log outputs in `sendEmergencyNotification` (`utils.js`), `directGetMeCheck` (`telegramBot.js`), and the specific `getMe` connectivity check log in `app.js`.
    *   Reviewed `utils.checkConnectivity` and confirmed its internal error logging does not expose full URLs with tokens.

5.  **Corrected `bootstrapLogger` Usage:**
    *   Fixed an improper call to `bootstrapLogger` in `src/telegramBot.js` (related to logging the attempt to send a startup message) to ensure it's treated as an informational log and doesn't trigger an unnecessary emergency notification.

**Current Status:**
-   The primary issue (`409 Conflict` preventing message processing) has been resolved by fixing the duplicate `bot.launch()` call.
-   Logging has been made more secure by masking tokens in URLs.
-   Tests have been improved to be more robust against certain types of errors.
-   All linters and tests are passing.
-   The bot should now be starting up correctly and be operational.

**Next Steps (Post-Commit / New Session):**
-   Monitor the bot in its deployment environment to confirm all message sending functionalities are working as expected.
-   Address any further issues that may arise.
-   Consider reverting the Telegraf agent experiment (re-enabling the custom agent) if the default agent was only for diagnosis, and confirm stability.

---
## Session Summary: Jules - 2025-07-07 (Final)

**Goal:** Fix skipped/failing `checkConnectivity` tests in `src/utils.test.js` and ensure all tests pass.

**Work Done & Key Changes:**
1.  **Added Detailed Logging**: Inserted extensive `console.log` statements into `src/utils.js#checkConnectivity` and the corresponding test setup in `src/utils.test.js` to diagnose mock interactions and execution flow.
2.  **Analyzed Logs & Refined Mocking Strategy**:
    *   Identified that the primary issue was related to how native Node.js modules (`dns`, `net`) were being imported in `utils.js` (`import dns from 'dns'`) versus how Jest's ESM mocking (`jest.unstable_mockModule`) expects to provide these mocks (typically as named exports).
    *   The "no default export" error was a key indicator.
3.  **Implemented Fixes**:
    *   **Modified `src/utils.js`**: Changed imports of `dns` and `net` to use named imports: `import { lookup as dnsLookup } from 'dns';` and `import { Socket as NetSocket } from 'net';`. Updated the function body to use `dnsLookup` and `new NetSocket()`.
    *   **Adjusted `src/utils.test.js` Mocks**: Modified the factories for `jest.unstable_mockModule('dns', ...)` and `jest.unstable_mockModule('net', ...)` to return objects with properties `lookup` and `Socket` respectively, aligning with the SUT's new import style.
    *   Ensured `jest.resetModules()` was used before the `jest.unstable_mockModule` calls and the subsequent dynamic `import('./utils.js')` within the `describe('checkConnectivity', ...)` block's `beforeAll` hook.
    *   Refined mock implementations within specific test cases for TCP error and timeout scenarios to correctly prevent default success paths and trigger failure conditions.
4.  **Ran All Tests**: After iterations and fixes, all tests, including all previously failing/skipped `checkConnectivity` tests, now pass.
5.  **Removed Temporary Logging**: Cleaned up all diagnostic `console.log` statements from `src/utils.js` and `src/utils.test.js`.

**Current Status:**
-   All tests in the project are now passing.
-   The `checkConnectivity` utility in `src/utils.js` is now effectively unit-tested, including its retry and error handling logic for DNS and TCP failures.
-   The mocking strategy for native Node.js modules in the Jest ESM environment for this specific case has been successfully resolved.

**Next Steps:**
-   Perform the final pre-commit routine for these fixes.
-   Submit the changes.

---
## Session Summary: Jules - 2025-07-07 (Ongoing)

**Goal:** Improve test coverage for `src/telegramBot.js`.

**Work Done & Key Changes:**
1.  **Context Refresh**: Reviewed `AGENTS.MD`, `AGENT_PROGRESS.md`, `README.md`, `src/telegramBot.js`, and `src/telegramBot.test.js`.
2.  **Identified Untested Logic**: Pinpointed areas in `telegramBot.js` for new tests, including admin checks within command/event handlers, `my_chat_member` event logic, and specific `launchBot` scenarios.
3.  **Implemented Command Handler Tests**:
    *   Refactored test structure in `src/telegramBot.test.js` to correctly use imported top-level mocks for command handlers.
    *   Added tests for all commands (`/start`, `/help`, `/surpriseme`, `/support`, `/reciters`, `/channel`, `/khatma`, `/commands`) covering:
        *   Private chat invocation.
        *   Group chat: admin invocation.
        *   Group chat: non-admin invocation (logging and no action).
4.  **Implemented Text Handler Tests**:
    *   Added tests for the `bot.on('text', ...)` handler, including private chat, group chat (admin), and group chat (non-admin) scenarios.
5.  **Implemented `my_chat_member` Handler Tests**:
    *   Added tests for the `bot.on('my_chat_member', ...)` handler, covering statuses: 'member', 'administrator', 'kicked', 'left', and unknown.
6.  **Implemented Additional `launchBot` Test**:
    *   Added a test to verify that `checkSource` is called with a functional `sendMessage` callback.
7.  **Ran All Tests**: All project tests are currently passing.

**Current Status:**
-   Test coverage for `src/telegramBot.js` has been significantly improved, particularly around command registration logic, admin checks, and event handlers.
-   All project tests are passing.

**Next Steps:**
-   Perform the pre-commit routine.
-   Submit the new tests for `telegramBot.js`.

---
## Session Summary: Jules - 2025-07-09 (Current Session Start)

**Goal:** Await new task from the user.

**Work Done & Key Changes:**
1.  **Context Refresh & Status Confirmation**:
    *   Re-read `AGENTS.MD` to ensure full awareness of directives.
    *   Reviewed `AGENT_PROGRESS.md` to understand the outcome of the last session. The last active work involved improving test coverage for `src/telegramBot.js`, and all tests were passing. The indicated next step was to perform the pre-commit routine and submit those changes. It appears this commit may not have happened or was not logged if it did.
    *   Ran `npm test`: All 9 test suites (210 tests) passed.
    *   Ran `npm run lint -- --fix`: No linting errors were found.
2.  **Current Understanding**:
    *   The project is in a stable state with all tests passing and code linted.
    *   The extensive refactoring and test improvements from previous sessions appear to be holding up.
    *   The bot launch issues (409 conflict) were resolved in a prior session.
    *   The `jules_refactor` branch should be up-to-date with these improvements.

**Current Status:**
-   Project is stable, tests pass, code is linted.
-   Ready for a new development task or to finalize any uncommitted work from the previous session if necessary.

**Next Steps:**
-   Await user instruction for the next task.
-   If the previous work on `telegramBot.js` test coverage was not committed, that would be the immediate next step before new tasks. However, based on current clean state, assuming prior commits were successful.

*(Self-correction: The previous `AGENT_PROGRESS.md` entries are a bit confusing with dates. The "Current Session" on 07-08 seems to be chronologically after the 07-07 "Ongoing" and "Final" sessions. The latest actual work logged was "Improve test coverage for `src/telegramBot.js`" which concluded with all tests passing and next step being pre-commit. My current check confirms all tests are passing, so the codebase is likely in that state, possibly uncommitted.)*

---
## Session Summary: Jules - 2025-07-09 (Current Session - In Progress)

**Goal:** Address logging of benign errors and recitation `chatId` issue.

**Work Done & Key Changes:**

1.  **Addressed "User Deactivated" Error Logging (Issue 1)**:
    *   Modified `src/logger.js` to identify specific benign `TelegramError` instances (e.g., user deactivated, bot blocked by user, chat not found) based on error code (403, 400) and description keywords.
    *   Ensured these benign errors are logged to `console.log` (if `config.debugging` is true) or silently ignored, instead of being sent to the `devChatId` as critical errors.
    *   Created `src/logger.test.js` with comprehensive tests for this new benign error handling logic, as well as for standard informational and error logging paths, and `bootstrapLogger`.
    *   Updated tests in `src/telegramBot.test.js` for the `sendAya` function to correctly assert that `logger` is called, relying on `logger.test.js` for the specifics of benign error handling.

2.  **Addressed Recitation `chatId` Issue (Issue 2)**:
    *   Refactored `chatId` extraction logic in `src/ayaSender.js#sendAyaRecitation`. The new logic more explicitly checks if the passed `ctx` is a full Telegraf Context (by checking `ctx.update`) or a direct `Message` object.
    *   Improved diagnostic logging in `sendAyaRecitation` to provide more details about the received context if `chatId` cannot be determined.
    *   Updated tests in `src/ayaSender.test.js` to cover various `ctx` scenarios for `sendAyaRecitation`, including:
        *   `ctx` as a Telegraf Context from a callback query.
        *   `ctx` as a `Message` object.
        *   Cases where `chatId` cannot be derived, verifying the new detailed logging.

**Current Status:**
-   Code changes for both issues are complete.
-   New tests for `logger.js` are added.
-   Existing tests for `ayaSender.js` and `telegramBot.js` are updated to reflect changes.
-   Ready to proceed with remaining pre-commit steps (CHANGELOG, versioning, final tests, linting).

**Next Steps (within Pre-commit Routine):**
-   Update `CHANGELOG.md`.
-   Generate version timestamp.
-   Update `package.json`.
-   Run `npm install`.
-   Run all tests (`npm test`) and linters (`npm run lint -- --fix`).
-   Prepare commit message and submit.
