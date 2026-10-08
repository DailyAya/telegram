import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { jest } from '@jest/globals';
import { Context } from 'telegraf';
import { createMockCtx } from '../test_helpers/telegraf_ctx_builder.js';

function readFixture(filePath) {
    return JSON.parse(readFileSync(join(process.cwd(), filePath), 'utf8'));
}

describe('createMockCtx', () => {
    const botInfo = readFixture('test/__fixtures__/telegram_api/responses/getMe_success.json').result;
    const sentMessage = readFixture('test/__fixtures__/telegram_api/responses/sendMessage_success.json').result;
    const adminMember = readFixture('test/__fixtures__/telegram_api/responses/getChatMember_admin.json').result;
    const messageUpdate = readFixture('test/__fixtures__/telegram_api/updates/text_message_private_chat.json');
    const callbackUpdate = readFixture('test/__fixtures__/telegram_api/updates/callback_query_recite_button.json');

    function createBot() {
        return {
            botInfo,
            telegram: {
                getChatMember: jest.fn().mockResolvedValue(adminMember),
            },
        };
    }

    it('builds a Telegraf context with message properties and fixture-backed API methods', async () => {
        const mockBot = createBot();
        const ctx = createMockCtx(messageUpdate, mockBot, { sendMessage: sentMessage });

        expect(ctx).toBeInstanceOf(Context);
        expect(ctx.update).toEqual(messageUpdate);
        expect(ctx.message).toEqual(messageUpdate.message);
        expect(ctx.chat).toEqual(messageUpdate.message.chat);
        expect(ctx.from).toEqual(messageUpdate.message.from);
        expect(ctx.botInfo).toEqual(botInfo);
        expect(ctx.reply).toEqual(expect.any(Function));
        await expect(ctx.reply('hello')).resolves.toEqual(sentMessage);
        await expect(ctx.telegram.getChatMember()).resolves.toEqual(adminMember);
    });

    it('derives callback-query context from the callback update fixture', () => {
        const ctx = createMockCtx(callbackUpdate, createBot(), { sendMessage: sentMessage });

        expect(ctx.callbackQuery).toEqual(callbackUpdate.callback_query);
        expect(ctx.message).toBeUndefined();
        expect(ctx.msg).toEqual(callbackUpdate.callback_query.message);
        expect(ctx.chat).toEqual(callbackUpdate.callback_query.message.chat);
        expect(ctx.from).toEqual(callbackUpdate.callback_query.from);
        expect(ctx.callbackQuery.data).toContain('"recite":262');
    });

    it('keeps malformed updates inspectable without inventing chat or sender data', () => {
        const ctx = createMockCtx({ update_id: 1 }, createBot(), { sendMessage: sentMessage });

        expect(ctx.update).toEqual({ update_id: 1 });
        expect(ctx.chat).toBeUndefined();
        expect(ctx.from).toBeUndefined();
    });

    it('rejects missing update, bot, or API response fixtures', () => {
        const mockBot = createBot();

        expect(() => createMockCtx(null, mockBot, { sendMessage: sentMessage })).toThrow(TypeError);
        expect(() => createMockCtx(messageUpdate, { telegram: {} }, { sendMessage: sentMessage })).toThrow(TypeError);
        expect(() => createMockCtx(messageUpdate, mockBot, {})).toThrow(TypeError);
    });
});
