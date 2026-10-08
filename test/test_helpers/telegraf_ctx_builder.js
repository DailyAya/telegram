import { jest } from '@jest/globals';
import { Context } from 'telegraf';

/**
 * Creates a Telegraf Context for handler unit tests using an Update fixture and
 * Telegram API method results from fixtures.
 *
 * @param {object} updateObject - A Telegram Update fixture.
 * @param {{telegram: object, botInfo: object}} mockBotInstance - Bot Telegram API client and BotInfo.
 * @param {{sendMessage: object}} apiResponseFixtures - Successful Telegram method result fixtures.
 * @returns {import('telegraf').Context} Context with mocked API convenience methods.
 */
export function createMockCtx(updateObject, mockBotInstance, apiResponseFixtures) {
    if (!updateObject || typeof updateObject !== 'object') {
        throw new TypeError('createMockCtx requires a Telegram Update object.');
    }
    if (!mockBotInstance?.telegram || !mockBotInstance.botInfo) {
        throw new TypeError('createMockCtx requires a bot Telegram client and BotInfo.');
    }
    if (!apiResponseFixtures?.sendMessage) {
        throw new TypeError('createMockCtx requires a sendMessage result fixture.');
    }

    const ctx = new Context(updateObject, mockBotInstance.telegram, mockBotInstance.botInfo);
    ctx.reply = jest.fn().mockResolvedValue(apiResponseFixtures.sendMessage);
    ctx.sendMessage = jest.fn().mockResolvedValue(apiResponseFixtures.sendMessage);
    ctx.answerCbQuery = jest.fn().mockResolvedValue(true);
    ctx.editMessageText = jest.fn().mockResolvedValue(apiResponseFixtures.sendMessage);
    ctx.editMessageReplyMarkup = jest.fn().mockResolvedValue(true);
    ctx.deleteMessage = jest.fn().mockResolvedValue(true);
    ctx.leaveChat = jest.fn().mockResolvedValue(true);
    return ctx;
}
