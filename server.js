const express = require('express');
const { Telegraf, Markup } = require('telegraf');

const { db, loadDB, saveDB } = require('./modules/db');
const { showCountdownPrompt } = require('./modules/countdown');
const { handlePhotoUpload, showImageUploadPrompt } = require('./modules/photo');
const { handleAudioUpload, showMusicUploadPrompt, handleMusicChoice, music_set } = require('./modules/music');
const { handleFeedbackStart, handleFeedbackText, setupFeedbackActions } = require('./modules/feedback');
const { setupAdmin, handleAdminText } = require('./modules/admin');
const { processFinalLinkCreation } = require('./modules/link');
const { setupRoutes } = require('./modules/routes');
const { generateRandomAnimation, generateRandomLetter } = require('./modules/random');

const app = express();
app.use(express.json());
app.set('trust proxy', true);

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const ADMIN_IDS = (process.env.ADMIN_CHAT_ID || "").split(',').map(id => id.trim()).filter(id => id !== "");

const isAdmin = (userId) => ADMIN_IDS.includes(userId.toString());

const SERVER_URL = "https://love-bb7p.onrender.com";

const bot = new Telegraf(TELEGRAM_TOKEN);

const HELP_TEXT = `❓ বট ব্যবহারের নিয়ম (Help Guide):\n\n*বট স্টার্ট করার পর\n1️⃣ প্রথমে 🚀 লিঙ্ক তৈরি করুন বাটনে ক্লিক করুন।\n2️⃣ আপনার পছন্দের ক্যাটাগরি সিলেক্ট করুন।\n3️⃣ কাউন্টডাউন টাইমার সেট করুন।\n4️⃣ মিউজিক আপলোড করুন অথবা ডিফল্ট রাখুন।\n5️⃣ ছবি আপলোড করুন করুন অথবা ছবি ছাড়া।\n6️⃣ অ্যানিমেশন টেক্সট দিন তারপর খামের ভেতরের মূল চিঠিটি লিখে পাঠান।\n7️⃣ সবশেষে বট আপনাকে লিঙ্ক জেনারেট করে দেবে যা আপনি শেয়ার করতে পারবেন!`;

bot.use(async (ctx, next) => {
    const userId = ctx.chat?.id;
    if (!userId) return;
    if (!db.registeredUsers.includes(userId)) db.registeredUsers.push(userId);
    if (ctx.from?.username) db.usernameMap[ctx.from.username.toLowerCase()] = userId;
    await saveDB();
    if (isAdmin(userId)) return next();

    if (db.bannedUsers.includes(userId)) {
        const session = db.userSessions[userId];
        if (session?.step === 'AWAITING_USER_FEEDBACK') return next();
        if (ctx.callbackQuery?.data === 'menu_feedback') return next();
        
        const banKeyboard = Markup.inlineKeyboard([[Markup.button.callback("📝 মতামত", 'menu_feedback')]]);
        const banMsg = "বিশেষ কোন কারণে বট থেকে আপনাকে ব্যান করা হয়েছে। আপনার কিছু বলার থাকলে এডমিনকে মতামত জানাতে পারেন।";
        
        if (ctx.callbackQuery) {
            ctx.answerCbQuery().catch(() => {});
            return ctx.editMessageText(banMsg, banKeyboard).catch(() => {});
        }
        return ctx.reply(banMsg, banKeyboard).catch(() => {});
    }

    if (db.isMaintenanceMode) {
        const session = db.userSessions[userId];
        if (session?.step === 'AWAITING_USER_FEEDBACK') return next();
        if (ctx.callbackQuery?.data === 'menu_feedback') return next();
        
        const maintMsg = "🚧 বটের কাজ চলছে (Under Maintenance)! খুব শীঘ্রই আমরা ফিরে আসছি。\n\nঅ্যাডমিনকে কিছু বলার থাকলে নিচে মতামত জানাতে পারেন।";
        const maintKeyboard = Markup.inlineKeyboard([[Markup.button.callback("📝 মতামত", 'menu_feedback')]]);
        if (ctx.callbackQuery) {
            ctx.answerCbQuery().catch(() => {});
            return ctx.editMessageText(maintMsg, maintKeyboard).catch(() => {});
        }
        return ctx.reply(maintMsg, maintKeyboard).catch(() => {});
    }
    return next();
});

setupAdmin(bot, db, saveDB, isAdmin, __dirname, { btn_feedback: "📝 মতামত" });
setupFeedbackActions(bot, db, saveDB, ADMIN_IDS, { btn_back: "🔙 Back" });

const sendMainMenu = async (ctx, isEdit = false) => {
    const fullName = `${ctx.from?.first_name || ""} ${ctx.from?.last_name || ""}`.trim() || "ব্যবহারকারী";
    const welcomeMsg = `👋 হ্যালো ${fullName}। বটের পক্ষ থেকে স্বাগতম।`;
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback("🚀 লিঙ্ক তৈরি করুন", 'menu_makelink')],
        [Markup.button.callback("📝 মতামত", 'menu_feedback'), Markup.button.callback("❓ সাহায্য", 'menu_help')]
    ]);
    if (isEdit) return ctx.editMessageText(welcomeMsg, { reply_markup: keyboard.reply_markup, parse_mode: 'Markdown' }).catch(() => {});
    return ctx.reply(welcomeMsg, { reply_markup: keyboard.reply_markup, parse_mode: 'Markdown' }).catch(() => {});
};

bot.command('start', async (ctx) => { 
    delete db.userSessions[ctx.chat.id];
    await saveDB();
    sendMainMenu(ctx, false); 
});

bot.action('go_to_main_menu', (ctx) => { ctx.answerCbQuery(); sendMainMenu(ctx, true); });

bot.action('menu_makelink', (ctx) => {
    ctx.answerCbQuery();
    ctx.editMessageText("📌 আপনার পছন্দের ক্যাটাগরি সিলেক্ট করুন:", Markup.inlineKeyboard([
        [Markup.button.callback("❤️ Love", 'make_love')],
        [Markup.button.callback("🎂 Birthday", 'make_birthday')],
        [Markup.button.callback("😢 Sorry", 'make_sorry')],
        [Markup.button.callback("🌙 Eid", 'make_eid')],
        [Markup.button.callback("🔙 Back", 'go_to_main_menu')]
    ]));
});

bot.action(/^make_/, async (ctx) => {
    ctx.answerCbQuery();
    const cat = ctx.match.input.replace('make_', '');
    db.userSessions[ctx.chat.id] = { 
        type: cat, 
        name: `${ctx.from.first_name || ""} ${ctx.from.last_name || ""}`.trim() || "User",
        username: ctx.from.username ? `@${ctx.from.username}` : "None",
        music: music_set[cat] || "",
        imageUrl: null,
        step: 'AWAITING_COUNTDOWN_SELECTION'
    };
    await saveDB();
    showCountdownPrompt(ctx, db, saveDB, (c, d, s) => showMusicUploadPrompt(c, d, s, {}));
});

bot.action('timer_no', async (ctx) => { 
    ctx.answerCbQuery(); 
    if (!db.userSessions[ctx.chat.id]) db.userSessions[ctx.chat.id] = {};
    db.userSessions[ctx.chat.id].pendingMinutes = null; 
    await saveDB();
    showMusicUploadPrompt(ctx, db, saveDB, {}); 
});

bot.action(/^set_time_/, async (ctx) => {
    ctx.answerCbQuery();
    const userId = ctx.chat.id;
    if (!db.userSessions[userId]) db.userSessions[userId] = {};
    db.userSessions[userId].pendingMinutes = parseInt(ctx.match.input.replace('set_time_', ''), 10);
    await saveDB();
    showMusicUploadPrompt(ctx, db, saveDB, {});
});

bot.action(['music_no', 'music_default'], (ctx) => {
    handleMusicChoice(ctx, db, saveDB, showImageUploadPrompt, {});
});

bot.action('skip_image_upload', async (ctx) => {
    ctx.answerCbQuery();
    const userId = ctx.chat.id;
    if (db.userSessions[userId]) {
        db.userSessions[userId].imageUrl = null;
    }
    await saveDB();
    showAnimationIntro(ctx);
});

async function showAnimationIntro(ctx) {
    db.userSessions[ctx.chat.id].step = 'AWAITING_ANIMATION_TEXT';
    await saveDB();
    const text = `✨ অ্যানিমেশন মেসেজ লিখুন。\nএকাধিক অ্যানিমেশন এর জন্য Enter দিয়ে নতুন লাইন লিখুন। যেমন:\n•হ্যালো প্রিয়\n•কেমন আছো\n•তোমার জন্য একটি বার্তা`;
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback("🎲 Random", 'random_anim_start')],
        [Markup.button.callback("🔙 পেছনে যান", 'menu_makelink')]
    ]);
    const sentMsg = await ctx.editMessageText(text, { reply_markup: keyboard.reply_markup, parse_mode: 'Markdown' }).catch(async () => {
        return await ctx.reply(text, { reply_markup: keyboard.reply_markup, parse_mode: 'Markdown' }).catch(() => null);
    });
    if (sentMsg) {
        db.userSessions[ctx.chat.id].lastPromptMsgId = sentMsg.message_id;
        await saveDB();
    }
}

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
    const text = `✅ চমৎকার! আপনি ${session.animations.length} লাইনের অ্যানিমেশন যোগ করেছেন。\n\n💌 এবার খামের ভেতরের মূল চিঠি বা উইশ মেসেজটি লিখে পাঠান।` + "\n\nএবার আপনার চিঠির জন্য টেক্সট দিন অথবা রেন্ডম ব্যবহার করুন:";
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback("🎲 Random", 'random_letter_start')],
        [Markup.button.callback("🔙 পেছনে যান", 'menu_makelink')]
    ]);
    const sentMsg = await ctx.editMessageText(text, { reply_markup: keyboard.reply_markup, parse_mode: 'Markdown' }).catch(async () => {
        return await ctx.reply(text, { reply_markup: keyboard.reply_markup, parse_mode: 'Markdown' }).catch(() => null);
    });
    if (sentMsg) {
        session.lastPromptMsgId = sentMsg.message_id;
        await saveDB();
    }
});

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
    const letterText = session.currentLetterText;
    if (session.lastPromptMsgId) {
        await bot.telegram.deleteMessage(userId, session.lastPromptMsgId).catch(() => {});
    }
    await processFinalLinkCreation(ctx, letterText, db, saveDB, bot, ADMIN_IDS, SERVER_URL);
});

bot.action('menu_help', (ctx) => { 
    ctx.answerCbQuery(); 
    ctx.editMessageText(HELP_TEXT, Markup.inlineKeyboard([[Markup.button.callback("🔙 Back", 'go_to_main_menu')]]), { parse_mode: 'Markdown' }); 
});

bot.action(/^delete_link_(.+)$/, async (ctx) => {
    const linkId = ctx.match[1];
    const data = db.linkDatabase[linkId];
    if (!data) return ctx.answerCbQuery("⚠️ এই লিঙ্কটি ইতিমধ্যে রিমুভ করা হয়েছে!", { show_alert: true });
    if (Number(data.userId) !== Number(ctx.chat.id)) return ctx.answerCbQuery("❌ পারমিশন নেই।", { show_alert: true });
    ctx.answerCbQuery("✅ লিঙ্কটি সফলভাবে ডিলিট করা হয়েছে।", { show_alert: true });
    delete db.linkDatabase[linkId];
    await saveDB();
    ctx.editMessageText("❌ আপনার এই লিঙ্কটি চিরতরে বন্ধ এবং রিমুভ করে দেওয়া হয়েছে।");
    sendMainMenu(ctx, false);
});

bot.on('audio', (ctx) => handleAudioUpload(ctx, bot, db, saveDB, showImageUploadPrompt, {}));
bot.on('photo', (ctx) => handlePhotoUpload(ctx, bot, db, saveDB, showAnimationIntro));

bot.on('text', async (ctx) => {
    const userId = ctx.chat.id;
    const session = db.userSessions[userId];
    const text = ctx.message.text.trim();
    
    if (session?.step === 'AWAITING_USER_FEEDBACK') {
        return handleFeedbackText(ctx, db, saveDB, bot, ADMIN_IDS, { btn_back: "🔙 Back" });
    }

    if (isAdmin(userId) && session) {
        const handled = handleAdminText(ctx, text, session, db, saveDB, bot);
        if (handled) return;
    }
    
    if (!session?.step) {
        ctx.reply(`❌ ভুল ইনপুট: \`${text}\` কমান্ডটি গ্রহণযোগ্য নয়। নিচে সঠিক সাহায্য গাইডটি দেওয়া হলো:`, { parse_mode: 'Markdown' }).catch(() => {});
        return ctx.reply(HELP_TEXT, Markup.inlineKeyboard([[Markup.button.callback("🔙 Back", 'go_to_main_menu')]]), { parse_mode: 'Markdown' }).catch(() => {});
    }
    try {
        if (session.step === 'AWAITING_ANIMATION_TEXT') {
            const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
            if (!lines.length) return ctx.reply("⚠️ অনুগ্রহ করে অন্তত একটি টেক্সট লিখুন।");
            db.userSessions[userId].animations = lines;
            db.userSessions[userId].step = 'AWAITING_LETTER_TEXT';
            if (session.lastPromptMsgId) {
                await bot.telegram.deleteMessage(userId, session.lastPromptMsgId).catch(() => {});
            }
            await ctx.deleteMessage().catch(() => {});
            const nextPrompt = await ctx.reply(`✅ চমৎকার! আপনি ${lines.length} লাইনের অ্যানিমেশন যোগ করেছেন。\n\nএবার আপনার চিঠির জন্য টেক্সট দিন অথবা রেন্ডম ব্যবহার করুন:`, Markup.inlineKeyboard([
                [Markup.button.callback("🎲 Random", 'random_letter_start')],
                [Markup.button.callback("🔙 পেছনে যান", 'menu_makelink')]
            ]));
            db.userSessions[userId].lastPromptMsgId = nextPrompt.message_id;
            await saveDB();
            return;
        }
        if (session.step === 'AWAITING_LETTER_TEXT') {
            if (session.lastPromptMsgId) {
                await bot.telegram.deleteMessage(userId, session.lastPromptMsgId).catch(() => {});
            }
            await ctx.deleteMessage().catch(() => {});
            return await processFinalLinkCreation(ctx, text, db, saveDB, bot, ADMIN_IDS, SERVER_URL);
        }
    } catch (error) {
        ctx.reply("⚠️ দুঃখিত, একটি অভ্যন্তরীণ ত্রুটি ঘটেছে। অনুগ্রহ করে আবার চেষ্টা করুন.").catch(() => {});
    }
});

setupRoutes(app, db, saveDB, bot);

const PORT = process.env.PORT || 3000;

loadDB().then(() => {
    app.listen(PORT, () => {
        bot.launch().catch(err => console.error(err));
        console.log(`Server running on port ${PORT}`);
    });
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
