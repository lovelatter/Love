const express = require('express');
const path = require('path');
const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');
const https = require('https');

// মডিউলসমূহ ইমপোর্ট করা হলো
const { photohandle, showImageUploadPrompt } = require('./modules/photohandle');
const { showCountdownPrompt, handleTimerNo, handleSetTime } = require('./modules/countdown');
const { CATEGORY_CONFIGS, getCategoryKeyboard, CATEGORY_MENU_TEXT } = require('./modules/category');
const { handleFeedbackMenu, processFeedbackText } = require('./modules/feedback');

const app = express();
app.use(express.json());
app.set('trust proxy', true);

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const ADMIN_IDS = (process.env.ADMIN_CHAT_ID || "").split(',').map(id => id.trim()).filter(id => id !== "");
const isAdmin = (userId) => ADMIN_IDS.includes(userId.toString());
const SERVER_URL = "https://love-bb7p.onrender.com";
const DB_FILE = path.join(__dirname, 'db.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const GITHUB_MUSIC_BASE_URL = "https://raw.githubusercontent.com/lovelatter/Love/main";
const AUTOMATIC_MUSIC_MAPPING = {
    love: `${GITHUB_MUSIC_BASE_URL}/love.mp3`,
    birthday: `${GITHUB_MUSIC_BASE_URL}/bd.mp3`,
    sorry: `${GITHUB_MUSIC_BASE_URL}/sorry.mp3`,
    eid: `${GITHUB_MUSIC_BASE_URL}/eid.mp3`
};

let db = { linkDatabase: {}, userSessions: {}, totalLinksCreated: 0, isMaintenanceMode: false, bannedUsers: [], registeredUsers: [], usernameMap: {} };

try {
    if (fs.existsSync(DB_FILE)) db = { ...db, ...JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) };
    else fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
} catch (e) { console.error(e); }

const saveDB = () => { try { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); } catch (e) { console.error(e); } };

const bot = new Telegraf(TELEGRAM_TOKEN);

const locale = {
    welcome: (name) => `হ্যালো ${name}। বটের পক্ষ থেকে স্বাগতম।`,
    btn_make: "🚀 লিঙ্ক তৈরি করুন", btn_feedback: "📝 মতামত", btn_help: "❓ সাহায্য", btn_back: "🔙 মেইন মেনু",
    prompt_image_ask: "📸 আপনি কি কোনো ছবি যুক্ত করতে চান?\n\nতাহলে ছবিটি এখানে পাঠান অথবা নিচে Skip করুন।",
    btn_skip_image: "⏭️ Skip করুন",
    help_text: `❓ বট ব্যবহারের সঠিক নিয়ম:\n\n১. 🚀 লিঙ্ক তৈরি করুন ক্লিক করুন।\n২. ক্যাটাগরি সিলেক্ট করুন।\n৩. সময় ও ছবি সেট করুন।\n৪. অ্যানিমেশন ও চিঠির টেক্সট লিখুন।`,
    invalid_cmd: (cmd) => `❌ ভুল ইনপুট: \`${cmd}\``,
    maint_msg: "🚧 বটের কাজ চলছে!",
    session_started: () => `✨ অ্যানিমেশন মেসেজ লিখুন (কমা বা এন্টার দিন)।`,
    input_anim_success: (count) => `✅ ${count} লাইনের অ্যানিমেশন যোগ হয়েছে। এবার মূল চিঠি লিখুন।`
};

function showAnimationIntro(ctx) {
    db.userSessions[ctx.chat.id].step = 'AWAITING_ANIMATION_TEXT';
    saveDB();
    ctx.editMessageText(locale.session_started(), Markup.inlineKeyboard([[Markup.button.callback("🔙 পেছনে যান", 'menu_makelink')]])).catch(() => {});
}

// Final Link Creation Logic
function processFinalLinkCreation(ctx, letterText) {
    const userId = ctx.chat.id;
    const session = db.userSessions[userId];
    const uniqueId = Math.random().toString(36).substring(2, 9);
    const finalGeneratedUrl = `${SERVER_URL}/love/${uniqueId}`;
    
    db.linkDatabase[uniqueId] = {
        userId, name: session.name, type: session.type, music: session.music, 
        animations: session.animations, letter: letterText, imagePath: session.imageUrl || null
    };
    saveDB();
    ctx.reply(`✅ আপনার লিংক তৈরি হয়েছে: \`${finalGeneratedUrl}\``, { parse_mode: 'Markdown' });
    delete db.userSessions[userId];
    saveDB();
}

bot.use(async (ctx, next) => {
    const userId = ctx.chat?.id;
    if (!userId) return next();
    if (!db.registeredUsers.includes(userId)) { db.registeredUsers.push(userId); saveDB(); }
    if (db.isMaintenanceMode && !isAdmin(userId)) return ctx.reply(locale.maint_msg);
    return next();
});

// Command & Actions
bot.command('start', (ctx) => { delete db.userSessions[ctx.chat.id]; saveDB(); ctx.reply(locale.welcome(ctx.from.first_name), Markup.inlineKeyboard([[Markup.button.callback(locale.btn_make, 'menu_makelink')]])); });
bot.action('menu_makelink', (ctx) => { ctx.answerCbQuery(); ctx.editMessageText(CATEGORY_MENU_TEXT.choose_cat, getCategoryKeyboard(locale.btn_back)); });
bot.action(/^make_/, (ctx) => {
    const cat = ctx.match.input.replace('make_', '');
    db.userSessions[ctx.chat.id] = { type: cat, name: ctx.from.first_name, step: 'AWAITING_COUNTDOWN_SELECTION' };
    saveDB();
    showCountdownPrompt(ctx, db, saveDB, showImageUploadPrompt);
});
bot.action('timer_no', (ctx) => handleTimerNo(ctx, db, saveDB, showImageUploadPrompt));
bot.action(/^set_time_/, (ctx) => handleSetTime(ctx, db, saveDB, showImageUploadPrompt));
bot.action('skip_image_upload', (ctx) => { ctx.answerCbQuery(); showAnimationIntro(ctx); });
bot.action('menu_feedback', (ctx) => handleFeedbackMenu(ctx, db, saveDB, locale.btn_back));

bot.on('photo', async (ctx) => await photohandle(ctx, bot, UPLOADS_DIR, db, saveDB, showAnimationIntro));
bot.on('text', async (ctx) => {
    const userId = ctx.chat.id;
    const session = db.userSessions[userId];
    if (session?.step === 'AWAITING_ANIMATION_TEXT') {
        db.userSessions[userId].animations = ctx.message.text.split(/[\n,]+/);
        db.userSessions[userId].step = 'AWAITING_LETTER_TEXT';
        saveDB();
        ctx.reply(locale.input_anim_success(db.userSessions[userId].animations.length));
    } else if (session?.step === 'AWAITING_LETTER_TEXT') {
        processFinalLinkCreation(ctx, ctx.message.text);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { bot.launch(); console.log(`Server running on port ${PORT}`); });
