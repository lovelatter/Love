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
const ADMIN_CHAT_ID = 6719885052; // Number ফরম্যাটে ফিক্স করা হয়েছে যেন এডমিন কমান্ড কাজ করে

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

// 🌐 Multi-Language Messages Comprehensive Dictionary
const locale = {
    bn: {
        welcome: (name) => `💝 **হ্যালো ${name}!** 💝\n\nবটের পক্ষ থেকে स्वागतম। আপনার প্রিয়জনের জন্য আকর্ষণীয় টাইম লক করা ওয়েব লিঙ্ক তৈরি করুন একদম ফ্রিতে।\n\nনিচের যেকোনো একটি অপশন সিলেক্ট করুন:`,
        btn_make: "🚀 লিঙ্ক তৈরি করুন", btn_card: "🖼️ উইশ কার্ড বানান", btn_demo: "👀 ডেমো দেখুন", btn_stats: "📊 স্ট্যাটাস", btn_off: "🔒 লিঙ্ক বন্ধ করুন", btn_feedback: "📝 মতামত", btn_help: "❓ সাহায্য", btn_lang: "🌐 ভাষা পরিবর্তন", btn_back: "🔙 মেইন মেনু",
        choose_cat: "✨ **আপনি কোন ক্যাটাগরির লিঙ্ক তৈরি করতে চান?**",
        cat_love: "❤️ প্রেমের চিঠি", cat_crush: "💖 ক্রাশ কনфেশন", cat_birthday: "🎂 জন্মদিনের শুভেচ্ছা", cat_anniversary: "💍 বিবাহবার্ষিকী", cat_newyear: "🎉 নতুন বছর", cat_boishakh: "🌾 পহেলা বৈশাখ", cat_friend: "🫂 সেরা বন্ধু", cat_eid: "🌙 ঈদ মোবারক", cat_sorry: "🥺 দুঃখ প্রকাশ",
        prompt_countdown_ask: "⏰ **আপনি কি এই লিঙ্কে নির্দিষ্ট টাইম লক (Time Lock) সেট করতে চান?**\n\n(টাইম সেট করলে আপনার দেওয়া সময়ের আগে কেউ লিঙ্কের ভেতরের চিঠি দেখতে পারবে না।)",
        btn_yes: "✅ হ্যাঁ, চাই", btn_no: "❌ না, লাগবে না",
        prompt_time_input: "⏳ অনুগ্রহ করে লিঙ্কটি খোলার সময়টি নিচের নিয়মে লিখে পাঠান:\n\nFormat: \`HH:MM AM/PM\`\nExample: \`12:10 PM\` অথবা \`08:15 PM\`\n\n⚠️ **শর্ত:** আপনি বর্তমান সময় থেকে সর্বোচ্চ আগামী **২ ঘণ্টার মধ্যে** যেকোনো সময় সেট করতে পারবেন।",
        invalid_time: "❌ **ভুল ফরম্যাট বা সময়!**\n\nঅনুগ্রহ করে এভাবে লিখুন: \`12:10 PM\` বা \`08:05 AM\`\n\n⚠️ মিনিট ১ ডিজিটের হলে আগে ০ দিন (যেমন: \`12:8 PM\` না লিখে \`12:08 PM\` লিখুন)। AM/PM দেওয়া বাধ্যতামূলক।",
        max_time_exceeded: "⚠️ **সীমা বহির্ভূত সময়!**\n\nআপনি বর্তমান সময় থেকে ২ ঘণ্টার বেশি দূরের সময় সেট করতে পারবেন না। অনুগ্রহ করে আপনার দেশের ঘড়ি অনুযায়ী আগামী ২ ঘণ্টার ভেতরের কোনো সময় দিন।",
        time_past: "❌ আপনি অতীতের কোনো সময় সেট করতে পারবেন না। বর্তমান বা ভবিষ্যৎ সময় দিন।",
        prompt_theme: "🎨 **একটি প্রিমিয়াম ওয়েব থিম সিলেক্ট করুন:**",
        prompt_music: "🎵 **একটি ব্যাকগ্রাউন্ড মিউজিক সিলেক্ট করুন:**",
        prompt_card_name: "🖼️ উইশ কার্ডে কার নাম লিখতে চান? নামটি লিখে পাঠান:",
        card_ready: "✨ **আপনার প্রিমিয়াম উইশ কার্ডটি তৈরি হয়ে গেছে!** 👇",
        help_text: `❓ **সাহায্য গাইড:**\n\n১. **লিঙ্ক তৈরি:** প্রথমে '🚀 লিঙ্ক তৈরি করুন' বাটনে ক্লিক করে আপনার পছন্দমতো ক্যাটাগরি বেছে নিন। এরপর ২ ঘণ্টার লিমিটের মধ্যে যেকোনো সময় (যেমন: 12:10 PM) ইনপুট দিন।\n২. **ডাইনামিক কাউন্টডাউন:** আপনি বটের ভেতর নরমাল টাইম সেট করলেও, ইউজার যখন লিঙ্কে ঢুকবে সে সেখানে লাইভ সেকেন্ডসহ রিয়েল-টাইম কাউন্টডাউন দেখতে পাবে।\n৩. **লিঙ্ক বন্ধ করা:** যেকোনো সময় আপনার তৈরি করা লিঙ্ক নিষ্ক্রিয় করতে '🔒 লিঙ্ক বন্ধ করুন' অপশনটি ব্যবহার করুন।\n\n💡 যেকোনো সমস্যায় এডমিনের সাথে যোগাযোগ করুন।`,
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
        session_started: (cat) => `✨ আপনার কাস্টম \`${cat.toUpperCase()}\` লিঙ্ক তৈরির সেশন শুরু হয়েছে!\n\n👉 প্রথমে অ্যানিমেশন টেক্সটগুলো পাঠান (একের অধিক লাইন হলে প্রতি লাইনের পর এন্টার বা নতুন লাইন ব্যবহার করুন)।`,
        demo_title: "👀 **আপনি কোন ডেমো পেজটি দেখতে চান? নিচে সিলেক্ট করুন:**",
        demo_ready: (type, url) => `✨ **আপনার অনুরোধ করা ডেমো লিঙ্কটি তৈরি!**\n\n🔗 ডেমো লিঙ্ক: ${url}`,
        input_anim_success: (count) => `✅ চমৎকার! আপনি ${count} লাইনের অ্যানিমেশন যোগ করেছেন।\n\n💌 এবার খামের ভেতরের মূল চিঠি বা উইশ মেসেজটি লিখে পাঠান:`,
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
        prompt_countdown_ask: "⏰ **Do you want to set a Time Lock for this link?**\n\n(If set, no one can view the inner content before the specified time.)",
        btn_yes: "✅ Yes", btn_no: "❌ No",
        prompt_time_input: "⏳ Send the lock release time in this exact format:\n\nFormat: \`HH:MM AM/PM\`\nExample: \`12:10 PM\` or \`08:15 PM\`\n\n⚠️ **Rule:** Max limit is within **2 hours** from current time.",
        invalid_time: "❌ **Invalid Format or Time!**\n\nPlease follow: \`12:10 PM\` or \`08:05 AM\`\n\n⚠️ If minutes are single digit, add a leading zero (e.g., write \`12:08 PM\` instead of \`12:8 PM\`). AM/PM is mandatory.",
        max_time_exceeded: "⚠️ **Limit Exceeded!**\n\nYou cannot set a time further than 2 hours from now. Please provide a time within the next 2 hours based on your device clock.",
        time_past: "❌ You cannot set a past time.",
        prompt_theme: "🎨 **Select a Premium Web Theme (Free):**",
        prompt_music: "🎵 **Select a Background Music (Free):**",
        prompt_card_name: "🖼️ Enter the name you want to print on the Wish Card:",
        card_ready: "✨ **Your premium Wish Card is ready!** 👇",
        help_text: `❓ **Help Guide:**\n\n1. **Link Creation:** Click '🚀 Make Link', pick a category, and enter a time within a 2-hour limit (e.g., 12:10 PM).\n2. **Dynamic Countdown:** Even though you input standard time, users visiting the link will see a real-time countdown with seconds.\n3. **Deactivation:** Turn off any link anytime using '🔒 Off Link'.\n\n💡 Contact admin for support.`,
        feedback_prompt: "📝 Please send your feedback:",
        feedback_short: "❌ Please write more details (min 5 characters).",
        feedback_success: "✅ Feedback submitted! Thank you.",
        session_cancelled: "❌ Your active session has been cancelled.",
        no_session: "💡 You don't have any active session.",
        invalid_cmd: (cmd) => `❌ **Invalid input:** \`${cmd}\` is not recognized. Please use the menu below or send /cancel to stop current session.`,
        maint_msg: "🚧 **Bot is under maintenance!** We will be back shortly.",
        no_links: "❌ You haven't created any links yet.",
        profile_report: (name, list) => `📊 **Your Profile:**\n\n👤 Name: ${name}\n🎫 Your Active Links:\n${list}`,
        off_link_title: "🔒 **Select link to deactivate:**",
        off_all_links: "❌ Off All Links",
        deactivate_success_all: (count) => `✅ Deactivated all (\`${count}\`) links!`,
        deactivate_success_single: (id) => `✅ Deactivated link (\`${id}\`).`,
        link_not_found: "❌ Link not found.",
        session_started: (cat) => `✨ Custom ${cat.toUpperCase()} Link started! Send animation texts (use new lines for multiple lines):`,
        demo_title: "👀 **Select demo page:**",
        demo_ready: (type, url) => `✨ **Demo Link:** ${url}`,
        input_anim_success: (count) => `✅ Added ${count} lines. Send main letter:`,
        link_ready: (url) => `💝 Link Ready:\n\n${url}\n\n👉 Share this link with your loved one.`,
        someone_opened: (type, time) => `👀 **Notification:** Someone opened your ${type.toUpperCase()} link!\n⏰ **Time:** ${time}`,
        new_response: (type, res) => `💌 New response on your ${type.toUpperCase()} link!\n\nAnswer: ${res}`,
        general_error: "⚠️ Sorry, an internal error occurred. Please try again or type /cancel to restart."
    }
};

// 🛡️ Security Middlewares & Multi-User Layer
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

// 👑 Admin Panel Infrastructure (ফিক্সড)
bot.command('admin', (ctx) => {
    if (Number(ctx.chat.id) !== Number(ADMIN_CHAT_ID)) return;
    ctx.reply("👑 **Welcome to the Master Admin Core Console:**", Markup.inlineKeyboard([
        [Markup.button.callback("📊 System Status", "admin_stats"), Markup.button.callback("📢 Global Broadcast", "admin_broadcast")],
        [Markup.button.callback(isMaintenanceMode ? "🟢 Live Mode" : "🚧 Maint Mode", "admin_toggle_maint")],
        [Markup.button.callback("🚫 Ban Management", "admin_ban_menu"), Markup.button.callback("📜 View Logs", "admin_view_logs")]
    ]));
});

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

bot.action('timer_yes', (ctx) => {
    ctx.answerCbQuery();
    userSessions[ctx.chat.id].step = 'AWAITING_COUNTDOWN_TIME';
    ctx.reply(locale[userLanguages[ctx.chat.id] || 'bn'].prompt_time_input, { parse_mode: 'Markdown' });
});

bot.action('timer_no', (ctx) => { 
    ctx.answerCbQuery(); 
    userSessions[ctx.chat.id].countdown = null; 
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
    ctx.reply(locale[userLanguages[ctx.chat.id] || 'bn'].session_started(userSessions[ctx.chat.id].type));
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

// 🎯 State Machine & Universal Validation Router (স্মার্ট এরর রিপ্লাই সহ)
bot.on('text', (ctx) => {
    const userId = ctx.chat.id;
    const session = userSessions[userId];
    const text = ctx.message.text.trim();
    const lang = userLanguages[userId] || 'bn';

    if (text.startsWith('/')) return;

    // 🛑 যদি ইউজারের কোনো সেশন না থাকে এবং সে ভুলভাল টেক্সট লেখে
    if (!session) {
        ctx.reply(locale[lang].invalid_cmd(text), { parse_mode: 'Markdown' });
        sendMainMenu(ctx, false);
        return;
    }

    try {
        // Admin Processors
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

        // 🕒 সম্পূর্ণ গ্লোবাল এবং ডায়নামিক "ইউজার টাইমজোন" প্রুফ ইঞ্জিন (ফিক্সড RegEx)
        if (session.step === 'AWAITING_COUNTDOWN_TIME') {
            // RegEx মডিফাই করা হয়েছে যাতে স্পেস এবং ছোট/বড় হাতের অক্ষরের কোনো সমস্যা না হয় (যেমন: 12:25am)
            const timeRegex = /^(\d{1,2})\s*:\s*(\d{1,2})\s*(AM|PM)$/i;
            const match = text.match(timeRegex);

            if (!match) {
                return ctx.reply(locale[lang].invalid_time, { parse_mode: 'Markdown' });
            }

            let [_, hours, minutes, ampm] = match;
            hours = parseInt(hours, 10);
            minutes = parseInt(minutes, 10);
            ampm = ampm.toUpperCase();

            if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) {
                return ctx.reply(locale[lang].invalid_time, { parse_mode: 'Markdown' });
            }

            const msgDateSeconds = ctx.message.date; 
            const serverNow = new Date();
            const userNow = new Date(msgDateSeconds * 1000); 

            const targetDate = new Date(userNow);
            let targetHours = hours;
            if (ampm === 'PM' && hours !== 12) targetHours += 12;
            if (ampm === 'AM' && hours === 12) targetHours = 0;

            targetDate.setHours(targetHours, minutes, 0, 0);

            // ৫ মিনিটের বাফার রাখা হয়েছে টাইপিং সময়ের সুবিধার জন্য
            if (targetDate.getTime() < userNow.getTime() - (5 * 60 * 1000)) { 
                targetDate.setDate(targetDate.getDate() + 1);
            }

            const diffMs = targetDate.getTime() - userNow.getTime();
            const maxLimitMs = 2 * 60 * 60 * 1000; 

            if (diffMs > maxLimitMs) {
                return ctx.reply(locale[lang].max_time_exceeded, { parse_mode: 'Markdown' });
            }

            const timeDifferenceWithServer = serverNow.getTime() - userNow.getTime();
            const finalServerTargetDate = new Date(targetDate.getTime() + timeDifferenceWithServer);

            session.countdown = finalServerTargetDate.toISOString(); 
            
            askThemeSelection(ctx);
            return;
        }

        if (session.step === 'AWAITING_ANIMATION_TEXT') {
            session.animations = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
            if (session.animations.length === 0) {
                return ctx.reply("⚠️ অনুগ্রহ করে অন্তত এক লাইন অ্যানিমেশন টেক্সট লিখুন।");
            }
            session.step = 'AWAITING_LETTER_TEXT';
            ctx.reply(locale[lang].input_anim_success(session.animations.length));
            return;
        }

        if (session.step === 'AWAITING_LETTER_TEXT') {
            totalLinksCreated++;
            const uniqueId = Math.random().toString(36).substring(2, 9);
            linkDatabase[uniqueId] = {
                userId: userId, name: session.name, type: session.type,
                theme: session.theme, music: session.music, countdown: session.countdown,
                animations: session.animations, letter: text, isActive: true
            };
            ctx.reply(locale[lang].link_ready(`${SERVER_URL}/love/${uniqueId}`));
            delete userSessions[userId];
            return;
        }

        // সেশন রানিং থাকা অবস্থায় যদি অন্য কোনো অদ্ভুত টেক্সট আসে
        ctx.reply(locale[lang].invalid_cmd(text), { parse_mode: 'Markdown' });

    } catch (error) {
        console.error("Critical Universal Runtime Handled Error:", error);
        ctx.reply(locale[lang].general_error);
    }
});

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

// 🌐 Web UI Engine API Integration
app.get('/love/:id', (req, res) => { res.sendFile(path.join(__dirname, 'index.html')); });

app.post('/api/get-content', (req, res) => {
    try {
        const { id } = req.body;
        if (!id) return res.json({ success: false });
        if (id.startsWith('demo-preview')) return res.json({ success: true, isLocked: false, theme: 'neon', music: 'none', animations: ["Demo Line 1", "Demo Line 2"], letter: "This is a placeholder demo preview message body." });
        
        const data = linkDatabase[id];
        if (!data || !data.isActive) return res.json({ success: false });

        const lang = userLanguages[data.userId] || 'bn';
        const formattedTime = new Date().toLocaleTimeString();
        bot.telegram.sendMessage(data.userId, locale[lang].someone_opened(data.type, formattedTime)).catch(()=>{});

        if (data.countdown) {
            const now = new Date();
            if (new Date(data.countdown) > now) {
                return res.json({ success: true, isLocked: true, countdownTime: data.countdown, theme: data.theme });
            }
        }
        res.json({ success: true, isLocked: false, theme: data.theme, music: data.music, animations: data.animations, letter: data.letter });
    } catch (err) {
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
app.listen(PORT, () => { bot.launch(); console.log(`Core Bot System operational on port: ${PORT}`); });
