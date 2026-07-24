const { Markup } = require('telegraf');

const animationPool = {
    love: [
        "তুমি আমার সবচেয়ে সুন্দর অনুভূতি ❤️",
        "তোমার হাসিতে পৃথিবী আলোকময় ✨",
        "মন শুধু তোমাকেই খুঁজে 🌹",
        "তুমি পাশে থাকলে সব কষ্ট দূর 🥰",
        "সারাজীবন তোমাকে ভালোবাসতে চাই ♾️",
        "আমার সকালের প্রথম ভাবনা তুমি 🌅",
        "তুমি আমার জীবনের শ্রেষ্ঠ অধ্যায় 📖",
        "চোখ বন্ধ করলে তোমাকেই দেখি 💭",
        "তোমাকে ভালোবাসার শেষ নেই 💕",
        "আমার সুখের নাম হলো তুমি 🌻",
        "এক মুহূর্তও তোমায় ছাড়া ভালো লাগে না ⏰",
        "হৃদয়ের প্রতি স্পন্দনে তোমার নাম 💓",
        "তুমি আমার জীবনের সেরা উপহার 🎁",
        "তোমার সাথে কাটানো সময় পবিত্র 🌸",
        "সব সুখ আর তোমার ভালোবাসা ⚖️",
        "তোমার হাত ধরে পথ চলতে চাই 🤝",
        "তুমি আমার মিষ্টি সকাল ও রাত 🌙",
        "আমার সব গল্পের নায়িকা তুমি 👑",
        "তোমাকে হারানোর ভয় সবচেয়ে বেশি 🔐",
        "তুমি আমার বর্তমান ও ভবিষ্যৎ 🕊️",
        "তুমি ছাড়া আমার দুনিয়া শূন্য 🌌",
        "আমার প্রতিটা নিঃশ্বাসে শুধু তুমি আছো 🌬️",
        "তোমার ওই মায়াবী চোখে আমি হারিয়ে যাই 👀",
        "তুমি আমার জীবনের সবচেয়ে দামি মানুষ 💎",
        "তোমার ভালোবাসায় আমার মন ভিজে যায় 🌧️",
        "হাজার জনমের চাওয়া শুধু তুমি 🌠",
        "আমার কষ্টের ওষুধ হলো তোমার হাসি 💊",
        "তুমি আমার মিষ্টি সকালের রোদ্দুর ☀️",
        "আমার হৃদয়ের একমাত্র অধিকারিণী তুমি 💖",
        "তোমাকে ভালোবেসে কখনো ক্লান্তি আসে না ⚓"
    ],
    birthday: [
        "শুভ জন্মদিন! দিনটি আনন্দে কাটুক 🎂",
        "আল্লাহ তোমাকে সুস্থ ও দীর্ঘজীবী করুন 🌟",
        "প্রতিটি পদক্ষেপে সাফল্য নেমে আসুক 🎉",
        "শুভ জন্মদিন প্রিয়! সব স্বপ্ন পূরণ হোক 🎈",
        "আজকের দিনটি শুধু তোমার জন্য 🎁",
        "তোমার হাসি মুখ সবসময় দেখতে চাই 😊",
        "দিনটি তোমার জীবনের সেরা হোক 🎊",
        "নতুন বয়সে জীবন আলোয় ভরে উঠুক ✨",
        "শুভ জন্মদিন! অনেক ভালোবাসা 💖",
        "প্রতিটি দিন খুশিতে পরিপূর্ণ থাকুক 🥳",
        "মুখে সবসময় মিষ্টি হাসি থাকুক 🍰",
        "আল্লাহ তোমার সব আশা কবুল করুন 🤲",
        "অন্তরের গভীর থেকে শুভেচ্ছা 🌹",
        "বছর ঘুরে আসুক আনন্দের দিন 🎇",
        "কেক কাটার আনন্দ দ্বিগুণ হোক 🎂",
        "জীবনের প্রতিটি অধ্যায় সফল হোক 🏆",
        "শুভ জন্মদিন! অনেক ভালো থেকো 💫",
        "জন্মদিনের অনেক প্রীতি ও শুভেচ্ছা 💐",
        "আজকে শুধু আনন্দ করো, টেনশন নেই 🎈",
        "তোমার পথচলা মসৃণ ও সুন্দর হোক 🌈",
        "আজকের দিনটা তোমার জীবনে অনাবিল সুখ আনুক 🍀",
        "তোমার সব ইচ্ছে পূরণ হোক এই শুভ দিনে 🌠",
        "প্রতিটি বছর তোমার জীবন আরও সুন্দর হোক 🌷",
        "হাসিখুশিতে কেটে যাক তোমার আজকের দিনটি 😄",
        "আল্লাহ তোমাকে সবসময় নেক হায়াত দান করুন 🤲",
        "জীবনের প্রতিটি পদক্ষেপে পাও যেন সফলতা 🎯",
        "শুভ জন্মদিনের অনেক অনেক শুভেচ্ছা ও ভালোবাসা 💌",
        "তোমার জীবনের আকাশ সবসময় মেঘমুক্ত থাকুক 🌤️",
        "আজকের দিনটি হয়ে উঠুক তোমার জীবনের সেরা দিন 🎇",
        "তোমার মুখের অমলিন হাসি চিরকাল বজায় থাকুক 😁"
    ],
    sorry: [
        "আমার ভুলের জন্য আন্তরিকভাবে দুঃখিত 😔",
        "মন কষ্ট দিয়ে থাকলে ক্ষমা করে দিও 🙏",
        "জানতাম না কষ্ট পাবে, খুব খারাপ লাগছে 💔",
        "সব ভুল শুধরে নতুন শুরু করতে চাই 🤝",
        "ক্ষমা করে আগের মতো হয়ে যাও 💖",
        "ভুল বুঝতে পেরেছি, ক্ষমা চাই 🥀",
        "তোমার চোখের জলের কারণ হতে চাইনি 💧",
        "বোকামির জন্য আমাকে ক্ষমা করো 🥺",
        "সম্পর্কের খাতিরে ভুল ক্ষমা করে দিও 🤲",
        "রাগ করে থেকো না প্লিজ, সব ঠিক করব 🫂",
        "নিজেকে শুধরানোর একটি সুযোগ দাও ⏳",
        "তোমার মন ভাঙার জন্য আমি অপরাধী 🚪",
        "ক্ষমা সুন্দর দৃষ্টিতে দেখো 🌺",
        "সব রাগ ভেঙে একটু তাকাও 😔",
        "তোমার হাসি ছাড়া আমি একা 🌧️",
        "ইচ্ছাকৃত তোমাকে কষ্ট দিইনি 🌪️",
        "ক্ষমা না পেলে শান্তি পাবো না 🍃",
        "ভুল শোধরে নেওয়ার সুযোগ দাও 🌉",
        "সব ভুল ক্ষমা করে আগের মতো হও ✨",
        "খুব শীঘ্রই তোমার মুখে হাসি ফেরা দেব 🌤️",
        "আমার বোকামির জন্য আমি লজ্জিত 🙇‍♂️",
        "তোমার অভিমান ভাঙানোর দায়িত্ব আমার 🧩",
        "প্লিজ রাগ করে থেকো না, কষ্ট হয় 🌧️",
        "আরেকটিবার বিশ্বাস করার সুযোগ দাও 🤝",
        "সব ভুল শুধরে নেওয়ার ওয়াদা করছি 📜",
        "তোমার মনে কষ্ট দেওয়ার জন্য আমি ক্ষমা প্রার্থী 🥀",
        "আমার ভুলগুলো ক্ষমা করে বুক জড়িয়ে ধরো 🤗",
        "তোমাকে হারানো আমার পক্ষে অসম্ভব 🧭",
        "রাগ ভেঙে আগের মতো হেসে ওঠো তো 😊",
        "আমার অপরাধ ক্ষমা করে আমাকে আপন করে নাও 🧡"
    ],
    eid: [
        "ঈদ মোবারক! জীবন শান্তিতে ভরে উঠুক 🌙",
        "এই পবিত্র ঈদে সব আশা পূরণ হোক ✨",
        "প্রিয়জনকে নিয়ে ভালো কাটুক ঈদ 🕌",
        "ঈদ মোবারক! আনন্দে কাটুক দিন 🌹",
        "সবার জীবনে বয়ে আসুক ঈদের আনন্দ 🎉",
        "রোজা ও কোরবানি কবুল হোক 🕋",
        "নতুন পোশাকে জমে উঠুক ঈদ 🍽️",
        "সব ভেদাভেদ ভুলে কোলাকুলি হোক 🤝",
        "চারপাশটা ঈদের আনন্দে রঙিন থাকুক 🎨",
        "ঈদ মোবারক! পরিবার নিয়ে আনন্দ করো 🏡",
        "জীবনে সুখ ও শান্তির বন্যা বয়ে যাক 🌊",
        "তোমার খুশিতেই আমার আসল আনন্দ 🥰",
        "পবিত্র ঈদুল ফিতর/আজহা মোবারক 🌙✨",
        "সেমাইয়ের মতো মিষ্টি হোক জীবন 🍜",
        "আনন্দময় কাটুক ঈদের ছুটি 🏕️",
        "ঈদের চাঁদ শান্তি বয়ে আনুক 🌠",
        "খুশির জোয়ারে ভেসে যাক দিন ⛵",
        "ঈদ মোবারক! অনেক দোয়া ও ভালোবাসা 🤲",
        "হাসিখুশিতে কাটুক প্রতিটি মুহূর্ত 🎊",
        "আল্লাহর রহমতে জীবন সুন্দর হোক 🌟",
        "ঈদের এই পবিত্র দিনে কাটুক সব ক্লান্তি 🌴",
        "সবার সাথে ভাগ করে নাও ঈদের আনন্দ 🤝",
        "তোমার জীবনের প্রতিটি দিন ঈদের মতো হোক 🏮",
        "আল্লাহ তোমার সকল নেক দোয়া কবুল করুন 🤲",
        "প্রিয়জনদের সান্নিধ্যে চমৎকার কাটুক ঈদ 👨‍👩‍👧‍👦",
        "ঈদ মানে আনন্দ, ঈদ মানে অনাবিল শান্তি 🕊️",
        "খুশির আলোয় ঝলমল করুক তোমার আঙিনা 💡",
        "মিষ্টিমুখ আর কোলাকুলিতে জমজমাট হোক ঈদ 🍧",
        "তোমার জীবনে বয়ে আসুক রহমতের বারিপাত 🌧️",
        "সবাইকে পবিত্র ঈদের অনেক শুভেচ্ছা 🎊"
    ]
};

function getRandomItems(arr, count) {
    const shuffled = [...arr].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}

async function generateRandomAnimation(category, history = []) {
    const cat = animationPool[category] ? category : 'love';
    let availableLines = animationPool[cat];
    let filtered = availableLines.filter(item => !history.includes(item));
    if (filtered.length < 5) filtered = availableLines;
    let lines = getRandomItems(filtered, 5);
    return lines;
}

function setupAnimationActions(bot, db, saveDB) {
    bot.action('random_anim_start', async (ctx) => {
        ctx.answerCbQuery();
        const userId = ctx.chat.id;
        const session = db.userSessions[userId];
        if (!session) return;
        
        session.animHistory = [];
        session.currentAnimList = await generateRandomAnimation(session.type, session.animHistory);
        session.animHistory.push(...session.currentAnimList);
        session.step = 'PREVIEW_RANDOM_ANIM';
        await saveDB();
        await renderRandomAnimPreview(ctx, userId);
    });

    bot.action('anim_change', async (ctx) => {
        ctx.answerCbQuery();
        const userId = ctx.chat.id;
        const session = db.userSessions[userId];
        if (!session) return;
        session.prevAnimList = [...session.currentAnimList];
        session.currentAnimList = await generateRandomAnimation(session.type, session.animHistory);
        session.animHistory.push(...session.currentAnimList);
        await saveDB();
        await renderRandomAnimPreview(ctx, userId, true);
    });

    bot.action('anim_prev', async (ctx) => {
        ctx.answerCbQuery();
        const userId = ctx.chat.id;
        const session = db.userSessions[userId];
        if (!session || !session.prevAnimList) return;
        const temp = [...session.currentAnimList];
        session.currentAnimList = [...session.prevAnimList];
        session.prevAnimList = temp;
        await saveDB();
        await renderRandomAnimPreview(ctx, userId, true);
    });

    bot.action('anim_keep', async (ctx) => {
        ctx.answerCbQuery();
        const userId = ctx.chat.id;
        const session = db.userSessions[userId];
        if (!session) return;
        session.animations = session.currentAnimList;
        session.step = 'AWAITING_LETTER_TEXT';
        await saveDB();
        const text = `✅ চমৎকার! আপনি ${session.animations.length} লাইনের অ্যানিমেশন যোগ করেছেন।\n\n💌 এবার খামের ভেতরের মূল চিঠি বা উইশ মেসেজটি লিখে পাঠান।` + "\n\nএবার আপনার চিঠির জন্য টেক্সট দিন অথবা রেন্ডম ব্যবহার করুন:";
        const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback("🎲 Random", 'random_letter_start')],
            [Markup.button.callback("🔙 পিছনে যান", 'menu_makelink')]
        ]);
        const sentMsg = await ctx.editMessageText(text, { reply_markup: keyboard.reply_markup, parse_mode: 'Markdown' }).catch(async () => {
            return await ctx.reply(text, { reply_markup: keyboard.reply_markup, parse_mode: 'Markdown' }).catch(() => null);
        });
        if (sentMsg) {
            session.lastPromptMsgId = sentMsg.message_id;
            await saveDB();
        }
    });
}

async function renderRandomAnimPreview(ctx, userId, showPrevBtn = false) {
    const session = db.userSessions[userId];
    const text = "জেনারেট করা অ্যানিমেশন টেক্সট:\n\n" + session.currentAnimList.join('\n');
    let buttons = [
        [Markup.button.callback("এটি রাখবো", 'anim_keep')],
        [Markup.button.callback("পরিবর্তন", 'anim_change')]
    ];
    if (showPrevBtn) {
        buttons = [
            [Markup.button.callback("এটি রাখবো", 'anim_keep')],
            [Markup.button.callback("আগেরটা", 'anim_prev'), Markup.button.callback("পরিবর্তন", 'anim_change')]
        ];
    }
    const keyboard = Markup.inlineKeyboard(buttons);
    await ctx.editMessageText(text, { reply_markup: keyboard.reply_markup }).catch(() => {});
}

async function handleAnimationText(ctx, db, saveDB, bot) {
    const userId = ctx.chat.id;
    const session = db.userSessions[userId];
    const text = ctx.message.text.trim();

    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (!lines.length) return ctx.reply("⚠️ অনুগ্রহ করে অন্তত একটি টেক্সট লিখুন।");
    db.userSessions[userId].animations = lines;
    db.userSessions[userId].step = 'AWAITING_LETTER_TEXT';
    if (session.lastPromptMsgId) {
        await bot.telegram.deleteMessage(userId, session.lastPromptMsgId).catch(() => {});
    }
    await ctx.deleteMessage().catch(() => {});
    const nextPrompt = await ctx.reply(`✅ চমৎকার! আপনি ${lines.length} লাইনের অ্যানিমেশন যোগ করেছেন।\n\n💌 এবার খামের ভেতরের মূল চিঠি বা উইশ মেসেজটি লিখে পাঠান।` + "\n\nএবার আপনার চিঠির জন্য টেক্সট দিন অথবা রেন্ডম ব্যবহার করুন:", Markup.inlineKeyboard([
        [Markup.button.callback("🎲 Random", 'random_letter_start')],
        [Markup.button.callback("🔙 পিছনে যান", 'menu_makelink')]
    ]));
    db.userSessions[userId].lastPromptMsgId = nextPrompt.message_id;
    await saveDB();
    return true;
}

module.exports = { setupAnimationActions, handleAnimationText };
