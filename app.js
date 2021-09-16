const telegramToken = process.env.telegramToken || "inactive"
const inst = process.env.inst || 0
const host = process.env.host || "Host"
const totalInst = process.env.totalInst || 0
const activeInst = process.env.activeInst || "0@Host" //unused for now
const instActivetUntil = process.env.instActiveUntil || "WHO KNOWS!"
const branch = process.env.branch || "staging"

var instStateMsg = "DailyAyaTelegram "+ branch +" instance "+inst+ "@"+host+ " (of total "+totalInst+") is active until "+instActivetUntil+"."



// just for heroku web dyno and to manage sleep and balance between multiple instances
const express = require('express')
const expressApp = express()
const port = process.env.PORT || 3000

// main route will respond (DailyAya is UP) when requested.
// we call it every 30 minutes using a google app script to prevent the app from sleeping.
expressApp.get('/', (req, res) => {
  res.send(instStateMsg)
})
expressApp.listen(port, () => {
  console.log(`Listening on port ${port}`)
})





// MongoDB is a pool and always open
var dbConn;
const { MongoClient } = require('mongodb');
const mongoDbCredentials = process.env.mongoDbCredentials;
const uri = "mongodb+srv://"+mongoDbCredentials+"@cluster0.acgar.mongodb.net/?retryWrites=true&w=majority&maxPoolSize=50&keepAlive=true";
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
client.connect((err, db) => {
    if (err) console.error('MongoDbConn ERROR: ', err);
    else {
      console.log('MongoDbConn Connected!');
      dbConn = db;
    }
});




// Records the last time an aya was sent to a chat so we can send again periodically (daily, for example)
function lastAyaTime(chatId, status){
    status = status || "success" // Function can be called with chatId only if not blocked
    var blocked = status.toLowerCase().includes('block')
    dbConn.db('dailyAyaTelegram').collection('chats').updateOne(
        {chatId: chatId},
        {$set: {lastAyaTime: Date.now(), blocked: blocked}},
        {upsert: true}
    ).then(console.log('Recorded Last Aya Time for chat '+chatId+' as '+ (blocked ? "blocked." : "successfuly sent.")))
    .catch(e => console.error('Failed to record Last Aya Time for chat '+chatId+': ', e))
}




//timer to fetch database every 15 minutes to send aya every 24 hours to chats who didn't block the bot.
var checkMinutes = 15 // Edit this if needed, instead of editing the numbers below
var sendHours = 24 // Edit this if needed, instead of editing the numbers below
var checkMillis = checkMinutes * 60 * 1000
var sendMillis = (sendHours * 60 * 60 * 1000)-checkMillis // For example, (24 hours - 15 minutes) to keep each chat near the same hour, otherwise it will keep shifting
var dailyTimer = setInterval(function(){
    dbConn.db('dailyAyaTelegram').collection('chats').find({lastAyaTime: {$lte: Date.now()-sendMillis}, blocked: false}).toArray( (err, res) => {
        if (err) console.error('Timer error: ', err);
        else {
        console.log('Timer will send to ' + res.length + ' chats.')
        res.forEach(chat => sendAya(chat.chatId))
        }
    })
}, checkMillis)





// Using Telegraf NodeJS framework for Telegram bots
const {Telegraf} = require('telegraf')
const bot = new Telegraf(telegramToken)

// Inform "DailyAya Dev" group about the instance state
if(telegramToken != "inactive"){
    bot.telegram.sendMessage(-1001592920692, instStateMsg) // -1001592920692 is the group ID of "DailyAya Dev"
}

//method for invoking start command
bot.command('start', ctx => {
    console.log(["command: start", ctx.from, ctx.chat])
    sendAya(ctx.chat.id)
})




//method to start get the script to pulling updates for telegram 
bot.launch()

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))


// Returns a random number based on input
// if no input or input is "aya": a random aya number in the whole quran (1 to 6230)
// if input is "reciter": a random number representing one of the available reciters
function randomNum(type){
    var max = 6230; // default for aya number
    if (type == "reciter") max = 16;
    return Math.floor(Math.random() * Math.floor(max)) + 1; // +1 because the generated numbers are between 0 and max-1
}




// Prepare an Aya to be sent
// Because returning a promise, must be called with .then().catch()
const axios = require('axios')

function prepareAya(ayaNum){
    return new Promise((resolve, reject) => {
        var ayaUrl = 'https://api.alquran.cloud/ayah/'.concat(ayaNum).concat('/editions/quran-uthmani,en.ahmedraza');
        
        // Fetching Aya data from API and formating it to be sent to user
        axios(ayaUrl)
            .then((res) => {
                String.prototype.toAr = function() {return this.replace(/\d/g, d =>  '٠١٢٣٤٥٦٧٨٩'[d]);}; // to be user to convert numbers from Egnlish to Arabic.
                    
                var arAya = res.data.data[0].text.toString(),
                    translatedAya = res.data.data[1].text.toString(),
                    ayaNumInSura = res.data.data[0].numberInSurah.toString(),
                    suraNum = res.data.data[0].surah.number.toString(),
                    arName = res.data.data[0].surah.name.toString().substr(8), // substr(8) to remove the Arabic word "Sura".
                    enName = res.data.data[0].surah.englishName.toString(),
                    translatedName = res.data.data[0].surah.englishNameTranslation.toString(),
                    // arSuraNum = suraNum.toAr(),
                    arAyaNumInSura = ayaNumInSura.toAr(),
                    response =
`${arAya} ﴿${arAyaNumInSura}﴾٠
"${arName}"

${translatedAya}

A translation of Aya ${ayaNumInSura} of Sura ${suraNum}
"${enName}" = ${translatedName}`;
                
                // return function call with the formated Aya.
                resolve(response);
                 
            })
            .catch((e) => {
                console.error('Failed to prepare an aya: ', e);
                reject(e);
            });
    });
}



// Provide Aya URL of Quran.com from Aya Number
function quranUrl(ayaNum){
    return new Promise((resolve, reject) => {
        var ayaUrl = 'https://api.alquran.cloud/ayah/'.concat(ayaNum).concat('/editions/quran-uthmani');
        axios(ayaUrl)
            .then((res) => {
                var ayaNumInSura = res.data.data[0].numberInSurah.toString(),
                    suraNum = res.data.data[0].surah.number.toString(),
                    url = 'https://quran.com/'.concat(suraNum).concat('/').concat(ayaNumInSura)
                    resolve(url)
            })
            .catch((e) => {
                console.error('Failed to get Quran.com URL for aya '+ayaNum+': ', e);
                reject(e);
            });
    })
}




// Prepares the response and use it to call sendMsg function
// user argument is a must
// scenario and requestAya are optional
// if scenario = explain, requestAya is not needed
// if scenario = request, requestedAya (1 to 6230) and requestedReciter (1 to 16) are a must 
function respondWith(userId, scenario, requestedAya, requestedReciter){
    var response, aya, reciter;

    switch (scenario){
        case 'explain': // if the user sent anything other than two numbers that match an existing Aya.
            response=
`لم نتعرف على أرقام أو تم طلب سورة أو آية غير موجودة.
يمكنك طلب آية محددة بإرسال رقم السورة والآية.
مثال: ٢   ٢٥٥
أو رقم السورة فقط : ٢
إليك آية أخرى 🙂

Couldn’t find numbers or the requested Sura or Aya doesn’t exist.
You can request a specific Aya by sending the numbers of Aya and Sura.
Example: 2   255
Or Sura number only: 2
Here's another Aya 🙂
`;
            // aya = randomNum('aya'); // to prepare a random aya
            // reciter = randomNum('reciter'); // random reciter
            // sendMsg(user, response, aya, reciter); // send explaination first (save scheduled aya and reciter instead of null)
            bot.telegram.sendMessage(userId, response)
            sendAya(userId)
            break;
            
        case 'request':
            aya = requestedAya;
            if (requestedReciter) reciter = requestedReciter;
            else reciter = randomNum('reciter');
            break;
            
        default: // default is requesting a random Aya and can be called with the user argument only, like this: respondWith(user);
            sendAya(userId);
    }
    
}





// returns a URL string for the audio file of the requested aya (is a must)
// if reciter is not requested (1 to 16), a random reciter will be provided
var recitersData
axios('http://api.alquran.cloud/edition/format/audio') // Run only one time for each process
.then(res => {
    recitersData=JSON.parse(JSON.stringify(res.data)).data.filter(i => i.language=="ar")
    console.log("Reciters List is ready. Total Reciters: "+recitersData.length)
}) // Only Arabic recitations
.catch(e => console.error('Failed to get reciters list: ', e))

function recitation(aya, reciter){
    if (reciter) {
        reciter = parseInt(reciter)
        if (1 > reciter || reciter > recitersData.length) reciter = randomNum('reciter')
    } else reciter = randomNum('reciter')
      
      return 'https://cdn.alquran.cloud/media/audio/ayah/'.concat(recitersData[reciter-1].identifier).concat('/').concat(aya)
  }


// Send random Aya and random reciter if called with the userId argument only 
function sendAya(chatId, requestedAyaNum, requestedReciterNum){

    var ayaNum, reciterNum;
    
    if(requestedAyaNum) {
        ayaNum = requestedAyaNum;
    } else {
        ayaNum = randomNum('aya');
    }

    if(requestedReciterNum) {
        reciterNum = requestedReciterNum;
    } else {
        reciterNum = randomNum('reciter');
    }
    
    // prepare an Aya then send it
    console.log('Preparing Aya ' +ayaNum+ ' for chat '+chatId);
    prepareAya(ayaNum)  
            .then((ayaText) => {
                console.log('Successfully prepared Aya ' +ayaNum+ ' for chat '+chatId);
               
                // send an Aya text
                bot.telegram.sendMessage(chatId, ayaText, {disable_web_page_preview: true})
                .then(({message_id}) => {
                    // send an Aya recitation with inline keyboard buttons after getting Aya URL
                    quranUrl(ayaNum).then((quranUrl) => {
                        // TODO: title and performer tags are not working!
                        bot.telegram.sendAudio(chatId, recitation(ayaNum, reciterNum), {
                            title: "Quran", performer: "Reciter", reply_markup: {
                                inline_keyboard:[
                                    [{
                                        text: "🎁",
                                        callback_data: "anotherAya"
                                    },{
                                        text: "📖",
                                        url: quranUrl
                                    },{
                                        text: "⏭️",
                                        callback_data: '{"currAya":'+ayaNum+',"r":'+reciterNum+',"aMsgId":'+message_id+'}'
                                        // aMsgId to be able to edit the text message later when needed (for example: change translation)
                                    }]
                                ]
                            }
                        })
                        console.log('Successfully sent Aya '+ayaNum+' has been sent to chat '+chatId);
                        lastAyaTime(chatId)

                    }).catch((e) => console.error('Failed to get aya Quran.com URL: ', e))
                }).catch(e => {
                    console.log("Failed to send Aya "+ayaNum+" to chat "+chatId+": ", e)
                    if(JSON.stringify(e).includes('blocked by the user')) lastAyaTime(chatId, 'blocked')
                })

                

            }).catch((e) => console.error('Failed preparing an Aya.. STOPPED: ', e));
}


// When a user presses "Another Aya" inline keyboard button
bot.action('anotherAya', ctx => {
    sendAya(ctx.chat.id)
})



// When a user presses "Next Aya" inline keyboard button
bot.action(/^{"currAya/, ctx => {
    var callbackData= JSON.parse(ctx.update.callback_query.message.reply_markup.inline_keyboard[0][2].callback_data)
    var currentAyaNum = Math.floor(callbackData.currAya)
    var currentReciter = Math.floor(callbackData.r)
    console.log("Sending next Aya after Aya "+ currentAyaNum+" with Reciter "+ currentReciter+" for chat "+ctx.chat.id)
    console.log("Current ayaMsgId is "+callbackData.aMsgId+" and recitationMsgId is "+ctx.update.callback_query.message.message_id)
    sendAya(ctx.chat.id, nextAya(currentAyaNum), currentReciter)
})




function nextAya(ayaNum){
    return ayaNum == 6230 ? 1 : ayaNum+1
}


bot.hears('test', ctx => sendAya(589683206))