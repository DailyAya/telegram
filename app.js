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

// Records the last time an aya was sent to a chat so we can send again after 24 hours
function lastAyaTime(chatId){
    var shiftedTime = Date.now() - 300000; // To shift lastUpdate time 5 minutes to keep sending the user near the same time everyday.

}



const {Telegraf} = require('telegraf')
const bot = new Telegraf(telegramToken)
const axios = require('axios')

// Inform "DailyAya Dev" group about the instance state
if(telegramToken != "inactive"){
    bot.telegram.sendMessage(-1001592920692, instStateMsg) // -1001592920692 is the group ID of "DailyAya Dev"
}

//method for invoking start command
bot.command('start', ctx => {
    console.log(["command: start", ctx.from, ctx.chat])
    sendAya(ctx.chat.id)
})

//method for sending an aya
bot.hears('aya', ctx => {
    respondWith(ctx.chat.id)
})

// testing db
bot.hears('db', ctx =>{
    bot.telegram.sendMessage(ctx.chat.id, 'Querying...')
    dbConn.db('sample_mflix').collection('users').find({email:
        "sean_bean@gameofthron.es"}).toArray((err, res) =>{
            if (err) console.error('DB error: ', err)
            else {
                console.log('Found ' + res.length + ' results.')
                bot.telegram.sendMessage(ctx.chat.id, 'Found ' + res.length + ' results.')
                if(res.length>=1) bot.telegram.sendMessage(ctx.chat.id, 'First name is '+ res[0].name)
            }
        })
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




//Send a message to a user in telegram
function sendMsg(user, response, lastAya, lastReciter) {
    bot.telegram.sendMessage(user, response, {disable_web_page_preview: true})
    // // Construct the message body
    // let request_body = {
    //     "recipient": {
    //         "id": user
    //     },
    //     "message": response,
    //     "messaging_type": "MESSAGE_TAG",
    //     "tag": "NON_PROMOTIONAL_SUBSCRIPTION"
    // };
 
    // // Send the HTTP request to the Messenger Platform
    // request({
        
    //   "uri": "https://graph.facebook.com/v2.6/me/messages",
    //   "qs": {"access_token":PAGE_ACCESS_TOKEN },
    //     "method": "POST",
    //     "json": request_body
    // }, (err, res, body) => {
    //     if (!err) {
    //         console.log('message sent!');
            
    //         if (res.statusCode == 200){
    //             // Update database and set failCount to 0
    //             updateDb(user, 0, lastAya, lastReciter);
                
    //         } else {
    //             // Update database and increase failCount by 1
    //             updateDb(user, 1, lastAya, lastReciter); 
    //         }
            
    //     } else {
    //         console.error("Unable to send message: " + err);
    //     }
    // });
}


// returns a URL string for the audio file of the requested aya (is a must)
// if reciter is not requested (1 to 16), a random reciter will be provided
function recitation(aya, reciter){
    var recitersArray = [
          "ar.alafasy",               // 1
          "ar.mahermuaiqly",          // 2
          "ar.muhammadjibreel",       // 3
          "ar.shaatree",              // 4
          "ar.ahmedajamy",            // 5
          "ar.abdullahbasfar",        // 6
          "ar.hanirifai",             // 7
          "ar.husary",                // 8
          "ar.hudhaify",              // 9
          "ar.ibrahimakhbar",         // 10
          "ar.abdurrahmaansudais",    // 11
          "ar.muhammadayyoub",        // 12
          "ar.abdulsamad",            // 13
          "ar.saoodshuraym",          // 14
          "ar.parhizgar",             // 15
          "ar.husarymujawwad"         // 16
          ];
  
      if (reciter) {
          reciter = parseInt(reciter);
          if (1 > reciter || reciter > 16) reciter = randomNum('reciter');
          
      } else reciter = randomNum('reciter');
      
      return 'https://cdn.alquran.cloud/media/audio/ayah/'.concat(recitersArray[reciter-1]).concat('/').concat(aya);
  }


// Send random Aya and random reciter if called with the userId argument only 
function sendAya(userId, requestedAyaNum, requestedReciterNum){

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
    console.log('Preparing Aya ' +ayaNum+ ' for user '+userId);
    prepareAya(ayaNum)  
            .then((ayaText) => {
                console.log('Successfully prepared Aya ' +ayaNum+ ' for user '+userId);
               
                // send an Aya text
                bot.telegram.sendMessage(userId, ayaText, {disable_web_page_preview: true})
                .then(sentMsg => console.log(sentMsg))
                .catch(e => console.log(e))

                // send an Aya recitation with inline keyboard buttons
                quranUrl(ayaNum).then((ayaQuranUrl) => {
                    bot.telegram.sendAudio(userId, recitation(ayaNum, reciterNum), {title: "Quran", performer: "Reciter", reply_markup: { // title and performer tags are not working!
                        inline_keyboard:[
                            [{
                                text: "🎁",
                                callback_data: "anotherAya"
                            },{
                                text: "📖",
                                url: ayaQuranUrl
                            },{
                                text: "⏭️",
                                callback_data: '{"nextAyaAfter":'+ayaNum+',"reciter":'+reciterNum+'}'
                            }]
                        ]
                    }
                }); 

                console.log('Successfully sent Aya '+ayaNum+' has been sent to user '+userId);

                }).catch((e) => console.error('Failed to get aya Quran.com URL: ', e))

            }).catch((e) => console.error('Failed preparing an Aya.. STOPPED: ', e));
}


// When a user presses "Another Aya" inline keyboard button
bot.action('anotherAya', ctx => {
    sendAya(ctx.chat.id)
})

// When a user presses "Next Aya" inline keyboard button
bot.action(/^{"nextAyaAfter/, ctx => {
    var callbackData= JSON.parse(ctx.update.callback_query.message.reply_markup.inline_keyboard[0][2].callback_data)
    var currentAyaNum = Math.floor(callbackData.nextAyaAfter)
    var currentReciter = Math.floor(callbackData.reciter)
    console.log("Sending next Aya after Aya "+ currentAyaNum+" with Reciter "+ currentReciter+" for ID "+ctx.chat.id)
    var nextAya = currentAyaNum==6230 ? 1 : currentAyaNum+1
    sendAya(ctx.chat.id, nextAya, currentReciter)
})