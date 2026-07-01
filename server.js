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
    isMaintenanceMode: false,
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

// 🌐 Messages (Bangla Only)
const locale = {
    welcome: (name) => `💝 **হ্যালো ${name}!** 💝\n\nবটের পক্ষ থেকে স্বাগতম। আপনার প্রিয়জনের জন্য আকর্ষণীয় টাইম কাউন্টডাউন করা ওয়েব লিঙ্ক তৈরি করুন একদম ফ্রিতে।\n\nনিচের যেকোনো একটি অপশন সিলেক্ট করুন:`,
    btn_make: "🚀 লিঙ্ক তৈরি করুন", btn_card: "🖼️ উইশ কার্ড বানান", btn_demo: "👀 ডেমো দেখুন", btn_stats: "📊 স্ট্যাটাস", btn_off: "🔒 লিঙ্ক বন্ধ করুন", btn_feedback: "📝 মতামত", btn_help: "❓ সাহায্য", btn_back: "🔙 মেইন মেনু",
    choose_cat: "✨ **আপনি কোন ক্যাটাগরির লিঙ্ক তৈরি করতে চান?**",
    cat_love: "❤️ প্রেমের চিঠি", cat_crush: "💖 ক্রাশ কনফেশন", cat_birthday: "🎂 জন্মদিনের শুভেচ্ছা", cat_anniversary: "💍 বিবাহবার্ষিকী", cat_newyear: "🎉 নতুন বছর", cat_boishakh: "🌾 পহেলা বৈশাখ", cat_friend: "🫂 সেরা বন্ধু", cat_eid: "🌙 ঈদ মোবারক", cat_sorry: "🥺 দুঃখ প্রকাশ",
    
    prompt_countdown_ask: "⏰ **আপনি কি এই লিঙ্কে নির্দিষ্ট টাইম কাউন্টডাউন (Time Countdown) সেট করতে চান?**",
    btn_yes: "✅ হ্যাঁ, চাই", btn_no: "❌ না, লাগবে না",
    prompt_time_input: "⏳ লিঙ্কটি কত মিনিট পর খুলবে তা সংখ্যায় লিখে পাঠান (১-১০০ মিনিট):",
    invalid_time: "❌ **ভুল ইনপুট!** ১ থেকে ১০০ এর মধ্যে সংখ্যা দিন।",
    
    prompt_theme: "🎨 **একটি প্রিমিয়াম ওয়েব থিম সিলেক্ট করুন:**",
    prompt_music: "🎵 **একটি ব্যাকগ্রাউন্ড মিউজিক সিলেক্ট করুন:**",
    prompt_card_name: "🖼️ উইশ কার্ডে কার নাম লিখতে চান? নামটি লিখে পাঠান:",
    card_ready: "✨ **আপনার প্রিমিয়াম উইশ কার্ডটি তৈরি হয়ে গেছে!**",
    
    session_started: (cat) => `✨ আপনার কাস্টম \`${cat.toUpperCase()}\` লিঙ্ক তৈরির সেশন শুরু হয়েছে!\n\n👉 আপনার প্রিয়জনের জন্য **অ্যানিমেশন টেক্সটগুলো** পাঠান। (প্রতি লাইনের পর Enter দিন বা কমা ব্যবহার করুন)।`,
    input_anim_success: "✅ চমৎকার! এবার খামের ভেতরের মূল চিঠি বা উইশ মেসেজটি লিখে পাঠান:",
    link_ready: (url) => `💝 অভিনন্দন! আপনার কাস্টমাইজড প্রিমিয়াম লিঙ্ক সম্পূর্ণ রেডি:\n\n${url}`,
    
    feedback_prompt: "📝 **আপনার মতামত লিখে পাঠান:**",
    feedback_success: "✅ আপনার মেসেজটি অ্যাডমিনের কাছে পাঠানো হয়েছে। ধন্যবাদ!",
    no_links: "❌ আপনি এখনো কোনো লিঙ্ক তৈরি করেননি।",
    profile_report: (name, list) => `📊 **আপনার প্রোফাইল রিপোর্ট:**\n\n👤 নাম: ${name}\n🎫 আপনার লিঙ্কসমূহ:\n${list}`,
    off_link_title: "🔒 **কোন লিঙ্কটি বন্ধ করতে চান?**",
    deactivate_success: "✅ লিঙ্কটি বন্ধ করা হয়েছে।"
};

// 🛡️ Security Middlewares
bot.use((ctx, next) => {
    try {
        const userId = ctx.chat?.id;
        if (!userId) return next();
        if (db.bannedUsers.includes(userId)) return;
        return next();
    } catch (err) { console.error(err); }
});

// 📌 Core Command
bot.command('start', (ctx) => sendMainMenu(ctx));

// 🚀 Link Creation Flow
bot.action('menu_makelink', (ctx) => {
    ctx.editMessageText(locale.choose_cat, Markup.inlineKeyboard([
        [Markup.button.callback(locale.cat_love, 'make_love'), Markup.button.callback(locale.cat_crush, 'make_crush')],
        [Markup.button.callback(locale.cat_birthday, 'make_birthday'), Markup.button.callback(locale.cat_anniversary, 'make_anniversary')],
        [Markup.button.callback(locale.cat_back, 'go_to_main_menu')]
    ]));
});

bot.action(/^make_/, (ctx) => {
    db.userSessions[ctx.chat.id] = { type: ctx.match.input.replace('make_', ''), name: ctx.from.first_name };
    saveDB();
    ctx.editMessageText(locale.prompt_countdown_ask, Markup.inlineKeyboard([
        [Markup.button.callback(locale.btn_yes, 'timer_yes'), Markup.button.callback(locale.btn_no, 'timer_no')]
    ]));
});

bot.action('timer_yes', (ctx) => {
    db.userSessions[ctx.chat.id].step = 'AWAITING_TIME';
    saveDB();
    ctx.reply(locale.prompt_time_input);
});

bot.action('timer_no', (ctx) => { askTheme(ctx); });

function askTheme(ctx) {
    db.userSessions[ctx.chat.id].step = 'AWAITING_THEME';
    saveDB();
    ctx.reply(locale.prompt_theme, Markup.inlineKeyboard([
        [Markup.button.callback('✨ Classic Pink', 'set_theme_classic'), Markup.button.callback('🌌 Neon Magic', 'set_theme_neon')]
    ]));
}

bot.action(/^set_theme_/, (ctx) => {
    db.userSessions[ctx.chat.id].theme = ctx.match.input.replace('set_theme_', '');
    db.userSessions[ctx.chat.id].step = 'AWAITING_MUSIC';
    saveDB();
    ctx.reply(locale.prompt_music, Markup.inlineKeyboard([
        [Markup.button.callback('🎵 Romantic Flute', 'set_music_romantic'), Markup.button.callback('🔇 No Music', 'set_music_none')]
    ]));
});

bot.action(/^set_music_/, (ctx) => {
    db.userSessions[ctx.chat.id].music = ctx.match.input.replace('set_music_', '');
    db.userSessions[ctx.chat.id].step = 'AWAITING_ANIMATION';
    saveDB();
    ctx.reply(locale.session_started(db.userSessions[ctx.chat.id].type));
});

// 📩 Input Handling
bot.on('text', (ctx) => {
    const userId = ctx.chat.id;
    const session = db.userSessions[userId];
    const text = ctx.message.text.trim();
    if (text.startsWith('/')) return;
    if (!session) return;

    if (session.step === 'AWAITING_TIME') {
        const min = parseInt(text);
        if (isNaN(min) || min < 1 || min > 100) return ctx.reply(locale.invalid_time);
        session.pendingMinutes = min;
        askTheme(ctx);
    } else if (session.step === 'AWAITING_ANIMATION') {
        session.animations = text.split(/[,\n]/).map(l => l.trim());
        session.step = 'AWAITING_LETTER';
        ctx.reply(locale.input_anim_success);
        saveDB();
    } else if (session.step === 'AWAITING_LETTER') {
        processFinalLink(ctx, text);
    } else if (session.step === 'AWAITING_CARD_NAME') {
        ctx.reply(locale.card_ready);
        ctx.replyWithPhoto({ url: `https://dummyimage.com/600x400/ff4b72/fff.png&text=${encodeURIComponent(text)}` });
        delete db.userSessions[userId];
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
        countdown: session.pendingMinutes ? new Date(Date.now() + session.pendingMinutes * 60000).toISOString() : null,
        animations: session.animations,
        letter: letter,
        isActive: true
    };
    saveDB();
    delete db.userSessions[ctx.chat.id];
    ctx.reply(locale.link_ready(`${SERVER_URL}/love/${uniqueId}`));
}

function sendMainMenu(ctx, isEdit = false) {
    const kb = Markup.inlineKeyboard([
        [Markup.button.callback(locale.btn_make, 'menu_makelink'), Markup.button.callback(locale.btn_card, 'menu_cardgen')],
        [Markup.button.callback(locale.btn_stats, 'menu_stats'), Markup.button.callback(locale.btn_feedback, 'menu_feedback')]
    ]);
    isEdit ? ctx.editMessageText(locale.welcome(ctx.from.first_name), kb) : ctx.reply(locale.welcome(ctx.from.first_name), kb);
}

bot.action('go_to_main_menu', (ctx) => sendMainMenu(ctx, true));
bot.launch();

app.listen(process.env.PORT || 3000, () => console.log("Server Running"));
