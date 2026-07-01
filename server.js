const express = require('express');
const path = require('path');
const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');

const app = express();
app.use(express.json());

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
const SERVER_URL = "https://love-bb7p.onrender.com";
const DB_FILE = path.join(__dirname, 'db.json');

const bot = new Telegraf(TELEGRAM_TOKEN);

// 🗄️ Database
let db = {
    linkDatabase: {},
    userSessions: {},
    totalLinksCreated: 0,
    bannedUsers: []
};

if (fs.existsSync(DB_FILE)) {
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function saveDB() {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// 🛡️ Markdown Escaping
function esc(text) {
    return text.toString().replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

// 🤖 মেনু এবং টেক্সট
const messages = {
    welcome: (name) => `💝 **হ্যালো ${name}!** 💝\n\nবটে স্বাগতম। আপনার প্রিয়জনের জন্য টাইম কাউন্টডাউন করা ওয়েব লিঙ্ক তৈরি করুন ফ্রিতে।\n\nনিচের অপশন থেকে বেছে নিন:`,
    btn_make: "🚀 লিঙ্ক তৈরি করুন", btn_card: "🖼️ উইশ কার্ড", btn_stats: "📊 স্ট্যাটাস", btn_off: "🔒 লিঙ্ক বন্ধ করুন", btn_feedback: "📝 মতামত", btn_help: "❓ সাহায্য", btn_back: "🔙 মেইন মেনু",
    choose_cat: "✨ **কোন ক্যাটাগরির লিঙ্ক তৈরি করবেন?**",
    prompt_countdown_ask: "⏰ **টাইম কাউন্টডাউন সেট করতে চান?**\n\n(সময় শেষ হওয়ার আগে লিঙ্কের ভেতরের লেখা দেখা যাবে না।)",
    btn_yes: "✅ হ্যাঁ", btn_no: "❌ না",
    prompt_time_input: "⏳ লিঙ্কটি কত মিনিট পর খুলবে? সংখ্যায় লিখে পাঠান (১-১০০ মিনিট):\n\nউদাহরণ: `15`",
    prompt_theme: "🎨 **একটি থিম সিলেক্ট করুন:**",
    prompt_music: "🎵 **মিউজিক সিলেক্ট করুন:**",
    prompt_anim: "✨ **অ্যানিমেশন টেক্সট লিখুন:**\n\nপ্রতি লাইনের পর Enter দিন বা কমা (,) ব্যবহার করুন।",
    prompt_letter: "💌 **মূল চিঠি বা উইশ মেসেজটি লিখুন:**",
    link_ready: (url) => `💝 আপনার লিঙ্কটি তৈরি:\n\n${url}`
};

// 🛡️ Middleware
bot.use((ctx, next) => {
    if (ctx.chat?.id && db.bannedUsers.includes(ctx.chat.id)) return;
    return next();
});

// 📌 Commands
bot.command('start', (ctx) => sendMainMenu(ctx));

// 🚀 Link Creation Flow
bot.action('menu_makelink', (ctx) => {
    ctx.editMessageText(messages.choose_cat, Markup.inlineKeyboard([
        [Markup.button.callback("❤️ প্রেম", 'make_love'), Markup.button.callback("🎂 জন্মদিন", 'make_birthday')],
        [Markup.button.callback("🔙 মেইন মেনু", 'go_main')]
    ]));
});

bot.action(/^make_/, (ctx) => {
    db.userSessions[ctx.chat.id] = { type: ctx.match.input.replace('make_', '') };
    saveDB();
    ctx.editMessageText(messages.prompt_countdown_ask, Markup.inlineKeyboard([
        [Markup.button.callback(messages.btn_yes, 'timer_yes'), Markup.button.callback(messages.btn_no, 'timer_no')]
    ]));
});

bot.action('timer_yes', (ctx) => {
    db.userSessions[ctx.chat.id].step = 'AWAITING_TIME';
    saveDB();
    ctx.reply(messages.prompt_time_input);
});

bot.action('timer_no', (ctx) => {
    askTheme(ctx);
});

function askTheme(ctx) {
    db.userSessions[ctx.chat.id].step = 'AWAITING_THEME';
    saveDB();
    ctx.reply(messages.prompt_theme, Markup.inlineKeyboard([
        [Markup.button.callback('✨ Classic', 'set_theme_classic'), Markup.button.callback('🌌 Neon', 'set_theme_neon')]
    ]));
}

bot.action(/^set_theme_/, (ctx) => {
    db.userSessions[ctx.chat.id].theme = ctx.match.input.replace('set_theme_', '');
    db.userSessions[ctx.chat.id].step = 'AWAITING_MUSIC';
    saveDB();
    ctx.reply(messages.prompt_music, Markup.inlineKeyboard([
        [Markup.button.callback('🎵 Flute', 'set_music_flute'), Markup.button.callback('🔇 None', 'set_music_none')]
    ]));
});

bot.action(/^set_music_/, (ctx) => {
    db.userSessions[ctx.chat.id].music = ctx.match.input.replace('set_music_', '');
    db.userSessions[ctx.chat.id].step = 'AWAITING_ANIM';
    saveDB();
    ctx.reply(messages.prompt_anim);
});

// 📩 Text Handler
bot.on('text', (ctx) => {
    const session = db.userSessions[ctx.chat.id];
    if (!session) return;
    const text = ctx.message.text;

    if (session.step === 'AWAITING_TIME') {
        session.pendingMinutes = parseInt(text);
        askTheme(ctx);
    } else if (session.step === 'AWAITING_ANIM') {
        session.animations = text.split(/[,\n]/).map(l => l.trim());
        session.step = 'AWAITING_LETTER';
        ctx.reply(messages.prompt_letter);
        saveDB();
    } else if (session.step === 'AWAITING_LETTER') {
        processFinalLink(ctx, text);
    }
});

function processFinalLink(ctx, letter) {
    const session = db.userSessions[ctx.chat.id];
    const uniqueId = Math.random().toString(36).substring(2, 9);
    
    db.linkDatabase[uniqueId] = {
        userId: ctx.chat.id,
        type: session.type,
        theme: session.theme,
        music: session.music,
        countdown: session.pendingMinutes ? new Date(Date.now() + session.pendingMinutes * 60000) : null,
        animations: session.animations,
        letter: letter,
        isActive: true
    };
    saveDB();
    delete db.userSessions[ctx.chat.id];
    ctx.reply(messages.link_ready(`${SERVER_URL}/love/${uniqueId}`));
}

function sendMainMenu(ctx) {
    const kb = Markup.inlineKeyboard([
        [Markup.button.callback(messages.btn_make, 'menu_makelink')],
        [Markup.button.callback(messages.btn_help, 'help')]
    ]);
    ctx.reply(messages.welcome(ctx.from.first_name), kb);
}

bot.action('go_main', (ctx) => sendMainMenu(ctx));
bot.launch();
