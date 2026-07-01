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

// 🌐 Messages (Fixed to Bangla)
const locale = {
    bn: {
        welcome: (name) => `💝 **হ্যালো ${name}!** 💝\n\nবটের পক্ষ থেকে স্বাগতম। আপনার প্রিয়জনের জন্য আকর্ষণীয় টাইম কাউন্টডাউন করা ওয়েব লিঙ্ক তৈরি করুন একদম ফ্রিতে।\n\nনিচের যেকোনো একটি অপশন সিলেক্ট করুন:`,
        btn_make: "🚀 লিঙ্ক তৈরি করুন", btn_card: "🖼️ উইশ কার্ড বানান", btn_demo: "👀 ডেমো দেখুন", btn_stats: "📊 স্ট্যাটাস", btn_off: "🔒 লিঙ্ক বন্ধ করুন", btn_feedback: "📝 মতামত", btn_help: "❓ সাহায্য", btn_back: "🔙 মেইন মেনু",
        choose_cat: "✨ **আপনি কোন ক্যাটাগরির লিঙ্ক তৈরি করতে চান?**",
        cat_love: "❤️ প্রেমের চিঠি", cat_crush: "💖 ক্রাশ কনফেশন", cat_birthday: "🎂 জন্মদিনের শুভেচ্ছা", cat_anniversary: "💍 বিবাহবার্ষিকী", cat_newyear: "🎉 নতুন বছর", cat_boishakh: "🌾 পহেলা বৈশাখ", cat_friend: "🫂 সেরা বন্ধু", cat_eid: "🌙 ঈদ মোবারক", cat_sorry: "🥺 দুঃখ প্রকাশ",
        
        prompt_countdown_ask: "⏰ **আপনি কি এই লিঙ্কে নির্দিষ্ট টাইম কাউন্টডাউন (Time Countdown) সেট করতে চান?**\n\n(কাউন্টডাউন সেট করলে আপনার দেওয়া সময় শেষ হওয়ার আগে কেউ লিঙ্কের ভেতরের চিঠি দেখতে পারবে না।)",
        btn_yes: "✅ হ্যাঁ, চাই", btn_no: "❌ না, লাগবে না",
        prompt_time_input: "⏳ লিঙ্কটি কত মিনিট পর খুলবে তা নিচের বাটন চেপে সিলেক্ট করুন অথবা শুধু সংখ্যায় লিখে পাঠান।\n\n**সহীহ উদাহরণ (Examples):**\n• \`15\` অথবা \`15m\`\n• \`90 minute\`\n\n⚠️ **সীমা:** সর্বনিম্ন **১ মিনিট** এবং সর্বোচ্চ **১০০ মিনিট**।",
        invalid_time: "❌ **ভুল ইনপুট বা ফরম্যাট!**\n\nঅনুগ্রহ করে শুধু মিনিট উল্লেখ করুন বা বাটন ব্যবহার করুন। অন্য কোনো লেখা বা ঘণ্টা গ্রহণযোগ্য নয়।",
        max_time_exceeded: "⚠️ **সীমা বহির্ভূত সময়!**\n\nআপনি সর্বোচ্চ **১০০ মিনিট** পর্যন্ত টাইম কাউন্টডাউন সেট করতে পারবেন। দয়া করে ১ থেকে ১০০ এর মধ্যে সংখ্যা দিন।",
        time_past: "❌ সর্বনিম্ন ১ মিনিটের টাইম কাউন্টডাউন দিতে হবে। ০ বা নেগেটিভ সময় গ্রহণযোগ্য নয়।",
        
        prompt_theme: "🎨 **একটি প্রিমিয়াম ওয়েব থিম সিলেক্ট করুন:**",
        prompt_music: "🎵 **একটি ব্যাকগ্রাউন্ড মিউজিক সিলেক্ট করুন:**",
        prompt_card_name: "🖼️ উইশ কার্ডে কার নাম লিখতে চান? নামটি লিখে পাঠান:",
        card_ready: "✨ **আপনার প্রিমিয়াম উইশ কার্ডটি তৈরি হয়ে গেছে!** 👇",
        help_text: `❓ **সাহায্য গাইড:**\n\n💡 যেকোনো সমস্যায় এডমিনের সাথে যোগাযোগ করুন।`,
        
        feedback_prompt: "📝 **মতামত ও রিপোর্ট:**\n\nঅ্যাডমিনের কাছে কোনো রিপোর্ট, নতুন আপডেটের আইডিয়া বা অন্য কোনো কিছু বলার থাকলে আপনার মেসেজটি নিচে লিখে পাঠিয়ে দিন:",
        feedback_short: "❌ মেসেজটি একটু বিস্তারিত লিখুন (কমপক্ষে ৫টি অক্ষর)।",
        feedback_success: "✅ আপনার মেসেজটি অ্যাডমিনের কাছে সফলভাবে পাঠানো হয়েছে। ধন্যবাদ!",
        
        session_cancelled: "❌ আপনার চলমান লিঙ্ক তৈরির সেশনটি বাতিল করা হয়েছে।",
        no_session: "💡 আপনার কোনো একটিভ সেশন নেই।",
        invalid_cmd: (cmd) => `❌ **ভুল ইনপুট বা আদেশ:** \`${cmd}\` গ্রহণযোগ্য নয়। অনুগ্রহ করে নিচের মেইন মেনু ব্যবহার করুন অথবা সেশনটি বাতিল করতে /cancel লিখুন।`,
        maint_msg: "🚧 **বটের কাজ চলছে (Under Maintenance)!** খুব শীঘ্রই আমরা ফিরে আসছি।",
        no_links: "❌ আপনি এখনো কোনো লিঙ্ক তৈরি করেননি।",
        profile_report: (name, list) => `📊 **আপনার প্রোফাইল রিপোর্ট:**\n\n👤 নাম: ${name}\n🎫 আপনার একটিভ লিঙ্কসমূহ:\n${list}`,
        off_link_title: "🔒 **কোন লিঙ্কটি বন্ধ করতে চান? নিচে ক্লিক করুন:**",
        off_all_links: "❌ সব লিঙ্ক বন্ধ করুন",
        deactivate_success_all: (count) => `✅ আপনার সবকটি (\`${count}\`) লিঙ্ক সফলভাবে বন্ধ করা হয়েছে!`,
        deactivate_success_single: (id) => `✅ আপনার লিঙ্কটি (\`${id}\`) সফলভাবে বন্ধ করা হয়েছে।`,
        link_not_found: "❌ লিঙ্কটি পাওয়া যায়নি।",
        session_started: (cat) => `✨ আপনার কাস্টম \`${cat.toUpperCase()}\` লিঙ্ক তৈরির সেশন শুরু হয়েছে!\n\n👉 আপনার প্রিয়জনের জন্য **অ্যানিমেশন টেক্সটগুলো** পাঠান।\n\n💡 **লেখার নিয়ম (How to write):**\n• প্রতি লাইনের পর কীবোর্ডের **Enter** চেপে নতুন লাইনে লিখুন।\n• অথবা প্রতিটি লাইনের মাঝে **কমা ( , )** ব্যবহার করুন।`,
        demo_title: "👀 **আপনি কোন ডেমো পেজটি দেখতে চান? নিচে সিলেক্ট করুন:**",
        demo_ready: (type, url) => `✨ **আপনার অনুরোধ করা ডেমো লিঙ্কটি তৈরি!**\n\n🔗 ডেমো লিঙ্ক: ${url}`,
        input_anim_success: (count) => `✅ চমৎকার! আপনি ${count} লাইনের অ্যানিমেশন যোগ করেছেন।\n\n💌 এবার খামের ভেতরের মূল চিঠি বা উইশ মেসেজটি লিখে পাঠান।`,
        link_ready: (url) => `💝 অভিনন্দন! আপনার কাস্টমাইজড প্রিমিয়াম লিঙ্ক সম্পূর্ণ রেডি:\n\n${url}\n\n👉 এই লিঙ্কটি আপনার প্রিয়জনের সাথে শেয়ার করুন।`,
        general_error: "⚠️ দুঃখিত, একটি অভ্যন্তরীণ ত্রুটি ঘটেছে। অনুগ্রহ করে আবার চেষ্টা করুন বা /cancel লিখে নতুন সেশন শুরু করুন।"
    }
};

function extractMinutes(input) {
    const cleanInput = input.trim().toLowerCase();
    const matches = cleanInput.match(/\d+/);
    if (!matches) return null;
    return parseInt(matches[0], 10);
}

// 🛡️ Middlewares
bot.use((ctx, next) => {
    try {
        const userId = ctx.chat ? ctx.chat.id : null;
        if (!userId) return next();
        if (Number(userId) === Number(ADMIN_CHAT_ID)) return next();
        if (isMaintenanceMode) {
            return ctx.reply(locale.bn.maint_msg);
        }
        if (bannedUsers.has(userId)) return; 
        return next();
    } catch (err) {
        console.error("Middleware Error:", err);
    }
});

// 📌 Commands
bot.command('start', (ctx) => { 
    try {
        registeredUsers.add(ctx.chat.id); 
        sendMainMenu(ctx, false); 
    } catch (err) { console.error(err); }
});

bot.command('cancel', (ctx) => {
    try {
        const userId = ctx.chat.id;
        if (db.userSessions[userId]) {
            delete db.userSessions[userId];
            ctx.reply(locale.bn.session_cancelled);
            sendMainMenu(ctx, false);
        } else { 
            ctx.reply(locale.bn.no_session); 
        }
    } catch (err) { console.error(err); }
});

// Admin Console
bot.command('admin', (ctx) => {
    if (Number(ctx.chat.id) !== Number(ADMIN_CHAT_ID)) return;
    ctx.reply("👑 **Admin Console:**", Markup.inlineKeyboard([
        [Markup.button.callback("📊 System Status", "admin_stats"), Markup.button.callback("📢 Broadcast", "admin_broadcast")],
        [Markup.button.callback(isMaintenanceMode ? "🟢 Live Mode" : "🚧 Maint Mode", "admin_toggle_maint")]
    ]));
});

bot.action('admin_stats', (ctx) => {
    if (Number(ctx.chat.id) !== Number(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    ctx.answerCbQuery();
    const activeLinks = Object.keys(db.linkDatabase).filter(k => db.linkDatabase[k].isActive).length;
    ctx.reply(`📊 Metrics: Users: ${registeredUsers.size}, Active Links: ${activeLinks}`);
});

bot.action('admin_toggle_maint', (ctx) => {
    if (Number(ctx.chat.id) !== Number(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    isMaintenanceMode = !isMaintenanceMode;
    ctx.answerCbQuery();
    ctx.reply(`⚙️ Maint Mode: ${isMaintenanceMode}`);
});

bot.action('go_to_main_menu', (ctx) => { ctx.answerCbQuery(); sendMainMenu(ctx, true); });

// Link Creation
bot.action('menu_makelink', (ctx) => {
    ctx.answerCbQuery();
    ctx.editMessageText(locale.bn.choose_cat, Markup.inlineKeyboard([
        [Markup.button.callback(locale.bn.cat_love, 'make_love'), Markup.button.callback(locale.bn.cat_crush, 'make_crush')],
        [Markup.button.callback(locale.bn.cat_birthday, 'make_birthday'), Markup.button.callback(locale.bn.cat_anniversary, 'make_anniversary')],
        [Markup.button.callback(locale.bn.cat_newyear, 'make_newyear'), Markup.button.callback(locale.bn.cat_boishakh, 'make_boishakh')],
        [Markup.button.callback(locale.bn.cat_friend, 'make_friend'), Markup.button.callback(locale.bn.cat_eid, 'make_eid')],
        [Markup.button.callback(locale.bn.cat_sorry, 'make_sorry')],
        [Markup.button.callback(locale.bn.btn_back, 'go_to_main_menu')]
    ]));
});

bot.action(/^make_/, (ctx) => {
    ctx.answerCbQuery();
    db.userSessions[ctx.chat.id] = { type: ctx.match.input.replace('make_', ''), name: ctx.from.first_name || "User" };
    saveDB();
    showCountdownPrompt(ctx);
});

function showCountdownPrompt(ctx) {
    ctx.editMessageText(locale.bn.prompt_countdown_ask, Markup.inlineKeyboard([
        [Markup.button.callback(locale.bn.btn_yes, 'timer_yes'), Markup.button.callback(locale.bn.btn_no, 'timer_no')],
        [Markup.button.callback("🔙 পেছনে যান", 'menu_makelink')]
    ])).catch(()=>{});
}

bot.action('timer_yes', (ctx) => {
    ctx.answerCbQuery();
    db.userSessions[ctx.chat.id].step = 'AWAITING_COUNTDOWN_TIME';
    saveDB();
    ctx.editMessageText(locale.bn.prompt_time_input, Markup.inlineKeyboard([
        [Markup.button.callback('🕒 ৩ মিনিট', 'set_time_3'), Markup.button.callback('🕒 ৫ মিনিট', 'set_time_5')],
        [Markup.button.callback('🕒 ১০ মিনিট', 'set_time_10'), Markup.button.callback('🕒 ২০ মিনিট', 'set_time_20')],
        [Markup.button.callback("🔙 পেছনে যান", 'back_to_timer_ask')]
    ], { parse_mode: 'Markdown' })).catch(()=>{});
});

bot.action('back_to_timer_ask', (ctx) => {
    ctx.answerCbQuery();
    showCountdownPrompt(ctx);
});

bot.action(/^set_time_/, (ctx) => {
    ctx.answerCbQuery();
    db.userSessions[ctx.chat.id].pendingMinutes = parseInt(ctx.match.input.replace('set_time_', ''), 10);
    saveDB();
    askThemeSelection(ctx);
});

bot.action('timer_no', (ctx) => { 
    ctx.answerCbQuery(); 
    db.userSessions[ctx.chat.id].pendingMinutes = null; 
    saveDB();
    askThemeSelection(ctx); 
});

function askThemeSelection(ctx) {
    ctx.editMessageText(locale.bn.prompt_theme, Markup.inlineKeyboard([
        [Markup.button.callback('✨ Classic Pink', 'set_theme_classic'), Markup.button.callback('🌌 Neon Magic', 'set_theme_neon')],
        [Markup.button.callback('🎈 Birthday Gold', 'set_theme_gold'), Markup.button.callback('❤️ Dark Romance', 'set_theme_dark')],
        [Markup.button.callback("🔙 পেছনে যান", 'back_to_timer_ask')]
    ])).catch(()=>{});
}

bot.action(/^set_theme_/, (ctx) => {
    ctx.answerCbQuery();
    db.userSessions[ctx.chat.id].theme = ctx.match.input.replace('set_theme_', '');
    saveDB();
    askMusicSelection(ctx);
});

function askMusicSelection(ctx) {
    ctx.editMessageText(locale.bn.prompt_music, Markup.inlineKeyboard([
        [Markup.button.callback('🎵 Romantic Flute', 'set_music_romantic'), Markup.button.callback('🎵 Soft Piano', 'set_music_piano')],
        [Markup.button.callback('🎵 Birthday Beats', 'set_music_birthday'), Markup.button.callback('🔇 No Music', 'set_music_none')],
        [Markup.button.callback("🔙 পেছনে যান", 'back_to_theme')]
    ])).catch(()=>{});
}

bot.action('back_to_theme', (ctx) => {
    ctx.answerCbQuery();
    askThemeSelection(ctx);
});

bot.action(/^set_music_/, (ctx) => {
    ctx.answerCbQuery();
    db.userSessions[ctx.chat.id].music = ctx.match.input.replace('set_music_', '');
    db.userSessions[ctx.chat.id].step = 'AWAITING_ANIMATION_TEXT';
    saveDB();
    ctx.editMessageText(locale.bn.session_started(db.userSessions[ctx.chat.id].type), Markup.inlineKeyboard([
        [Markup.button.callback("🔙 পেছনে যান", 'back_to_music')]
    ]), { parse_mode: 'Markdown' }).catch(()=>{});
});

bot.action('back_to_music', (ctx) => {
    ctx.answerCbQuery();
    askMusicSelection(ctx);
});

// Menus & Stats
bot.action('menu_cardgen', (ctx) => { 
    ctx.answerCbQuery(); 
    db.userSessions[ctx.chat.id] = { step: 'AWAITING_CARD_NAME' }; 
    saveDB();
    ctx.reply(locale.bn.prompt_card_name); 
});

bot.action('menu_demo', (ctx) => { 
    ctx.answerCbQuery(); 
    ctx.editMessageText(locale.bn.demo_title, Markup.inlineKeyboard([
        [Markup.button.callback("❤️ Love Demo", "view_demo_love"), Markup.button.callback("🎂 Birthday Demo", "view_demo_birthday")],
        [Markup.button.callback("🔙 Main Menu", "go_to_main_menu")]
    ])); 
});

bot.action(/^view_demo_/, (ctx) => { 
    ctx.answerCbQuery(); 
    const type = ctx.match.input.replace('view_demo_', '');
    ctx.reply(locale.bn.demo_ready(type, `${SERVER_URL}/love/demo-preview?type=${type}`)); 
});

bot.action('menu_stats', (ctx) => {
    ctx.answerCbQuery();
    const userId = ctx.chat.id;
    const userLinks = Object.keys(db.linkDatabase).filter(k => db.linkDatabase[k].userId === userId && db.linkDatabase[k].isActive);
    let listText = userLinks.length === 0 ? locale.bn.no_links : userLinks.map((id, i) => `${i+1}. \`${SERVER_URL}/love/${id}\``).join('\n');
    ctx.reply(locale.bn.profile_report(ctx.from.first_name || "User", listText));
});

bot.action('menu_off', (ctx) => {
    ctx.answerCbQuery();
    const userId = ctx.chat.id;
    const userLinks = Object.keys(db.linkDatabase).filter(k => db.linkDatabase[k].userId === userId && db.linkDatabase[k].isActive);
    if (userLinks.length === 0) return ctx.reply(locale.bn.no_links);
    const buttons = userLinks.map(id => [Markup.button.callback(`❌ Off: ${id}`, `deactivate_${id}`)]);
    buttons.push([Markup.button.callback(locale.bn.off_all_links, "deactivate_all_links")]);
    ctx.reply(locale.bn.off_link_title, Markup.inlineKeyboard(buttons));
});

bot.action('deactivate_all_links', (ctx) => {
    ctx.answerCbQuery();
    const userLinks = Object.keys(db.linkDatabase).filter(k => db.linkDatabase[k].userId === ctx.chat.id && db.linkDatabase[k].isActive);
    userLinks.forEach(id => { db.linkDatabase[id].isActive = false; });
    saveDB();
    ctx.reply(locale.bn.deactivate_success_all(userLinks.length));
    sendMainMenu(ctx, false);
});

bot.action(/^deactivate_/, (ctx) => {
    ctx.answerCbQuery();
    const id = ctx.match.input.replace('deactivate_', '');
    if (db.linkDatabase[id] && db.linkDatabase[id].userId === ctx.chat.id) {
        db.linkDatabase[id].isActive = false;
        saveDB();
        ctx.reply(locale.bn.deactivate_success_single(id));
    }
    sendMainMenu(ctx, false);
});

bot.action('menu_feedback', (ctx) => { 
    ctx.answerCbQuery(); 
    db.userSessions[ctx.chat.id] = { step: 'AWAITING_USER_FEEDBACK' }; 
    saveDB();
    ctx.reply(locale.bn.feedback_prompt); 
});

bot.action('menu_help', (ctx) => {
    ctx.answerCbQuery();
    ctx.reply(locale.bn.help_text);
});

// 🎯 Main Processing Logic
bot.on('text', (ctx) => {
    const userId = ctx.chat.id;
    const session = db.userSessions[userId];
    const text = ctx.message.text.trim();

    if (text.startsWith('/')) return;

    if (!session) {
        ctx.reply(locale.bn.invalid_cmd(text), { parse_mode: 'Markdown' });
        sendMainMenu(ctx, false);
        return;
    }

    try {
        if (session.step === 'AWAITING_USER_FEEDBACK') {
            if (text.length < 5) return ctx.reply(locale.bn.feedback_short);
            bot.telegram.sendMessage(ADMIN_CHAT_ID, `📝 Feedback from ${userId}:\n\n${text}`).catch(()=>{});
            ctx.reply(locale.bn.feedback_success);
            delete db.userSessions[userId]; sendMainMenu(ctx, false); return;
        }

        if (session.step === 'AWAITING_CARD_NAME') {
            ctx.reply(locale.bn.card_ready);
            ctx.replyWithPhoto({ url: `https://dummyimage.com/600x400/ff4b72/fff.png&text=${encodeURIComponent(text)}` }).catch(()=>{});
            delete db.userSessions[userId]; sendMainMenu(ctx, false); return;
        }

        if (session.step === 'AWAITING_COUNTDOWN_TIME') {
            const parsedMinutes = extractMinutes(text);
            if (parsedMinutes === null || parsedMinutes < 1 || parsedMinutes > 100) return ctx.reply(locale.bn.invalid_time);
            session.pendingMinutes = parsedMinutes; 
            askThemeSelection(ctx);
            return;
        }

        if (session.step === 'AWAITING_ANIMATION_TEXT') {
            session.animations = text.split(/[\n,，]+/).map(l => l.trim()).filter(l => l.length > 0);
            if (session.animations.length === 0) return ctx.reply("⚠️ অনুগ্রহ করে অন্তত একটি লাইন লিখুন।");
            session.step = 'AWAITING_LETTER_TEXT';
            saveDB();
            ctx.reply(locale.bn.input_anim_success(session.animations.length));
            return;
        }

        if (session.step === 'AWAITING_LETTER_TEXT') {
            processFinalLinkCreation(ctx, text);
            return;
        }

    } catch (error) {
        console.error(error);
        ctx.reply(locale.bn.general_error);
    }
});

function processFinalLinkCreation(ctx, letterText) {
    const userId = ctx.chat.id;
    const session = db.userSessions[userId];
    let finalCountdownIso = null;
    if (session.pendingMinutes) {
        const targetDate = new Date();
        targetDate.setMinutes(targetDate.getMinutes() + session.pendingMinutes);
        finalCountdownIso = targetDate.toISOString();
    }
    const uniqueId = Math.random().toString(36).substring(2, 9);
    db.linkDatabase[uniqueId] = {
        userId: userId, name: session.name, type: session.type,
        theme: session.theme, music: session.music, countdown: finalCountdownIso,
        animations: session.animations, letter: letterText, isActive: true
    };
    saveDB();
    ctx.reply(locale.bn.link_ready(`${SERVER_URL}/love/${uniqueId}`));
    delete db.userSessions[userId];
    saveDB();
}

function sendMainMenu(ctx, isEdit = false) {
    const text = locale.bn.welcome(ctx.from?.first_name || "User");
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback(locale.bn.btn_make, 'menu_makelink'), Markup.button.callback(locale.bn.btn_card, 'menu_cardgen')],
        [Markup.button.callback(locale.bn.btn_demo, 'menu_demo'), Markup.button.callback(locale.bn.btn_stats, 'menu_stats')],
        [Markup.button.callback(locale.bn.btn_off, 'menu_off'), Markup.button.callback(locale.bn.btn_feedback, 'menu_feedback')],
        [Markup.button.callback(locale.bn.btn_help, 'menu_help')]
    ]);
    if (isEdit) return ctx.editMessageText(text, keyboard).catch(()=>{});
    return ctx.reply(text, keyboard);
}

app.post('/api/get-content', async (req, res) => {
    try {
        const { id } = req.body;
        const data = db.linkDatabase[id];
        if (!data || !data.isActive) return res.json({ success: false });
        if (data.countdown && new Date(data.countdown) > new Date()) {
            return res.json({ success: true, isLocked: true, countdownTime: data.countdown, theme: data.theme });
        }
        return res.json({ success: true, isLocked: false, theme: data.theme, music: data.music, animations: data.animations, letter: data.letter });
    } catch (err) { res.json({ success: false }); }
});

app.get('/love/:id', (req, res) => { res.sendFile(path.join(__dirname, 'index.html')); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    bot.launch();
    console.log(`Bot running on port ${PORT}`);
});
