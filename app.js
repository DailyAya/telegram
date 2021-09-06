const {Telegraf} = require('telegraf')
const bot = new Telegraf(process.env.telegramToken)

// just for heroku web
const express = require('express')
const expressApp = express()
const port = process.env.PORT || 3000

expressApp.get('/', (req, res) => {
  res.send('UP!')
})
expressApp.listen(port, () => {
  console.log(`Listening on port ${port}`)
})


//method for invoking start command
bot.command('start', ctx => {
    console.log(ctx.from)
    bot.telegram.sendMessage(ctx.chat.id, 'Welcomooooz.', {
    })
})

//method for sending a message to sherbeeny
bot.hears('sherbo', ctx => {
    bot.telegram.sendMessage("589683206", "(mention:"+ctx.chat.id+")", parse_mode="Markdown")
    bot.telegram.sendMessage(ctx.chat.id, "Message has been sent!")
})


//method that displays the inline keyboard buttons 
bot.hears('animals', ctx => {
    console.log(ctx.from)
    let animalMessage = `great, here are pictures of animals you would love`;
    ctx.deleteMessage();
    bot.telegram.sendMessage(ctx.chat.id, animalMessage, {
        reply_markup: {
            inline_keyboard: [
                [{
                        text: "dog",
                        callback_data: 'dog'
                    },
                    {
                        text: "cat",
                        callback_data: 'cat'
                    }
                ],

            ]
        }
    })
})

//method that returns image of a dog
bot.action('dog', ctx => {
    bot.telegram.sendPhoto(ctx.chat.id, {
        source: "res/dog.png"
    })

})

//method that returns image of a cat 
bot.action('cat', ctx => {
    bot.telegram.sendPhoto(ctx.chat.id, {
        source: "res/cat.png"
    })

})


//method for requesting user's phone number
bot.hears('phone', (ctx, next) => {
    console.log(ctx.from)
    bot.telegram.sendMessage(ctx.chat.id, 'Can we get access to your phone number?', requestPhoneKeyboard);

})

//method for requesting user's location
bot.hears("location", (ctx) => {
    console.log(ctx.from)
    bot.telegram.sendMessage(ctx.chat.id, 'Can we access your location?', requestLocationKeyboard);
})

//constructor for providing phone number to the bot
const requestPhoneKeyboard = {
    "reply_markup": {
        "one_time_keyboard": true,
        "keyboard": [
            [{
                text: "My phone number",
                request_contact: true,
                one_time_keyboard: true
            }],
            ["Cancel"]
        ]
    }
};

//constructor for proving location to the bot
const requestLocationKeyboard = {
    "reply_markup": {
        "one_time_keyboard": true,
        "keyboard": [
            [{
                text: "My location",
                request_location: true,
                one_time_keyboard: true
            }],
            ["Cancel"]
        ]
    }

}

//method to start get the script to pulling updates for telegram 
bot.launch()

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))