const express = require('express');
const path = require('path');
const axios = require('axios');
const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');

const app = express();
app.use(express.json());

// ⚙️ Configurations
const TELEGRAM_TOKEN = "8922778423:AAGbdZfdUDol_5w3dPbeBH0aucf9qkgtPTA"; 
const SERVER_URL = "https://love-bb7p.onrender.com"; 
const ADMIN_CHAT_ID = "6719885052"; 

const bot = new Telegraf(TELEGRAM_TOKEN);

// 🗄️ In-Memory Databases & States
const linkDatabase = {}; 
const userSessions = {}; 
const registeredUsers = new Set(); 
const bannedUsers = new Set(); 
const userLanguages = {}; 
let isMaintenanceMode = false; 

// 📁 Demo Links Generator
const categories = ['love', 'crush', 'birthday', 'anniversary', 'newyear', 'boishakh', 'friend', 'eid', 'sorry'];
categories.forEach(cat => {
    linkDatabase[`demo_${cat}`] = {
        userId: ADMIN_CHAT_ID,
        name: "Developer",
        username: "@admin",
        type: cat,
        theme: "classic",
        music: "none",
        countdown: null,
        animations: ["Hello Dear", "How are you?", "I have a surprise for you... 👀"],
        letter: `This is a demo page.\nWhen you create your custom link, your written letter will be displayed beautifully inside the envelope like this! ✨`,
        isActive: true
    };
});

// 🌐 Multi-Language Messages Dictionary
const locale = {
    bn: {
        welcome: (name) => `💝 **হ্যালো ${name}!** 💝\n\nবটের পক্ষ থেকে স্বাগতম। এই বটের মাধ্যমে আপনি আপনার প্রিয়জনের জন্য আকর্ষণীয় কাউন্টডাউন টাইমার, ব্যাকগ্রাউন্ড মিউজিক এবং এনিমেশনসহ প্রিমিয়াম উইশিং ওয়েব লিঙ্ক তৈরি করতে পারবেন সম্পূর্ণ ফ্রিতে।\n\nনিচের যেকোনো একটি অপশন সিলেক্ট করুন:`,
        btn_make: "🚀 লিঙ্ক তৈরি করুন", btn_card: "🖼️ উইশ কার্ড বানান", btn_demo: "👀 ডেমো দেখুন", btn_stats: "📊 স্ট্যাটাস", btn_off: "🔒 লিঙ্ক বন্ধ করুন", btn_feedback: "📝 মতামত", btn_help: "❓ সাহায্য", btn_lang: "🌐 ভাষা পরিবর্তন", btn_back: "🔙 মেইন মেনু",
        choose_cat: "✨ **আপনি কোন ক্যাটাগরির লিঙ্ক তৈরি করতে চান? নিচে থেকে সিলেক্ট করুন:**",
        cat_love: "❤️ প্রেমের চিঠি", cat_crush: "💖 ক্রাশ কনফেশন", cat_birthday: "🎂 জন্মদিনের শুভেচ্ছা", cat_anniversary: "💍 বিবাহবার্ষিকী", cat_newyear: "🎉 নতুন বছর", cat_boishakh: "🌾 পহেলা বৈশাখ", cat_friend: "🫂 সেরা বন্ধু", cat_eid: "🌙 ঈদ মোবারক", cat_sorry: "🥺 দুঃখ প্রকাশ",
        prompt_countdown_ask: "⏰ **আপনি কি এই লিঙ্কে কাউন্টডাউন টাইমার (Time Countdown) সেট করতে চান?**\n\n(টাইমার সেট করলে আপনার দেওয়া সময়ের আগে কেউ লিঙ্কের মূল মেসেজ দেখতে পারবে না।)",
        btn_yes: "✅ হ্যাঁ, চাই", btn_no: "❌ না, লাগবে না",
        prompt_time_input: "⏳ অনুগ্রহ করে আজ কোন সময়ে কাউন্টডাউন শেষ হবে তা লিখে পাঠান।\n\nFormat: \`12:02pm\` বা \`4:30am\` বা \`12:2pm\`\n\n⚠️ **সর্বোচ্চ ২ ঘণ্টা পর্যন্ত সময় দিতে পারবেন।**",
        invalid_time: "❌ ভুল ফরম্যাট! অনুগ্রহ করে সঠিক ফরম্যাটে লিখুন। উদাহরণ: \`12:02pm\` অথবা \`4:30am\`",
        max_time_exceeded: "⚠️ দুঃখিত! আপনি বর্তমান সময় থেকে সর্বোচ্চ ২ ঘণ্টার বেশি কাউন্টডাউন টাইম সেট করতে পারবেন না।",
        time_past: "❌ আপনি অতীতের কোনো সময় সেট করতে পারবেন না। সঠিক সময় দিন।",
        prompt_theme: "🎨 **একটি প্রিমিয়াম ওয়েব থিম সিলেক্ট করুন (সম্পূর্ণ ফ্রি):**",
        prompt_music: "🎵 **একটি ব্যাকগ্রাউন্ড মিউজিক সিলেক্ট করুন (সম্পূর্ণ ফ্রি):**",
        prompt_card_name: "🖼️ উইশ কার্ডে কার নাম লিখতে চান? তার নামটি লিখে পাঠান:",
        card_ready: "✨ **আপনার প্রিমিয়াম উইশ কার্ডটি তৈরি হয়ে গেছে!** 👇",
        help_text: `❓ **কিভাবে ব্যবহার করবেন?**\n\n১. প্রথমে 🚀 **লিঙ্ক তৈরি করুন** বাটনে ক্লিক করুন।\n২. ক্যাটাগরি বেছে নেওয়ার পরেই কাউন্টডাউন সেট করার অপশন আসবে। সর্বোচ্চ ২ ঘণ্টার জন্য টাইম সেট করতে পারবেন।\n৩. থিম ও মিউজিক সিলেক্ট করে আপনার টেক্সটগুলো পাঠিয়ে লিঙ্ক তৈরি করে নিন।`,
        feedback_prompt: "📝 অনুগ্রহ করে আপনার মতামত বা পরামর্শ এখানে মেসেজ আকারে লিখে পাঠান:",
        feedback_short: "❌ মতামত একটু বড় করে লিখুন (কমপক্ষে ৫টি অক্ষর)।",
        feedback_success: "✅ আপনার মূল্যবান মতামত সফলভাবে জমা হয়েছে। ধন্যবাদ!",
        session_cancelled: "❌ আপনার চলমান লিঙ্ক তৈরির সেশনটি বাতিল করা হয়েছে।",
        no_session: "💡 আপনার কোনো একটিভ সেশন নেই।",
        invalid_cmd: (cmd) => `❌ **ভুল আদেশ:** \`${cmd}\` এই বটটিতে গ্রহণযোগ্য নয়!`,
        btn_open_help: "❓ সাহায্য মেনু দেখুন",
        maint_msg: "🚧 **বটের কাজ চলছে (Under Maintenance)!**",
        no_links: "❌ আপনি এখনো কোনো লিঙ্ক তৈরি করেননি।",
        profile_report: (name, list) => `📊 **আপনার প্রোফাইল রিপোর্ট:**\n\n👤 নাম: ${name}\n🎫 আপনার লিঙ্কসমূহ:\n${list}`,
        btn_want_deactivate: "🔒 লিঙ্ক ডিঅ্যাক্টিভেট করতে চান?",
        no_active_links: "💡 আপনার এই মুহূর্তে কোনো সক্রিয় লিঙ্ক নেই।",
        off_link_title: "🔒 **আপনি কোন লিঙ্কটি বন্ধ করতে চান? নিচে ক্লিক করুন:**",
        off_all_links: "❌ সব লিঙ্ক বন্ধ করুন",
        deactivate_success_all: (count) => `✅ আপনার সবকটি (\`${count}\`) সক্রিয় লিঙ্ক সফলভাবে বন্ধ করা হয়েছে!`,
        deactivate_success_single: (id) => `✅ আপনার লিঙ্কটি (\`${id}\`) সফলভাবে বন্ধ করা হয়েছে।`,
        link_not_found: "❌ লিঙ্কটি পাওয়া যায়নি অথবা ইতিমধ্যে বন্ধ করা হয়েছে।",
        session_started: (cat) => `✨ আপনার কাস্টম লিঙ্ক তৈরির সেশন শুরু হয়েছে!\n\n👉 প্রথমে অ্যানিমেশন টেক্সটগুলো পাঠান (একের অধিক লাইন হলে প্রতি লাইনের পর এন্টার দিন)।`,
        demo_title: "👀 **আপনি কোন ডেমো পেজটি দেখতে চান? নিচে সিলেক্ট করুন:**",
        demo_ready: (type, url) => `✨ **আপনার অনুরোধ করা ডেমো লিঙ্কটি তৈরি!**\n\n🔗 ডেমো লিঙ্ক: ${url}`,
        input_anim_success: (count) => `✅ চমৎকার! আপনি ${count} লাইনের অ্যানিমেশন যোগ করেছেন।\n\n💌 এবার খামের ভেতরের মূল চিঠি বা মেসেজটি লিখে পাঠান:`,
        link_ready: (url) => `💝 অভিনন্দন! আপনার কাস্টমাইজড লিঙ্ক সম্পূর্ণ রেডি:\n\n${url}`,
        btn_rate_feedback: "📝 বটটি কেমন লাগলো? মতামত দিন",
        someone_opened: (type, time) => `👀 **বিজ্ঞপ্তি:** কেউ একজন আপনার তৈরি করা \`${type.toUpperCase()}\` লিঙ্কটি ওপেন করেছে!\n⏰ **সময়:** ${time}`,
        new_response: (type, res) => `💌 আপনার কাস্টম \`${type.toUpperCase()}\` লিঙ্কে একটি নতুন রেসপন্স এসেছে!\n\nউত্তর: ${res}`
    },
    en: {
        welcome: (name) => `💝 **Hello ${name}!** 💝\n\nWelcome to Wishing Bot. Using this bot, you can create beautiful premium web wishing links for your loved ones with customized countdown timers, background music, and smooth animations completely for free.\n\nChoose an option from below:`,
        btn_make: "🚀 Make Link", btn_card: "🖼️ Wish Card Generator", btn_demo: "👀 Demo", btn_stats: "📊 Stats", btn_off: "🔒 Off Link", btn_feedback: "📝 Feedback", btn_help: "❓ Help", btn_lang: "🌐 Change Language", btn_back: "🔙 Main Menu",
        choose_cat: "✨ **Select Category:**",
        cat_love: "❤️ Love Letter", cat_crush: "💖 Crush Confession", cat_birthday: "🎂 Birthday Wish", cat_anniversary: "💍 Anniversary Wish", cat_newyear: "🎉 New Year Wish", cat_boishakh: "🌾 Pohela Boishakh", cat_friend: "🫂 Best Friend", cat_eid: "🌙 Eid Wish", cat_sorry: "🥺 Sorry Letter",
        prompt_countdown_ask: "⏰ **Do you want to set a Time Countdown Timer for this link?**\n\n(If enabled, users cannot view the main message until the countdown expires.)",
        btn_yes: "✅ Yes", btn_no: "❌ No",
        prompt_time_input: "⏳ Send the time for countdown to end today.\n\nFormat: \`12:02pm\` or \`4:30am\`\n\n⚠️ **Maximum limit is 2 hours from now.**",
        invalid_time: "❌ Invalid format! Please follow: \`12:02pm\` or \`4:30am\`",
        max_time_exceeded: "⚠️ Sorry! You cannot set countdown time for more than 2 hours from current time.",
        time_past: "❌ You cannot set a past time.",
        prompt_theme: "🎨 **Select a Premium Web Theme (Free):**",
        prompt_music: "🎵 **Select a Background Music (Free):**",
        prompt_card_name: "🖼️ Enter the name you want to print on the Wish Card:",
        card_ready: "✨ **Your premium Wish Card is ready!** 👇",
        help_text: `❓ **How to use?**\n\n1. Click 🚀 **Make Link**.\n2. Right after choosing category, you can set a countdown timer for up to 2 hours.\n3. Choose theme, music, send text lines and generate your link.`,
        feedback_prompt: "📝 Please send your feedback:",
        feedback_short: "❌ Please write more details (at least 5 characters).",
        feedback_success: "✅ Feedback submitted! Thank you.",
        session_cancelled: "❌ Session cancelled.",
        no_session: "💡 No active session.",
        invalid_cmd: (cmd) => `❌ **Invalid Command:** \`${cmd}\``,
        btn_open_help: "❓ Open Help Menu",
        maint_msg: "🚧 **Bot is under maintenance!**",
        no_links: "❌ No links created yet.",
        profile_report: (name, list) => `📊 **Your Profile:**\n\n👤 Name: ${name}\n🎫 Your Links:\n${list}`,
        btn_want_deactivate: "🔒 Want to deactivate a link?",
        no_active_links: "💡 No active links.",
        off_link_title: "🔒 **Select link to deactivate:**",
        off_all_links: "❌ Off All Links",
        deactivate_success_all: (count) => `✅ Deactivated all (\`${count}\`) links!`,
        deactivate_success_single: (id) => `✅ Deactivated link (\`${id}\`).`,
        link_not_found: "❌ Link not found.",
        session_started: (cat) => `✨ Custom ${cat.toUpperCase()} Link started! Send animation texts line by line (press enter for multiple lines):`,
        demo_title: "👀 **Select demo page:**",
        demo_ready: (type, url) => `✨ **Demo Link:** ${url}`,
        input_anim_success: (count) => `✅ Added ${count} lines. Send main letter:`,
        link_ready: (url) => `💝 Link Ready:\n\n${url}`,
        btn_rate_feedback: "📝 Give feedback",
        someone_opened: (type, time) => `👀 **Notification:** Someone opened your \`${type.toUpperCase()}\` link!\n⏰ **Time:** ${time}`,
        new_response: (type, res) => `💌 New response: ${res}`
    }
};

// 🛡️ Middleware Guard
bot.use((ctx, next) => {
    const userId = ctx.chat ? ctx.chat.id : (ctx.from ? ctx.from.id : null);
    if (!userId) return next();
    if (String(userId) === String(ADMIN_CHAT_ID)) return next();
    if (isMaintenanceMode) {
        const lang = userLanguages[userId] || 'bn';
        return ctx.reply(locale[lang].maint_msg);
    }
    if (bannedUsers.has(userId) || bannedUsers.has(Number(userId))) return;
    return next();
});

// 🏠 Menu Builders
function sendMainMenu(ctx, isEdit = false) {
    const userId = ctx.chat.id;
    const lang = userLanguages[userId] || 'bn';
    const firstName = ctx.from ? ctx.from.first_name : "User";
    const text = locale[lang].welcome(firstName);
    
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback(locale[lang].btn_make, 'menu_makelink'), Markup.button.callback(locale[lang].btn_card, 'menu_cardgen')],
        [Markup.button.callback(locale[lang].btn_demo, 'menu_demo'), Markup.button.callback(locale[lang].btn_stats, 'menu_stats')],
        [Markup.button.callback(locale[lang].btn_off, 'menu_off'), Markup.button.callback(locale[lang].btn_feedback, 'menu_feedback')],
        [Markup.button.callback(locale[lang].btn_help, 'menu_help'), Markup.button.callback(locale[lang].btn_lang, 'menu_lang')]
    ]);

    if (isEdit) return ctx.editMessageText(text, keyboard).catch(e => {});
    return ctx.reply(text, keyboard);
}

function sendAdminDashboard(ctx, isEdit = false) {
    const text = `👑 **Welcome Boss! Your Complete Admin Dashboard:**`;
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📊 Bot Live Stats', 'adm_stats'), Markup.button.callback('📋 All Links List', 'adm_alllinks_main')],
        [Markup.button.callback('⚙️ Maintenance (On/Off)', 'adm_toggle_maint'), Markup.button.callback('📢 Broadcast Message', 'adm_prompt_broadcast')],
        [Markup.button.callback('🧼 Clean Inactive Links', 'adm_clean'), Markup.button.callback('💾 Database Backup', 'adm_backup')],
        [Markup.button.callback('🔥 Delete All Links (NUKE)', 'adm_prompt_nuke')]
    ]);
    if (isEdit) return ctx.editMessageText(text, keyboard).catch(e => {});
    return ctx.reply(text, keyboard);
}

// 🚦 Basic Bot Commands
bot.command('start', (ctx) => {
    registeredUsers.add(ctx.chat.id);
    sendMainMenu(ctx, false);
});

bot.command('adm', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return ctx.reply("⚠️ **Access Denied!**");
    sendAdminDashboard(ctx, false);
});

bot.command('cancel', (ctx) => {
    const lang = userLanguages[ctx.chat.id] || 'bn';
    if (userSessions[ctx.chat.id]) {
        delete userSessions[ctx.chat.id];
        ctx.reply(locale[lang].session_cancelled);
        sendMainMenu(ctx, false);
    } else {
        ctx.reply(locale[lang].no_session);
    }
});

// 🌐 Language Configuration Actions
bot.action('menu_lang', (ctx) => {
    ctx.answerCbQuery();
    ctx.editMessageText("🌐 **Please select your language / আপনার ভাষা নির্বাচন করুন:**", 
        Markup.inlineKeyboard([
            [Markup.button.callback('🇧🇩 বাংলা', 'set_lang_bn'), Markup.button.callback('🇺🇸 English', 'set_lang_en')],
            [Markup.button.callback('🔙 Back / পিছনে যান', 'go_to_main_menu')]
        ])
    );
});

bot.action(/^set_lang_/, (ctx) => {
    const selectedLang = ctx.match.input.replace('set_lang_', '');
    userLanguages[ctx.chat.id] = selectedLang;
    ctx.answerCbQuery();
    sendMainMenu(ctx, true);
});

bot.action('go_to_main_menu', (ctx) => { ctx.answerCbQuery(); sendMainMenu(ctx, true); });
bot.action('go_to_admin_dashboard', (ctx) => { ctx.answerCbQuery(); sendAdminDashboard(ctx, true); });

// 🚀 Link Generator Flow
bot.action('menu_makelink', (ctx) => {
    ctx.answerCbQuery();
    const lang = userLanguages[ctx.chat.id] || 'bn';
    ctx.editMessageText(locale[lang].choose_cat, 
        Markup.inlineKeyboard([
            [Markup.button.callback(locale[lang].cat_love, 'make_love'), Markup.button.callback(locale[lang].cat_crush, 'make_crush'), Markup.button.callback(locale[lang].cat_birthday, 'make_birthday')],
            [Markup.button.callback(locale[lang].cat_anniversary, 'make_anniversary'), Markup.button.callback(locale[lang].cat_newyear, 'make_newyear'), Markup.button.callback(locale[lang].cat_boishakh, 'make_boishakh')],
            [Markup.button.callback(locale[lang].cat_friend, 'make_friend'), Markup.button.callback(locale[lang].cat_eid, 'make_eid'), Markup.button.callback(locale[lang].cat_sorry, 'make_sorry')],
            [Markup.button.callback(locale[lang].btn_back, 'go_to_main_menu')]
        ])
    );
});

bot.action(/^make_/, (ctx) => {
    ctx.answerCbQuery();
    const type = ctx.match.input.replace('make_', '');
    const lang = userLanguages[ctx.chat.id] || 'bn';
    userSessions[ctx.chat.id] = {
        type: type,
        name: ctx.from.first_name,
        username: ctx.from.username ? '@' + ctx.from.username : 'None'
    };
    
    ctx.editMessageText(locale[lang].prompt_countdown_ask,
        Markup.inlineKeyboard([
            [Markup.button.callback(locale[lang].btn_yes, 'timer_yes'), Markup.button.callback(locale[lang].btn_no, 'timer_no')]
        ])
    );
});

bot.action('timer_yes', (ctx) => {
    ctx.answerCbQuery();
    const lang = userLanguages[ctx.chat.id] || 'bn';
    userSessions[ctx.chat.id].step = 'AWAITING_COUNTDOWN_TIME';
    ctx.reply(locale[lang].prompt_time_input);
});

bot.action('timer_no', (ctx) => {
    ctx.answerCbQuery();
    userSessions[ctx.chat.id].countdown = null;
    askThemeSelection(ctx);
});

function askThemeSelection(ctx) {
    const lang = userLanguages[ctx.chat.id] || 'bn';
    const text = locale[lang].prompt_theme;
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('✨ Classic Pink', 'set_theme_classic'), Markup.button.callback('🌌 Neon Magic', 'set_theme_neon')],
        [Markup.button.callback('🎈 Birthday Gold', 'set_theme_gold'), Markup.button.callback('❤️ Dark Romance', 'set_theme_dark')]
    ]);
    if (ctx.message) {
        ctx.reply(text, keyboard);
    } else {
        ctx.editMessageText(text, keyboard).catch(() => ctx.reply(text, keyboard));
    }
}

bot.action(/^set_theme_/, (ctx) => {
    ctx.answerCbQuery();
    userSessions[ctx.chat.id].theme = ctx.match.input.replace('set_theme_', '');
    const lang = userLanguages[ctx.chat.id] || 'bn';

    ctx.editMessageText(locale[lang].prompt_music,
        Markup.inlineKeyboard([
            [Markup.button.callback('🎵 Romantic Flute', 'set_music_romantic'), Markup.button.callback('🎂 Birthday Tune', 'set_music_birthday')],
            [Markup.button.callback('🎹 Soft Piano', 'set_music_piano'), Markup.button.callback('🔇 No Music', 'set_music_none')]
        ])
    );
});

bot.action(/^set_music_/, (ctx) => {
    ctx.answerCbQuery();
    userSessions[ctx.chat.id].music = ctx.match.input.replace('set_music_', '');
    const lang = userLanguages[ctx.chat.id] || 'bn';
    userSessions[ctx.chat.id].step = 'AWAITING_ANIMATION_TEXT';
    ctx.reply(locale[lang].session_started(userSessions[ctx.chat.id].type));
});

// 👀 Demo View Flow
bot.action('menu_demo', (ctx) => {
    ctx.answerCbQuery();
    const lang = userLanguages[ctx.chat.id] || 'bn';
    ctx.editMessageText(locale[lang].demo_title,
        Markup.inlineKeyboard([
            [Markup.button.callback(locale[lang].cat_love, 'view_love'), Markup.button.callback(locale[lang].cat_crush, 'view_crush')],
            [Markup.button.callback(locale[lang].cat_birthday, 'view_birthday'), Markup.button.callback(locale[lang].cat_anniversary, 'view_anniversary')],
            [Markup.button.callback(locale[lang].btn_back, 'go_to_main_menu')]
        ])
    );
});

bot.action(/^view_/, (ctx) => {
    ctx.answerCbQuery();
    const type = ctx.match.input.replace('view_', '');
    const lang = userLanguages[ctx.chat.id] || 'bn';
    ctx.reply(locale[lang].demo_ready(type, `${SERVER_URL}/love/demo_${type}`));
});

// 🔒 Deactivate Links Area
bot.action('menu_off', (ctx) => {
    ctx.answerCbQuery();
    const userId = ctx.chat.id;
    const lang = userLanguages[userId] || 'bn';
    
    const userLinks = Object.keys(linkDatabase).filter(id => linkDatabase[id].userId === userId && linkDatabase[id].isActive !== false && !id.startsWith('demo_'));
    
    if (userLinks.length === 0) {
        return ctx.editMessageText(locale[lang].no_active_links, Markup.inlineKeyboard([[Markup.button.callback(locale[lang].btn_back, 'go_to_main_menu')]]));
    }

    const buttons = userLinks.map(id => [Markup.button.callback(`❌ ID: ${id} (${linkDatabase[id].type.toUpperCase()})`, `deact_${id}`)]);
    buttons.push([Markup.button.callback(locale[lang].off_all_links, 'deact_all_now')]);
    buttons.push([Markup.button.callback(locale[lang].btn_back, 'go_to_main_menu')]);

    ctx.editMessageText(locale[lang].off_link_title, Markup.inlineKeyboard(buttons));
});

bot.action('deact_all_now', (ctx) => {
    ctx.answerCbQuery();
    const userId = ctx.chat.id;
    const lang = userLanguages[userId] || 'bn';
    let count = 0;
    
    Object.keys(linkDatabase).forEach(id => {
        if (linkDatabase[id].userId === userId && linkDatabase[id].isActive !== false && !id.startsWith('demo_')) {
            linkDatabase[id].isActive = false;
            count++;
        }
    });
    ctx.editMessageText(locale[lang].deactivate_success_all(count), Markup.inlineKeyboard([[Markup.button.callback(locale[lang].btn_back, 'go_to_main_menu')]]));
});

bot.action(/^deact_/, (ctx) => {
    ctx.answerCbQuery();
    const id = ctx.match.input.replace('deact_', '');
    const lang = userLanguages[ctx.chat.id] || 'bn';
    
    if (linkDatabase[id] && linkDatabase[id].userId === ctx.chat.id) {
        linkDatabase[id].isActive = false;
        ctx.editMessageText(locale[lang].deactivate_success_single(id), Markup.inlineKeyboard([[Markup.button.callback(locale[lang].btn_back, 'go_to_main_menu')]]));
    } else {
        ctx.reply(locale[lang].link_not_found);
    }
});

// 📊 User Profiles Stats Tracker
bot.action('menu_stats', (ctx) => {
    ctx.answerCbQuery();
    const userId = ctx.chat.id;
    const lang = userLanguages[userId] || 'bn';
    
    const userLinks = Object.keys(linkDatabase).filter(id => linkDatabase[id].userId === userId && !id.startsWith('demo_'));
    if (userLinks.length === 0) {
        return ctx.editMessageText(locale[lang].no_links, Markup.inlineKeyboard([[Markup.button.callback(locale[lang].btn_back, 'go_to_main_menu')]]));
    }

    let reportList = "";
    userLinks.forEach(id => {
        const item = linkDatabase[id];
        const status = item.isActive ? "🟢 Active" : "🔴 Closed";
        reportList += `🔗 \`${id}\` | [${item.type.toUpperCase()}] -> ${status}\n`;
    });

    ctx.editMessageText(locale[lang].profile_report(ctx.from.first_name, reportList), 
        Markup.inlineKeyboard([
            [Markup.button.callback(locale[lang].btn_off, 'menu_off')],
            [Markup.button.callback(locale[lang].btn_back, 'go_to_main_menu')]
        ])
    );
});

// 🖼️ Wish Card Generator Flow
bot.action('menu_cardgen', (ctx) => {
    ctx.answerCbQuery();
    const lang = userLanguages[ctx.chat.id] || 'bn';
    userSessions[ctx.chat.id] = { step: 'AWAITING_CARD_NAME' };
    ctx.editMessageText(locale[lang].prompt_card_name);
});

// 📝 User Feedbacks System
bot.action('menu_feedback', (ctx) => {
    ctx.answerCbQuery();
    const lang = userLanguages[ctx.chat.id] || 'bn';
    userSessions[ctx.chat.id] = { step: 'AWAITING_FEEDBACK' };
    ctx.editMessageText(locale[lang].feedback_prompt);
});

// ❓ Quick Help System
bot.action('menu_help', (ctx) => {
    ctx.answerCbQuery();
    const lang = userLanguages[ctx.chat.id] || 'bn';
    ctx.editMessageText(locale[lang].help_text, Markup.inlineKeyboard([[Markup.button.callback(locale[lang].btn_back, 'go_to_main_menu')]]));
});

// 👑 ADMIN CORE INTERACTIVE PANEL LOGICS
bot.action('adm_stats', (ctx) => {
    ctx.answerCbQuery();
    const totalLinks = Object.keys(linkDatabase).filter(k => !k.startsWith('demo_')).length;
    const activeLinks = Object.keys(linkDatabase).filter(k => !k.startsWith('demo_') && linkDatabase[k].isActive).length;
    
    const text = `📊 **Live Bot Control Room Metrics:**\n\n👥 Registered Users: ${registeredUsers.size}\n📦 Total Link Objects: ${totalLinks}\n🟢 Active Web Instances: ${activeLinks}\n🚨 Maint Status: ${isMaintenanceMode ? "ON" : "OFF"}`;
    ctx.editMessageText(text, Markup.inlineKeyboard([[Markup.button.callback('🔙 Admin Menu', 'go_to_admin_dashboard')]]));
});

bot.action('adm_toggle_maint', (ctx) => {
    ctx.answerCbQuery();
    isMaintenanceMode = !isMaintenanceMode;
    ctx.reply(`⚙️ Maintenance mode toggled to: **${isMaintenanceMode ? "ENABLED" : "DISABLED"}**`);
    sendAdminDashboard(ctx, false);
});

bot.action('adm_prompt_broadcast', (ctx) => {
    ctx.answerCbQuery();
    userSessions[ctx.chat.id] = { step: 'ADM_AWAITING_BROADCAST' };
    ctx.reply("📢 **Enter your message text to broadcast to ALL registered Telegram users:**");
});

bot.action('adm_clean', (ctx) => {
    ctx.answerCbQuery();
    let cleaned = 0;
    Object.keys(linkDatabase).forEach(k => {
        if (!k.startsWith('demo_') && !linkDatabase[k].isActive) {
            delete linkDatabase[k];
            cleaned++;
        }
    });
    ctx.reply(`🧼 Clean Sweep Completed! Removed **${cleaned}** inactive links database documents.`);
});

bot.action('adm_backup', (ctx) => {
    ctx.answerCbQuery();
    fs.writeFileSync('./database_dump.json', JSON.stringify(linkDatabase, null, 4));
    ctx.reply("💾 Full database structures saved and dumped into backup JSON file stream!");
});

bot.action('adm_prompt_nuke', (ctx) => {
    ctx.answerCbQuery();
    ctx.reply("⚠️ **ARE YOU SURE?** Write down exactly \`NUKE-ALL\` to trigger absolute link database destruction.");
    userSessions[ctx.chat.id] = { step: 'ADM_AWAITING_NUKE_CONFIRM' };
});

bot.action('adm_alllinks_main', (ctx) => {
    ctx.answerCbQuery();
    const list = Object.keys(linkDatabase).filter(k => !k.startsWith('demo_'));
    if (list.length === 0) return ctx.reply("No links available.");
    
    let str = "📋 **All Active Database Records Matrix:**\n\n";
    list.slice(0, 30).forEach(k => {
        str += `🆔 ID: \`${k}\` | User: ${linkDatabase[k].name} (${linkDatabase[k].userId}) | Typ: [${linkDatabase[k].type}]\n`;
    });
    ctx.reply(str);
});

// 🎯 Main Unified Multi-step Routing Text Engine
bot.on('text', (ctx) => {
    const userId = ctx.chat.id;
    const session = userSessions[userId];
    const text = ctx.message.text;
    const lang = userLanguages[userId] || 'bn';

    if (!session) {
        if (text.startsWith('/')) return ctx.reply(locale[lang].invalid_cmd(text));
        return;
    }

    // ⏱️ Countdown live processing validation (FIXED)
    if (session.step === 'AWAITING_COUNTDOWN_TIME') {
        const inputStr = text.trim().toLowerCase().replace(/\s+/g, '');
        const match = inputStr.match(/^(\d{1,2}):(\d{2})(am|pm)$/);
        
        if (!match) return ctx.reply(locale[lang].invalid_time);

        let hours = parseInt(match[1]);
        const minutes = parseInt(match[2]);
        const ampm = match[3];

        if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) return ctx.reply(locale[lang].invalid_time);

        const now = new Date();
        const bdOffset = 6 * 60 * 60 * 1000; 
        const bdNow = new Date(now.getTime() + bdOffset);

        if (ampm === 'pm' && hours < 12) hours += 12;
        if (ampm === 'am' && hours === 12) hours = 0;

        const targetTime = new Date(bdNow);
        targetTime.setUTCHours(hours, minutes, 0, 0);

        if (targetTime < bdNow) return ctx.reply(locale[lang].time_past);

        const diffMs = targetTime - bdNow;
        const diffMins = diffMs / (1000 * 60);

        if (diffMins > 120) return ctx.reply(locale[lang].max_time_exceeded);

        const finalTargetDate = new Date(now.getTime() + diffMs);
        
        // 🛠️ FIX: মিলি-সেকেন্ড পাস না করে সরাসরি স্ট্যান্ডার্ড ISO স্ট্রিং সেভ করা হচ্ছে
        session.countdown = finalTargetDate.toISOString(); 
        
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
        const uniqueId = Math.random().toString(36).substring(2, 9);
        linkDatabase[uniqueId] = {
            userId: userId,
            name: session.name,
            username: session.username,
            type: session.type,
            theme: session.theme,
            music: session.music,
            countdown: session.countdown,
            animations: session.animations,
            letter: text.trim(),
            isActive: true
        };
        ctx.reply(locale[lang].link_ready(`${SERVER_URL}/love/${uniqueId}`));
        delete userSessions[userId];
        return;
    }

    if (session.step === 'AWAITING_CARD_NAME') {
        ctx.reply(locale[lang].card_ready);
        ctx.replyWithPhoto({ url: `https://dummyimage.com/600x400/ff4b72/fff.jpg&text=Happy+Wishing+Card+For+${encodeURIComponent(text)}` });
        delete userSessions[userId];
        sendMainMenu(ctx, false);
        return;
    }

    if (session.step === 'AWAITING_FEEDBACK') {
        if (text.length < 5) return ctx.reply(locale[lang].feedback_short);
        bot.telegram.sendMessage(ADMIN_CHAT_ID, `📝 **New Feedbacks Inbox Alert:**\n\n👤 User: ${ctx.from.first_name} ID: [${userId}]\n💬 Text: ${text}`);
        ctx.reply(locale[lang].feedback_success);
        delete userSessions[userId];
        sendMainMenu(ctx, false);
        return;
    }

    // 👑 Admins Special Strings Catch Engines
    if (session.step === 'ADM_AWAITING_BROADCAST') {
        let sent = 0;
        registeredUsers.forEach(u => {
            bot.telegram.sendMessage(u, `📢 **Broadcast Alert From Admin Panel:**\n\n${text}`).then(() => sent++).catch(()=>{});
        });
        ctx.reply(`📢 Broadcast process triggered successfully to background streams.`);
        delete userSessions[userId];
        return;
    }

    if (session.step === 'ADM_AWAITING_NUKE_CONFIRM') {
        if (text.trim() === 'NUKE-ALL') {
            Object.keys(linkDatabase).forEach(k => { if (!k.startsWith('demo_')) delete linkDatabase[k]; });
            ctx.reply("🔥 SYSTEM CRYPTO DUMP WIPED OUT completely! All non-demo links deleted.");
        } else {
            ctx.reply("❌ Nuke operation halted due to incorrect passphrase token.");
        }
        delete userSessions[userId];
        return;
    }
});

// 🌐 REST JSON APIs Configuration Endpoints
app.get('/love/:id', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/api/get-content', (req, res) => {
    const { id } = req.body;
    const data = linkDatabase[id];
    
    if (!data || data.isActive === false) {
        return res.json({ success: false });
    }

    if (data.countdown) {
        const targetTime = new Date(data.countdown);
        const now = new Date();
        
        if (targetTime > now) {
            return res.json({
                success: true,
                isLocked: true,
                targetTime: data.countdown,
                theme: data.theme
            });
        }
    }

    // 🔔 Notify user that someone opened their link
    bot.telegram.sendMessage(data.userId, locale['bn'].someone_opened(data.type, new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Dhaka' }))).catch(()=>{});

    res.json({
        success: true,
        isLocked: false,
        type: data.type,
        theme: data.theme,
        music: data.music,
        animations: data.animations,
        letter: data.letter
    });
});

app.post('/api/respond', (req, res) => {
    const { response, id } = req.body;
    const data = linkDatabase[id];
    
    if (data && data.isActive !== false) {
        bot.telegram.sendMessage(data.userId, locale['bn'].new_response(data.type, response)).catch(()=>{});
        return res.json({ success: true });
    }
    res.json({ success: false });
});

// 🛠️ Boot up Server and Listen Engines
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    bot.launch();
    console.log(`Wishing engine listening gracefully on port infrastructure: ${PORT}`);
});
