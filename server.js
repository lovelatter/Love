const express = require('express');
const path = require('path');
const axios = require('axios');
const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');

const app = express();
app.use(express.json());

// ⚙️ Configurations & Environment Variables
const TELEGRAM_TOKEN = "8922778423:AAGbdZfdUDol_5w3dPbeBH0aucf9qkgtPTA"; 
const SERVER_URL = "https://love-bb7p.onrender.com"; 
const ADMIN_CHAT_ID = 6719885052; 

const bot = new Telegraf(TELEGRAM_TOKEN);

// 🗄️ In-Memory Databases & Core States
const linkDatabase = {}; 
const userSessions = {}; 
const registeredUsers = new Set(); 
const bannedUsers = new Set(); 
const userLanguages = {}; 
let isMaintenanceMode = false; 

// 📊 Global Stats Counters
let totalLinksCreated = 0;
let totalCardsGenerated = 0;
let totalFeedbacksReceived = 0;

// 🌐 Multi-Language Messages Dictionary
const locale = {
    bn: {
        welcome: (name) => `💝 **হ্যালো ${name}!** 💝\n\nবটের পক্ষ থেকে স্বাগতম। আপনার প্রিয়জনের জন্য আকর্ষণীয় টাইম লক করা ওয়েব লিঙ্ক তৈরি করুন একদম ফ্রিতে।\n\nনিচের যেকোনো একটি অপশন সিলেক্ট করুন:`,
        btn_make: "🚀 লিঙ্ক তৈরি করুন", btn_card: "🖼️ উইশ কার্ড বানান", btn_demo: "👀 ডেমো দেখুন", btn_stats: "📊 স্ট্যাটাস", btn_off: "🔒 লিঙ্ক বন্ধ করুন", btn_feedback: "📝 মতামত", btn_help: "❓ সাহায্য", btn_lang: "🌐 ভাষা পরিবর্তন", btn_back: "🔙 মেইন মেনু",
        choose_cat: "✨ **আপনি কোন ক্যাটাগরির লিঙ্ক তৈরি করতে চান?**",
        cat_love: "❤️ প্রেমের চিঠি", cat_crush: "💖 ক্রাশ稳 কনফেশন", cat_birthday: "🎂 জন্মদিনের শুভেচ্ছা", cat_anniversary: "💍 বিবাহবার্ষিকী", cat_newyear: "🎉 নতুন বছর", cat_boishakh: "🌾 পহেলা বৈশাখ", cat_friend: "🫂 সেরা বন্ধু", cat_eid: "🌙 ঈদ মোবারক", cat_sorry: "🥺 দুঃখ প্রকাশ",
        prompt_countdown_ask: "⏰ **আপনি কি এই লিঙ্কে নির্দিষ্ট টাইম লক (Time Lock) সেট করতে চান?**\n\n(টাইম সেট করলে আপনার দেওয়া সময়ের আগে কেউ লিঙ্কের ভেতরের চিঠি দেখতে পারবে না।)",
        btn_yes: "✅ হ্যাঁ, চাই", btn_no: "❌ না, লাগবে না",
        prompt_time_input: "⏳ লিঙ্কটি কত মিনিট পর খুলবে তা নিচের বাটন চেপে সিলেক্ট করুন অথবা শুধু সংখ্যায় লিখে পাঠান।\n\n**সঠিক উদাহরন (Examples):**\n• \`15\` অথবা \`15m\`\n• \`90 minute\`\n\n⚠️ **সীমা:** সর্বনিম্ন **১ মিনিট** এবং সর্বোচ্চ **১০০ মিনিট**।",
        invalid_time: "❌ **ভুল ইনপুট বা ফরম্যাট!**\n\nঅনুগ্রহ করে শুধু মিনিট উল্লেখ করুন বা বাটন ব্যবহার করুন। অন্য কোনো লেখা বা ঘণ্টা গ্রহণযোগ্য নয়।",
        max_time_exceeded: "⚠️ **সীমা বহির্ভূত সময়!**\n\nআপনি সর্বোচ্চ **১০০ মিনিট** পর্যন্ত টাইম লক সেট করতে পারবেন। দয়া করে ১ থেকে ১০০ এর মধ্যে সংখ্যা দিন।",
        time_past: "❌ সর্বনিম্ন ১ মিনিটের টাইম লক দিতে হবে। ০ বা নেগেティブ সময় গ্রহণযোগ্য নয়।",
        prompt_theme: "🎨 **একটি প্রিমিয়াম ওয়েব থিম সিলেক্ট করুন:**",
        prompt_music: "🎵 **একটি ব্যাকগ্রাউন্ড মিউজিক সিলেক্ট করুন:**",
        prompt_card_name: "🖼️ উইশ কার্ডে কার নাম লিখতে চান? নামটি লিখে পাঠান:",
        card_ready: "✨ **আপনার প্রিমিয়াম উইশ কার্ডটি তৈরি হয়ে গেছে!** 👇",
        help_text: `❓ **সাহায্য গাইড:**\n\n💡 যেকোনো সমস্যায় এডমিনের সাথে যোগাযোগ করুন।`,
        feedback_prompt: "📝 অনুগ্রহ করে আপনার মতামত বা পরামর্শ এখানে লিখে পাঠান:",
        feedback_short: "❌ মতামত একটু বড় করে লিখুন (কমপক্ষে ৫টি অক্ষর)।",
        feedback_success: "✅ আপনার মূল্যবান মতামত সফলভাবে জমা হয়েছে। ধন্যবাদ!",
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
        session_started: (cat) => `✨ আপনার কাস্টম \`${cat.toUpperCase()}\` লিঙ্ক তৈরির সেশন শুরু হয়েছে!\n\n👉 আপনার প্রিয়জনের জন্য **অ্যানিমেশন টেক্সটগুলো** পাঠান।\n\n💡 **লেখার নিয়ম (How to write):**\n• প্রতি লাইনের পর কীবোর্ডের **Enter** চেপে নতুন লাইনে লিখুন।\n• অথবা প্রতিটি লাইনের মাঝে **কমা ( , )** ব্যবহার করুন。`,
        demo_title: "👀 **আপনি কোন ডেমো পেজটি দেখতে চান? নিচে সিলেক্ট করুন:**",
        demo_ready: (type, url) => `✨ **আপনার অনুরোধ করা ডেমো লিঙ্কটি তৈরি!**\n\n🔗 ডেমো লিঙ্ক: ${url}`,
        input_anim_success: (count) => `✅ চমৎকার! আপনি ${count} লাইনের অ্যানিমেশন যোগ করেছেন。\n\n💌 এবার খামের ভেতরের মূল চিঠি বা উইশ মেসেজটি লিখে পাঠান। \n\n🤖 (নিজে লিখতে না চাইলে নিচের AI বাটনটি ব্যবহার করতে পারেন)`,
        link_ready: (url) => `💝 অভিনন্দন! আপনার কাস্টমাইজড প্রিমিয়াম লিঙ্ক সম্পূর্ণ রেডি:\n\n${url}\n\n👉 এই লিঙ্কটি আপনার প্রিয়জনের সাথে শেয়ার করুন।`,
        someone_opened: (type, time) => `👀 **বিজ্ঞপ্তি:** কেউ একজন আপনার তৈরি করা \`${type.toUpperCase()}\` লিঙ্কটি ওপেন করেছে!\n⏰ **সময়:** ${time}`,
        new_response: (type, res) => `💌 আপনার কাস্টম \`${type.toUpperCase()}\` লিঙ্কে একটি নতুন রেসপন্স এসেছে!\n\nউত্তর: ${res}`,
        general_error: "⚠️ দুঃখিত, একটি অভ্যন্তরীণ ত্রুটি ঘটেছে। অনুগ্রহ করে আবার চেষ্টা করুন বা /cancel লিখে নতুন সেশন শুরু করুন।"
    },
    en: {
        welcome: (name) => `💝 **Hello ${name}!** 💝\n\nWelcome to Wishing Bot. Create premium links with customized time locks for free.\n\nPlease select an option below:`,
        btn_make: "🚀 Make Link", btn_card: "🖼️ Wish Card Generator", btn_demo: "👀 Demo", btn_stats: "📊 Stats", btn_off: "🔒 Off Link", btn_feedback: "📝 Feedback", btn_help: "❓ Help", btn_lang: "🌐 Change Language", btn_back: "🔙 Main Menu",
        choose_cat: "✨ **Select Category:**",
        cat_love: "❤️ Love Letter", cat_crush: "💖 Crush Confession", cat_birthday: "🎂 Birthday Wish", cat_anniversary: "💍 Anniversary Wish", cat_newyear: "🎉 New Year Wish", cat_boishakh: "🌾 Pohela Boishakh", cat_friend: "🫂 Best Friend", cat_eid: "🌙 Eid Wish", cat_sorry: "🥺 Sorry Letter",
        prompt_countdown_ask: "⏰ **Do you want to set a Time Lock for this link?**",
        btn_yes: "✅ Yes", btn_no: "❌ No",
        prompt_time_input: "⏳ Select lock duration using buttons below or send minutes as text.\n\n⚠️ Limits: Min 1 min, Max 100 mins.",
        invalid_time: "❌ **Invalid format!** Please send minutes only.",
        max_time_exceeded: "⚠️ **Limit Exceeded!** Max lock time is 100 minutes.",
        time_past: "❌ Minimum lock duration is 1 minute.",
        prompt_theme: "🎨 **Select a Premium Web Theme:**",
        prompt_music: "🎵 **Select a Background Music:**",
        prompt_card_name: "🖼️ Enter the name you want to print on the Wish Card:",
        card_ready: "✨ **Your premium Wish Card is ready!** 👇",
        help_text: `❓ **Help Guide:** Contact admin for support.`,
        feedback_prompt: "📝 Please send your feedback:",
        feedback_short: "❌ Please write more details (min 5 characters).",
        feedback_success: "✅ Feedback submitted! Thank you.",
        session_cancelled: "❌ Your active session has been cancelled.",
        no_session: "💡 You don't have any active session.",
        invalid_cmd: (cmd) => `❌ **Invalid input:** \`${cmd}\` is not recognized.`,
        maint_msg: "🚧 **Bot is under maintenance!** We will be back shortly.",
        no_links: "❌ You haven't created any links yet.",
        profile_report: (name, list) => `📊 **Your Profile:**\n\n👤 Name: ${name}\n🎫 Your Active Links:\n${list}`,
        off_link_title: "🔒 **Select link to deactivate:**",
        off_all_links: "❌ Off All Links",
        deactivate_success_all: (count) => `✅ Deactivated all (\`${count}\`) links!`,
        deactivate_success_single: (id) => `✅ Deactivated link (\`${id}\`).`,
        link_not_found: "❌ Link not found.",
        session_started: (cat) => `✨ Custom ${cat.toUpperCase()} Link started!\n\n👉 Send animation texts separated by line breaks or commas (,).`,
        demo_title: "👀 **Select demo page:**",
        demo_ready: (type, url) => `✨ **Demo Link:** ${url}`,
        input_anim_success: (count) => `✅ Added ${count} lines. Send main letter or use AI helper below:`,
        link_ready: (url) => `💝 Link Ready:\n\n${url}`,
        someone_opened: (type, time) => `👀 **Notification:** Someone opened your ${type.toUpperCase()} link!`,
        new_response: (type, res) => `💌 New response on your ${type.toUpperCase()} link!`,
        general_error: "⚠️ Sorry, an internal error occurred."
    }
};

// 🤖 ফ্রি AI টেক্সট জেনারেটর ইঞ্জিন ফাংশন
async function generateAiLetter(category, lang) {
    try {
        const prompts = {
            bn: `Write a short, highly emotional, touchy, beautiful message or letter in Bengali for the category: "${category}". Keep it under 100 words. Do not use any introductory or extra English text, just give the Bengali text.`,
            en: `Write a short, heart-touching, beautiful message or letter in English for the category: "${category}". Keep it under 80 words. Give only the core letter.`
        };
        const prompt = prompts[lang] || prompts['bn'];
        
        const response = await axios.get(`https://sandipbaruwal.onrender.com/gpt?prompt=${encodeURIComponent(prompt)}`);
        if (response.data && response.data.answer) {
            return response.data.answer.replace(/["']/g, "").trim();
        }
        return lang === 'bn' ? "আমি তোমাকে অনেক ভালোবাসি। তুমি আমার জীবনের সেরা পাওয়া।" : "I love you so much. You are the best part of my life.";
    } catch (e) {
        return lang === 'bn' ? "আমি তোমাকে অনেক ভালোবাসি। তুমি আমার জীবনের সেরা পাওয়া।" : "I love you so much. You are the best part of my life.";
    }
}

// 🧠 স্মার্ট মিনিট এক্সট্রাক্টর ফাংশন
function extractMinutes(input) {
    const cleanInput = input.trim().toLowerCase();
    const matches = cleanInput.match(/\d+/);
    if (!matches) return null;
    return parseInt(matches[0], 10);
}

// 🛡️ Security Middlewares
bot.use((ctx, next) => {
    try {
        const userId = ctx.chat ? ctx.chat.id : null;
        if (!userId) return next();
        if (Number(userId) === Number(ADMIN_CHAT_ID)) return next();
        if (isMaintenanceMode) {
            const lang = userLanguages[userId] || 'bn';
            return ctx.reply(locale[lang].maint_msg);
        }
        if (bannedUsers.has(userId)) return; 
        return next();
    } catch (err) {
        console.error("Middleware Error:", err);
    }
});

// 📌 Core Command Orchestrations
bot.command('start', (ctx) => { 
    try {
        registeredUsers.add(ctx.chat.id); 
        sendMainMenu(ctx, false); 
    } catch (err) { console.error(err); }
});

bot.command('cancel', (ctx) => {
    try {
        const userId = ctx.chat.id;
        const lang = userLanguages[userId] || 'bn';
        if (userSessions[userId]) {
            delete userSessions[userId];
            ctx.reply(locale[lang].session_cancelled);
            sendMainMenu(ctx, false);
        } else { 
            ctx.reply(locale[lang].no_session); 
        }
    } catch (err) { console.error(err); }
});

// Admin Control Panel
const handleAdminConsole = (ctx) => {
    if (Number(ctx.chat.id) !== Number(ADMIN_CHAT_ID)) return;
    ctx.reply("👑 **Welcome to the Master Admin Core Console:**", Markup.inlineKeyboard([
        [Markup.button.callback("📊 System Status", "admin_stats"), Markup.button.callback("📢 Global Broadcast", "admin_broadcast")],
        [Markup.button.callback(isMaintenanceMode ? "🟢 Live Mode" : "🚧 Maint Mode", "admin_toggle_maint")],
        [Markup.button.callback("🚫 Ban Management", "admin_ban_menu"), Markup.button.callback("📜 View Logs", "admin_view_logs")]
    ]));
};
bot.command('admin', handleAdminConsole);
bot.command('adm', handleAdminConsole);

bot.action('admin_stats', (ctx) => {
    if (Number(ctx.chat.id) !== Number(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    ctx.answerCbQuery();
    const activeLinks = Object.keys(linkDatabase).filter(k => linkDatabase[k].isActive).length;
    ctx.reply(`📊 **Metrics:**\n\nUsers: \`${registeredUsers.size}\`\nActive Links: \`${activeLinks}\` (Total: \`${totalLinksCreated}\`)\nCards: \`${totalCardsGenerated}\`\nFeedbacks: \`${totalFeedbacksReceived}\``);
});

bot.action('admin_toggle_maint', (ctx) => {
    if (Number(ctx.chat.id) !== Number(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    isMaintenanceMode = !isMaintenanceMode;
    ctx.answerCbQuery();
    ctx.reply(`⚙️ Maintenance Mode -> ${isMaintenanceMode ? 'ENABLED 🚧' : 'DISABLED 🟢'}`);
});

bot.action('admin_broadcast', (ctx) => {
    if (Number(ctx.chat.id) !== Number(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    ctx.answerCbQuery();
    userSessions[ctx.chat.id] = { step: 'AWAITING_ADMIN_BROADCAST_MSG' };
    ctx.reply("📢 Enter the broadcast transmission message:");
});

bot.action('admin_ban_menu', (ctx) => {
    if (Number(ctx.chat.id) !== Number(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    ctx.answerCbQuery();
    userSessions[ctx.chat.id] = { step: 'AWAITING_BAN_USER_ID' };
    ctx.reply("🚫 Send the Telegram Chat ID to BAN/UNBAN:");
});

bot.action('admin_view_logs', (ctx) => {
    if (Number(ctx.chat.id) !== Number(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    ctx.answerCbQuery();
    ctx.reply("📜 Logs: Engines running smoothly.");
});

// Language Routing
bot.action('menu_lang', (ctx) => {
    ctx.answerCbQuery();
    ctx.editMessageText("🌐 **Language / ভাষা:**", Markup.inlineKeyboard([
        [Markup.button.callback('🇧🇩 বাংলা', 'set_lang_bn'), Markup.button.callback('🇺🇸 English', 'set_lang_en')],
        [Markup.button.callback('🔙 Back', 'go_to_main_menu')]
    ]));
});
bot.action(/^set_lang_/, (ctx) => { 
    userLanguages[ctx.chat.id] = ctx.match.input.replace('set_lang_', ''); 
    ctx.answerCbQuery(); 
    sendMainMenu(ctx, true); 
});
bot.action('go_to_main_menu', (ctx) => { ctx.answerCbQuery(); sendMainMenu(ctx, true); });

// Link Creation Routing
bot.action('menu_makelink', (ctx) => {
    ctx.answerCbQuery();
    const lang = userLanguages[ctx.chat.id] || 'bn';
    ctx.editMessageText(locale[lang].choose_cat, Markup.inlineKeyboard([
        [Markup.button.callback(locale[lang].cat_love, 'make_love'), Markup.button.callback(locale[lang].cat_crush, 'make_crush')],
        [Markup.button.callback(locale[lang].cat_birthday, 'make_birthday'), Markup.button.callback(locale[lang].cat_anniversary, 'make_anniversary')],
        [Markup.button.callback(locale[lang].cat_newyear, 'make_newyear'), Markup.button.callback(locale[lang].cat_boishakh, 'make_boishakh')],
        [Markup.button.callback(locale[lang].cat_friend, 'make_friend'), Markup.button.callback(locale[lang].cat_eid, 'make_eid')],
        [Markup.button.callback(locale[lang].cat_sorry, 'make_sorry')],
        [Markup.button.callback(locale[lang].btn_back, 'go_to_main_menu')]
    ]));
});

bot.action(/^make_/, (ctx) => {
    ctx.answerCbQuery();
    userSessions[ctx.chat.id] = { type: ctx.match.input.replace('make_', ''), name: ctx.from.first_name || "User" };
    const lang = userLanguages[ctx.chat.id] || 'bn';
    ctx.editMessageText(locale[lang].prompt_countdown_ask, Markup.inlineKeyboard([
        [Markup.button.callback(locale[lang].btn_yes, 'timer_yes'), Markup.button.callback(locale[lang].btn_no, 'timer_no')]
    ]));
});

// 🕒 টাইম লক বাটন লেআউট
bot.action('timer_yes', (ctx) => {
    ctx.answerCbQuery();
    userSessions[ctx.chat.id].step = 'AWAITING_COUNTDOWN_TIME';
    const lang = userLanguages[ctx.chat.id] || 'bn';
    
    ctx.reply(locale[lang].prompt_time_input, Markup.inlineKeyboard([
        [Markup.button.callback(lang === 'bn' ? '🕒 ৩ মিনিট' : '🕒 3 Min', 'set_time_3'), Markup.button.callback(lang === 'bn' ? '🕒 ৫ মিনিট' : '🕒 5 Min', 'set_time_5')],
        [Markup.button.callback(lang === 'bn' ? '🕒 ১০ মিনিট' : '🕒 10 Min', 'set_time_10'), Markup.button.callback(lang === 'bn' ? '🕒 ২০ মিনিট' : '🕒 20 Min', 'set_time_20')]
    ], { parse_mode: 'Markdown' }));
});

bot.action(/^set_time_/, (ctx) => {
    ctx.answerCbQuery();
    const userId = ctx.chat.id;
    const session = userSessions[userId];
    if (!session || session.step !== 'AWAITING_COUNTDOWN_TIME') return;
    
    const minutes = parseInt(ctx.match.input.replace('set_time_', ''), 10);
    session.pendingMinutes = minutes;
    askThemeSelection(ctx);
});

bot.action('timer_no', (ctx) => { 
    ctx.answerCbQuery(); 
    userSessions[ctx.chat.id].pendingMinutes = null; 
    askThemeSelection(ctx); 
});

function askThemeSelection(ctx) {
    const lang = userLanguages[ctx.chat.id] || 'bn';
    ctx.reply(locale[lang].prompt_theme, Markup.inlineKeyboard([
        [Markup.button.callback('✨ Classic Pink', 'set_theme_classic'), Markup.button.callback('🌌 Neon Magic', 'set_theme_neon')],
        [Markup.button.callback('🎈 Birthday Gold', 'set_theme_gold'), Markup.button.callback('❤️ Dark Romance', 'set_theme_dark')]
    ]));
}

bot.action(/^set_theme_/, (ctx) => {
    ctx.answerCbQuery();
    userSessions[ctx.chat.id].theme = ctx.match.input.replace('set_theme_', '');
    const lang = userLanguages[ctx.chat.id] || 'bn';
    ctx.reply(locale[lang].prompt_music, Markup.inlineKeyboard([
        [Markup.button.callback('🎵 Romantic Flute', 'set_music_romantic'), Markup.button.callback('🎵 Soft Piano', 'set_music_piano')],
        [Markup.button.callback('🎵 Birthday Beats', 'set_music_birthday'), Markup.button.callback('🔇 No Music', 'set_music_none')]
    ]));
});

bot.action(/^set_music_/, (ctx) => {
    ctx.answerCbQuery();
    userSessions[ctx.chat.id].music = ctx.match.input.replace('set_music_', '');
    userSessions[ctx.chat.id].step = 'AWAITING_ANIMATION_TEXT';
    ctx.reply(locale[userLanguages[ctx.chat.id] || 'bn'].session_started(userSessions[ctx.chat.id].type), { parse_mode: 'Markdown' });
});

// Card & Demos & Stats Infrastructure
bot.action('menu_cardgen', (ctx) => { 
    ctx.answerCbQuery(); 
    userSessions[ctx.chat.id] = { step: 'AWAITING_CARD_NAME' }; 
    ctx.reply(locale[userLanguages[ctx.chat.id] || 'bn'].prompt_card_name); 
});

bot.action('menu_demo', (ctx) => { 
    ctx.answerCbQuery(); 
    const lang = userLanguages[ctx.chat.id] || 'bn';
    ctx.reply(locale[lang].demo_title, Markup.inlineKeyboard([
        [Markup.button.callback("❤️ Love Demo", "view_demo_love"), Markup.button.callback("🎂 Birthday Demo", "view_demo_birthday")],
        [Markup.button.callback("💖 Crush Demo", "view_demo_crush"), Markup.button.callback("🔙 Main Menu", "go_to_main_menu")]
    ])); 
});

bot.action(/^view_demo_/, (ctx) => { 
    ctx.answerCbQuery(); 
    const type = ctx.match.input.replace('view_demo_', '');
    const lang = userLanguages[ctx.chat.id] || 'bn';
    ctx.reply(locale[lang].demo_ready(type, `${SERVER_URL}/love/demo-preview?type=${type}`)); 
});

bot.action('menu_stats', (ctx) => {
    ctx.answerCbQuery();
    const userId = ctx.chat.id;
    const lang = userLanguages[userId] || 'bn';
    const userLinks = Object.keys(linkDatabase).filter(k => linkDatabase[k].userId === userId && linkDatabase[k].isActive);
    let listText = userLinks.length === 0 ? locale[lang].no_links : userLinks.map((id, i) => `${i+1}. \`${SERVER_URL}/love/${id}\` [${linkDatabase[id].type.toUpperCase()}]`).join('\n');
    ctx.reply(locale[lang].profile_report(ctx.from.first_name || "User", listText));
});

bot.action('menu_off', (ctx) => {
    ctx.answerCbQuery();
    const userId = ctx.chat.id;
    const lang = userLanguages[userId] || 'bn';
    const userLinks = Object.keys(linkDatabase).filter(k => linkDatabase[k].userId === userId && linkDatabase[k].isActive);
    if (userLinks.length === 0) return ctx.reply(locale[lang].no_links);
    const buttons = userLinks.map(id => [Markup.button.callback(`❌ Off: ${id}`, `deactivate_${id}`)]);
    buttons.push([Markup.button.callback(locale[lang].off_all_links, "deactivate_all_links")]);
    ctx.reply(locale[lang].off_link_title, Markup.inlineKeyboard(buttons));
});

bot.action('deactivate_all_links', (ctx) => {
    ctx.answerCbQuery();
    const userLinks = Object.keys(linkDatabase).filter(k => linkDatabase[k].userId === ctx.chat.id && linkDatabase[k].isActive);
    userLinks.forEach(id => { linkDatabase[id].isActive = false; });
    ctx.reply(locale[userLanguages[ctx.chat.id] || 'bn'].deactivate_success_all(userLinks.length));
    sendMainMenu(ctx, false);
});

bot.action(/^deactivate_/, (ctx) => {
    ctx.answerCbQuery();
    const id = ctx.match.input.replace('deactivate_', '');
    if (linkDatabase[id] && linkDatabase[id].userId === ctx.chat.id) {
        linkDatabase[id].isActive = false;
        ctx.reply(locale[userLanguages[ctx.chat.id] || 'bn'].deactivate_success_single(id));
    }
    sendMainMenu(ctx, false);
});

bot.action('menu_feedback', (ctx) => { 
    ctx.answerCbQuery(); 
    userSessions[ctx.chat.id] = { step: 'AWAITING_USER_FEEDBACK' }; 
    ctx.reply(locale[userLanguages[ctx.chat.id] || 'bn'].feedback_prompt); 
});

bot.action('menu_help', (ctx) => {
    ctx.answerCbQuery();
    const lang = userLanguages[ctx.chat.id] || 'bn';
    ctx.reply(locale[lang].help_text);
});


// 🤖 AI LETTER GENERATION ACTIONS & RE-WRITE/PREVIOUS LOGIC
bot.action('generate_ai_letter', async (ctx) => {
    ctx.answerCbQuery("🤖 AI চিঠি তৈরি করছে...");
    const userId = ctx.chat.id;
    const session = userSessions[userId];
    if (!session || session.step !== 'AWAITING_LETTER_TEXT') return;

    const lang = userLanguages[userId] || 'bn';
    
    if (!session.aiLettersHistory) {
        session.aiLettersHistory = [];
        session.currentHistoryIndex = -1;
    }

    const generatedText = await generateAiLetter(session.type, lang);
    
    session.aiLettersHistory.push(generatedText);
    session.currentHistoryIndex = session.aiLettersHistory.length - 1;
    session.tempAiLetter = generatedText; 

    // নতুন নোটিশ মেসেজে যুক্ত করা হলো (ইউজার চাইলে নিজেও লিখে দিতে পারবে)
    const promptMsg = lang === 'bn' 
        ? `🤖 **AI এর লেখা চিঠিটি নিচে দেওয়া হলো (সংস্করণ: ${session.currentHistoryIndex + 1}):**\n\n_"${generatedText}"_\n\n💡 **পরামর্শ:** আপনার যদি এটি পছন্দ না হয়, তবে আপনি চাইলে নিচের চ্যাটবক্সে **নিজের মতো করেও** যেকোনো চিঠি লিখে পাঠিয়ে দিতে পারেন।\n\nআপনার কি এটি পছন্দ হয়েছে?` 
        : `🤖 **Here is the AI generated letter (Version: ${session.currentHistoryIndex + 1}):**\n\n_"${generatedText}"_\n\n💡 **Tip:** If you don't like this, you can also write and send **your own custom letter** directly in the chat box.\n\nDo you like it?`;
    
    const buttons = [
        [Markup.button.callback(lang === 'bn' ? "✅ এটিই রাখব" : "✅ Keep this", "ai_letter_accept")],
        [Markup.button.callback(lang === 'bn' ? "🔄 পরিবর্তন করুন" : "🔄 Change/Regenerate", "generate_ai_letter")]
    ];

    if (session.aiLettersHistory.length > 1) {
        buttons.push([Markup.button.callback(lang === 'bn' ? "🔙 আগের চিঠি" : "🔙 Previous Letter", "ai_letter_previous")]);
    }

    try {
        await ctx.editMessageText(promptMsg, Markup.inlineKeyboard(buttons), { parse_mode: 'Markdown' });
    } catch (e) {
        await ctx.reply(promptMsg, Markup.inlineKeyboard(buttons), { parse_mode: 'Markdown' });
    }
});

bot.action('ai_letter_previous', async (ctx) => {
    const userId = ctx.chat.id;
    const session = userSessions[userId];
    if (!session || !session.aiLettersHistory || session.currentHistoryIndex <= 0) {
        return ctx.answerCbQuery(userLanguages[userId] === 'bn' ? "❌ এর আগে আর কোনো চিঠি নেই!" : "❌ No previous letters found!");
    }

    ctx.answerCbQuery("🔙 আগের চিঠিতে ফিরে যাওয়া হচ্ছে...");
    const lang = userLanguages[userId] || 'bn';

    session.currentHistoryIndex--;
    const previousText = session.aiLettersHistory[session.currentHistoryIndex];
    session.tempAiLetter = previousText; 

    const promptMsg = lang === 'bn' 
        ? `🤖 **AI এর লেখা চিঠিটি নিচে দেওয়া হলো (সংস্করণ: ${session.currentHistoryIndex + 1}):**\n\n_"${previousText}"_\n\n💡 **পরামর্শ:** আপনার যদি এটি পছন্দ না হয়, তবে আপনি চাইলে নিচের চ্যাটবক্সে **নিজের মতো করেও** যেকোনো চিঠি লিখে পাঠিয়ে দিতে পারেন।\n\nআপনার কি এটি পছন্দ হয়েছে?` 
        : `🤖 **Here is the AI generated letter (Version: ${session.currentHistoryIndex + 1}):**\n\n_"${previousText}"_\n\n💡 **Tip:** If you don't like this, you can also write and send **your own custom letter** directly in the chat box.\n\nDo you like it?`;

    const buttons = [
        [Markup.button.callback(lang === 'bn' ? "✅ এটিই রাখ করব" : "✅ Keep this", "ai_letter_accept")],
        [Markup.button.callback(lang === 'bn' ? "🔄 পরিবর্তন করুন" : "🔄 Change/Regenerate", "generate_ai_letter")]
    ];

    if (session.currentHistoryIndex > 0) {
        buttons.push([Markup.button.callback(lang === 'bn' ? "🔙 আগের চিঠি" : "🔙 Previous Letter", "ai_letter_previous")]);
    }

    await ctx.editMessageText(promptMsg, Markup.inlineKeyboard(buttons), { parse_mode: 'Markdown' }).catch(()=>{});
});

bot.action('ai_letter_accept', (ctx) => {
    ctx.answerCbQuery();
    const userId = ctx.chat.id;
    const session = userSessions[userId];
    if (!session || !session.tempAiLetter) return;

    ctx.deleteMessage().catch(()=>{});
    processFinalLinkCreation(ctx, session.tempAiLetter);
});


// 🎯 State Machine & Text Processing Engine
bot.on('text', (ctx) => {
    const userId = ctx.chat.id;
    const session = userSessions[userId];
    const text = ctx.message.text.trim();
    const lang = userLanguages[userId] || 'bn';

    if (text.startsWith('/')) return;

    if (!session) {
        ctx.reply(locale[lang].invalid_cmd(text), { parse_mode: 'Markdown' });
        sendMainMenu(ctx, false);
        return;
    }

    try {
        if (Number(userId) === Number(ADMIN_CHAT_ID)) {
            if (session.step === 'AWAITING_ADMIN_BROADCAST_MSG') {
                registeredUsers.forEach(id => bot.telegram.sendMessage(id, `📢 **[Announcement]**\n\n${text}`, { parse_mode: 'Markdown' }).catch(()=>{}));
                ctx.reply("📡 Broadcast distribution cycle finished.");
                delete userSessions[userId]; return;
            }
            if (session.step === 'AWAITING_BAN_USER_ID') {
                const targetId = parseInt(text, 10);
                if (isNaN(targetId)) return ctx.reply("❌ Invalid Chat ID. Please send a numeric ID.");
                if (bannedUsers.has(targetId)) { bannedUsers.delete(targetId); ctx.reply("🟢 Target Unbanned successfully."); }
                else { bannedUsers.add(targetId); ctx.reply("🚫 Target Banned successfully."); }
                delete userSessions[userId]; return;
            }
        }

        if (session.step === 'AWAITING_USER_FEEDBACK') {
            if (text.length < 5) return ctx.reply(locale[lang].feedback_short);
            totalFeedbacksReceived++;
            bot.telegram.sendMessage(ADMIN_CHAT_ID, `📝 Feedback from User ${userId}:\n\n${text}`).catch(()=>{});
            ctx.reply(locale[lang].feedback_success);
            delete userSessions[userId]; sendMainMenu(ctx, false); return;
        }

        if (session.step === 'AWAITING_CARD_NAME') {
            totalCardsGenerated++; 
            ctx.reply(locale[lang].card_ready);
            ctx.replyWithPhoto({ url: `https://dummyimage.com/600x400/ff4b72/fff.png&text=${encodeURIComponent(text)}` }).catch(()=>{});
            delete userSessions[userId]; sendMainMenu(ctx, false); return;
        }

        if (session.step === 'AWAITING_COUNTDOWN_TIME') {
            const parsedMinutes = extractMinutes(text);

            if (parsedMinutes === null || isNaN(parsedMinutes)) {
                return ctx.reply(locale[lang].invalid_time, { parse_mode: 'Markdown' });
            }
            if (parsedMinutes < 1) {
                return ctx.reply(locale[lang].time_past, { parse_mode: 'Markdown' });
            }
            if (parsedMinutes > 100) {
                return ctx.reply(locale[lang].max_time_exceeded, { parse_mode: 'Markdown' });
            }

            session.pendingMinutes = parsedMinutes; 
            askThemeSelection(ctx);
            return;
        }

        if (session.step === 'AWAITING_ANIMATION_TEXT') {
            session.animations = text.split(/[\n,，]+/)
                                     .map(l => l.trim())
                                     .filter(l => l.length > 0);

            if (session.animations.length === 0) {
                return ctx.reply("⚠️ অনুগ্রহ করে অন্তত একটি অ্যানিমেশন টেক্সট লিখুন বা কমা দিয়ে আলাদা করুন।");
            }
            session.step = 'AWAITING_LETTER_TEXT';
            
            ctx.reply(locale[lang].input_anim_success(session.animations.length), Markup.inlineKeyboard([
                [Markup.button.callback(lang === 'bn' ? "🤖 AI দিয়ে চিঠি লিখুন" : "🤖 Write Letter with AI", "generate_ai_letter")]
            ]));
            return;
        }

        if (session.step === 'AWAITING_LETTER_TEXT') {
            processFinalLinkCreation(ctx, text);
            return;
        }

        ctx.reply(locale[lang].invalid_cmd(text), { parse_mode: 'Markdown' });

    } catch (error) {
        console.error("Critical Runtime Error:", error);
        ctx.reply(locale[lang].general_error);
    }
});

// ফাইনাল লিঙ্ক তৈরির কমন ফাংশন
function processFinalLinkCreation(ctx, letterText) {
    const userId = ctx.chat.id;
    const session = userSessions[userId];
    const lang = userLanguages[userId] || 'bn';

    totalLinksCreated++;
    
    let finalCountdownIso = null;
    if (session.pendingMinutes) {
        const targetDate = new Date();
        targetDate.setMinutes(targetDate.getMinutes() + session.pendingMinutes);
        finalCountdownIso = targetDate.toISOString();
    }

    const uniqueId = Math.random().toString(36).substring(2, 9);
    linkDatabase[uniqueId] = {
        userId: userId, name: session.name, type: session.type,
        theme: session.theme, music: session.music, countdown: finalCountdownIso,
        animations: session.animations, letter: letterText, isActive: true
    };
    
    ctx.reply(locale[lang].link_ready(`${SERVER_URL}/love/${uniqueId}`));
    delete userSessions[userId];
}

function sendMainMenu(ctx, isEdit = false) {
    try {
        const userId = ctx.chat.id;
        const lang = userLanguages[userId] || 'bn';
        const text = locale[lang].welcome(ctx.from?.first_name || "User");
        const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback(locale[lang].btn_make, 'menu_makelink'), Markup.button.callback(locale[lang].btn_card, 'menu_cardgen')],
            [Markup.button.callback(locale[lang].btn_demo, 'menu_demo'), Markup.button.callback(locale[lang].btn_stats, 'menu_stats')],
            [Markup.button.callback(locale[lang].btn_off, 'menu_off'), Markup.button.callback(locale[lang].btn_feedback, 'menu_feedback')],
            [Markup.button.callback(locale[lang].btn_help, 'menu_help'), Markup.button.callback(locale[lang].btn_lang, 'menu_lang')]
        ]);
        if (isEdit) return ctx.editMessageText(text, keyboard).catch(()=>{});
        return ctx.reply(text, keyboard);
    } catch (err) { console.error(err); }
}

// 🌐 Web Content Distribution Routing API 
app.get('/love/:id', (req, res) => { res.sendFile(path.join(__dirname, 'index.html')); });

app.post('/api/get-content', (req, res) => {
    try {
        const { id } = req.body;
        if (!id) return res.json({ success: false });
        if (id.startsWith('demo-preview')) return res.json({ success: true, isLocked: false, theme: 'neon', music: 'none', animations: ["Demo Line 1", "Demo Line 2"], letter: "This is placeholder preview letter." });
        
        const data = linkDatabase[id];
        if (!data || !data.isActive) return res.json({ success: false });

        const lang = userLanguages[data.userId] || 'bn';
        const formattedTime = new Date().toLocaleTimeString();
        bot.telegram.sendMessage(data.userId, locale[lang].someone_opened(data.type, formattedTime)).catch(()=>{});

        if (data.countdown) {
            const now = new Date();
            const lockTime = new Date(data.countdown);
            if (lockTime > now) {
                return res.json({ success: true, isLocked: true, countdownTime: data.countdown, theme: data.theme });
            }
        }
        
        return res.json({ success: true, isLocked: false, theme: data.theme, music: data.music, animations: data.animations, letter: data.letter });
    } catch (err) {
        console.error("Get Content API Error:", err);
        res.json({ success: false });
    }
});

app.post('/api/respond', (req, res) => {
    try {
        const { response, id } = req.body;
        const data = linkDatabase[id];
        if (data && data.isActive) {
            const lang = userLanguages[data.userId] || 'bn';
            bot.telegram.sendMessage(data.userId, locale[lang].new_response(data.type, response)).catch(()=>{});
            return res.json({ success: true });
        }
        res.json({ success: false });
    } catch (err) {
        res.json({ success: false });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { bot.launch(); console.log(`Engines configured. Port: ${PORT}`); });
