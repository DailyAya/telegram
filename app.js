const numCPUs = require('os').cpus().length
console.log(`Number of CPUs is: ${numCPUs}`)

const telegramToken = process.env.telegramToken || 0
const inst = process.env.inst || 0
const host = process.env.host || "Host"
const totalInst = process.env.totalInst || 0
const activeInst = process.env.activeInst || "0@Host" //unused for now
const instActivetUntil = process.env.instActiveUntil || "WHO KNOWS!"
const branch = process.env.branch || "staging"
const debugging = process.env.debugging == "true"
const devChatId = process.env.devChatId  // the group ID of development team on Telegram


// Use log(x) instead of log(x) to control debugging mode from env variables
// Use log(x, e) for errors
function log(x, e){
    return new Promise ((resolve, reject) =>{
        switch(log.arguments.length){
            case 1:
                if(debugging) console.log(x)
                resolve()
                break
            case 2:
                console.error(x, e)
                if(bot) bot.telegram.sendMessage(devChatId, x+JSON.stringify(e)).then(resolve())
                break
            default:
                console.error('Invalid log argument count.')
                resolve()
                break
        }
    })
}

var instStateMsg = `DailyAyaTelegram ${branch} instance ${inst}@${host} (of total ${totalInst}) is active in ${debugging ? 'debugging' : 'normal'} mode until ${instActivetUntil}.
Memory Used: ${Math.floor(process.memoryUsage().rss / (1024 * 1024))} MB`



// just for heroku web dyno and to manage sleep and balance between multiple instances
const express = require('express')
const expressApp = express()
const port = process.env.PORT || 3000

// main route will respond instStateMsg when requested.
// we call it every 15 minutes using a google app script to prevent the app from sleeping.
expressApp.get('/', (req, res) => {
  res.send(instStateMsg)
})
expressApp.listen(port, () => {
  log(`Listening on port ${port}`)
})





// MongoDB is a pool and always open
var dbConn
const { MongoClient } = require('mongodb')
const mongoDbCredentials = process.env.mongoDbCredentials
const mongoSubdomain = process.env.mongoSubdomain
const uri = `mongodb+srv://${mongoDbCredentials}@cluster0.${mongoSubdomain}.mongodb.net/?retryWrites=true&w=majority&maxPoolSize=50&keepAlive=true`
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true })
log('Connecting to MongoDB...')
client.connect((err, db) => {
    if (err) log('MongoDbConn ERROR: ', err)
    else {
        log('MongoDbConn Connected!')
        dbConn = db

        getReciters()
        .then((r) => {
            recitersButtons(r)
            timerSend()
            .catch(e => {
                log(`Error while calling timerSend inside getReciters: `, e)
            })
        }).catch(e => {
            if(!recitersData.length){
                log(`Error while calling getReciters inside client.connect: `, e)
            }
        })
    }
})




// Records the last time an aya was sent to a chat so we can send again periodically (daily, for example)
function lastAyaTime(chatId, status, chatName, lang, trigger){
    var setObj = {}
    status = status || "success" // Function can be called with chatId only if not blocked
    
    setObj.since = {$cond: [{$not: ["$since"]}, new Date(), "$since"]} // Add "Since" date only once
    setObj.lastAyaTime = Date.now()
    setObj.blocked = status.toLowerCase().includes('block')
    if(chatName) setObj.name = chatName // Only update the name when it's known
    if(lang) setObj.language_code = lang // Only update the language_code when it's known
    if(trigger){
        setObj.lastTrigger = trigger
        switch (trigger) {
            case 'surprise':
                setObj.surprises = {$cond: [{$not: ["$surprises"]}, 1, {$add: ["$surprises", 1]}]}
                break;

            case 'next':
                setObj.nexts = {$cond: [{$not: ["$nexts"]}, 1, {$add: ["$nexts", 1]}]}
                break;

            case 'request':
                setObj.requests = {$cond: [{$not: ["$requests"]}, 1, {$add: ["$requests", 1]}]}
                break;

            case 'timer':
                setObj.timers = {$cond: [{$not: ["$timers"]}, 1, {$add: ["$timers", 1]}]}
                break;
            
            default:
                log('Unknown trigger: ', trigger)
                break;
        }
    }

    dbConn.db('dailyAyaTelegram').collection('chats').updateOne(
        {chatId: chatId},
        [{$set: setObj}],
        {upsert: true}
    ).then(log('Recorded Last Aya Time for chat '+chatId+' as '+ (setObj.blocked ? "blocked." : "successfuly sent.")))
    .catch(e => log('Failed to record Last Aya Time for chat '+chatId+': ', e))
}


// Sets the favorit reciter for chatIds that request so
function setFavReciter(chatId, reciterIdentifier){
    var setObj = {}
    log(`Chat ${chatId} fav reciter request: ${reciterIdentifier}`)

    // sets reciter to "surprise" if not provided or reciter is not valid
    reciterIdentifier = (reciterIdentifier == "surprise" || isValidReciter(reciterIdentifier)) ? reciterIdentifier : "surprise"
    log(`Chat ${chatId} fav reciter to be stored: ${reciterIdentifier}`)
    
    setObj.favReciter = reciterIdentifier

    dbConn.db('dailyAyaTelegram').collection('chats').updateOne(
        {chatId: chatId},
        [{$set: setObj}],
        {upsert: true}
    )
    .then(() => {
        log(`Favorit reciter "${reciterIdentifier}" has been set for chat ${chatId}.`)

        var msg
        if (reciterIdentifier == "surprise") {
            msg = 
`سيتم تغيير القارئ مع كل آية مفاجئة.

Reciter will be changed with each surprise Aya.`
        } else {
            var requestedFavReciterData = recitersData.filter(i => i.identifier == reciterIdentifier)
            msg =
`القارئ المفضل الحالي: ${requestedFavReciterData[0].name}

Current Favorit Reciter: ${requestedFavReciterData[0].englishName}`
        }
        bot.telegram.sendMessage(chatId, msg, {
            reply_markup: {
                inline_keyboard:[
                    [{
                        text: "👍",
                        callback_data: "surpriseAya"
                    }]
                ]
            }
        })
    })
    .catch(e => {
        log(`Error while setting favorit reciter "${reciterIdentifier}" for chat ${chatId}:`, e)
        msg =
`عذرا.. نواجه مشكلة أثناء حفظ القارئ المفضل ونأمل حلها قريبا.

Sorry.. There's an issue while setting favorite reciters and we hope it gets fixed soon.` 
        bot.telegram.sendMessage(chatId, msg, {
            reply_markup: {
                inline_keyboard:[
                    [{
                        text: "👍",
                        callback_data: "surpriseAya"
                    }]
                ]
            }
        })
    })
}

// Gets the favorit reciter for chatIds requesting surprise Aya
function getFavReciter(chatId){
    return new Promise ((resolve, reject) => {
        log(`Getting fav reciter for Chat ${chatId}`)
        if (chatId){
            dbConn.db('dailyAyaTelegram').collection('chats').find({chatId: chatId}).toArray((err, res) => {
                if (err){
                    log(`Error while getting favReciter for chat ${chatId}: `, err)
                    reject(err)
                } else {
                    resolve(res[0].favReciter)
                }
            })
        } else {
            resolve(0)
        }
    })
}



//timer to fetch database every 15 minutes to send aya every 24 hours to chats who didn't block the bot.
const checkMinutes = process.env.TimerCheckMinutes || 15 // Edit this if needed, instead of editing the numbers below
const sendHours = process.env.TimerSendHours || 24 // Edit this if needed, instead of editing the numbers below
var checkMillis = checkMinutes * 60 * 1000
var sendMillis = (sendHours * 60 * 60 * 1000)-checkMillis // For example, (24 hours - 15 minutes) to keep each chat near the same hour, otherwise it will keep shifting

function timerSend(){
    return new Promise((resolve, reject) =>{
        try {
            dbConn.db('dailyAyaTelegram').collection('chats').find({lastAyaTime: {$lte: Date.now()-sendMillis}, blocked: false}).toArray( (err, res) => {
                if (err) {
                    log('Timer dbConn error: ', err)
                    reject(err)
                } else {
                    log(`Used memory: ${Math.floor(process.memoryUsage().rss / (1024 * 1024))} MB`)
                    log('Timer will send to ' + res.length + ' chats.')
                    res.forEach(chat => sendAya(chat.chatId, "", chat.favReciter, "", 'timer'))
                    resolve()
                }
            })
        } catch (e) {
            if (!e.message.includes(`Cannot read property 'db'`)){
                log('Timer unexpected error: ', e)
            }
            reject(e)   
        }
    })
}
var dailyTimer = setInterval(timerSend, checkMillis)





// Using Telegraf NodeJS framework for Telegram bots
const {Telegraf} = require('telegraf')
const bot = new Telegraf(telegramToken)
bot.telegram.getMe().then((botInfo) => { // for handling group commands without calling "launch"
    bot.options.username = botInfo.username
})



// Inform "DailyAya Dev" group about the instance state
if(telegramToken){
    bot.telegram.sendMessage(devChatId, instStateMsg)
}




function start(chatId){
    var msg =
`دايلي آية يرسل آية واحدة يوميا في نفس موعد آخر آية تطلبوها في الدردشات الشخصية أو المجموعات.

Daily Aya sends one Aya daily at the same time of the last Aya you request in private chats or groups.`

    bot.telegram.sendMessage(chatId, msg, {
        reply_markup: {
            inline_keyboard:[
                [{
                    text: "👍",
                    callback_data: "surpriseAya"
                }]
            ]
        }
    })


    // Informing "DailyAya Dev" of total active and blocked chats when /start is sent
    dbConn.db('dailyAyaTelegram').collection('chats').find({}).toArray((err, res) =>{
        if (err) log('Error getting total chats: ', err);
        else {
            var totalActiveChatsMsg = 'Active: ' + res.filter(i => i.blocked == false).length
            var totalBlockedChatsMsg = 'Blocked: ' + res.filter(i => i.blocked == true).length
            var totalChatsMsg = `${totalActiveChatsMsg}   ${totalBlockedChatsMsg}`
            log(totalChatsMsg)
            bot.telegram.sendMessage(devChatId, totalChatsMsg)
        }
    })
}





// Returns a random number based on input
// if no input or input is "aya": a random aya number in the whole quran (1 to 6236)
// if input is "reciter": a random number representing one of the available reciters
function random(type){
    var max = 6236 // default for aya number
    if (type == "reciter"){
        max = recitersData.length
        return recitersData[Math.floor(Math.random() * Math.floor(max))].identifier
    }
    // +1 because the generated numbers are between 0 and max-1
    else return Math.floor(Math.random() * Math.floor(max)) + 1  
}




// Prepare an Aya to be sent
// Because returning a promise, must be called with .then().catch()
const axios = require('axios')
const arQuran = require('./quran-uthmani.json')
const enQuran = require('./en.ahmedraza.json')


function checkQuran(){
    var downloadStart = Date.now()
    axios("http://api.alquran.cloud/v1/quran/quran-uthmani")
    .then(r =>{
        if(JSON.stringify(r.data) != JSON.stringify(arQuran)){
            bot.telegram.sendMessage(devChatId,
                `Remote arQuran has changed. Please update the cached JSON file.`
            )
        } else {
            log(`Remote arQuran is the same as the cached JSON file. It took ${((Date.now()-downloadStart)/1000).toFixed(2)} seconds.`)
        }
    })
    .catch(e => log('Error while comparing arQuran cached vs remote: ', e))

    axios("http://api.alquran.cloud/v1/quran/en.ahmedraza")
    .then(r =>{
        if(JSON.stringify(r.data) != JSON.stringify(enQuran)){
            bot.telegram.sendMessage(devChatId,
                `Remote enQuran has changed. Please update the cached JSON file.`
            )
        } else {
            log(`Remote enQuran is the same as the cached JSON file. It took ${((Date.now()-downloadStart)/1000).toFixed(2)} seconds.`)
        }
    })
    .catch(e => log('Error while checking enQuran cached vs remote: ', e))
}
if(!debugging) {
    checkQuran()
}


function ayaId2SuraAya(ayaId){
    var sura = enQuran.data.surahs.find(s => s.ayahs.find(a => a.number == ayaId)).number
    var aya = enQuran.data.surahs[sura-1].ayahs.find(a => a.number == ayaId).numberInSurah
    return {sura: sura, aya: aya}
}

function prepareAya(ayaId){
    String.prototype.toArNum = function() {return this.replace(/\d/g, d =>  '٠١٢٣٤٥٦٧٨٩'[d])}

    var ayaIndex    = ayaId2SuraAya(ayaId),
        suraNum     = ayaIndex.sura,
        ayaNum      = ayaIndex.aya,

        arAya               = arQuran.data.surahs[suraNum-1].ayahs[ayaNum-1].text,
        enTranslatedAya     = enQuran.data.surahs[suraNum-1].ayahs[ayaNum-1].text,
        arName              = enQuran.data.surahs[suraNum-1].name.substr(8), // substr(8) to remove the Arabic word "Sura".
        enArName            = enQuran.data.surahs[suraNum-1].englishName,
        enTranslatedName    = enQuran.data.surahs[suraNum-1].englishNameTranslation,
        arIndex             = `﴿<a href="t.me/${bot.options.username}?start=${suraNum}-${ayaNum}">${arName}؜ ${ayaNum.toString().toArNum()}</a>﴾`,
        enIndex             = `"${enArName}: ${enTranslatedName}", <a href="t.me/${bot.options.username}?start=${suraNum}-${ayaNum}">Sura ${suraNum} Aya ${ayaNum}</a>`,
        
        arText      =
`<b>${arAya}</b>
${arIndex}`,

        enText      =
`${enTranslatedAya}

<i>An interpretation of ${enIndex}.</i>`,

        caption  =
`<a href="t.me/${bot.options.username}?start=${suraNum}-${ayaNum}">@${bot.options.username}</a>`

    return {caption: caption, arText: arText, enText: enText}
}




// returns a URL string for the audio file of the requested aya (is a must)
// if reciter is not requested or not supported, a random reciter will be provided
var recitersData

function getReciters() {
    return new Promise((resolve, reject) =>{
        axios('http://api.alquran.cloud/edition/format/audio') // Run only once for each process
        .then(res => {
            recitersData = JSON.parse(JSON.stringify(res.data)).data.filter(i => i.language == "ar") // Only Arabic recitations
            log("Reciters List is ready. Total Reciters: " + recitersData.length)
            resolve(recitersData)
        })
        .catch(e => {
            log('Error while getting reciters list and will try again after 1 sec: ', e)
            setTimeout(() => {
                getReciters()
                .then(r => resolve(r))
                .catch(e => log(`getReciters Try Error: `, e)) // don't reject inside promise loop
            }, 1000) // wait 1 sec before trying again due to api.alquran.cloud requests limit
        })
    })
}


// For inline keyboard when setting favorite reciter
var recitersInlineButtons = []
function recitersButtons(recitersData){
    recitersData.forEach(reciter => {
        recitersInlineButtons.push([{
            text: `${reciter.englishName} ${reciter.name}`,
            callback_data: `{"setReciter": "${reciter.identifier}"}`
        }])
    })
}


// Must be called with .then .catch
var recitationTries = [] // ['aya/reciter']
function recitation(aya, reciter){
    return new Promise((resolve, reject) => {
        
        reciter = isValidReciter(reciter) ? reciter : random('reciter')

        axios(`http://api.alquran.cloud/ayah/${aya}/${reciter}`)
            .then(res => {
                recitationTries = recitationTries.filter(i => i != `${aya}/${reciter}`) // Remove from tries due to success
                var allAudio = [res.data.data.audio].concat(res.data.data.audioSecondary)
                audioPicker(allAudio, 0)
                .then(pick => resolve(pick))
                .catch(e => reject(e))
            }).catch(e => {
                log('Recitation Error: ', e)
                recitationTries.push(`${aya}/${reciter}`)
                if (recitationTries.filter(`${aya}/${reciter}`).length <= 3) {
                    setTimeout(
                        recitation(aya, reciter)
                        .then(r => resolve(r))
                        .catch(e => log("Recitattion Try Error: ", e)), // Don't reject inside loop
                        1000);
                } else {
                    recitationTries = recitationTries.filter(i => i != `${aya}/${reciter}`) // Remove from tries due to max tries
                    reject(e)
                }
            })
    })
}


function isValidReciter(reciter){
    var validReciter = false
    for (let i = 0; i < recitersData.length; i++) {
        if(recitersData[i].identifier == reciter) {
            validReciter = true
            break
        }
    }
    return validReciter
}



function audioPicker(audioUrlArray, i){
    return new Promise((resolve, reject) =>{
        audioUrlCheck(audioUrlArray[i])
            .then(isAvailable =>{
                if(isAvailable) resolve(audioUrlArray[i])
                else if (i+1 < audioUrlArray.length){
                    audioPicker(audioUrlArray, i+1)
                    .then(pick => resolve(pick))
                    .catch(e => reject(e))
                } else reject ('All audio files are not available.')
            })
            .catch(e => log("AuidoPicker Error: ", e)) // Don't reject inside the loop until it finishes
    })
}


function audioUrlCheck(url){
    return new Promise((resolve, reject) =>{
        axios.head(url)
        .then(r =>{
            log('Fetched audio file URL headers.')
            // log(`Audio URL header: ${JSON.stringify(r.headers)}`)
            if(r.status >= 200 && r.status < 300) resolve(true)
            else {
                log(`Error in audio file "${url}" header: `, r.headers)
                resolve(false)
            }
        })
        .catch(e => resolve(false)) // No reject if URL request failed
    })
}



// Send random Aya and random reciter if called with the userId argument only 
function sendAya(chatId, requestedAyaId, requestedReciter, lang, trigger){
    log(`Initiating sending an Aya to chat ${chatId} with requested reciter: ${requestedReciter}`)

    var ayaId, reciter, audioSuccess
    
    ayaId = requestedAyaId || random('aya')

    log(`Formating Aya ${ayaId} for chat ${chatId}`)
    var preparedAya = prepareAya(ayaId)
    var dualText =
`${preparedAya.arText}

${preparedAya.enText}`

    // Prepare recitation URL
    getFavReciter(requestedReciter ? 0 : chatId) // getFavReciter will resolve 0 if there's a requestedReciter
    .then(favReciter => {
        var recitationReady
        reciter = (favReciter && isValidReciter(favReciter)) ? favReciter : (isValidReciter(requestedReciter) ? requestedReciter : random('reciter'))
        log(`Chat ${chatId} got reciter: ${reciter}`)

        recitation(ayaId, reciter)
        .then(recitationUrl => {
            recitationReady = true
            bot.telegram.sendAudio(chatId, recitationUrl, {caption: preparedAya.caption, parse_mode: 'HTML'})
            .then(ctx =>{
                // log(`Audio File ctx: ${JSON.stringify(ctx)}`)
                audioSuccess = true
                sendAyaText(ctx, dualText, ayaId, reciter, lang, trigger)
                if(trigger == 'surprise' || trigger == 'timer'){
                    var chatName = ctx.chat.type == 'private' ? ctx.chat.first_name : ctx.chat.title
                    var personalizedCaption = `${ctx.caption} ➔ ${chatName}`
                    bot.telegram.editMessageMedia(chatId, ctx.message_id, undefined, {
                        type: 'audio', media: ctx.audio.file_id, caption: personalizedCaption, caption_entities: ctx.caption_entities
                    })
                }
            })
            .catch(e => {
                log(`Error while sending recitation for aya ${ayaId} by ${reciter} to chat ${chatId} (${preparedAya.caption}): `, e)
                if(JSON.stringify(e).includes('blocked by the user')) {
                    lastAyaTime(chatId, 'blocked')
                } else if(!audioSuccess) {
                    sendSorry(chatId, 'audio')
                    .then(ctx => sendAyaText(ctx, dualText, ayaId, reciter, lang, trigger))
                    .catch(e => log(`Error while sending SORRY for failed recitation send for aya ${ayaId} by ${reciter} to chat ${chatId}: `, e))
                }
            })
        })
        .catch(e => {
            log(`Error while getting recitation URL for aya ${ayaId} by ${reciter} for chat ${chatId}: `, e)
            if(!recitationReady) {
                sendSorry(chatId, 'audio')
                .then(ctx => sendAyaText(ctx, dualText, ayaId, reciter, lang, trigger))
                .catch(e => log(`Error while sending SORRY for no recitation for aya ${ayaId} by ${reciter} to chat ${chatId}: `, e))
            }
        })
    })
    .catch(e => log(`Error while calling getFavReciter for chat ${chatId}: `, e)) 
}


function sendAyaText(ctx, ayaText, ayaId, reciter, lang, trigger){
    recitationMsgId = ctx.audio ? ctx.message_id : 0 // To be able to handle cases of audio issues

    // Prepare buttons to be sent with Aya text
    var markup = aMenuButtons(ayaId, reciter, recitationMsgId)

    // send aya text and inline buttons
    bot.telegram.sendMessage(ctx.chat.id, ayaText, {disable_web_page_preview: true, parse_mode: 'HTML', reply_markup: markup})
        .then(c => successSend(c, ayaId, lang, trigger))
        .catch(e => {
            log(`Error while sending Aya ${ayaId} text to chat ${ctx.chat.id}: `, e)
            if(JSON.stringify(e).includes('blocked by the user')){
                lastAyaTime(ctx.chat.id, 'blocked')
            }
        })
}

function aMenuButtons(ayaId, reciter, recitationMsgId, menuState){
    var buttons, menuState = menuState ? menuState : 0
    switch (menuState) {
        case 0:
            buttons = {
                inline_keyboard:[
                    [{
                        text: "···",
                        callback_data: `{"aMenu":0,"a":${ayaId},"r":"${reciter}","rMsgId":${recitationMsgId}}`
                        // rMsgId to be able to change the audio later when needed (for example: change recitation)
                    },{
                        text: "▼",
                        callback_data: `{"currAya":${ayaId},"r":"${reciter}","rMsgId":${recitationMsgId}}`
                    }]
                ]
            }
            break

        case 1:
            var ayaIndex = ayaId2SuraAya(ayaId)
            buttons = {
                inline_keyboard: [
                    [{
                        text: "·",
                        callback_data: `{"aMenu":1,"a":${ayaId},"r":"${reciter}","rMsgId":${recitationMsgId}}`
                    },
                    // {
                    //     text: "⚠️",
                    //     callback_data: `{"aReport":${ayaId},"r":"${reciter}","rMsgId":${recitationMsgId}}`
                    // },
                    {
                        text: "🗣️",
                        callback_data: `{"setReciter":"${reciter}","a":${ayaId},"rMsgId":${recitationMsgId}}`
                    },{
                        text: "📖",
                        url: `https://quran.com/${ayaIndex.sura}/${ayaIndex.aya}`
                    },{
                        text: "▼",
                        callback_data: `{"currAya":${ayaId},"r":"${reciter}","rMsgId":${recitationMsgId}}`
                    }]
                ]
            }
            break
    
        default:
            log("Invalid aMenuButtons menuState: ", menuState)
            break
    }
    return buttons
}


function successSend(ctx, ayaId, lang, trigger){
    var chatName = ctx.chat.type == 'private' ? ctx.chat.first_name : ctx.chat.title
    log(`Successfully sent Aya ${ayaId} has been sent to chat ${ctx.chat.id}`)
    lastAyaTime(ctx.chat.id, 'success', chatName, lang, trigger)
}


function sendSorry(chatId, reason){
    return new Promise((resolve, reject) =>{
        var msg
        switch (reason) {
            case 'audio':
                msg =
`عذرا.. نواجه مشكلة في الملفات الصوتية ونأمل إصلاحها قريبا.
    
Sorry.. There's an issue in audio files and we hope it gets fixed soon.`
                break

            case 'text':
                msg =
`عذرا.. نواجه مشكلة في نصوص الآيات ونأمل إصلاحها قريبا.

Sorry.. There's an issue in Aya texts and we hope it gets fixed soon.`
                break
        
            default:
                msg =
`عذرا.. حدثت مشكلة غير معروفة.
    
Sorry.. An unknown issue happened.`
                break
        }


        bot.telegram.sendMessage(chatId, msg)
        .then(ctx => {
            log(`Sorry message sent to ${chatId} due to ${reason}.`)
            resolve(ctx)
        })
        .catch(e => {
            log(`Failed to send sorry message to ${chatId}: `, e)
            reject(e)
        })
    })
}



function nextAya(ayaId){
    return ayaId == 6236 ? 1 : ayaId+1
}



// Sends an error message if unrecognized aya
function unrecognized(chatId, reason){
    var msg 

    switch (reason) {
        case 1:
            msg =
`رسالتك بلا أرقام.
رجاء إرسال رقم السورة على الأقل.

Your message didn't contain numbers.
Please send Sura number at least.`
            break;
            
        case 2:
            msg =
`الرقم الأول ليس رقم سورة.
يجب أن يكون من 1 إلى 114.

The first number is not a Sura number.
It must be from 1 to 114.`
            break;

        case 3:
            msg =
`الرقم الثاني ليس آية في السورة المطلوبة.

The second number is not an Aya in the requested Sura.`
            break;

        case 4:
            msg =
`عفوا، حاليا نتعرف فقط على أرقام السور والآيات في الرسائل النصية.

Sorry, we currently only recognize numbers of Sura or Aya in text messages.`
            break;
    
        default:
            msg =
`خطأ غير معروف!

Unknown error!`
            break;
    }

    bot.telegram.sendMessage(chatId, msg, {
        reply_markup: {
            inline_keyboard:[
                [{
                    text: "🎁",
                    callback_data: "surpriseAya"
                },{
                    text: "🤔",
                    callback_data: "instructions"
                }]
            ]
        }
    })
    .then(log('Sent reason of unrecognized request to chat '+chatId+'.'))
    .catch(e=>log('Failed to send reason of unrecognized request to chat '+chatId+': ', e))
}





// Sends instructions message with buttons to get random aya or contact support
function instructions(chatId){
    var msg =
`يمكنك طلب آية محددة بإرسال رقم السورة والآية.
مثل: ٢   ٢٥٥
أو رقم السورة فقط مثل : ٢

You can request a specific Aya by sending the numbers of Aya and Sura.
Example: 2   255
Or Sura number only: 2`

    bot.telegram.sendMessage(chatId, msg, {
        reply_markup: {
            inline_keyboard:[
                [{
                    text: "🎁",
                    callback_data: "surpriseAya"
                },{
                    text: "💬",
                    url: "https://t.me/sherbeeny"
                }]
            ]
        }
    })
    .then(log('Sent instructions message to chat '+chatId+'.'))
    .catch(e=>log('Failed to send instructions message to chat '+chatId+': ', e))
}






// Converting input arabic number into english one to easily find numbers in sent messages
function numArabicToEnglish(string) {
    return string.replace(/[\u0660-\u0669]/g, function (c) {
        return c.charCodeAt(0) - 0x0660
    })
}



// Check if the requested Aya is valid or not
// returns Aya number (1 to 6236) if valid, or 0 if not valid.
// Because returning a promise, must be called with .then().catch()
function ayaCheck(sura, aya){
    return new Promise((resolve, reject) => {
        var url = 'http://api.alquran.cloud/ayah/'+sura+':'+aya;
      	    axios(url)
      	        .then(function (res) {
      	            resolve(res.data.data.number);
    	        }).catch(function (e) {
    	            log('ayaCheck error: ', e);
                    if (e.response.data.data.match('surah')) resolve(0); // Aya is not valid
                    else reject(e); // Something else is wrong!
                });
    });
}



// Responds to text messages to send the requested Aya or error message if unrecognized
function handleText(ctx){
    var txt = ctx.message.text
    var chatId = ctx.chat.id
    log('Message from chat ' + chatId+ ': ' + txt)
    var foundNums = numArabicToEnglish(txt).match(/\d+/g)
    
    // if incoming text doesn't have any valid numbers, send UNRECOGNIZED for reason 1
    if (foundNums===null || foundNums.length === 0) unrecognized(chatId, 1)
    
    // if incoming message contains one or more numbers and the first number is between 1 to 114 (sura number)
    else if (1 <= foundNums[0] && foundNums[0] <= 114) {
        if (foundNums.length == 1) { // One number is Sura number only
            ayaCheck(foundNums[0],1) // to get the Global Aya number of the first Aya in this Sura for "sendAya" function.
            .then((validAya) => { // it's always valid here.
                log('ayaCheck: '+ validAya)
                sendAya(chatId, validAya, "", ctx.from.language_code, 'request')
            })
            .catch((e) => log('ayaCheck Error: ', e))
            
        } else { // if first number is Sura and there's at least one more number (aya)
            ayaCheck(foundNums[0], foundNums[1])
            .then((validAya) => {
                log('ayaCheck: '+ validAya)
                
                if (validAya){ // if valid aya number, send requested Aya
                    sendAya(chatId, validAya, "", ctx.from.language_code, 'request')
                
                // if second number (aya) is invalid, send UNRECOGNIZED for reason 3
                } else unrecognized(chatId, 3)
            })
            .catch((e) => log('ayaCheck Error: ', e))
        }
    // if first number is not valid sura number, send UNRECOGNIZED for reason 2
    } else unrecognized(chatId, 2)
}


// set the bot menu
bot.telegram.setMyCommands([
    {'command':'surpriseme', 'description': '🎁 ꓢurprise ꓟe فاجئني'},
    {'command':'help', 'description': '🤔 𝐈nstructions إرشادات'},
    {'command':'support', 'description': '🤗 ꓢupport دعم'},
    {'command':'reciters', 'description': '🗣️ ꓢet Reciter اختيار القارئ'}
])


// Invoking start command
bot.start(ctx => {
    if(ctx.startPayload.length) handleText(ctx)
    else start(ctx.chat.id)
})

// Invoking help command
bot.help(ctx => {
    instructions(ctx.chat.id)
})




// When a user presses "Surprise Me" in menu
bot.command('surpriseme', ctx => {
    sendAya(ctx.chat.id, "", "", ctx.from.language_code, 'surprise')
})


// When a user presses "Support" in menu
bot.command('support', ctx => {
    var msg =
`ندعمك أم تدعمنا؟

Support you or support us?`
    bot.telegram.sendMessage(ctx.chat.id, msg, {
        reply_markup: {
            inline_keyboard:[
                [{
                    text: "💰",
                    url: "https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=sherbeeny@me.com&lc=US&item_name=Support+DailyAya&no_note=0&cn=&currency_code=USD&bn=PP-DonationsBF:btn_donateCC_LG.gif:NonHosted"
                },{
                    text: "💬",
                    url: "https://t.me/sherbeeny"
                }]
            ]
        }
    })
})



// When a user presses "set_fav_reciter" in menu
bot.command('reciters', ctx => {
    var msg =
`من هو قارئك المفضل؟

Who is your favorite Reciter?`
    bot.telegram.sendMessage(ctx.chat.id, msg, {
        reply_markup: {
            inline_keyboard: recitersNavPage(1)
        }
    })
})

// bot.command(`restart`, ctx =>{
//     sigHandler(`restartCommand`)
// })

function recitersNavPage(page){
    var recitersPerPage = 5
    var totalPages = Math.ceil(recitersInlineButtons.length/recitersPerPage)
    var buttons = recitersInlineButtons.slice((page-1)*recitersPerPage, (page*recitersPerPage))
    var navRow = [{
        text: `🎲`,
        callback_data: `{"setReciter": "surprise"}`
    },{
        text: `＜`,
        callback_data:  page != 1 ? `{"recitersNavPage": ${page-1}}` : `{"recitersNavPage": ${totalPages}}`
    },{
        text: `${page}/${totalPages}`,
        callback_data:  "inactive"
    },{
        text: `＞`,
        callback_data:  page != totalPages ? `{"recitersNavPage": ${page+1}}` : `{"recitersNavPage": 1}`
    }]
    buttons.push(navRow)
    return buttons
}

bot.action(/^{"recitersNavPage/ , ctx =>{
    var callbackData = JSON.parse(ctx.update.callback_query.data)
    var requestedRecitersNavPage = callbackData.recitersNavPage
    bot.telegram.editMessageReplyMarkup(ctx.chat.id, ctx.update.callback_query.message.message_id, undefined, {
        inline_keyboard: recitersNavPage(requestedRecitersNavPage)
    })
})

bot.action(/^{"setReciter/ , ctx =>{
    var callbackData = JSON.parse(ctx.update.callback_query.data)
    var requestedFavReciter = callbackData.setReciter
    
    setFavReciter(ctx.chat.id, requestedFavReciter)
})



bot.action('instructions', ctx => {
    instructions(ctx.chat.id)
})


// When a user presses "Another Aya" inline keyboard button
bot.action('surpriseAya', ctx => {
    sendAya(ctx.chat.id, "", "", ctx.from.language_code, 'surprise')
})



// When a user presses "Next Aya" inline keyboard button
bot.action(/^{"currAya/, ctx => {
    var callbackData= JSON.parse(ctx.update.callback_query.data)
    var currentAyaId = Math.floor(callbackData.currAya)
    log(`Sending next Aya after Aya ${currentAyaId} with Reciter ${callbackData.r} for chat ${ctx.chat.id}`)
    log(`Current ayaMsgId is ${ctx.update.callback_query.message.message_id} and recitationMsgId is ${callbackData.rMsgId}`)
    sendAya(ctx.chat.id, nextAya(currentAyaId), callbackData.r, ctx.from.language_code, 'next')
})

bot.action(/^{"aMenu/ , ctx =>{
    var callbackData = JSON.parse(ctx.update.callback_query.data)
    var buttons = aMenuButtons(callbackData.a, callbackData.r, callbackData.rMsgId, callbackData.aMenu ? 0 : 1) // Toggle menu state
    bot.telegram.editMessageReplyMarkup(ctx.chat.id, ctx.update.callback_query.message.message_id, undefined, buttons)
})



bot.on('text', ctx => handleText(ctx))


// Responds to "some" non text messages to send UNRECOGNIZED for reason 4
bot.on('sticker', ctx => unrecognized(ctx.chat.id, 4))
bot.on('photo', ctx => unrecognized(ctx.chat.id, 4))
bot.on('location', ctx => unrecognized(ctx.chat.id, 4))
bot.on('document', ctx => unrecognized(ctx.chat.id, 4))
bot.on('audio', ctx => unrecognized(ctx.chat.id, 4))
bot.on('voice', ctx => unrecognized(ctx.chat.id, 4))
bot.on('poll', ctx => unrecognized(ctx.chat.id, 4))
bot.on('contact', ctx => unrecognized(ctx.chat.id, 4))




// to handle when blocked/unblocked by a user or when added/removed from groups
bot.on('my_chat_member', ctx => {
    switch (ctx.update.my_chat_member.new_chat_member.status) {
        case 'member':
            if(ctx.chat.type != 'private') start(ctx.chat.id) // don't send to private chats as they already trigger /start
            break

        case 'kicked': case 'left':
            lastAyaTime(ctx.chat.id, 'blocked')
            break
    
        default:
            log('Unknown my_chat_member status: ', JSON.stringify(ctx))
            break
    }
})










//method to start get the script to pulling updates for telegram 
bot.launch()
.then(console.log('Bot launched.')) // using console.log() to log it regardless of debugging flag
.catch(e => log('Failed to launch bot: ', e))

function sigHandler(sig){
    log(`Exiting after ${+(process.uptime()/3600).toFixed(2)} hours and Used Memory ${Math.floor(process.memoryUsage().rss / (1024 * 1024))} MB due to: `, sig)
    .then(() => {
        bot.stop(sig)
        //process.exit()
    })
    
}

// Enable graceful stop
process
    .on('SIGTERM', () => sigHandler('SIGTERM'))
    .on('SIGINT', () => sigHandler('SIGINT'))
    .on('uncaughtException', (err, origin) => {
        log(`Uncaught Exception of origin (${origin}): `, err)
        sigHandler('uncaughtException')
    })
    .on('unhandledRejection', (reason, promise) =>{
        log(`Unhandled Rejection for promise (${promise}): `, reason)
        sigHandler('unhandledRejection')
    })