const { Markup } = require('telegraf');
const { processFinalLinkCreation } = require('./link');

const letterPool = {
    love: [
        "তুমি আমার জীবনের সবথেকে মূল্যবান পাওয়া। তোমার এই মিষ্টি মুখের হাসি আর ভালোবাসা ছাড়া আমার একটি মুহূর্তও চলে না। সারাজীবন এভাবেই আমার পাশে থেকো, তোমায় অনেক ভালোবাসি। ❤️",
        "হাজারো মানুষের ভিড়ে কেবল তোমাকেই আমার মনের খুব কাছের মানুষ মনে হয়। তোমার সাথে কাটানো প্রতিটি মুহূর্ত আমার কাছে রূপকথার মতো। চিরদিন আমার ছায়াসঙ্গী হয়ে থেকো। 🌹",
        "তুমি আমার চোখের পলকের শান্তি আর মনের গভীরের সবটুকু ভালোবাসা। তোমায় নিয়ে দেখা স্বপ্নগুলো একদিন সত্যি করতে চাই। সারাজীবন এভাবেই ভালোবেসে যাবো। 🥰",
        "ঝড়-ঝাপটা যাই আসুক না কেন, তোমার হাতটি আমি কখনো ছাড়ব না। আমার সুখের দিনে এবং দুঃখের দিনে তোমাকেই পাশে চাই। অনেক ভালোবাসি আমার প্রিয় মানুষটিকে। ♾️",
        "আমার জীবনের সবচাইতে সুন্দর অধ্যায়টি শুরু হয়েছিল তোমাকে পাওয়ার পর থেকে। তুমি আমার জীবনে আসার পর সবকিছু অনেক সুন্দর হয়ে গেছে। এভাবেই সবসময় পাশে থেকো। ✨",
        "তোমার সাথে কাটানো প্রতিটি সেকেন্ড আমার কাছে স্বর্গের মতো মনে হয়। তুমি আমার জীবনের এমন এক অধ্যায়, যা আমি কখনো শেষ হতে দিতে চাই না। 📖",
        "আমার সব চাওয়া-পাওয়ার মাঝে কেবল তুমিজুড়ে আছো। আমার সুখের চাবিকাঠি তোমার ওই মিষ্টি হাসির মাঝেই লুকিয়ে আছে। সারাজীবন এভাবেই ভালোবেসে যাবো। 🌻",
        "তোমাকে না দেখলে মন কেমন যেন আনচান করে। তুমি আমার প্রতিদিনের বেঁচে থাকার অনুপ্রেরণা এবং আমার সবথেকে বড় শক্তি। অনেক ভালো থেকো আমার ভালোবাসা। 💫",
        "জীবনে অনেক মানুষ আসবে আর যাবে, কিন্তু আমার হৃদয়ে তোমার স্থান কেউ কখনো নিতে পারবে না। তুমি আমার প্রথম ও শেষ ভালোবাসা। 💖",
        "আমার ছোট ছোট স্বপ্নগুলোর চাবিকাঠি তুমি। তোমায় পেয়ে আমি পৃথিবীর সবচেয়ে সুখী মানুষ। সৃষ্টিকর্তার কাছে শুধু একটাই প্রার্থনা, আমাদের বন্ধন যেন চির অটুট থাকে। 🤲"
    ],
    birthday: [
        "শুভ জন্মদিন! তোমার জীবনের প্রতিটি দিন যেন সুখ, হাসি, সাফল্য ও আলোয় ভরে থাকে। আজকের এই বিশেষ দিনটি তোমার জীবনে অনেক বড় আনন্দ নিয়ে আসুক, এই কামনাই করি! 🎂",
        "আজকের এই বিশেষ দিনটিতে দোয়া করি মহান আল্লাহ যেন তোমার সব স্বপ্ন ও আশা পূরণ করেন। জীবনটা অনেক সুন্দরভাবে উপভোগ করো, জন্মদিনের অনেক শুভেচ্ছা! 🌟",
        "বয়স তো কেবল একটি সংখ্যা, তোমার ভেতরের শিশুসুলভ মনটি যেন সবসময় এমন সুন্দর ও অমলিন থাকে। আজকের দিনটি শুধু তোমার, প্রচুর আনন্দ করো এবং অনেক হাসিখুশি থেকো! 🎉",
        "শুভ জন্মদিন প্রিয়! জীবনে অনেক দূর এগিয়ে যাও এবং তোমার লক্ষ্যগুলো অর্জন করো। তোমার আগামী দিনগুলো যেন আরও বেশি উজ্জ্বল ও চমৎকার হয়। 🎈",
        "আজকের দিনটা অনেক আনন্দের হোক! কেক, গিফট আর চারপাশের মানুষের ভালোবাসায় তোমার দিনটি যেন একটি স্মরণীয় দিন হয়ে থাকে। অনেক শুভকামনা তোমার জন্য! 🎁",
        "তোমার জন্মদিনের এই পবিত্র ক্ষণে কামনা করি, জীবনের প্রতিটি ক্ষেত্রে তোমার জয় হোক। তুমি সবসময় এভাবেই হাসিখুশি থেকো এবং সবাইকে ভালো রেখো। 🌸",
        "আজকের দিনটি তোমার জীবনে নিয়ে আসুক নতুন আশা এবং সফলতার নতুন দুয়ার। জন্মদিনের অনেক অনেক প্রীতি ও শুভেচ্ছা রইল তোমার প্রতি! 🎊",
        "শুভ জন্মদিন! তোমার জীবনের প্রতিটি সকাল হোক নতুন সম্ভাবনায় ভরপুর এবং প্রতিটি সন্ধ্যা হোক শান্তির। অনেক অনেক ভালো কাটো আজকের দিনটি। 🌅",
        "তোমার মতো একজন দুর্দান্ত মানুষের জীবনে আজ একটি বিশেষ দিন। সৃষ্টিকর্তা তোমাকে সবসময় সুস্থ রাখুন এবং তোমার সব নেক আশা পূরণ করুন। 🤲",
        "জন্মদিনের একরাশ লাল গোলাপ শুভেচ্ছা তোমার জন্য! জীবনটা অনেক বড়, এটিকে তোমার নিজের মতো করে সুন্দরভাবে সাজিয়ে তোলো। হ্যাপি বার্থডে! 🌹"
    ],
    sorry: [
        "আমার ভুলগুলোর জন্য আমি সত্যিই লজ্জিত ও গভীরভাবে দুঃখিত। কখনো ইচ্ছাকৃতভাবে তোমাকে কষ্ট দিতে চাইনি। আমার ভুলগুলো ক্ষমা করে দিয়ে আগের মতো আপন করে নাও প্লিজ। 🙏",
        "তোমার মন ভাঙার কষ্ট আমাকে ভেতর থেকে পুড়িয়ে দিচ্ছে। বুঝতে পারিনি আমার কথা বা কাজ তোমাকে এত আঘাত করবে। দয়া করে আমাকে একটিবার ক্ষমা করে দাও। 😔",
        "সব অহংকার ও ভুল ভেঙে আজ তোমার কাছে ক্ষমা চাচ্ছি। দয়া করে আমার ভুলটি ক্ষমা সুন্দর দৃষ্টিতে দেখে আগের মতো সুন্দর সম্পর্কটা ফিরিয়ে দাও। 🥀",
        "তোমার রাগ করাটা একদম স্বাভাবিক, কারণ আমিই ভুল করেছি। তবে আমায় ক্ষমা না করলে আমি খুব কষ্ট পাবো। দয়া করে সব রাগ অভিমান ভেঙে আমাকে ক্ষমা করে দাও। 🥺",
        "আমার অপরিপক্ব আচরণের জন্য আমি আন্তরিকভাবে ক্ষমা প্রার্থী। আমাকে আগের মতো বন্ধু বা ভালোবাসার মানুষ হিসেবে গ্রহণ করো, কথা দিচ্ছি এমন ভুল আর হবে না। 🤝",
        "তোমার চোখের এক ফোঁটা জলের কারণ হওয়া মানে আমার নিজের শাস্তি পাওয়া। আমি আমার ভুলের জন্য অনুতপ্ত, দয়া করে আমাকে ক্ষমা করে দাও। 💧",
        "মানুষ মাত্রই ভুল হয়, কিন্তু আমার এই ভুলটি তোমার মনে বড় বেশি কষ্ট দিয়েছে। বিশ্বাস করো, আমি সত্যিই খুব অনুতপ্ত। আমায় ক্ষমা করে দাও প্রিয়। 🍃",
        "রাগ করে দূরে চলে যেও না। তোমার এই নীরবতা আমার বুক চিরে ফেলছে। আমার সব ভুল ক্ষমা করে দিয়ে আগের মতো সুন্দর সম্পর্কটা ফিরিয়ে দাও। 🫂",
        "আমার বোকামির জন্য আজ আমাদের মাঝে এই দূরত্ব তৈরি হয়েছে। আমি কথা দিচ্ছি ভবিষ্যতে আর কখনো এমন ভুল হবে না। দয়া করে আমাকে ক্ষমা করে দাও। ⏳",
        "সব রাগ, অভিমান আর জেদ ভুলে একটু হাসো। আমার সমস্ত অপরাধ ক্ষমা করে দিয়ে আমাকে আবার আগের মতো আপন করে নাও। অনেক ভালোবাসি তোমায়। 🧡"
    ],
    eid: [
        "ঈদ মোবারক! তোমার ও তোমার পরিবারের জীবন ঈদের চাঁদের মতো উজ্জ্বল ও সুন্দর হোক। আল্লাহ তোমার জীবন অনাবিল শান্তি ও সমৃদ্ধিতে পরিপূর্ণ করে দিন। 🌙✨",
        "এই পবিত্র ঈদে তোমার জীবনের সকল দুঃখ-বেদনা দূর হয়ে মনটা আনন্দে ভরে উঠুক। প্রিয়জনদের সান্নিধ্যে তোমার এবারের ঈদ অত্যন্ত আনন্দময় ও নিরাপদ কাটুক। 🕌",
        "ঈদ মোবারক! মহান আল্লাহ তোমার সকল নেক আমল কবুল করুন এবং তোমার জীবনকে সুখ ও হাসিমুখে ভরিয়ে তুলুন। পরিবারকে নিয়ে অনেক ভালো কাটুক এবারের ঈদ! 🌹",
        "সেমাইয়ের মিষ্টি স্বাদ আর সবার কোলাকুলিতে জমে উঠুক তোমার ঈদের দিনটি। সব মনকষ্ট দূরে ঠেলে দিয়ে আজকের দিনটি শুধু হাসিখুশিতে কাটিয়ে দাও। ঈদ মোবারক! 🎉",
        "ঈদের এই পবিত্র হাওয়া তোমার মনে নিয়ে আসুক অপার শান্তি ও প্রশান্তি। তোমার জীবনের প্রতিটি দিন যেন ঈদের দিনের মতো আনন্দের হয়, এই শুভকামনা রইল। 🌟",
        "ঈদ মোবারক! তোমার জীবনের সমস্ত অন্ধকার দূর হয়ে আনন্দের আলোয় ঝলমল করে উঠুক চারপাশ। পরিবারের সবাইকে নিয়ে খুব আনন্দে কাটুক এবারের ঈদ! 🏮",
        "বছর ঘুরে আবার আসুক ঈদের আনন্দ। এই পবিত্র দিনে আল্লাহ তোমার সমস্ত দোয়া কবুল করুন এবং তোমার জীবনকে সুখ-শান্তিতে ভরে দিন। ঈদ মোবারক! 🌙",
        "ঈদের এই আনন্দঘন মুহূর্তে ভুলে যাও সব ভেদাভেদ। কোলাকুলি আর হাসিখুশিতে মেতে উঠুক তোমার আজকের দিনটি। অনেক শুভেচ্ছা তোমার জন্য! 🤝",
        "নতুন পোশাকের সুবাস আর মিষ্টির মোমে মুখরিত হোক তোমার ঈদের সকাল। জীবনটা অনেক সুন্দর হোক, এই কামনা করি। ঈদ মোবারক! 🍰",
        "আল্লাহর অশেষ রহমতে তোমার ও তোমার প্রিয়জনদের জীবন যেন সবসময় শান্তিতে ভরে থাকে। পবিত্র ঈদের অনাবিল শুভেচ্ছা ও ভালোবাসা নিও! 🤲"
    ]
};

async function generateRandomLetter(category, history = []) {
    const cat = letterPool[category] ? category : 'love';
    let availableLetters = letterPool[cat];
    let filtered = availableLetters.filter(item => !history.includes(item));
    if (filtered.length === 0) filtered = availableLetters;
    let text = filtered[Math.floor(Math.random() * filtered.length)];
    return text;
}

function setupLetterActions(bot, db, saveDB, ADMIN_IDS, SERVER_URL) {
    bot.action('random_letter_start', async (ctx) => {
        ctx.answerCbQuery();
        const userId = ctx.chat.id;
        const session = db.userSessions[userId];
        if (!session) return;
        
        session.letterHistory = [];
        session.currentLetterText = await generateRandomLetter(session.type, session.letterHistory);
        session.letterHistory.push(session.currentLetterText);
        session.step = 'PREVIEW_RANDOM_LETTER';
        await saveDB();
        await renderRandomLetterPreview(ctx, userId);
    });

    bot.action('letter_change', async (ctx) => {
        ctx.answerCbQuery();
        const userId = ctx.chat.id;
        const session = db.userSessions[userId];
        if (!session) return;
        session.prevLetterText = session.currentLetterText;
        session.currentLetterText = await generateRandomLetter(session.type, session.letterHistory);
        session.letterHistory.push(session.currentLetterText);
        await saveDB();
        await renderRandomLetterPreview(ctx, userId, true);
    });

    bot.action('letter_prev', async (ctx) => {
        ctx.answerCbQuery();
        const userId = ctx.chat.id;
        const session = db.userSessions[userId];
        if (!session || !session.prevLetterText) return;
        const temp = session.currentLetterText;
        session.currentLetterText = session.prevLetterText;
        session.prevLetterText = temp;
        await saveDB();
        await renderRandomLetterPreview(ctx, userId, true);
    });

    bot.action('letter_keep', async (ctx) => {
        ctx.answerCbQuery();
        const userId = ctx.chat.id;
        const session = db.userSessions[userId];
        if (!session) return;
        session.step = 'AWAITING_MOVEMENT_CHOICE';
        await saveDB();
        
        if (session.lastPromptMsgId) {
            await bot.telegram.deleteMessage(userId, session.lastPromptMsgId).catch(() => {});
        }

        const sentMsg = await ctx.reply("🔘 No বাটনটি মুভমেন্ট করাতে চান?", Markup.inlineKeyboard([
            [Markup.button.callback("হ্যাঁ ✅", "mov_yes"), Markup.button.callback("না ❌", "mov_no")]
        ]));
        session.lastPromptMsgId = sentMsg.message_id;
        await saveDB();
    });

    bot.action(/^mov_(yes|no)$/, async (ctx) => {
        ctx.answerCbQuery();
        const userId = ctx.chat.id;
        const session = db.userSessions[userId];
        if (!session) return;

        session.enableMovement = (ctx.match[1] === 'yes');
        const letterText = session.currentLetterText;

        if (session.lastPromptMsgId) {
            await bot.telegram.deleteMessage(userId, session.lastPromptMsgId).catch(() => {});
        }
        await processFinalLinkCreation(ctx, letterText, db, saveDB, bot, ADMIN_IDS, SERVER_URL);
    });
}

async function renderRandomLetterPreview(ctx, userId, showPrevBtn = false) {
    const session = db.userSessions[userId];
    const text = "জেনারেট করা চিঠি:\n\n" + session.currentLetterText;
    let buttons = [
        [Markup.button.callback("এটি রাখবো", 'letter_keep')],
        [Markup.button.callback("পরিবর্তন", 'letter_change')]
    ];
    if (showPrevBtn) {
        buttons = [
            [Markup.button.callback("এটি রাখবো", 'letter_keep')],
            [Markup.button.callback("আগেরটা", 'letter_prev'), Markup.button.callback("পরিবর্তন", 'letter_change')]
        ];
    }
    const keyboard = Markup.inlineKeyboard(buttons);
    await ctx.editMessageText(text, { reply_markup: keyboard.reply_markup }).catch(() => {});
}

async function handleLetterText(ctx, db, saveDB, bot) {
    const userId = ctx.chat.id;
    const session = db.userSessions[userId];
    const text = ctx.message.text.trim();

    if (session.lastPromptMsgId) {
        await bot.telegram.deleteMessage(userId, session.lastPromptMsgId).catch(() => {});
    }
    await ctx.deleteMessage().catch(() => {});
    session.currentLetterText = text;
    session.step = 'AWAITING_MOVEMENT_CHOICE';
    await saveDB();

    const sentMsg = await ctx.reply("🔘 No বাটনটি মুভমেন্ট করাতে চান?", Markup.inlineKeyboard([
        [Markup.button.callback("হ্যাঁ ✅", "mov_yes"), Markup.button.callback("না ❌", "mov_no")]
    ]));
    session.lastPromptMsgId = sentMsg.message_id;
    await saveDB();
    return true;
}

module.exports = { setupLetterActions, handleLetterText };
