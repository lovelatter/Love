const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const path = require('path');

const { db, loadDB, saveDB } = require('./modules/db');
const { showCountdownPrompt, setupCountdownActions } = require('./modules/countdown');
const { showImageUploadPrompt, setupPhotoActions } = require('./modules/photo');
const { handleAudioUpload, showMusicUploadPrompt, setupMusicActions, music_set } = require('./modules/music');
const { handleFeedbackMessages, setupFeedbackActions } = require('./modules/feedback');
const { setupAdmin, handleAdminText } = require('./modules/admin');
const { processFinalLinkCreation } = require('./modules/link');
const { setupRoutes } = require('./modules/routes');
const { showAnimationIntro, setupRandomActions, handleAnimationTextStep } = require('./modules/random');

const app = express();
app.use(express.json());
app.set('trust proxy', true);

app.use('/uploads', express.static(path.join(process.cwd(), 'public', 'uploads')));

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const ADMIN_IDS = (process.env.ADMIN_CHAT_ID || "").split(',').map(id => id.trim()).filter(id => id !== "");

const isAdmin = (userId) => ADMIN_IDS.includes(userId.toString());

const SERVER_URL = "https://love-bb7p.onrender.com";

const bot = new Telegraf(TELEGRAM_TOKEN);

const help_msg = "❓ বট ব্যবহারের নিয়ম (Help Guide)\n\n1️⃣ প্রথমে বট স্টার্ট করার পর 🚀 লিঙ্ক তৈরি করুন বাটনে ক্লিক করুন।\n2️⃣ আপনার পছন্দের ক্যাটাগরি সিলেক্ট করুন।\n3️⃣ কাউন্টডাউন টাইমার সেট করুন।\n4️⃣ মিউজিক আপলোড করুন অথবা ডিফল্ট রাখুন।\n5️⃣ ছবি আপলোড করুন করুন অথবা ছবি ছাড়া।\n6️⃣ অ্যানিমেশন টেক্সট দিন তারপর খামের ভেতরের মূল চিঠিটি লিখে পাঠান।\n7️⃣ সবশেষে বট আপনাকে লিঙ্ক জেনারেট করে দেবে যা আপনি শেয়ার করতে পারবেন!";
const error_msg = "⚠️ দুঃখিত, একটি অভ্যন্তরীণ ত্রুটি ঘটেছে। অনুগ্রহ করে আবার চেষ্টা করুন.";
const maint_msg = "🚧 বটের কাজ চলছে (Under Maintenance)! খুব শীঘ্রই আমরা ফিরে আসছি।\n\nঅ্যাডমিনকে কিছু বলার থাকলে নিচে মতামত জানাতে পারেন।";
const invalid_cmd = (cmd) => `❌ ভুল ইনপুট: \`${cmd}\` কমান্ডটি গ্রহণযোগ্য নয়। সঠিক সাহায্য গাইডটি দেওয়া হলো:`;

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
        const maintKeyboard = Markup.inlineKeyboard([[Markup.button.callback("📝 মতামত", 'menu_feedback')]]);
        if (ctx.callbackQuery) {
            ctx.answerCbQuery().catch(() => {});
            return ctx.editMessageText(maint_msg, maintKeyboard).catch(() => {});
        }
        return ctx.reply(maint_msg, maintKeyboard).catch(() => {});
    }
    return next();
});

setupAdmin(bot, db, saveDB, isAdmin, __dirname);
setupFeedbackActions(bot, db, saveDB, ADMIN_IDS);
setupCountdownActions(bot, db, saveDB, showMusicUploadPrompt);
setupMusicActions(bot, db, saveDB, showImageUploadPrompt);
setupPhotoActions(bot, db, saveDB, (c) => showAnimationIntro(c, db, saveDB));
setupRandomActions(bot, db, saveDB, processFinalLinkCreation, ADMIN_IDS, SERVER_URL);

const sendMainMenu = async (ctx, isEdit = false) => {
    const fullName = `${ctx.from?.first_name || ""} ${ctx.from?.last_name || ""}`.trim() || "";
    const welcome = `👋 হ্যালো ${fullName}। বটের পক্ষ থেকে স্বাগতম।`;
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback("🚀 লিঙ্ক তৈরি করুন", 'menu_makelink')],
        [Markup.button.callback("📝 মতামত", 'menu_feedback'), Markup.button.callback("❓ সাহায্য", 'menu_help')]
    ]);
    if (isEdit) return ctx.editMessageText(welcome, { reply_markup: keyboard.reply_markup, parse_mode: 'Markdown' }).catch(() => {});
    return ctx.reply(welcome, { reply_markup: keyboard.reply_markup, parse_mode: 'Markdown' }).catch(() => {});
};

bot.command('start', async (ctx) => { 
    delete db.userSessions[ctx.chat.id];
    await saveDB();
    sendMainMenu(ctx, false); 
});

bot.action('go_to_main_menu', (ctx) => { ctx.answerCbQuery(); sendMainMenu(ctx, true); });

bot.action('menu_makelink', (ctx) => {
    ctx.answerCbQuery();
    ctx.editMessageText("✨ কোন ক্যাটাগরির লিঙ্ক বানাতে চান?", Markup.inlineKeyboard([
        [Markup.button.callback("❤️ প্রেম-LOVE", 'make_love')],
        [Markup.button.callback("🥳 জন্মদিন-BIRTHDAY", 'make_birthday')],
        [Markup.button.callback("🥺 দুঃখিত-SORRY", 'make_sorry')],
        [Markup.button.callback("🫂 ঈদ মোবারক-EID", 'make_eid')]
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
    showCountdownPrompt(ctx, db, saveDB, showMusicUploadPrompt);
});

bot.action('menu_feedback', async (ctx) => {
    ctx.answerCbQuery();
    const userId = ctx.chat.id;
    if (!db.userSessions[userId]) db.userSessions[userId] = {};
    db.userSessions[userId].step = 'AWAITING_USER_FEEDBACK';
    db.userSessions[userId].feedbackWarningMsgId = null;
    
    const sentMsg = await ctx.editMessageText("📝 মতামত ও রিপোর্ট:\n\nঅ্যাডমিনের কাছে কোনো রিপোর্ট, নতুন আপডেটের আইডিয়া বা অন্য কোনো কিছু বলার থাকলে আপনার মেসেজটি এখানে লিখে পাঠিয়ে দিন:", Markup.inlineKeyboard([[Markup.button.callback("🔙 Back", 'go_to_main_menu')]]));
    db.userSessions[userId].feedbackPromptMsgId = sentMsg.message_id;
    await saveDB();
});

bot.action('menu_help', (ctx) => { 
    ctx.answerCbQuery(); 
    ctx.editMessageText(help_msg, Markup.inlineKeyboard([[Markup.button.callback("🔙 Back", 'go_to_main_menu')]]), { parse_mode: 'Markdown' }); 
});

bot.action(/^delete_link_(.+)$/, async (ctx) => {
    const linkId = ctx.match[1];
    const data = db.linkDatabase[linkId];
    if (!data) return ctx.answerCbQuery("⚠️ লিঙ্কটি ইতিমধ্যে রিমুভ করা হয়েছে!", { show_alert: true });
    if (Number(data.userId) !== Number(ctx.chat.id)) return ctx.answerCbQuery("❌ পারমিশন নেই।", { show_alert: true });
    ctx.answerCbQuery("✅ লিঙ্কটি ডিলিট করা হয়েছে।", { show_alert: true });
    delete db.linkDatabase[linkId];
    await saveDB();
    ctx.editMessageText("❌ লিঙ্কটি রিমুভ করা হয়েছে।");
    sendMainMenu(ctx, false);
});

bot.on('audio', (ctx) => handleAudioUpload(ctx, bot, db, saveDB, showImageUploadPrompt));

bot.on('text', async (ctx) => {
    const userId = ctx.chat.id;
    const session = db.userSessions[userId];
    const text = ctx.message.text.trim();
    
    const feedbackHandled = await handleFeedbackMessages(ctx, userId, session, text, db, saveDB, bot, ADMIN_IDS, isAdmin);
    if (feedbackHandled) return;

    if (isAdmin(userId) && session) {
        const handled = handleAdminText(ctx, text, session, db, saveDB, bot);
        if (handled) return;
    }
    
    if (!session?.step) {
        ctx.reply(invalid_cmd(text), { parse_mode: 'Markdown' }).catch(() => {});
        return ctx.reply(help_msg, Markup.inlineKeyboard([[Markup.button.callback("🔙 Back", 'go_to_main_menu')]]), { parse_mode: 'Markdown' }).catch(() => {});
    }
    try {
        if (session.step === 'AWAITING_ANIMATION_TEXT') {
            return await handleAnimationTextStep(ctx, userId, text, db, saveDB, bot);
        }
        if (session.step === 'AWAITING_LETTER_TEXT') {
            if (session.lastPromptMsgId) {
                await bot.telegram.deleteMessage(userId, session.lastPromptMsgId).catch(() => {});
            }
            await ctx.deleteMessage().catch(() => {});
            return await processFinalLinkCreation(ctx, text, db, saveDB, bot, ADMIN_IDS, SERVER_URL);
        }
    } catch (error) {
        ctx.reply(error_msg).catch(() => {});
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
