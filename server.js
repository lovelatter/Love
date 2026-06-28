const express = require('express');
const path = require('path');
const axios = require('axios');
const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');

const app = express();
app.use(express.json());

const TELEGRAM_TOKEN = "8922778423:AAGbdZfdUDol_5w3dPbeBH0aucf9qkgtPTA"; 
const SERVER_URL = "https://love-bb7p.onrender.com"; 
const ADMIN_CHAT_ID = "6719885052"; 

const bot = new Telegraf(TELEGRAM_TOKEN);

const linkDatabase = {}; 
const userSessions = {}; 
const registeredUsers = new Set(); 
const bannedUsers = new Set(); 
const userLanguages = {}; 
let isMaintenanceMode = false; 

const categories = ['love', 'crush', 'birthday', 'anniversary', 'newyear', 'boishakh', 'friend', 'eid', 'sorry'];
categories.forEach(cat => {
    linkDatabase[`demo_${cat}`] = {
        userId: ADMIN_CHAT_ID, name: "Developer", username: "@admin", type: cat, theme: "classic", music: "none", countdown: null,
        animations: ["Hello Dear", "How are you?", "I have a surprise for you... 👀"],
        letter: `This is a demo page.\nWhen you create your custom link, your written letter will be displayed beautifully inside the envelope like this! ✨`,
        isActive: true
    };
});

// 🌐 মাল্টি-ল্যাঙ্গুয়েজ ডিকশনারি (নতুন সহজ টাইম ফরম্যাট ও ২ ঘণ্টার লিমিট মেসেজ সহ)
const locale = {
    bn: {
        welcome: (name) => `💝 **হ্যালো ${name}!** 💝\n\nঅল-ইন-ওয়ান উইশিং অ্যান্ড破解 বটের পক্ষ থেকে স্বাগতম। নিচের যেকোনো একটি অপশন সিলেক্ট করুন:`,
        btn_make: "🚀 লিঙ্ক তৈরি করুন", btn_card: "🖼️ উইশ কার্ড বানান", btn_demo: "👀 ডেমো দেখুন", btn_stats: "📊 স্ট্যাটাস", btn_off: "🔒 লিঙ্ক বন্ধ করুন", btn_feedback: "📝 মতামত", btn_help: "❓ সাহায্য", btn_lang: "🌐 ভাষা পরিবর্তন (Change Lang)", btn_back: "🔙 মেইন মেনু",
        choose_cat: "✨ **আপনি কোন ক্যাটাগরির লিঙ্ক তৈরি করতে চান? নিচে থেকে সিলেক্ট করুন:**",
        cat_love: "❤️ প্রেমের চিঠি", cat_crush: "💖 ক্রাশ কনফেশন", cat_birthday: "🎂 জন্মদিনের শুভেচ্ছা", cat_anniversary: "💍 বিবাহবার্ষিকী", cat_newyear: "🎉 নতুন বছর", cat_boishakh: "🌾 পহেলা বৈশাখ", cat_friend: "🫂 সেরা বন্ধু", cat_eid: "🌙 ঈদ মোবারক", cat_sorry: "🥺 দুঃখ প্রকাশ",
        prompt_countdown_ask: "⏰ **আপনি কি এই লিঙ্কে কাউন্টডাউন টাইমার (Time Countdown) সেট করতে চান?**\n\n(টাইমার সেট করলে আপনার দেওয়া সময়ের আগে কেউ লিঙ্কের মূল মেসেজ দেখতে পারবে না, শুধু কাউন্টডাউন দেখবে।)",
        btn_yes: "✅ হ্যাঁ, চাই", btn_no: "❌ না, লাগবে না",
        prompt_time_input: "⏳ অনুগ্রহ করে আজ কোন সময়ে কাউন্টডাউন শেষ হবে তা লিখে পাঠান।\n\nFormat: \`HH:MMam\` অথবা \`HH:MMpm\`\nExample: \`12:02pm\` বা \`4:30am\` বা \`12:2pm\`\n\n⚠️ **সর্বোচ্চ ২ ঘণ্টা পর্যন্ত সময় দিতে পারবেন।**",
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
        invalid_cmd: (cmd) => `❌ **ভুল কমান্ড:** \`${cmd}\` এই বটটিতে গ্রহণযোগ্য নয়!`,
        btn_open_help: "❓ সাহায্য মেনু দেখুন",
        maint_msg: "🚧 **বটের কাজ চলছে (Under Maintenance)!**",
        no_links: "❌ আপনি এখনো কোনো লিঙ্ক তৈরি করেননি।",
        profile_report: (name, list) => `📊 **আপনার প্রোফাইল রিপোর্ট:**\n\n👤 নাম: ${name}\n🎫 আপনার লিঙ্কসমূহ:\n${list}`,
        btn_want_deactivate: "🔒 লিঙ্ক ডিঅ্যাক্টিভেট করতে চান?",
        no_active_links: "💡 আপনার এই মুহূর্তে কোনো সক্রিয় লিঙ্ক নেই。",
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
        welcome: (name) => `💝 **Hello ${name}!** 💝\n\nWelcome to Wishing Bot. Choose an option:`,
        btn_make: "🚀 Make Link", btn_card: "🖼️ Wish Card Generator", btn_demo: "👀 Demo", btn_stats: "📊 Stats", btn_off: "🔒 Off Link", btn_feedback: "📝 Feedback", btn_help: "❓ Help", btn_lang: "🌐 Change Language", btn_back: "🔙 Main Menu",
        choose_cat: "✨ **Select Category:**",
        cat_love: "❤️ Love Letter", cat_crush: "💖 Crush Confession", cat_birthday: "🎂 Birthday Wish", cat_anniversary: "💍 Anniversary Wish", cat_newyear: "🎉 New Year Wish", cat_boishakh: "🌾 Pohela Boishakh", cat_friend: "🫂 Best Friend", cat_eid: "🌙 Eid Wish", cat_sorry: "🥺 Sorry Letter",
        prompt_countdown_ask: "⏰ **Do you want to set a Time Countdown Timer for this link?**",
        btn_yes: "✅ Yes", btn_no: "❌ No",
        prompt_time_input: "⏳ Send the time for countdown to end today.\n\nFormat: \`HH:MMam\` or \`HH:MMpm\`\nExample: \`12:02pm\` or \`4:30am\`\n\n⚠️ **Maximum limit is 2 hours from now.**",
        invalid_time: "❌ Invalid format! Please follow: \`12:02pm\` or \`4:30am\`",
        max_time_exceeded: "⚠️ Sorry! You cannot set countdown time for more than 2 hours from current time.",
        time_past: "❌ You cannot set a past time.",
        prompt_theme: "🎨 **Select a Premium Web Theme (Free):**",
        prompt_music: "🎵 **Select a Background Music (Free):**",
        prompt_card_name: "🖼️ Enter the name you want to print on the Wish Card:",
        card_ready: "✨ **Your premium Wish Card is ready!** 👇",
        help_text: `❓ **How to use?**\n\n1. Click 🚀 **Make Link**.\n2. Right after choosing category, you can set a countdown timer for up to 2 hours.\n3. Choose theme, music, send text lines and generate your link.`,
        feedback_prompt: "📝 Please send your feedback:",
        feedback_short: "❌ Please write more details.",
        feedback_success: "✅ Feedback submitted!",
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
        session_started: (cat) => `✨ Custom ${cat.toUpperCase()} Link started! Send animation texts line by line:`,
        demo_title: "👀 **Select demo page:**",
        demo_ready: (type, url) => `✨ **Demo Link:** ${url}`,
        input_anim_success: (count) => `✅ Added ${count} lines. Send main letter:`,
        link_ready: (url) => `💝 Link Ready:\n\n${url}`,
        btn_rate_feedback: "📝 Give feedback",
        someone_opened: (type, time) => `👀 **Notification:** Someone opened your \`${type.toUpperCase()}\` link!\n⏰ **Time:** ${time}`,
        new_response: (type, res) => `💌 New response: ${res}`
    }
};

// 🛠️ মেইনটেন্যান্স ও ব্যান ফিল্টার
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
    const text = `👑 **Welcome Boss! Your Complete Admin Dashboard:**\n\nUse the buttons below to control the bot's activities instantly.`;
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📊 Bot Live Stats', 'adm_stats'), Markup.button.callback('📋 All Links List', 'adm_alllinks_main')],
        [Markup.button.callback('⚙️ Maintenance (On/Off)', 'adm_toggle_maint'), Markup.button.callback('📢 Broadcast Message', 'adm_prompt_broadcast')],
        [Markup.button.callback('🧼 Clean Inactive Links', 'adm_clean'), Markup.button.callback('💾 Database Backup', 'adm_backup')],
        [Markup.button.callback('🔥 Delete All Links (NUKE)', 'adm_prompt_nuke')]
    ]);
    if (isEdit) return ctx.editMessageText(text, keyboard).catch(e => {});
    return ctx.reply(text, keyboard);
}

// 🎯 স্টার্ট কম্যান্ড
bot.command('start', (ctx) => {
    registeredUsers.add(ctx.chat.id);
    sendMainMenu(ctx, false);
});

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
    ctx.answerCbQuery(selectedLang === 'bn' ? "ভাষা বাংলা সেট করা হয়েছে!" : "Language has been set to English!");
    sendMainMenu(ctx, true);
});

bot.action('go_to_main_menu', (ctx) => { ctx.answerCbQuery(); sendMainMenu(ctx, true); });
bot.action('go_to_admin_dashboard', (ctx) => { ctx.answerCbQuery(); sendAdminDashboard(ctx, true); });

// 👑 ==================== ADMIN CORE COMMANDS ==================== 👑
bot.command('adm', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return ctx.reply("⚠️ **Access Denied!**");
    sendAdminDashboard(ctx, false);
});

bot.action('adm_stats', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    ctx.answerCbQuery();
    const totalUsers = registeredUsers.size;
    let totalLinks = 0;
    Object.keys(linkDatabase).forEach(id => { if(!id.startsWith('demo_')) totalLinks++; });
    const text = `📊 **Bot Live Statistics Summary:**\n\n👥 Total Active Users: \`${totalUsers}\`\n🔗 Total Links Generated: \`${totalLinks}\`\n🚫 Total Banned Users: \`${bannedUsers.size}\`\n⚙️ Maintenance Mode: \`${isMaintenanceMode ? "ON 🚧" : "OFF 🟢"}\``;
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('👥 User List', 'adm_sub_userlist'), Markup.button.callback('📋 All Links List', 'adm_alllinks_stats')],
        [Markup.button.callback('🚫 Banned Users List', 'adm_sub_banlist')],
        [Markup.button.callback('🔙 Back to Dashboard', 'go_to_admin_dashboard')]
    ]);
    ctx.editMessageText(text, keyboard);
});

bot.action('adm_sub_userlist', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    ctx.answerCbQuery();
    let userArr = Array.from(registeredUsers);
    let text = `👥 **Registered Users List (${userArr.length}):**\n\n`;
    userArr.slice(0, 50).forEach((uId, idx) => {
        const isBanned = bannedUsers.has(uId) || bannedUsers.has(Number(uId));
        text += `${idx + 1}. User ID: \`${uId}\` ${isBanned ? '🔴 (Banned)' : '🟢 (Active)'}\n`;
    });
    const keyboard = Markup.inlineKeyboard([[Markup.button.callback('🚫 Ban User', 'adm_prompt_input_ban')], [Markup.button.callback('🔙 Back to Stats', 'adm_stats')]]);
    ctx.editMessageText(text, keyboard);
});

bot.action('adm_prompt_input_ban', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    ctx.answerCbQuery();
    userSessions[ctx.chat.id] = { step: 'AWAITING_BAN_ID_INPUT' };
    ctx.reply("🚫 Please write the **User ID** you want to ban:");
});

bot.action('adm_sub_banlist', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    ctx.answerCbQuery();
    let banArr = Array.from(bannedUsers);
    let text = `🚫 **Banned Users List (${banArr.length}):**\n\n`;
    banArr.forEach((uId, idx) => { text += `${idx + 1}. User ID: \`${uId}\` 🚫\n`; });
    const keyboard = Markup.inlineKeyboard([[Markup.button.callback('🔓 Unban User', 'adm_prompt_input_unban')], [Markup.button.callback('🔙 Back to Stats', 'adm_stats')]]);
    ctx.editMessageText(text, keyboard);
});

bot.action('adm_prompt_input_unban', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    ctx.answerCbQuery();
    userSessions[ctx.chat.id] = { step: 'AWAITING_UNBAN_ID_INPUT' };
    ctx.reply("🔓 Please write the **User ID** you want to UNBAN:");
});

const renderAllLinksList = () => {
    let list = [];
    Object.keys(linkDatabase).forEach(id => {
        if (!id.startsWith('demo_')) {
            const status = linkDatabase[id].isActive !== false ? "🟢" : "🔴";
            list.push(`${status} ID: \`${id}\` | \`${linkDatabase[id].type.toUpperCase()}\` | Maker: ${linkDatabase[id].name}`);
        }
    });
    return list.length === 0 ? "💡 No links generated in database yet." : `📋 **All Generated Links List:**\n\n${list.slice(0, 30).join('\n')}\n\n💡 Ban: /banlink [ID] | Details: /linkdetails [ID]`;
};

bot.action('adm_alllinks_main', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    ctx.answerCbQuery();
    ctx.editMessageText(renderAllLinksList(), Markup.inlineKeyboard([[Markup.button.callback('🔙 Back to Dashboard', 'go_to_admin_dashboard')]]));
});

bot.action('adm_alllinks_stats', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    ctx.answerCbQuery();
    ctx.editMessageText(renderAllLinksList(), Markup.inlineKeyboard([[Markup.button.callback('🔙 Back to Stats', 'adm_stats')]]));
});

bot.action('adm_toggle_maint', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    ctx.answerCbQuery();
    isMaintenanceMode = !isMaintenanceMode;
    ctx.reply(`⚙️ Maintenance Mode turned **${isMaintenanceMode ? "ON 🚧" : "OFF 🟢"}**!`);
    sendAdminDashboard(ctx, false);
});

bot.action('adm_clean', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    ctx.answerCbQuery();
    let count = 0;
    Object.keys(linkDatabase).forEach(id => { if (!id.startsWith('demo_') && linkDatabase[id].isActive === false) { delete linkDatabase[id]; count++; } });
    ctx.reply(`🧼 Database cleared! Total \`${count}\` inactive links deleted.`);
});

bot.action('adm_backup', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    ctx.answerCbQuery();
    try {
        const backupData = JSON.stringify(linkDatabase, null, 2);
        fs.writeFileSync('backup.txt', backupData);
        ctx.replyWithDocument({ source: fs.createReadStream('backup.txt'), filename: 'database_backup.txt' });
    } catch(e) { ctx.reply("❌ Backup Error."); }
});

bot.action('adm_prompt_broadcast', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    ctx.answerCbQuery();
    userSessions[ctx.chat.id] = { step: 'AWAITING_BROADCAST' };
    ctx.reply("📢 Type and send your broadcast notification message:");
});

bot.action('adm_prompt_nuke', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    ctx.answerCbQuery();
    ctx.editMessageText("⚠️ **WARNING BOSS!** Nuke all user links?", Markup.inlineKeyboard([[Markup.button.callback('💥 YES, NUKE', 'adm_confirm_nuke')], [Markup.button.callback('❌ Cancel', 'go_to_admin_dashboard')]]));
});

bot.action('adm_confirm_nuke', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    ctx.answerCbQuery();
    let count = 0;
    for (let key in linkDatabase) { if (!key.startsWith('demo_')) { delete linkDatabase[key]; count++; } }
    ctx.editMessageText(`🔥 Nuke Successful. Deleted \`${count}\` links.`, Markup.inlineKeyboard([[Markup.button.callback('🔙 Dashboard', 'go_to_admin_dashboard')]]));
});

// 🖼️ ১. WISH CARD GENERATOR
bot.action('menu_cardgen', (ctx) => {
    ctx.answerCbQuery();
    const lang = userLanguages[ctx.chat.id] || 'bn';
    userSessions[ctx.chat.id] = { step: 'AWAITING_CARD_NAME' };
    ctx.reply(locale[lang].prompt_card_name);
});

// 🚀 ২. LINK GENERATOR FLOW (ক্যাটাগরি সিলেক্টের পরই কাউন্টডাউন অপশন রাখা হয়েছে)
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
    userSessions[ctx.chat.id] = { type: type, name: ctx.from.first_name, username: ctx.from.username ? '@' + ctx.from.username : 'None' };
    
    // ক্যাটাগরি সিলেক্টের পর সরাসরি টাইম কাউন্টডাউন প্রম্পট
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

// থিম সিলেকশন প্রম্পট ফাংশন
function askThemeSelection(ctx) {
    const lang = userLanguages[ctx.chat.id] || 'bn';
    const text = locale[lang].prompt_theme;
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('✨ Classic Pink', 'set_theme_classic'), Markup.button.callback('🌌 Neon Magic', 'set_theme_neon')],
        [Markup.button.callback('🎈 Birthday Gold', 'set_theme_gold'), Markup.button.callback('❤️ Dark Romance', 'set_theme_dark')]
    ]);
    
    // যদি মেসেজটি টেক্সট ইনপুটের পর পাঠাতে হয়
    if (ctx.message) {
        ctx.reply(text, keyboard);
    } else {
        ctx.editMessageText(text, keyboard).catch(e => ctx.reply(text, keyboard));
    }
}

bot.action(/^set_theme_/, (ctx) => {
    ctx.answerCbQuery();
    const theme = ctx.match.input.replace('set_theme_', '');
    const lang = userLanguages[ctx.chat.id] || 'bn';
    userSessions[ctx.chat.id].theme = theme;

    ctx.editMessageText(locale[lang].prompt_music,
        Markup.inlineKeyboard([
            [Markup.button.callback('🎵 Romantic Flute', 'set_music_romantic'), Markup.button.callback('🎂 Happy Birthday Tune', 'set_music_birthday')],
            [Markup.button.callback('🎹 Soft Piano Instrumental', 'set_music_piano'), Markup.button.callback('🔇 No Music', 'set_music_none')]
        ])
    );
});

bot.action(/^set_music_/, (ctx) => {
    ctx.answerCbQuery();
    const music = ctx.match.input.replace('set_music_', '');
    const lang = userLanguages[ctx.chat.id] || 'bn';
    userSessions[ctx.chat.id].music = music;

    userSessions[ctx.chat.id].step = 'AWAITING_ANIMATION_TEXT';
    ctx.reply(locale[lang].session_started(userSessions[ctx.chat.id].type));
});

bot.action(/^demo_/, (ctx) => {
    const selectedType = ctx.match.input.replace('demo_', '');
    const lang = userLanguages[ctx.chat.id] || 'bn';
    ctx.answerCbQuery();
    ctx.reply(locale[lang].demo_ready(selectedType, `${SERVER_URL}/love/demo_${selectedType}`));
});

bot.action('menu_help', (ctx) => {
    ctx.answerCbQuery();
    const lang = userLanguages[ctx.chat.id] || 'bn';
    ctx.editMessageText(locale[lang].help_text, Markup.inlineKeyboard([[Markup.button.callback(locale[lang].btn_back, 'go_to_main_menu')]]));
});

bot.action('menu_feedback', (ctx) => {
    ctx.answerCbQuery();
    const lang = userLanguages[ctx.chat.id] || 'bn';
    userSessions[ctx.chat.id] = { step: 'AWAITING_FEEDBACK', name: ctx.from.first_name };
    ctx.reply(locale[lang].feedback_prompt);
});

bot.action('menu_stats', (ctx) => {
    ctx.answerCbQuery();
    const userId = ctx.chat.id; 
    const lang = userLanguages[userId] || 'bn';
    let myLinks = [];
    Object.keys(linkDatabase).forEach(id => {
        if (linkDatabase[id].userId === userId && !id.startsWith('demo_')) {
            const status = linkDatabase[id].isActive !== false ? "🟢 Active" : "🔴 Deactivated";
            myLinks.push(`🎫 ID: \`${id}\` (${linkDatabase[id].type.toUpperCase()}) [${status}]`);
        }
    });
    const responseText = myLinks.length === 0 ? locale[lang].no_links : locale[lang].profile_report(ctx.from.first_name, myLinks.join('\n'));
    ctx.editMessageText(responseText, Markup.inlineKeyboard([[Markup.button.callback(locale[lang].btn_want_deactivate, 'menu_off')], [Markup.button.callback(locale[lang].btn_back, 'go_to_main_menu')]]).catch(e=>{}));
});

bot.action('menu_off', (ctx) => {
    ctx.answerCbQuery();
    const userId = ctx.chat.id;
    const lang = userLanguages[userId] || 'bn';
    let buttons = [];
    Object.keys(linkDatabase).forEach(id => {
        if (linkDatabase[id].userId === userId && !id.startsWith('demo_') && linkDatabase[id].isActive !== false) {
            buttons.push([Markup.button.callback(`🚫 Off Link: ${id}`, `deactivate_${id}`)]);
        }
    });
    if (buttons.length === 0) return ctx.editMessageText(locale[lang].no_active_links, Markup.inlineKeyboard([[Markup.button.callback(locale[lang].btn_back, 'go_to_main_menu')]]));
    buttons.push([Markup.button.callback(locale[lang].off_all_links, 'deactivate_all')]);
    buttons.push([Markup.button.callback(locale[lang].btn_back, 'go_to_main_menu')]);
    ctx.editMessageText(locale[lang].off_link_title, Markup.inlineKeyboard(buttons));
});

bot.action(/^deactivate_/, (ctx) => {
    ctx.answerCbQuery();
    const target = ctx.match.input.replace('deactivate_', '');
    const userId = ctx.chat.id;
    const lang = userLanguages[userId] || 'bn';
    if (target === 'all') {
        let count = 0;
        Object.keys(linkDatabase).forEach(id => { if (linkDatabase[id].userId === userId && !id.startsWith('demo_') && linkDatabase[id].isActive !== false) { linkDatabase[id].isActive = false; count++; } });
        return ctx.reply(locale[lang].deactivate_success_all(count));
    }
    if (linkDatabase[target] && linkDatabase[target].userId === userId) {
        linkDatabase[target].isActive = false;
        ctx.reply(locale[lang].deactivate_success_single(target));
    }
});

// 🎯 টেক্সট ইনপুট প্রসেস (অ্যাডমিন কম্যান্ড এবং কাস্টম টাইম লজিক সহ)
bot.on('text', (ctx) => {
    const userId = ctx.chat.id;
    const session = userSessions[userId];
    const text = ctx.message.text;
    const lang = userLanguages[userId] || 'bn';
    
    if (String(userId) === String(ADMIN_CHAT_ID)) {
        if (text.startsWith('/userinfo')) {
            const targetUid = text.replace('/userinfo', '').trim();
            if (!targetUid) return ctx.reply("❌ Usage: /userinfo [User_ID]");
            let userLinksCount = 0;
            Object.keys(linkDatabase).forEach(id => { if (String(linkDatabase[id].userId) === String(targetUid)) userLinksCount++; });
            const isBanned = bannedUsers.has(Number(targetUid)) || bannedUsers.has(targetUid);
            return ctx.reply(`👤 **User Information:**\n\n🆔 User ID: \`${targetUid}\`\n📊 Total Links Created: \`${userLinksCount}\` \n🚦 Status: ${isBanned ? "🔴 Banned" : "🟢 Active"}`);
        }
        if (text.startsWith('/banlink')) {
            const targetId = text.replace('/banlink', '').trim();
            if (!targetId || !linkDatabase[targetId] || targetId.startsWith('demo_')) return ctx.reply("❌ Invalid Link ID!");
            linkDatabase[targetId].isActive = false;
            ctx.reply(`🚫 Link \`${targetId}\` has been successfully blocked!`);
            return bot.telegram.sendMessage(linkDatabase[targetId].userId, `⚠️ **Notice:** Your link (\`${targetId}\`) has been blocked by Admin.`).catch(e => {});
        }
        if (text.startsWith('/linkdetails')) {
            const targetId = text.replace('/linkdetails', '').trim();
            if (!targetId || !linkDatabase[targetId]) return ctx.reply("❌ Invalid Link ID!");
            const data = linkDatabase[targetId];
            return ctx.reply(`🔍 **Link ID: ${targetId} Details:**\n\n👤 Creator: ${data.name}\n🏷 Category: \`${data.type}\`\n🎬 Animations: \`${JSON.stringify(data.animations)}\`\n💌 Letter:\n"${data.letter}"`);
        }
        if (text.startsWith('/blockuser')) {
            const targetUid = text.replace('/blockuser', '').trim();
            if (!targetUid || String(targetUid) === String(ADMIN_CHAT_ID)) return ctx.reply("❌ Invalid User ID!");
            bannedUsers.add(Number(targetUid)); bannedUsers.add(targetUid);
            return ctx.reply(`🚫 User \`${targetUid}\` has been successfully banned!`);
        }
        if (text.startsWith('/unblockuser')) {
            const targetUid = text.replace('/unblockuser', '').trim();
            if (!targetUid) return ctx.reply("❌ Invalid User ID!");
            bannedUsers.delete(Number(targetUid)); bannedUsers.delete(targetUid);
            return ctx.reply(`🔓 User \`${targetUid}\` has been unbanned.`);
        }
    }

    if (!session && text.startsWith('/')) {
        if (text !== '/start' && text !== '/cancel') return ctx.reply(locale[lang].invalid_cmd(text));
    }

    if (!session) return;

    if (session.step === 'AWAITING_BAN_ID_INPUT' && String(userId) === String(ADMIN_CHAT_ID)) {
        bannedUsers.add(text.trim()); bannedUsers.add(Number(text.trim()));
        ctx.reply("✅ User Banned Successfully."); delete userSessions[userId]; return;
    }
    if (session.step === 'AWAITING_UNBAN_ID_INPUT' && String(userId) === String(ADMIN_CHAT_ID)) {
        bannedUsers.delete(text.trim()); bannedUsers.delete(Number(text.trim()));
        ctx.reply("🔓 User Unbanned Successfully."); delete userSessions[userId]; return;
    }
    if (session.step === 'AWAITING_BROADCAST' && String(userId) === String(ADMIN_CHAT_ID)) {
        registeredUsers.forEach(uId => { bot.telegram.sendMessage(uId, `📢 **Official Notification:**\n\n${text}`).catch(e=>{}); });
        ctx.reply("📢 Broadcast Finished."); delete userSessions[userId]; sendAdminDashboard(ctx, false); return;
    }
    if (session.step === 'AWAITING_FEEDBACK') {
        if (text.trim().length < 5) return ctx.reply(locale[lang].feedback_short);
        bot.telegram.sendMessage(ADMIN_CHAT_ID, `💬 **Feedback from ${session.name} (ID: ${userId}):** ${text}`).catch(e=>{});
        ctx.reply(locale[lang].feedback_success); delete userSessions[userId]; return;
    }

    if (session.step === 'AWAITING_CARD_NAME') {
        ctx.reply(locale[lang].card_ready);
        const cardUrl = `https://dummyimage.com/800x500/ff4b72/fff.png&text=Best+Wishes+To+${encodeURIComponent(text)}!+✨`;
        ctx.replyWithPhoto(cardUrl).then(() => { delete userSessions[userId]; });
        return;
    }

    // ⏳ নতুন অ্যাডভান্সড ২-ঘণ্টা লিমিট ও সহজ টাইম ফরম্যাট ক্যালকুলেশন লজিক
    if (session.step === 'AWAITING_COUNTDOWN_TIME') {
        const inputStr = text.trim().toLowerCase().replace(/\s+/g, '');
        const match = inputStr.match(/^(\d{1,2}):(\d{2})(am|pm)$/);
        
        if (!match) {
            return ctx.reply(locale[lang].invalid_time);
        }

        let hours = parseInt(match[1]);
        const minutes = parseInt(match[2]);
        const ampm = match[3];

        if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) {
            return ctx.reply(locale[lang].invalid_time);
        }

        // বর্তমান বাংলাদেশি সময় বের করা
        const now = new Date();
        const bdOffset = 6 * 60 * 60 * 1000; // UTC+6
        const bdNow = new Date(now.getTime() + bdOffset);

        // ইনপুট দেওয়া সময়কে আজকের ডেটে রূপান্তর করা
        if (ampm === 'pm' && hours < 12) hours += 12;
        if (ampm === 'am' && hours === 12) hours = 0;

        const targetTime = new Date(bdNow);
        targetTime.setUTCHours(hours, minutes, 0, 0);

        // যদি ইনপুট করা সময় অলরেডি পার হয়ে গিয়ে থাকে
        if (targetTime < bdNow) {
            return ctx.reply(locale[lang].time_past);
        }

        // ২ ঘণ্টার (১২০ মিনিট) বেশি কিনা তা চেক করা
        const diffMs = targetTime - bdNow;
        const diffMins = diffMs / (1000 * 60);

        if (diffMins > 120) {
            return ctx.reply(locale[lang].max_time_exceeded);
        }

        // ডাটাবেজে স্টোর করার জন্য ISO ফরম্যাটে কনভার্ট করে সেভ করা
        const finalTargetDate = new Date(now.getTime() + diffMs);
        session.countdown = finalTargetDate.toISOString();
        
        // কাউন্টডাউন সাকসেস হলে পরবর্তী থিম মেনুতে নিয়ে যাওয়া
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
            userId: userId, name: session.name, username: session.username, type: session.type,
            theme: session.theme, music: session.music, countdown: session.countdown,
            animations: session.animations, letter: text.trim(), isActive: true 
        };
        ctx.reply(locale[lang].link_ready(`${SERVER_URL}/love/${uniqueId}`));
        
        if (String(userId) !== String(ADMIN_CHAT_ID)) {
            bot.telegram.sendMessage(ADMIN_CHAT_ID, `🚨 **New Link!**\n👤 **Creator:** ${session.name}\n🎫 **ID:** ${uniqueId}`).catch(e=>{});
        }
        delete userSessions[userId];
    }
});

bot.command('cancel', (ctx) => {
    const lang = userLanguages[ctx.chat.id] || 'bn';
    if (userSessions[ctx.chat.id]) { delete userSessions[ctx.chat.id]; ctx.reply(locale[lang].session_cancelled); }
    else ctx.reply(locale[lang].no_session);
});

// 🎯 এক্সপ্রেস ও ফ্রন্টএন্ড এপিআই রাউটিং
app.get('/love/:id', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.post('/api/get-content', (req, res) => {
    const { id } = req.body;
    const data = linkDatabase[id];
    if (!data || data.isActive === false) return res.json({ success: false });

    // লাইভ সার্ভার কাউন্টডাউন লক লজিক
    if (data.countdown) {
        const targetTime = new Date(data.countdown);
        const now = new Date();
        if (targetTime > now) {
            return res.json({ success: true, isLocked: true, targetTime: data.countdown, theme: data.theme });
        }
    }

    if (!id.startsWith('demo_')) {
        const openTime = new Date().toLocaleString("en-US", {timeZone: "Asia/Dhaka"});
        const userLang = userLanguages[data.userId] || 'bn';
        bot.telegram.sendMessage(data.userId, locale[userLang].someone_opened(data.type, openTime)).catch(e=>{});
    }

    res.json({ 
        success: true, isLocked: false, type: data.type, theme: data.theme,
        music: data.music, animations: data.animations, letter: data.letter 
    });
});

app.post('/api/respond', (req, res) => {
    const { response, id } = req.body; const data = linkDatabase[id];
    if (data && data.isActive !== false) {
        if (!id.startsWith('demo_')) {
            const userLang = userLanguages[data.userId] || 'bn';
            bot.telegram.sendMessage(data.userId, locale[userLang].new_response(data.type, response));
        }
        res.json({ success: true });
    } else res.json({ success: false });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { bot.launch(); console.log(`Live on ${PORT}`); });
