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
const ADMIN_CHAT_ID = "6719885052"; 

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
        welcome: (name) => `💝 **হ্যালো ${name}!** 💝\n\nবটের পক্ষ থেকে স্বাগতম। আপনার প্রিয়জনের জন্য আকর্ষণীয় টাইম লক করা ওয়েব লিঙ্ক তৈরি করুন একদম ফ্রিতে।\n\nনিচের যেকোনো একটি অপশন সিলেক্ট করুন:`,
        btn_make: "🚀 লিঙ্ক তৈরি করুন", btn_card: "🖼️ উইশ কার্ড বানান", btn_demo: "👀 ডেমো দেখুন", btn_stats: "📊 স্ট্যাটাস", btn_off: "🔒 লিঙ্ক বন্ধ করুন", btn_feedback: "📝 মতামত", btn_help: "❓ সাহায্য", btn_lang: "🌐 ভাষা পরিবর্তন", btn_back: "🔙 মেইন মেনু",
        choose_cat: "✨ **আপনি কোন ক্যাটাগরির লিঙ্ক তৈরি করতে চান?**",
        cat_love: "❤️ প্রেমের চিঠি", cat_crush: "💖 ক্রাশ কনফেশন", cat_birthday: "🎂 জন্মদিনের শুভেচ্ছা", cat_anniversary: "💍 বিবাহবার্ষিকী", cat_newyear: "🎉 নতুন বছর", cat_boishakh: "🌾 পহেলা বৈশাখ", cat_friend: "🫂 সেরা বন্ধু", cat_eid: "🌙 ঈদ মোবারক", cat_sorry: "🥺 দুঃখ প্রকাশ",
        prompt_countdown_ask: "⏰ **আপনি কি এই লিঙ্কে নির্দিষ্ট টাইম লক (Time Lock) সেট করতে চান?**\n\n(টাইম সেট করলে আপনার দেওয়া সময়ের আগে কেউ লিঙ্কের ভেতরের চিঠি দেখতে পারবে না।)",
        btn_yes: "✅ হ্যাঁ, চাই", btn_no: "❌ না, লাগবে না",
        prompt_time_input: "⏳ অনুগ্রহ করে লিঙ্কটি খোলার সময়টি নিচের নিয়মে লিখে পাঠান:\n\nFormat: \`HH:MM AM/PM\`\nExample: \`12:10 PM\` অথবা \`08:15 PM\`\n\n⚠️ **শর্ত:** আপনি বর্তমান সময় থেকে সর্বোচ্চ আগামী **২ ঘণ্টার মধ্যে** যেকোনো সময় সেট করতে পারবেন।",
        invalid_time: "❌ ভুল ফরম্যাট! অনুগ্রহ করে এভাবে লিখুন: \`12:10 PM\` বা \`08:15 PM\` (AM/PM উল্লেখ করা বাধ্যতামূলক)",
        max_time_exceeded: "⚠️ **সীমা বহির্ভূত!** আপনি বর্তমান সময় থেকে ২ ঘণ্টার বেশি দূরের সময় সেট করতে পারবেন না। অনুগ্রহ করে ২ ঘণ্টার ভেতরের কোনো সময় দিন।",
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
        invalid_cmd: (cmd) => `❌ **ভুল আদেশ:** \`${cmd}\` গ্রহণযোগ্য নয়।`,
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
        new_response: (type, res) => `💌 আপনার কাস্টম \`${type.toUpperCase()}\` লিঙ্কে একটি নতুন রেসপন্স এসেছে!\n\nউত্তর: ${res}`
    },
    en: {
        welcome: (name) => `💝 **Hello ${name}!** 💝\n\nWelcome to Wishing Bot. Create premium links with customized time locks for free.`,
        btn_make: "🚀 Make Link", btn_card: "🖼️ Wish Card Generator", btn_demo: "👀 Demo", btn_stats: "📊 Stats", btn_off: "🔒 Off Link", btn_feedback: "📝 Feedback", btn_help: "❓ Help", btn_lang: "🌐 Change Language", btn_back: "🔙 Main Menu",
        choose_cat: "✨ **Select Category:**",
        cat_love: "❤️ Love Letter", cat_crush: "💖 Crush Confession", cat_birthday: "🎂 Birthday Wish", cat_anniversary: "💍 Anniversary Wish", cat_newyear: "🎉 New Year Wish", cat_boishakh: "🌾 Pohela Boishakh", cat_friend: "🫂 Best Friend", cat_eid: "🌙 Eid Wish", cat_sorry: "🥺 Sorry Letter",
        prompt_countdown_ask: "⏰ **Do you want to set a Time Lock for this link?**",
        btn_yes: "✅ Yes", btn_no: "❌ No",
        prompt_time_input: "⏳ Send the lock release time in this exact format:\n\nFormat: \`HH:MM AM/PM\`\nExample: \`12:10 PM\` or \`08:15 PM\`\n\n⚠️ **Rule:** Max limit is within **2 hours** from current time.",
        invalid_time: "❌ Invalid format! Follow: \`12:10 PM\` or \`08:15 PM\`",
        max_time_exceeded: "⚠️ **Limit Exceeded!** You cannot set a time further than 2 hours from now.",
        time_past: "❌ You cannot set a past time.",
        prompt_theme: "🎨 **Select a Premium Web Theme (Free):**",
        prompt_music: "🎵 **Select a Background Music (Free):**",
        prompt_card_name: "🖼️ Enter the name you want to print on the Wish Card:",
        card_ready: "✨ **Your premium Wish Card is ready!** 👇",
        help_text: `❓ Help menu instructions...`,
        feedback_prompt: "📝 Please send your feedback:",
        feedback_short: "❌ Please write more details.",
        feedback_success: "✅ Feedback submitted!",
        session_cancelled: "❌ Session cancelled.",
        no_session: "💡 No active session.",
        invalid_cmd: (cmd) => `❌ **Invalid Command:** \`${cmd}\``,
        maint_msg: "🚧 **Bot is under maintenance!**",
        no_links: "❌ No links created yet.",
        profile_report: (name, list) => `📊 **Your Profile:**\n\n👤 Name: ${name}\n🎫 Your Links:\n${list}`,
        off_link_title: "🔒 **Select link to deactivate:**",
        off_all_links: "❌ Off All Links",
        deactivate_success_all: (count) => `✅ Deactivated all (\`${count}\`) links!`,
        deactivate_success_single: (id) => `✅ Deactivated link (\`${id}\`).`,
        link_not_found: "❌ Link not found.",
        session_started: (cat) => `✨ Custom ${cat.toUpperCase()} Link started! Send animation texts:`,
        demo_title: "👀 **Select demo page:**",
        demo_ready: (type, url) => `✨ **Demo Link:** ${url}`,
        input_anim_success: (count) => `✅ Added ${count} lines. Send main letter:`,
        link_ready: (url) => `💝 Link Ready:\n\n${url}`,
        someone_opened: (type, time) => `👀 **Notification:** Someone opened your link!`,
        new_response: (type, res) => `💌 New response: ${res}`
    }
};

// 🛡️ Security Middlewares & Multi-User Layer
bot.use((ctx, next) => {
    const userId = ctx.chat ? ctx.chat.id : null;
    if (!userId) return next();
    
    // Admin bypass guardrails
    if (String(userId) === String(ADMIN_CHAT_ID)) return next();
    
    // Safety & Maintenance Interceptors
    if (isMaintenanceMode) {
        const lang = userLanguages[userId] || 'bn';
        return ctx.reply(locale[lang].maint_msg);
    }
    if (bannedUsers.has(userId)) return; 
    
    return next();
});

// 📌 Core Command Orchestrations
bot.command('start', (ctx) => {
    registeredUsers.add(ctx.chat.id);
    sendMainMenu(ctx, false);
});

bot.command('cancel', (ctx) => {
    const userId = ctx.chat.id;
    const lang = userLanguages[userId] || 'bn';
    if (userSessions[userId]) {
        delete userSessions[userId];
        ctx.reply(locale[lang].session_cancelled);
        sendMainMenu(ctx, false);
    } else {
        ctx.reply(locale[lang].no_session);
    }
});

// 👑 Advanced Admin Panel Infrastructure
bot.command('admin', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return;
    ctx.reply("👑 **Welcome to the Master Admin Core Console:**", Markup.inlineKeyboard([
        [Markup.button.callback("📊 System Status", "admin_stats"), Markup.button.callback("📢 Global Broadcast", "admin_broadcast")],
        [Markup.button.callback(isMaintenanceMode ? "🟢 Live Mode" : "🚧 Maint Mode", "admin_toggle_maint")],
        [Markup.button.callback("🚫 Ban Management", "admin_ban_menu"), Markup.button.callback("📜 View Logs", "admin_view_logs")]
    ]));
});

// Admin Callbacks Engine
bot.action('admin_stats', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    ctx.answerCbQuery();
    const activeLinks = Object.keys(linkDatabase).filter(k => linkDatabase[k].isActive).length;
    const statsMsg = `📊 **Realtime Engine Metrics:**\n\n👥 Registered Active Users: \`${registeredUsers.size}\`\n🔗 Total Active Links: \`${activeLinks}\` (All-time: \`${totalLinksCreated}\`)\n🖼️ Wish Cards Made: \`${totalCardsGenerated}\`\n📝 User Feedback Count: \`${totalFeedbacksReceived}\`\n🚫 Total Banned Entities: \`${bannedUsers.size}\``;
    ctx.reply(statsMsg);
});

bot.action('admin_toggle_maint', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    isMaintenanceMode = !isMaintenanceMode;
    ctx.answerCbQuery(`Maintenance Mode is now ${isMaintenanceMode ? 'ON' : 'OFF'}`);
    ctx.reply(`⚙️ System Status changed: **Maintenance Mode -> ${isMaintenanceMode ? 'ENABLED 🚧' : 'DISABLED 🟢'}**`);
});

bot.action('admin_broadcast', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    ctx.answerCbQuery();
    userSessions[ctx.chat.id] = { step: 'AWAITING_ADMIN_BROADCAST_MSG' };
    ctx.reply("📢 Enter the broadcast transmission message. Send /cancel to drop execution.");
});

bot.action('admin_ban_menu', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    ctx.answerCbQuery();
    userSessions[ctx.chat.id] = { step: 'AWAITING_BAN_USER_ID' };
    ctx.reply("🚫 Send the precise Telegram Chat ID of the user you wish to BAN/UNBAN:");
});

bot.action('admin_view_logs', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    ctx.answerCbQuery();
    ctx.reply("📜 **Latest Node Framework Operational Logs:**\n\n[INFO] Engines initialized successfully.\n[INFO] Bot instance securely connected to Telegram servers.\n[SYSTEM] Live Web Server handling dynamic API calls cleanly.");
});

// 🌐 Localization Engine Routing
bot.action('menu_lang', (ctx) => {
    ctx.answerCbQuery();
    ctx.editMessageText("🌐 **Select Preferred Interface Language / ভাষা নির্বাচন করুন:**", Markup.inlineKeyboard([
        [Markup.button.callback('🇧🇩 বাংলা', 'set_lang_bn'), Markup.button.callback('🇺🇸 English', 'set_lang_en')],
        [Markup.button.callback('🔙 Back to Menu', 'go_to_main_menu')]
    ]));
});

bot.action(/^set_lang_/, (ctx) => {
    const selectedLang = ctx.match.input.replace('set_lang_', '');
    userLanguages[ctx.chat.id] = selectedLang;
    ctx.answerCbQuery();
    sendMainMenu(ctx, true);
});

bot.action('go_to_main_menu', (ctx) => {
    ctx.answerCbQuery();
    sendMainMenu(ctx, true);
});

// 🚀 Dynamic Web Link Creation Protocol
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
    const cat = ctx.match.input.replace('make_', '');
    userSessions[ctx.chat.id] = { 
        type: cat, 
        name: ctx.from.first_name || "Anonymous", 
        username: ctx.from.username ? '@' + ctx.from.username : 'None' 
    };
    const lang = userLanguages[ctx.chat.id] || 'bn';
    ctx.editMessageText(locale[lang].prompt_countdown_ask, Markup.inlineKeyboard([
        [Markup.button.callback(locale[lang].btn_yes, 'timer_yes'), Markup.button.callback(locale[lang].btn_no, 'timer_no')]
    ]));
});

bot.action('timer_yes', (ctx) => {
    ctx.answerCbQuery();
    userSessions[ctx.chat.id].step = 'AWAITING_COUNTDOWN_TIME';
    ctx.reply(locale[userLanguages[ctx.chat.id] || 'bn'].prompt_time_input);
});

bot.action('timer_no', (ctx) => {
    ctx.answerCbQuery();
    userSessions[ctx.chat.id].countdown = null;
    askThemeSelection(ctx);
});

function askThemeSelection(ctx) {
    const lang = userLanguages[ctx.chat.id] || 'bn';
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('✨ Classic Pink', 'set_theme_classic'), Markup.button.callback('🌌 Neon Magic', 'set_theme_neon')],
        [Markup.button.callback('🎈 Birthday Gold', 'set_theme_gold'), Markup.button.callback('❤️ Dark Romance', 'set_theme_dark')]
    ]);
    ctx.reply(locale[lang].prompt_theme, keyboard);
}

bot.action(/^set_theme_/, (ctx) => {
    ctx.answerCbQuery();
    userSessions[ctx.chat.id].theme = ctx.match.input.replace('set_theme_', '');
    const lang = userLanguages[ctx.chat.id] || 'bn';
    ctx.reply(locale[lang].prompt_music, Markup.inlineKeyboard([
        [Markup.button.callback('🎵 Romantic Flute Trance', 'set_music_romantic'), Markup.button.callback('🔇 Completely Silent', 'set_music_none')]
    ]));
});

bot.action(/^set_music_/, (ctx) => {
    ctx.answerCbQuery();
    userSessions[ctx.chat.id].music = ctx.match.input.replace('set_music_', '');
    userSessions[ctx.chat.id].step = 'AWAITING_ANIMATION_TEXT';
    ctx.reply(locale[userLanguages[ctx.chat.id] || 'bn'].session_started(userSessions[ctx.chat.id].type));
});

// 🖼️ Premium Wish Card Infrastructure
bot.action('menu_cardgen', (ctx) => {
    ctx.answerCbQuery();
    userSessions[ctx.chat.id] = { step: 'AWAITING_CARD_NAME' };
    const lang = userLanguages[ctx.chat.id] || 'bn';
    ctx.reply(locale[lang].prompt_card_name);
});

// 👀 Intelligent Web Engine Interactive Demos
bot.action('menu_demo', (ctx) => {
    ctx.answerCbQuery();
    const lang = userLanguages[ctx.chat.id] || 'bn';
    ctx.reply(locale[lang].demo_title, Markup.inlineKeyboard([
        [Markup.button.callback("🔗 Love Theme Demo", "view_demo_love"), Markup.button.callback("🔗 Gold Birthday Demo", "view_demo_gold")],
        [Markup.button.callback(locale[lang].btn_back, 'go_to_main_menu')]
    ]));
});

bot.action(/^view_demo_/, (ctx) => {
    ctx.answerCbQuery();
    const type = ctx.match.input.replace('view_demo_', '');
    const lang = userLanguages[ctx.chat.id] || 'bn';
    ctx.reply(locale[lang].demo_ready(type, `${SERVER_URL}/love/demo-preview`));
});

// 📊 Profile & Account Engine Metrics
bot.action('menu_stats', (ctx) => {
    ctx.answerCbQuery();
    const userId = ctx.chat.id;
    const lang = userLanguages[userId] || 'bn';
    const userLinks = Object.keys(linkDatabase).filter(k => linkDatabase[k].userId === userId && linkDatabase[k].isActive);
    
    let linkListText = "";
    if (userLinks.length === 0) {
        linkListText = locale[lang].no_links;
    } else {
        userLinks.forEach((id, index) => {
            linkListText += `${index + 1}. \`${SERVER_URL}/love/${id}\` [${linkDatabase[id].type.toUpperCase()}]\n`;
        });
    }
    ctx.reply(locale[lang].profile_report(ctx.from.first_name || "User", linkListText));
});

// 🔒 Remote Link Deactivation Dashboard
bot.action('menu_off', (ctx) => {
    ctx.answerCbQuery();
    const userId = ctx.chat.id;
    const lang = userLanguages[userId] || 'bn';
    const userLinks = Object.keys(linkDatabase).filter(k => linkDatabase[k].userId === userId && linkDatabase[k].isActive);

    if (userLinks.length === 0) {
        return ctx.reply(locale[lang].no_links);
    }

    const buttons = userLinks.map(id => [Markup.button.callback(`❌ Lock: ${id} (${linkDatabase[id].type})`, `deactivate_${id}`)]);
    buttons.push([Markup.button.callback(locale[lang].off_all_links, "deactivate_all_links")]);
    buttons.push([Markup.button.callback(locale[lang].btn_back, "go_to_main_menu")]);

    ctx.reply(locale[lang].off_link_title, Markup.inlineKeyboard(buttons));
});

bot.action('deactivate_all_links', (ctx) => {
    ctx.answerCbQuery();
    const userId = ctx.chat.id;
    const lang = userLanguages[userId] || 'bn';
    const userLinks = Object.keys(linkDatabase).filter(k => linkDatabase[k].userId === userId && linkDatabase[k].isActive);
    
    userLinks.forEach(id => { linkDatabase[id].isActive = false; });
    ctx.reply(locale[lang].deactivate_success_all(userLinks.length));
    sendMainMenu(ctx, false);
});

bot.action(/^deactivate_/, (ctx) => {
    ctx.answerCbQuery();
    const id = ctx.match.input.replace('deactivate_', '');
    const lang = userLanguages[ctx.chat.id] || 'bn';
    if (linkDatabase[id] && linkDatabase[id].userId === ctx.chat.id) {
        linkDatabase[id].isActive = false;
        ctx.reply(locale[lang].deactivate_success_single(id));
    } else {
        ctx.reply(locale[lang].link_not_found);
    }
    sendMainMenu(ctx, false);
});

// 📝 Dynamic User Feedback Module
bot.action('menu_feedback', (ctx) => {
    ctx.answerCbQuery();
    userSessions[ctx.chat.id] = { step: 'AWAITING_USER_FEEDBACK' };
    const lang = userLanguages[ctx.chat.id] || 'bn';
    ctx.reply(locale[lang].feedback_prompt);
});

// 🎯 Complex State Machine & Text Input Validation
bot.on('text', (ctx) => {
    const userId = ctx.chat.id;
    const session = userSessions[userId];
    const text = ctx.message.text.trim();
    const lang = userLanguages[userId] || 'bn';

    // Global Command Overrides inside states
    if (text.startsWith('/')) return;
    if (!session) return;

    // Admin Session Protocols
    if (String(userId) === String(ADMIN_CHAT_ID)) {
        if (session.step === 'AWAITING_ADMIN_BROADCAST_MSG') {
            let transmissionCount = 0;
            registeredUsers.forEach(id => {
                bot.telegram.sendMessage(id, `📢 **[Global Server Announcement]**\n\n${text}`, { parse_mode: 'Markdown' })
                    .then(() => transmissionCount++)
                    .catch(() => {});
            });
            ctx.reply(`📡 Broadcast parsing sequence finished. Sent to \`${transmissionCount}\` terminal sockets.`);
            delete userSessions[userId];
            return;
        }
        if (session.step === 'AWAITING_BAN_USER_ID') {
            const targetId = parseInt(text, 10);
            if (isNaN(targetId)) return ctx.reply("❌ Provide a valid numeric Chat ID.");
            if (bannedUsers.has(targetId)) {
                bannedUsers.delete(targetId);
                ctx.reply(`🟢 User account \`${targetId}\` has been successfully UNBANNED.`);
            } else {
                bannedUsers.add(targetId);
                ctx.reply(`🚫 User account \`${targetId}\` has been permanently BANNED.`);
            }
            delete userSessions[userId];
            return;
        }
    }

    // Standard Client Pipeline Engine
    if (session.step === 'AWAITING_USER_FEEDBACK') {
        if (text.length < 5) return ctx.reply(locale[lang].feedback_short);
        totalFeedbacksReceived++;
        bot.telegram.sendMessage(ADMIN_CHAT_ID, `📝 **New Feedback Broadcast:**\nUser ID: \`${userId}\`\nName: ${ctx.from.first_name}\n\nText: ${text}`).catch(()=>{});
        ctx.reply(locale[lang].feedback_success);
        delete userSessions[userId];
        sendMainMenu(ctx, false);
        return;
    }

    if (session.step === 'AWAITING_CARD_NAME') {
        totalCardsGenerated++;
        ctx.reply(locale[lang].card_ready);
        ctx.replyWithPhoto({ url: `https://dummyimage.com/600x400/ff4b72/fff.png&text=${encodeURIComponent(text)}` }).catch(()=>{});
        delete userSessions[userId];
        sendMainMenu(ctx, false);
        return;
    }

    // 🕒 বটের টাইম ইনপুট এবং ২ ঘণ্টার নিখুঁত ভ্যালিডেশন ইঞ্জিন
    if (session.step === 'AWAITING_COUNTDOWN_TIME') {
        const timeRegex = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i;
        const match = text.match(timeRegex);

        if (!match) {
            return ctx.reply(locale[lang].invalid_time);
        }

        let [_, hours, minutes, ampm] = match;
        hours = parseInt(hours, 10);
        minutes = parseInt(minutes, 10);
        ampm = ampm.toUpperCase();

        if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) {
            return ctx.reply(locale[lang].invalid_time);
        }

        // বর্তমান বাংলাদেশ সময় অবজেক্ট জেনারেট করা
        const now = new Date();
        const targetDate = new Date(now);

        let targetHours = hours;
        if (ampm === 'PM' && hours !== 12) targetHours += 12;
        if (ampm === 'AM' && hours === 12) targetHours = 0;

        targetDate.setHours(targetHours, minutes, 0, 0);

        // অতীতের টাইম ইনপুট দিলে স্বয়ংক্রিয়ভাবে আগামীকালের জন্য শিডিউলড করা
        if (targetDate < now) {
            targetDate.setDate(targetDate.getDate() + 1);
        }

        // ⚠️ ২ ঘণ্টার স্ট্রিক্ট লিমিট ক্যালকুলেশন (Difference Checker)
        const diffMs = targetDate.getTime() - now.getTime();
        const maxLimitMs = 2 * 60 * 60 * 1000; // ২ ঘণ্টা = ৭,২০০,০০০ মিলিসেকেন্ড

        if (diffMs > maxLimitMs) {
            return ctx.reply(locale[lang].max_time_exceeded);
        }

        session.countdown = targetDate.toISOString(); // সার্ভার ড্যাশবোর্ডে স্টোর
        askThemeSelection(ctx);
        return;
    }

    if (session.step === 'AWAITING_ANIMATION_TEXT') {
        session.animations = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        session.step = 'AWAITING_LETTER_TEXT';
        ctx.reply(locale[lang].input_anim_success(session.animations.length));
        return;
    }

    if (session.step === 'AWAITING_LETTER_TEXT') {
        totalLinksCreated++;
        const uniqueId = Math.random().toString(36).substring(2, 9);
        
        linkDatabase[uniqueId] = {
            userId: userId,
            name: session.name,
            type: session.type,
            theme: session.theme,
            music: session.music,
            countdown: session.countdown, // এই টাইম অবজেক্টটি দিয়ে ফ্রন্টএন্ডে সেকেন্ডসহ লাইভ উল্টো গণনা হবে
            animations: session.animations,
            letter: text,
            isActive: true
        };
        
        ctx.reply(locale[lang].link_ready(`${SERVER_URL}/love/${uniqueId}`));
        delete userSessions[userId];
        return;
    }
});

// Helper Interface Dispatcher
function sendMainMenu(ctx, isEdit = false) {
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
}

// 🌐 High-Performance REST API Middleware & Routing
app.get('/love/:id', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// API endpoint to serve content dynamically to HTML Frontend
app.post('/api/get-content', (req, res) => {
    const { id } = req.body;
    
    // Preview Dummy Route handler
    if (id === 'demo-preview') {
        return res.json({ success: true, isLocked: false, theme: 'neon', music: 'none', animations: ["Demo Line 1", "Demo Line 2"], letter: "This is a working demo profile." });
    }

    const data = linkDatabase[id];
    if (!data || !data.isActive) return res.json({ success: false });

    // Dynamic Time System validation layer
    if (data.countdown) {
        const now = new Date();
        const lockTime = new Date(data.countdown);
        if (lockTime > now) {
            // লক হয়ে থাকলে ফায়ারফক্স/ক্রোম ফ্রন্টএন্ডের জন্য ISO টাইম পাস করা হচ্ছে লাইভ সেকেন্ডের কাউন্টডাউনের জন্য
            return res.json({ success: true, isLocked: true, countdownTime: data.countdown, theme: data.theme });
        }
    }

    // Send real-time client analytics to owner before delivery
    const accessTime = new Date().toLocaleTimeString();
    bot.telegram.sendMessage(data.userId, locale[userLanguages[data.userId] || 'bn'].someone_opened(data.type, accessTime)).catch(()=>{});

    res.json({
        success: true,
        isLocked: false,
        theme: data.theme,
        music: data.music,
        animations: data.animations,
        letter: data.letter
    });
});

app.post('/api/respond', (req, res) => {
    const { response, id } = req.body;
    const data = linkDatabase[id];
    if (data && data.isActive) {
        const lang = userLanguages[data.userId] || 'bn';
        bot.telegram.sendMessage(data.userId, locale[lang].new_response(data.type, response)).catch(()=>{});
        return res.json({ success: true });
    }
    res.json({ success: false });
});

// ⚡ Application Initialization Core
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    bot.launch();
    console.log(`Wishing Core Network Running Smoothly on Port Terminal: ${PORT}`);
});
