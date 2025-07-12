// [TELEGRAMBOT_SUT] Importing dependencies... (Original log)
import { Telegraf, Markup } from 'telegraf';
// [TELEGRAMBOT_SUT] Telegraf (Markup) imported. (Original log)
import config from './config.js';
import { logger, bootstrapLogger } from './logger.js';
import { lastAyaTime, setFavReciter, getFavReciter } from './database.js';
import {
    adminChecker as helperAdminChecker,
    successSend as helperSuccessSend,
    sendSorry as helperSendSorry,
    aMenuButtons as helperAMenuButtons,
    helperAdminProtectedAction,
    helperAdminConditionalAction,
    sendUnrecognizedMessage as helperSendUnrecognizedMessage,
    instructions as helperInstructions,
} from './botHelpers.js';
import * as commandHandlers from './botHandlers/commandHandlers.js';
import * as actionHandlers from './botHandlers/actionHandlers.js'; // Assuming this is needed for specific actions
import { khatmaUpdate as khatmaServiceKhatmaUpdate } from './botFeatures/khatmaService.js';
import { sendAyaText as senderSendAyaText, sendAyaRecitation as senderSendAyaRecitation } from './ayaSender.js';
import {
    prepareAya,
    getRecitation,
    isValidReciter,
    getRandomReciterIdentifier,
    nextAya,
    ayaId2suraAya,
    suraAya2ayaId,
    normalizedSurasArNames,
    rasmifize,
    getQuranData,
    checkSource,
} from './quranService.js';
import {
    populateRecitersButtons as servicePopulateRecitersButtons,
    recitersNavPage as serviceRecitersNavPage,
} from './botFeatures/reciterService.js';
import { randomAyaNumber, numArabicToEnglish } from './utils.js';

let activeBotInstance = null;
const quranData = getQuranData();

async function sendAya(chatId, ayaId, reciter, lang, trigger, withRecitation = false) {
    logger(
        `Initiating sending an Aya to chat ${chatId}. AyaID: ${ayaId || 'random'}, Reciter: ${reciter || 'default/random'}, Trigger: ${trigger}, Recitation: ${withRecitation}`
    );
    const targetAyaId = ayaId || randomAyaNumber();

    if (!activeBotInstance || !activeBotInstance.telegram || !activeBotInstance.options) {
        logger(
            'Error: sendAya called before bot is properly initialized/registered.',
            new Error('Bot not ready for sendAya')
        );
        return;
    }

    const senderDependencies = {
        botTelegram: activeBotInstance.telegram,
        botUsername: activeBotInstance.options.username,
        prepareAyaFn: prepareAya,
        helperSendSorryFn: helperSendSorry,
        helperAMenuButtonsFn: helperAMenuButtons,
        helperSuccessSendFn: helperSuccessSend,
        lastAyaTimeDbFn: lastAyaTime,
        ayaId2suraAyaFn: ayaId2suraAya,
        isValidReciterFn: isValidReciter,
        getFavReciterDbFn: getFavReciter,
        getRandomReciterIdentifierFn: getRandomReciterIdentifier,
        getRecitationFn: getRecitation,
    };

    try {
        const sentTextCtx = await senderSendAyaText(senderDependencies, chatId, targetAyaId, reciter, lang, trigger);
        if (sentTextCtx && withRecitation) {
            await senderSendAyaRecitation(
                senderDependencies,
                sentTextCtx.chat.id,
                sentTextCtx.message_id,
                sentTextCtx.from?.id,
                targetAyaId,
                reciter
            );
        }
    } catch (e) {
        logger(`sendAya: Error caught while sending Aya ${targetAyaId} to chat ${chatId}. Trigger: ${trigger}`, e);
        const errorDesc = e.response?.description?.toLowerCase() || '';
        const blockKeywords =
            /blocked by the user|user is deactivated|need administrator rights|not enough rights|chat not found|TOPIC_CLOSED|bot was kicked|CHAT_SEND_PLAIN_FORBIDDEN/;
        if (blockKeywords.test(errorDesc)) {
            // Attempt to get chat type and lang from context if possible, otherwise use defaults or undefined
            const chatType = activeBotInstance.context?.chat?.type || 'unknown'; // Example fallback
            await lastAyaTime(chatId, 'blocked', undefined, chatType, lang, trigger);
        }
    }
}

export async function surpriseAya(ctx) {
    const lang = ctx.from?.language_code;
    await sendAya(ctx.chat.id, null, null, lang, 'surprise', false);
}

export async function handleText(ctx) {
    const originalText = ctx.message.text;
    const normalizedTxt = rasmifize(numArabicToEnglish(originalText));
    const foundNums = normalizedTxt.match(/\d+/g) || [];
    const chatId = ctx.chat.id;
    let ayaId = -2;
    let foundArSuraNum = 0;

    logger(`Message from chat ${chatId} (${ctx.from?.username}): ${originalText}. Normalized: ${normalizedTxt}`);

    let searchableTxt = normalizedTxt;
    const rasmifiedSuraPrefix = rasmifize('سورة ');
    if (normalizedTxt.startsWith(rasmifiedSuraPrefix)) {
        searchableTxt = normalizedTxt.substring(rasmifiedSuraPrefix.length).trim();
    }

    const ArMagicRegex = new RegExp(`[${rasmifize('المهوسصق')}]`);

    if (ArMagicRegex.test(searchableTxt)) {
        if (searchableTxt.includes(rasmifize('الكرسي'))) {
            ayaId = 262;
        } else {
            for (let index = 0; index < normalizedSurasArNames.length; index++) {
                const suraNamePattern = normalizedSurasArNames[index].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(
                    `(^${suraNamePattern}$)|(^${suraNamePattern}([-: 0-9]+)(.*))|((.*)([-: ]+)${suraNamePattern}([-: 0-9]+)(.*))|((.*)([-: ]+)${suraNamePattern}$)`
                );
                if (regex.test(searchableTxt)) {
                    foundArSuraNum = index + 1;
                    logger(`Found Arabic Sura name: ${quranData.enQuran[index].englishName} (Num: ${foundArSuraNum})`);
                    break;
                }
            }
            if (foundArSuraNum) {
                const suraAyaInput = { sura: foundArSuraNum, aya: foundNums.length ? parseInt(foundNums[0], 10) : 1 };
                ayaId = suraAya2ayaId(suraAyaInput);
            }
        }
    }

    if (foundNums.length && !foundArSuraNum && ayaId === -2) {
        const potentialSuraNum = parseInt(foundNums[0], 10);
        const potentialAyaNum = foundNums.length >= 2 ? parseInt(foundNums[1], 10) : 1;
        ayaId = suraAya2ayaId({ sura: potentialSuraNum, aya: potentialAyaNum });
    }

    const startPayloadRecitation = ctx.startPayload ? ctx.startPayload.includes('r') : false;

    if (ayaId > 0) {
        await sendAya(chatId, ayaId, null, ctx.from?.language_code, 'request', startPayloadRecitation);
    } else {
        let reasonCode = 3;
        if (ayaId === 0) reasonCode = 2;
        else if (ayaId === -1) reasonCode = 1;
        if (!activeBotInstance || !activeBotInstance.telegram) {
            logger(
                'Error: handleText trying to send unrecognized message but bot is not ready.',
                new Error('Bot not ready for sendUnrecognizedMessage in handleText')
            );
            return;
        }
        await helperSendUnrecognizedMessage(ctx, reasonCode, activeBotInstance.telegram);
    }
}

servicePopulateRecitersButtons();

export function registerHandlers(botToRegister, dependencies) {
    if (!botToRegister) {
        logger(
            'Error: registerHandlers called without a bot instance.',
            new Error('Bot instance not provided to registerHandlers')
        );
        return;
    }
    activeBotInstance = botToRegister;
    const { Markup } = dependencies;

    // <DEBUG_LOGGING>
    console.log('[TELEGRAMBOT_SUT registerHandlers] ENTER. botToRegister defined?', !!botToRegister);
    console.log('[TELEGRAMBOT_SUT registerHandlers] activeBotInstance is now set. Is it defined?', !!activeBotInstance);
    if (activeBotInstance) {
        console.log(
            '[TELEGRAMBOT_SUT registerHandlers] typeof activeBotInstance.start:',
            typeof activeBotInstance.start
        );
    }
    // </DEBUG_LOGGING>

    const startHandlerWrapper = async (ctx) => {
        // <DEBUG_LOGGING>
        console.log(
            '[TELEGRAMBOT_SUT registerHandlers] Start handler WRAPPER invoked. commandHandlers.handleStartCommand is function?',
            typeof commandHandlers.handleStartCommand === 'function'
        );
        // </DEBUG_LOGGING>
        if (ctx.chat.type !== 'private' && !(await helperAdminChecker(ctx, activeBotInstance.telegram))) {
            logger(
                `Ignored /start command from non-admin user ${ctx.from.id} in chat ${ctx.chat.id} (${ctx.chat.title}).`
            );
            return;
        }
        await commandHandlers.handleStartCommand(ctx, {
            telegram: activeBotInstance.telegram,
            options: activeBotInstance.options,
            handleTextFn: handleText,
        });
    };
    // <DEBUG_LOGGING>
    console.log(
        '[TELEGRAMBOT_SUT registerHandlers] Registering .start with startHandlerWrapper:',
        typeof startHandlerWrapper,
        startHandlerWrapper
    );
    // </DEBUG_LOGGING>
    activeBotInstance.start(startHandlerWrapper);

    // <DEBUG_LOGGING>
    console.log(
        '[TELEGRAMBOT_SUT registerHandlers] Registering .help handler with handler:',
        commandHandlers.handleHelpCommand
    );
    // </DEBUG_LOGGING>
    activeBotInstance.help(async (ctx) => {
        if (ctx.chat.type !== 'private' && !(await helperAdminChecker(ctx, activeBotInstance.telegram))) {
            logger(
                `Ignored /help command from non-admin user ${ctx.from.id} in chat ${ctx.chat.id} (${ctx.chat.title}).`
            );
            return;
        }
        await commandHandlers.handleHelpCommand(ctx, { telegram: activeBotInstance.telegram });
    });

    // <DEBUG_LOGGING>
    console.log(
        '[TELEGRAMBOT_SUT registerHandlers] Registering .command("surpriseme") with handler:',
        commandHandlers.handleSurpriseMeCommand
    );
    // </DEBUG_LOGGING>
    activeBotInstance.command('surpriseme', async (ctx) => {
        if (ctx.chat.type !== 'private' && !(await helperAdminChecker(ctx, activeBotInstance.telegram))) {
            logger(
                `Ignored /surpriseme command from non-admin user ${ctx.from.id} in chat ${ctx.chat.id} (${ctx.chat.title}).`
            );
            return;
        }
        await commandHandlers.handleSurpriseMeCommand(ctx, {
            surpriseAyaFn: surpriseAya,
        });
    });

    console.log(
        '[TELEGRAMBOT_SUT registerHandlers] Registering .command("support") with handler:',
        commandHandlers.handleSupportCommand
    );
    activeBotInstance.command('support', commandHandlers.handleSupportCommand); // Was wrapped, now direct

    console.log(
        '[TELEGRAMBOT_SUT registerHandlers] Registering .command("reciters") with handler:',
        commandHandlers.handleRecitersCommand
    );
    activeBotInstance.command('reciters', commandHandlers.handleRecitersCommand); // Was wrapped, now direct

    console.log(
        '[TELEGRAMBOT_SUT registerHandlers] Registering .command("channel") with handler:',
        commandHandlers.handleChannelCommand
    );
    activeBotInstance.command('channel', commandHandlers.handleChannelCommand); // Was wrapped, now direct

    // <DEBUG_LOGGING>
    console.log(
        '[TELEGRAMBOT_SUT registerHandlers] Registering .command("khatma") with handler:',
        commandHandlers.handleKhatmaCommand
    );
    // </DEBUG_LOGGING>
    activeBotInstance.command('khatma', async (ctx) => {
        if (ctx.chat.type !== 'private' && !(await helperAdminChecker(ctx, activeBotInstance.telegram))) {
            logger(
                `Ignored /khatma command from non-admin user ${ctx.from.id} in chat ${ctx.chat.id} (${ctx.chat.title}).`
            );
            return;
        }
        await commandHandlers.handleKhatmaCommand(ctx, Markup);
    });

    console.log(
        '[TELEGRAMBOT_SUT registerHandlers] Registering .command("commands") with handler:',
        commandHandlers.handleCommandsCommand
    );
    activeBotInstance.command('commands', commandHandlers.handleCommandsCommand); // Was wrapped, now direct

    // <DEBUG_LOGGING>
    console.log('[TELEGRAMBOT_SUT registerHandlers] Setting my commands with activeBotInstance.telegram.setMyCommands');
    // </DEBUG_LOGGING>
    activeBotInstance.telegram
        .setMyCommands([
            { command: 'surpriseme', description: '🎁 Surprise Me فاجئني' },
            { command: 'khatma', description: '💪 Group Khatma ختمة مجموعة' },
            { command: 'help', description: '🤔 Instructions إرشادات' },
            { command: 'support', description: '🤗 Support دعم' },
            { command: 'reciters', description: '🗣️ Set Reciter اختيار القارئ' },
            { command: 'channel', description: '📢 Daily Aya Channel قناة دايلي آية' },
        ])
        .catch((e) => logger('Error setting bot commands:', e));

    // Action Handlers
    activeBotInstance.action(/^{"groupkhatma":\d+}$/, async (ctx) =>
        actionHandlers.handleGroupKhatmaAction(ctx, { khatmaUpdateFn: khatmaServiceKhatmaUpdate })
    );
    activeBotInstance.action(/^{"recitersNavPage":\s*\d+\s*}$/, async (ctx) =>
        actionHandlers.handleRecitersNavPageAction(ctx, {
            botTelegram: activeBotInstance.telegram,
            recitersNavPageFn: serviceRecitersNavPage,
            helperAdminProtectedAction,
        })
    );
    // For handleSetReciterAction, ensure all dependencies are passed. Markup is from dependencies.
    activeBotInstance.action(/^{"setReciter":"[^"]+"(?:,"a":\d+)?}$/, async (ctx) =>
        actionHandlers.handleSetReciterAction(ctx, {
            botTelegram: activeBotInstance.telegram,
            helperAdminProtectedAction,
            dbSetFavReciter: setFavReciter,
            getQuranDataFn: getQuranData,
            TelegrafMarkup: Markup,
        })
    );
    activeBotInstance.action(JSON.stringify({ instructionsAction: true }), async (ctx) =>
        actionHandlers.handleInstructionsAction(ctx, {
            botTelegram: activeBotInstance.telegram,
            helperAdminProtectedAction,
            instructionsFn: helperInstructions,
        })
    );
    activeBotInstance.action(/^{"surpriseAyaAction":true(?:,"a":\d+)?}$/, async (ctx) =>
        actionHandlers.handleSurpriseAyaAction(ctx, {
            botTelegram: activeBotInstance.telegram,
            helperAdminProtectedAction,
            surpriseAyaFn: surpriseAya,
        })
    );
    activeBotInstance.action(/^{"currAya":\d+,"r":"[^"]+"}$/, async (ctx) =>
        actionHandlers.handleCurrAyaAction(ctx, {
            botTelegram: activeBotInstance.telegram,
            botOptions: activeBotInstance.options,
            helperAdminConditionalAction,
            sendAyaFn: sendAya,
            nextAyaFn: nextAya,
            ayaId2suraAyaFn: ayaId2suraAya,
        })
    );
    activeBotInstance.action(/^{"aMenu":"[^"]+","a":\d+,"r":"[^"]+"}$/, async (ctx) =>
        actionHandlers.handleAMenuAction(ctx, {
            botTelegram: activeBotInstance.telegram,
            botOptions: activeBotInstance.options,
            helperAdminProtectedAction,
            helperAMenuButtonsFn: helperAMenuButtons,
            ayaId2suraAyaFn: ayaId2suraAya,
        })
    );

    activeBotInstance.action(/^{"recite":\d+,"r":"[^"]+"}$/, async (ctx) => {
        let callbackData,
            chatId,
            fromId,
            messageId,
            rawCtxForAnswerCbQuery = ctx;
        try {
            if (!ctx || typeof ctx !== 'object' || Object.keys(ctx).length === 0) {
                throw new Error('Invalid ctx for recite action');
            }
            if (!ctx.update?.callback_query?.data) {
                throw new Error('Missing callback_query data for recite action');
            }
            callbackData = JSON.parse(ctx.update.callback_query.data);
            if (!ctx.chat?.id) {
                throw new Error('Missing chat ID for recite action');
            }
            chatId = ctx.chat.id;
            fromId = ctx.from?.id;
            messageId = ctx.update.callback_query.message?.message_id;
        } catch (e) {
            logger('Recite action wrapper: Error parsing ctx/data.', { error: e.message });
            if (ctx?.answerCbQuery)
                await ctx
                    .answerCbQuery('Error parsing request for recite.', { show_alert: true })
                    .catch((ebq) => logger('Error in answerCbQuery for recite parse fail:', ebq));
            return;
        }
        actionHandlers.handleReciteAction(
            { chatId, fromId, messageId, callbackData, rawCtx: rawCtxForAnswerCbQuery },
            {
                botTelegram: activeBotInstance.telegram,
                botOptions: activeBotInstance.options,
                helperAdminConditionalAction,
                sendAyaRecitationFn: senderSendAyaRecitation,
                ayaId2suraAyaFn: ayaId2suraAya,
                isValidReciterFn: isValidReciter,
                getRecitationFn: getRecitation,
                getFavReciterDbFn: getFavReciter,
                getRandomReciterIdentifierFn: getRandomReciterIdentifier,
                helperSendSorryFn: helperSendSorry,
                helperAMenuButtonsFn: helperAMenuButtons,
                lastAyaTimeDbFn: lastAyaTime,
            }
        );
    });

    // Event Handlers
    console.log('[TELEGRAMBOT_SUT registerHandlers] Registering .on("text") with handleText wrapper');
    activeBotInstance.on('text', async (ctx) => {
        if (ctx.chat.type !== 'private' && !(await helperAdminChecker(ctx, activeBotInstance.telegram))) {
            logger(
                `Ignored text message from non-admin user ${ctx.from.id} in chat ${ctx.chat.id} (${ctx.chat.title}).`
            );
            return;
        }
        await handleText(ctx);
    });

    console.log('[TELEGRAMBOT_SUT registerHandlers] Registering .on("my_chat_member") with handler function');
    activeBotInstance.on('my_chat_member', async (ctx) => {
        const newStatus = ctx.update.my_chat_member.new_chat_member.status;
        logger(`my_chat_member update for chat ${ctx.chat.id}: ${newStatus}`);
        switch (newStatus) {
            case 'member':
            case 'administrator':
                await commandHandlers.handleStartCommand(ctx, {
                    telegram: activeBotInstance.telegram,
                    options: activeBotInstance.options,
                    handleTextFn: handleText,
                });
                break;
            case 'kicked':
            case 'left':
                await lastAyaTime(ctx.chat.id, 'blocked');
                break;
            default:
                logger(`Unknown my_chat_member status: ${newStatus} for chat ${ctx.chat.id}`);
                break;
        }
    });

    console.log(
        `[TELEGRAMBOT_SUT registerHandlers] Finished. Bot username from activeBotInstance: ${activeBotInstance.options?.username || 'UNKNOWN_BOT'}`
    );
}

export async function performBotPreLaunchChecks() {
    if (!activeBotInstance) {
        const errMsg =
            'performBotPreLaunchChecks (in telegramBot.js) called but bot is not initialized. Ensure initializeBot() and registerHandlers() were called by app.js.';
        bootstrapLogger(errMsg, new Error(errMsg));
        throw new Error(errMsg);
    }
    const username = activeBotInstance.options?.username;

    if (!username) {
        const warnMsg =
            'performBotPreLaunchChecks (in telegramBot.js): Bot username not available. Startup message to devChatId might be incomplete or fail.';
        bootstrapLogger(warnMsg);
    }

    bootstrapLogger(
        `performBotPreLaunchChecks (in telegramBot.js): Pre-launch checks. Bot username: ${username || 'Not yet available'}.`
    );

    if (config.devChatId && username) {
        const instStateMsg = `DailyAyaTelegram ${config.branch} instance ${config.inst}@${config.host} (of total ${config.totalInst}) is active in ${config.debugging ? 'debugging' : 'normal'} mode of version ${config.codeVer} until ${config.instActiveUntil}. Memory Used: ${Math.floor(process.memoryUsage().rss / (1024 * 1024))} MB Uptime: ${+(process.uptime() / 3600).toFixed(2)} hours`;
        try {
            await activeBotInstance.telegram.sendMessage(config.devChatId, instStateMsg);
            bootstrapLogger('performBotPreLaunchChecks: Startup state message successfully sent to dev group.');
        } catch (e) {
            bootstrapLogger(
                'performBotPreLaunchChecks: Error sending startup state message to dev group (proceeding):',
                e
            );
        }
    } else if (config.devChatId && !username) {
        bootstrapLogger(
            'performBotPreLaunchChecks: Cannot send startup state message to dev group - bot username not available.'
        );
    }

    if (!config.debugging) {
        if (activeBotInstance && activeBotInstance.telegram) {
            console.log(
                '[SUT performBotPreLaunchChecks] About to call checkSource. Is it a function?',
                typeof checkSource
            ); // <--- DEBUG LOG
            checkSource((chatId, message) => activeBotInstance.telegram.sendMessage(chatId, message))
                .then(() => logger('Initial Quran source check scheduled/done.'))
                .catch((e) => logger('Error during initial Quran source check:', e));
        } else {
            logger('performBotPreLaunchChecks: Skipping checkSource as bot instance not ready for it.');
        }
    }
    bootstrapLogger('performBotPreLaunchChecks (in telegramBot.js): Pre-launch checks complete.');
}

// Named exports
export { sendAya };
// Other functions (surpriseAya, handleText, registerHandlers, performBotPreLaunchChecks) are exported via `export function`

// console.log('[TELEGRAMBOT_SUT] End of module execution.'); // Original end-of-module log
