const express = require('express');
const { Telegraf, Markup } = require('telegraf');

const { db, loadDB, saveDB } = require('./modules/db');
const { showCountdownPrompt, setupCountdownActions } = require('./modules/countdown');
const { handlePhotoUpload, showImageUploadPrompt } = require('./modules/photo');
const { handleAudioUpload, showMusicUploadPrompt, setupMusicActions } = require('./modules/music');
const { handleFeedbackStart, handleFeedbackInput } = require('./modules/feedback');
const { setupAdmin, handleAdminText } = require('./modules/admin');
const { processFinalLinkCreation } = require('./modules/link');
const { setupRoutes } = require('./modules/routes');
const { setupMakeLink } = require('./modules/menu_makelink');
const { generateRandomAnimation, generateRandomLetter } = require('./modules/random');

const app = express();
app.use(express.json());
app.set('trust proxy', true);

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const ADMIN_IDS = (process.env.ADMIN_CHAT_ID || "").split(',').map(id => id.trim()).filter(id => id !== "");

const isAdmin = (userId) => ADMIN_IDS.includes(userId.toString());

const SERVER_URL = "https://love-bb7p.onrender.com";

const bot = new Telegraf(TELEGRAM_TOKEN);

const HELP_TEXT = `❓ বট ব্যবহারের সঠিক নিয়ম (Help Guide):\n\n*বট স্টার্ট করার পর*\n1️⃣ প্রথমে 🚀 লিঙ্ক তৈরি করুন বাটনে ক্লিক করুন।\n2️⃣ আপনার পছন্দের ক্যাটাগরি সিলেক্ট করুন।\n3️⃣ কাউন্টডাউন টাইমার সেট করুন।\n4️⃣ মিউজিক আপলোড করুন অথবা ডিফল্ট রাখুন।\n5️⃣ ছবি আপলোড করুন অথবা Skip করুন।\n6️⃣ অ্যানিমেশন টেক্সট দিন তারপর খামের ভেতরের মূল চিঠিটি লিখে পাঠান।\n7️⃣ No বাটন মুভমেন্ট করাতে চান কিনা তা সিলেক্ট করুন।\n8️⃣ সবশেষে বট আপনাকে লিঙ্ক জেনারেট করে দেবে যা আপনি শেয়ার করতে পারবেন!`;

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
        
        const banKeyboard = Markup.inlineKeyboard([[Markup.button.callback("motamot", "menu_feedback")]]);
        const banMsg = "bot theke apnake ban kora hoyeche. Adminke kichu janate motamot patan.";
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
        const maintKeyboard = Markup.inlineKeyboard([[Markup.button.callback("📝 মতামত", 'menu_feedback')]]);
        const maint_msg = "🚧 বটের কাজ চলছে (Under Maintenance)! খুব শীঘ্রই আমরা ফিরে আসছি።\n\nঅ্যাডমিনকে কিছু বলার থাকলে নিচে মতামত জানাতে পারেন।";
        if (ctx.callbackQuery) {
            ctx.answerCbQuery().catch(() => {});
            return ctx.editMessageText(maint_msg, maintKeyboard).catch(() => {});
        }
        return ctx.reply(maint_msg, maintKeyboard).catch(() => {});
    }
    return next();
});

setupAdmin(bot, db, saveDB, isAdmin, __dirname, null);
setupMakeLink(bot, db, saveDB, showCountdownPrompt, showMusicUploadPrompt);
setupCountdownActions(bot, db, saveDB, showMusicUploadPrompt);
setupMusicActions(bot, db, saveDB, showImageUploadPrompt);

const sendMainMenu = async (ctx, isEdit = false) => {
    const fullName = `${ctx.from?.first_name || ""} ${ctx.from?.last_name || ""}`.trim() || "ব্যবহারকারী";
    const welcomeText = `👋 হ্যালো ${fullName}। বটের পক্ষ থেকে স্বাগতম।`;
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback("🚀 লিঙ্ক তৈরি করুন", 'menu_makelink')],
        [Markup.button.callback("📝 মতামত", 'menu_feedback'), Markup.button.callback("❓ সাহায্য", 'menu_help')]
    ]);
    if (isEdit) return ctx.editMessageText(welcomeText, { reply_markup: keyboard.reply_markup, parse_mode: 'Markdown' }).catch(() => {});
    return ctx.reply(welcomeText, { reply_markup: keyboard.reply_markup, parse_mode: 'Markdown' }).catch(() => {});
};

bot.command('start', async (ctx) => { 
    delete db.userSessions[ctx.chat.id];
    await saveDB();
    sendMainMenu(ctx, false); 
});

bot.action('go_to_main_menu', (ctx) => { ctx.answerCbQuery(); sendMainMenu(ctx, true); });

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
    const text = `✨ অ্যানিমেশন মেসেজ লিখুন。\n• একাধিক অ্যানিমেশন এর জন্য Enter দিয়ে নতুন লাইন লিখুন। যেমন:\n•হ্যালো প্রিয়\n•কেমন আছো\n•তোমার জন্য একটি বার্তা`;
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback("🎲 Random", 'random_anim_start')],
        [Markup.button.callback("🔙 পিছনে যান", 'menu_makelink')]
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

bot.action('menu_feedback', async (ctx) => {
    ctx.answerCbQuery();
    const userId = ctx.chat.id;
    if (!db.userSessions[userId]) db.userSessions[userId] = {};
    db.userSessions[userId].step = 'AWAITING_USER_FEEDBACK';
    db.userSessions[userId].feedbackWarningMsgId = null;
    
    const sentMsg = await ctx.editMessageText("📝 মতামত ও রিপোর্ট:\n\nঅ্যাডমিনের কাছে কোনো রিপোর্ট, নতুন আপডেটের আইডিয়া বা অন্য কোনো কিছু বলার থাকলে আপনার মেসেজটি এখানে লিখে পাঠিয়ে দিন:", Markup.inlineKeyboard([[Markup.button.callback("🔙 পিছনে যান", 'go_to_main_menu')]]));
    db.userSessions[userId].feedbackPromptMsgId = sentMsg.message_id;
    await saveDB();
});

bot.action('menu_help', (ctx) => { 
    ctx.answerCbQuery(); 
    ctx.editMessageText(HELP_TEXT, Markup.inlineKeyboard([[Markup.button.callback("🔙 পিছনে যান", 'go_to_main_menu')]]), { parse_mode: 'Markdown' }); 
});

bot.on('audio', (ctx) => handleAudioUpload(ctx, bot, db, saveDB, showImageUploadPrompt, null));
bot.on('photo', (ctx) => handlePhotoUpload(ctx, bot, db, saveDB, showAnimationIntro));

bot.on('text', async (ctx) => {
    const userId = ctx.chat.id;
    const session = db.userSessions[userId];
    const text = ctx.message.text.trim();
    
    if (session?.step === 'AWAITING_USER_FEEDBACK') {
        if (text.length < 5) {
            await ctx.deleteMessage().catch(() => {});
            if (session.feedbackWarningMsgId) {
                await bot.telegram.deleteMessage(userId, session.feedbackWarningMsgId).catch(() => {});
            }
            const warnMsg = await ctx.reply("⚠️ অনুগ্রহ করে অন্তত ৫ অক্ষরের বেশি মতামত দিন।");
            db.userSessions[userId].feedbackWarningMsgId = warnMsg.message_id;
            await saveDB();
            return;
        } else {
            if (session.feedbackWarningMsgId) {
                await bot.telegram.deleteMessage(userId, session.feedbackWarningMsgId).catch(() => {});
            }
            if (session.feedbackPromptMsgId) {
                await bot.telegram.deleteMessage(userId, session.feedbackPromptMsgId).catch(() => {});
            }
            await ctx.deleteMessage().catch(() => {});
            return handleFeedbackInput(ctx, db, saveDB, bot, ADMIN_IDS, null);
        }
    }

    if (isAdmin(userId) && session) {
        const handled = handleAdminText(ctx, text, session, db, saveDB, bot);
        if (handled) return;
    }
    
    if (!session?.step) {
        const invalid_cmd_text = `❌ ভুল ইনপুট: \`${text}\` কমান্ডটি গ্রহণযোগ্য নয়। নিচে সঠিক সাহায্য গাইডটি দেওয়া হলো:`;
        ctx.reply(invalid_cmd_text, { parse_mode: 'Markdown' }).catch(() => {});
        return ctx.reply(HELP_TEXT, Markup.inlineKeyboard([[Markup.button.callback("🔙 পিছনে যান", 'go_to_main_menu')]]), { parse_mode: 'Markdown' }).catch(() => {});
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
            const nextPrompt = await ctx.reply(`✅ চমৎকার! আপনি ${lines.length} লাইনের অ্যানিমেশন যোগ করেছেন।\n\n💌 এবার খামের ভেতরের মূল চিঠি বা উইশ মেসেজটি লিখে পাঠান।` + "\n\nএবার আপনার চিঠির জন্য টেক্সট দিন অথবা রেন্ডম ব্যবহার করুন:", Markup.inlineKeyboard([
                [Markup.button.callback("🎲 Random", 'random_letter_start')],
                [Markup.button.callback("🔙 পিছনে যান", 'menu_makelink')]
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
            session.currentLetterText = text;
            session.step = 'AWAITING_MOVEMENT_CHOICE';
            await saveDB();

            const sentMsg = await ctx.reply("🔘 No বাটনটি মুভমেন্ট করাতে চান?", Markup.inlineKeyboard([
                [Markup.button.callback("হ্যাঁ ✅", "mov_yes"), Markup.button.callback("না ❌", "mov_no")]
            ]));
            session.lastPromptMsgId = sentMsg.message_id;
            await saveDB();
            return;
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
