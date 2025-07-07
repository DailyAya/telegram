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
