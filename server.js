const express = require('express');
const path = require('path');
const axios = require('axios');
const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');

const app = express();
app.use(express.json());

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
const SERVER_URL = "https://love-bb7p.onrender.com";
const DB_FILE = path.join(__dirname, 'db.json');
const registeredUsers = new Set();
const bannedUsers = new Set();
let isMaintenanceMode = false;

const bot = new Telegraf(TELEGRAM_TOKEN);

// 🗄️ Database Load & Save
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

// 🌐 Messages
const locale = {
    bn: {
        welcome: (name) => `💝 **হ্যালো ${name}!** 💝\n\nবটের পক্ষ থেকে স্বাগতম। আপনার প্রিয়জনের জন্য আকর্ষণীয় টাইম কাউন্টডাউন করা ওয়েব লিঙ্ক তৈরি করুন একদম ফ্রিতে।\n\nনিচের যেকোনো একটি অপশন সিলেক্ট করুন:`,
        btn_make: "🚀 লিঙ্ক তৈরি করুন", btn_card: "🖼️ উইশ কার্ড বানান", btn_demo: "👀 ডেমো দেখুন", btn_stats: "📊 স্ট্যাটাস", btn_off: "🔒 লিঙ্ক বন্ধ করুন", btn_feedback: "📝 মতামত", btn_help: "❓ সাহায্য", btn_back: "🔙 মেইন মেনু",
        choose_cat: "✨ **আপনি কোন ক্যাটাগরির লিঙ্ক তৈরি করতে চান?**",
        cat_love: "❤️ প্রেমের চিঠি", cat_crush: "💖 ক্রাশ কনফেশন", cat_birthday: "🎂 জন্মদিনের শুভেচ্ছা", cat_anniversary: "💍 বিবাহবার্ষিকী", cat_newyear: "🎉 নতুন বছর", cat_boishakh: "🌾 পহেলা বৈশাখ", cat_friend: "🫂 সেরা বন্ধু", cat_eid: "🌙 ঈদ মোবারক", cat_sorry: "🥺 দুঃখ প্রকাশ",
        prompt_countdown_ask: "⏰ **আপনি কি এই লিঙ্কে নির্দিষ্ট টাইম কাউন্টডাউন (Time Countdown) সেট করতে চান?**",
        btn_yes: "✅ হ্যাঁ, চাই", btn_no: "❌ না, লাগবে না",
        prompt_time_input: "⏳ লিঙ্কটি কত মিনিট পর খুলবে তা সংখ্যায় লিখে পাঠান। (১-১০০ মিনিট)",
        invalid_time: "❌ **ভুল ইনপুট!** ১ থেকে ১০০ এর মধ্যে মিনিট দিন।",
        prompt_theme: "🎨 **একটি প্রিমিয়াম ওয়েব থিম সিলেক্ট করুন:**",
        prompt_music: "🎵 **একটি ব্যাকগ্রাউন্ড মিউজিক সিলেক্ট করুন:**",
        prompt_card_name: "🖼️ উইশ কার্ডে কার নাম লিখতে চান? নামটি লিখে পাঠান:",
        card_ready: "✨ **আপনার প্রিমিয়াম উইশ কার্ডটি তৈরি হয়ে গেছে!**",
        help_text: `❓ **সাহায্য গাইড:** যেকোনো সমস্যায় এডমিনের সাথে যোগাযোগ করুন।`,
        feedback_prompt: "📝 আপনার মেসেজটি নিচে লিখে পাঠিয়ে দিন:",
        feedback_success: "✅ আপনার মেসেজটি অ্যাডমিনের কাছে পাঠানো হয়েছে।",
        session_cancelled: "❌ সেশন বাতিল করা হয়েছে।",
        invalid_cmd: (cmd) => `❌ **ভুল ইনপুট:** \`${cmd}\` গ্রহণযোগ্য নয়।`,
        maint_msg: "🚧 **বটের কাজ চলছে!** খুব শীঘ্রই ফিরছি।",
        no_links: "❌ আপনি এখনো কোনো লিঙ্ক তৈরি করেননি।",
        profile_report: (name, list) => `📊 **আপনার রিপোর্ট:**\n👤 নাম: ${name}\n🎫 একটিভ লিঙ্ক:\n${list}`,
        session_started: (cat) => `✨ আপনার কাস্টম \`${cat.toUpperCase()}\` সেশন শুরু হয়েছে!\n\n👉 প্রিয়জনের জন্য **অ্যানিমেশন টেক্সটগুলো** পাঠান। (লাইনগুলো কমা বা এন্টার দিয়ে আলাদা করুন)`,
        input_anim_success: (count) => `✅ ${count} লাইনের অ্যানিমেশন যোগ হয়েছে।\n\n💌 এবার খামের ভেতরের মূল চিঠি বা মেসেজটি লিখে পাঠান।`,
        link_ready: (url) => `💝 আপনার লিঙ্ক রেডি:\n\n${url}`
    }
};

// 📌 Middlewares
bot.use((ctx, next) => {
    const userId = ctx.chat?.id;
    if (!userId) return next();
    if (bannedUsers.has(userId)) return;
    if (isMaintenanceMode && Number(userId) !== Number(ADMIN_CHAT_ID)) {
        return ctx.reply(locale.bn.maint_msg);
    }
    return next();
});

// 📌 Admin Engine Controls
const handleAdminConsole = (ctx) => {
    if (Number(ctx.chat.id) !== Number(ADMIN_CHAT_ID)) return;
    ctx.reply("👑 **Admin Console:**", Markup.inlineKeyboard([
        [Markup.button.callback("📊 Status", "admin_stats"), Markup.button.callback("📢 Broadcast", "admin_broadcast")],
        [Markup.button.callback(isMaintenanceMode ? "🟢 Live Mode" : "🚧 Maint Mode", "admin_toggle_maint")],
        [Markup.button.callback("🚫 Ban User", "admin_ban_menu")]
    ]));
};
bot.command('admin', handleAdminConsole);
bot.command('adm', handleAdminConsole);

bot.action('admin_stats', (ctx) => {
    if (Number(ctx.chat.id) !== Number(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    ctx.answerCbQuery();
    const activeLinks = Object.keys(db.linkDatabase).filter(k => db.linkDatabase[k].isActive).length;
    ctx.reply(`📊 Stats:\nUsers: ${registeredUsers.size}\nActive Links: ${activeLinks}`);
});

bot.action('admin_toggle_maint', (ctx) => {
    if (Number(ctx.chat.id) !== Number(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    isMaintenanceMode = !isMaintenanceMode;
    ctx.answerCbQuery();
    ctx.reply(`Maintenance: ${isMaintenanceMode ? 'ON' : 'OFF'}`);
});

bot.action('admin_broadcast', (ctx) => {
    if (Number(ctx.chat.id) !== Number(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    ctx.answerCbQuery();
    db.userSessions[ctx.chat.id] = { step: 'AWAITING_ADMIN_BROADCAST_MSG' };
    ctx.reply("📢 ব্রডকাস্ট মেসেজটি লিখুন:");
});

bot.action('admin_ban_menu', (ctx) => {
    if (Number(ctx.chat.id) !== Number(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    ctx.answerCbQuery();
    db.userSessions[ctx.chat.id] = { step: 'AWAITING_BAN_USER_ID' };
    ctx.reply("🚫 ব্যান করার জন্য ইউজার ID দিন:");
});

// 📌 User Commands
bot.command('start', (ctx) => { 
    registeredUsers.add(ctx.chat.id); 
    sendMainMenu(ctx, false); 
});

bot.command('cancel', (ctx) => {
    delete db.userSessions[ctx.chat.id];
    ctx.reply(locale.bn.session_cancelled);
    sendMainMenu(ctx, false);
});

bot.action('go_to_main_menu', (ctx) => { ctx.answerCbQuery(); sendMainMenu(ctx, true); });

bot.action('menu_makelink', (ctx) => {
    ctx.answerCbQuery();
    ctx.editMessageText(locale.bn.choose_cat, Markup.inlineKeyboard([
        [Markup.button.callback(locale.bn.cat_love, 'make_love'), Markup.button.callback(locale.bn.cat_crush, 'make_crush')],
        [Markup.button.callback(locale.bn.cat_birthday, 'make_birthday'), Markup.button.callback(locale.bn.cat_anniversary, 'make_anniversary')],
        [Markup.button.callback(locale.bn.btn_back, 'go_to_main_menu')]
    ]));
});

bot.action(/^make_/, (ctx) => {
    ctx.answerCbQuery();
    db.userSessions[ctx.chat.id] = { type: ctx.match.input.replace('make_', ''), name: ctx.from.first_name };
    showCountdownPrompt(ctx);
});

function showCountdownPrompt(ctx) {
    ctx.editMessageText(locale.bn.prompt_countdown_ask, Markup.inlineKeyboard([
        [Markup.button.callback(locale.bn.btn_yes, 'timer_yes'), Markup.button.callback(locale.bn.btn_no, 'timer_no')]
    ]));
}

bot.action('timer_yes', (ctx) => {
    ctx.answerCbQuery();
    db.userSessions[ctx.chat.id].step = 'AWAITING_COUNTDOWN_TIME';
    ctx.reply(locale.bn.prompt_time_input);
});

bot.action('timer_no', (ctx) => {
    ctx.answerCbQuery();
    db.userSessions[ctx.chat.id].pendingMinutes = null;
    askThemeSelection(ctx);
});

function askThemeSelection(ctx) {
    db.userSessions[ctx.chat.id].step = 'CHOOSE_THEME';
    ctx.reply(locale.bn.prompt_theme, Markup.inlineKeyboard([
        [Markup.button.callback('✨ Pink', 'set_theme_classic'), Markup.button.callback('🌌 Neon', 'set_theme_neon')],
        [Markup.button.callback('❤️ Dark', 'set_theme_dark')]
    ]));
}

bot.action(/^set_theme_/, (ctx) => {
    ctx.answerCbQuery();
    db.userSessions[ctx.chat.id].theme = ctx.match.input.replace('set_theme_', '');
    askMusicSelection(ctx);
});

function askMusicSelection(ctx) {
    ctx.reply(locale.bn.prompt_music, Markup.inlineKeyboard([
        [Markup.button.callback('🎵 Flute', 'set_music_romantic'), Markup.button.callback('🔇 None', 'set_music_none')]
    ]));
}

bot.action(/^set_music_/, (ctx) => {
    ctx.answerCbQuery();
    const userId = ctx.chat.id;
    db.userSessions[userId].music = ctx.match.input.replace('set_music_', '');
    db.userSessions[userId].step = 'AWAITING_ANIMATION_TEXT';
    ctx.reply(locale.bn.session_started(db.userSessions[userId].type));
});

// 🎯 State & Text Handling
bot.on('text', (ctx) => {
    const userId = ctx.chat.id;
    const session = db.userSessions[userId];
    const text = ctx.message.text.trim();

    if (text.startsWith('/')) return;

    // --- Admin Logic ---
    if (Number(userId) === Number(ADMIN_CHAT_ID) && session) {
        if (session.step === 'AWAITING_ADMIN_BROADCAST_MSG') {
            registeredUsers.forEach(id => bot.telegram.sendMessage(id, `📢 **নোটিশ:**\n\n${text}`).catch(()=>{}));
            ctx.reply("✅ ব্রডকাস্ট সম্পন্ন হয়েছে।");
            delete db.userSessions[userId]; return;
        }
        if (session.step === 'AWAITING_BAN_USER_ID') {
            const tId = parseInt(text);
            if (bannedUsers.has(tId)) { bannedUsers.delete(tId); ctx.reply("🟢 আনব্যান করা হয়েছে।"); }
            else { bannedUsers.add(tId); ctx.reply("🚫 ব্যান করা হয়েছে।"); }
            delete db.userSessions[userId]; return;
        }
    }

    if (!session) return;

    // --- User Link Creation Logic ---
    if (session.step === 'AWAITING_COUNTDOWN_TIME') {
        const mins = parseInt(text);
        if (isNaN(mins) || mins < 1 || mins > 100) return ctx.reply(locale.bn.invalid_time);
        session.pendingMinutes = mins;
        askThemeSelection(ctx);
    } 
    else if (session.step === 'AWAITING_ANIMATION_TEXT') {
        const anims = text.split(/[\n,，]+/).map(l => l.trim()).filter(l => l.length > 0);
        if (anims.length === 0) return ctx.reply("⚠️ কিছু লিখুন।");
        session.animations = anims;
        session.step = 'AWAITING_LETTER_TEXT';
        ctx.reply(locale.bn.input_anim_success(anims.length));
    } 
    else if (session.step === 'AWAITING_LETTER_TEXT') {
        processFinalLinkCreation(ctx, text);
    } 
    else if (session.step === 'AWAITING_USER_FEEDBACK') {
        bot.telegram.sendMessage(ADMIN_CHAT_ID, `📝 Feedback: ${text}`);
        ctx.reply(locale.bn.feedback_success);
        delete db.userSessions[userId];
    }
});

function processFinalLinkCreation(ctx, letterText) {
    const userId = ctx.chat.id;
    const session = db.userSessions[userId];
    const uniqueId = Math.random().toString(36).substring(2, 9);
    
    let countdown = null;
    if (session.pendingMinutes) {
        let d = new Date();
        d.setMinutes(d.getMinutes() + session.pendingMinutes);
        countdown = d.toISOString();
    }

    db.linkDatabase[uniqueId] = {
        userId, theme: session.theme, music: session.music,
        animations: session.animations, letter: letterText,
        countdown, isActive: true, type: session.type
    };
    
    saveDB();
    ctx.reply(locale.bn.link_ready(`${SERVER_URL}/love/${uniqueId}`));
    delete db.userSessions[userId];
}

function sendMainMenu(ctx, isEdit = false) {
    const text = locale.bn.welcome(ctx.from?.first_name || "User");
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback(locale.bn.btn_make, 'menu_makelink'), Markup.button.callback(locale.bn.btn_stats, 'menu_stats')],
        [Markup.button.callback(locale.bn.btn_off, 'menu_off'), Markup.button.callback(locale.bn.btn_feedback, 'menu_feedback')]
    ]);
    if (isEdit) return ctx.editMessageText(text, keyboard).catch(()=>{});
    return ctx.reply(text, keyboard);
}

// 📌 API
app.post('/api/get-content', (req, res) => {
    const data = db.linkDatabase[req.body.id];
    if (!data || !data.isActive) return res.json({ success: false });
    res.json({ success: true, ...data });
});

app.get('/love/:id', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    bot.launch();
    console.log(`Bot running on port ${PORT}`);
});w
