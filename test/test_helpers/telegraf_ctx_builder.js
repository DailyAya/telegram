import { jest } from '@jest/globals'; // For jest.fn()

/**
 * Creates a mock Telegraf Context (ctx) object from a given Update object fixture.
 * This aims to simulate the context object that Telegraf provides to its handlers.
 *
 * @param {object} updateObject - The parsed JSON Update object from a fixture.
 * @param {object} mockBotInstance - The mocked Telegraf bot instance (e.g., mockMinimalTelegrafInstance from tests).
 *                                   It should have `telegram` (with mocked API methods) and `options` (with botInfo).
 * @returns {object} A mock ctx object.
 */
export function createMockCtx(updateObject, mockBotInstance) {
    const ctx = {
        update: updateObject,
        telegram: mockBotInstance.telegram,
        botInfo: mockBotInstance.options.username // Ensure botInfo is based on whether username is set
            ? {
                  username: mockBotInstance.options.username,
                  id: mockBotInstance.telegram.getMe?.mock?.results[0]?.value?.id || 0,
                  is_bot: true,
              }
            : undefined, // or some default botInfo if username is not yet set on mockBotInstance.options

        // Standard Telegraf methods (mocked)
        reply: jest.fn().mockResolvedValue({ message_id: Date.now(), chat: {}, from: {} }), // Return a basic message structure
        sendMessage: jest.fn().mockResolvedValue({ message_id: Date.now(), chat: {}, from: {} }),
        answerCbQuery: jest.fn().mockResolvedValue(true),
        editMessageText: jest.fn().mockResolvedValue(true), // Can also resolve with the message object
        editMessageReplyMarkup: jest.fn().mockResolvedValue(true),
        deleteMessage: jest.fn().mockResolvedValue(true),
        leaveChat: jest.fn().mockResolvedValue(true),
        // ... add other commonly used ctx methods as jest.fn() if needed by handlers

        // State object
        state: {},

        // Convenience properties (derived from updateObject)
        chat: undefined,
        from: undefined,
        message: undefined,
        callbackQuery: undefined,
        inlineQuery: undefined,
        chosenInlineResult: undefined,
        editedMessage: undefined,
        channelPost: undefined,
        editedChannelPost: undefined,
        myChatMember: undefined,
        chatMember: undefined,
        chatJoinRequest: undefined,
        // ... any other shortcuts Telegraf might add based on update type
    };

    // Populate convenience properties based on update type
    // This logic mimics parts of Telegraf's Context class constructor or property getters.
    if (updateObject.message) {
        ctx.message = updateObject.message;
        ctx.chat = updateObject.message.chat;
        ctx.from = updateObject.message.from;
        ctx.updateType = 'message';
    } else if (updateObject.edited_message) {
        ctx.editedMessage = updateObject.edited_message;
        ctx.chat = updateObject.edited_message.chat;
        ctx.from = updateObject.edited_message.from;
        ctx.updateType = 'edited_message';
    } else if (updateObject.callback_query) {
        ctx.callbackQuery = updateObject.callback_query;
        ctx.updateType = 'callback_query';
        if (updateObject.callback_query.message) {
            // Callback queries can be attached to messages
            ctx.message = updateObject.callback_query.message;
            ctx.chat = updateObject.callback_query.message.chat;
        }
        ctx.from = updateObject.callback_query.from;
    } else if (updateObject.channel_post) {
        ctx.channelPost = updateObject.channel_post;
        ctx.chat = updateObject.channel_post.chat;
        ctx.from = updateObject.channel_post.from; // Typically undefined for channel posts from channel itself
        ctx.updateType = 'channel_post';
    } else if (updateObject.edited_channel_post) {
        ctx.editedChannelPost = updateObject.edited_channel_post;
        ctx.chat = updateObject.edited_channel_post.chat;
        ctx.from = updateObject.edited_channel_post.from;
        ctx.updateType = 'edited_channel_post';
    } else if (updateObject.inline_query) {
        ctx.inlineQuery = updateObject.inline_query;
        ctx.from = updateObject.inline_query.from;
        ctx.updateType = 'inline_query';
    } else if (updateObject.chosen_inline_result) {
        ctx.chosenInlineResult = updateObject.chosen_inline_result;
        ctx.from = updateObject.chosen_inline_result.from;
        ctx.updateType = 'chosen_inline_result';
    } else if (updateObject.my_chat_member) {
        ctx.myChatMember = updateObject.my_chat_member;
        ctx.chat = updateObject.my_chat_member.chat;
        ctx.from = updateObject.my_chat_member.from;
        ctx.updateType = 'my_chat_member';
    } else if (updateObject.chat_member) {
        ctx.chatMember = updateObject.chat_member;
        ctx.chat = updateObject.chat_member.chat;
        ctx.from = updateObject.chat_member.from;
        ctx.updateType = 'chat_member';
    } else if (updateObject.chat_join_request) {
        ctx.chatJoinRequest = updateObject.chat_join_request;
        ctx.chat = updateObject.chat_join_request.chat;
        ctx.from = updateObject.chat_join_request.from;
        ctx.updateType = 'chat_join_request';
    }

    // Telegraf also has getters like ctx.messageOrChannelPost, ctx.senderChat etc.
    // These can be added if tests require them. For now, direct properties should cover most cases.

    return ctx;
}
