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
const userLanguages = {}; // ইউজারদের ভাষা মনে রাখার জন্য { userId: 'bn' বা 'en' }
let isMaintenanceMode = false; 

// 🎯 ডেমো ডাটাবেজ ক্যাটাগরি সেটআপ
const categories = ['love', 'crush', 'birthday', 'anniversary', 'newyear', 'boishakh', 'friend', 'eid', 'sorry'];
categories.forEach(cat => {
    linkDatabase[`demo_${cat}`] = {
        userId: ADMIN_CHAT_ID,
        name: "Developer",
        username: "@admin",
        type: cat,
        animations: ["Hello Dear", "How are you?", "I have a surprise for you... 👀"],
        letter: `This is a demo page.\nWhen you create your custom link, your written letter will be displayed beautifully inside the envelope like this! ✨`,
        isActive: true
    };
});

// 🌐 মাল্টি-ল্যাঙ্গুয়েজ ডিকশনারি (ডিফল্ট: বাংলা)
const locale = {
    bn: {
        welcome: (name) => `💝 **হ্যালো ${name}!** 💝\n\nঅল-ইন-ওয়ান উইশিং অ্যান্ড কনফেশন বটের পক্ষ থেকে স্বাগতম। নিচের যেকোনো একটি অপশন সিলেক্ট করুন:`,
        btn_make: "🚀 লিঙ্ক তৈরি করুন",
        btn_demo: "👀 ডেমো দেখুন",
        btn_stats: "📊 স্ট্যাটাস",
        btn_off: "🔒 লিঙ্ক বন্ধ করুন",
        btn_feedback: "📝 মতামত",
        btn_help: "❓ সাহায্য",
        btn_lang: "🌐 ভাষা পরিবর্তন (Change Lang)",
        btn_back: "🔙 মেইন মেনু",
        choose_cat: "✨ **আপনি কোন ক্যাটাগরির লিঙ্ক তৈরি করতে চান? নিচে থেকে সিলেক্ট করুন:**",
        cat_love: "❤️ প্রেমের চিঠি", cat_crush: "💖 ক্রাশ কনফেশন", cat_birthday: "🎂 জন্মদিনের শুভেচ্ছা",
        cat_anniversary: "💍 বিবাহবার্ষিকী", cat_newyear: "🎉 নতুন বছর", cat_boishakh: "🌾 পহেলা বৈশাখ",
        cat_friend: "🫂 সেরা বন্ধু", cat_eid: "🌙 ঈদ মোবারক", cat_sorry: "🥺 দুঃখ প্রকাশ",
        help_text: `❓ **কিভাবে ব্যবহার করবেন?**\n\n১. প্রথমে 🚀 **লিঙ্ক তৈরি করুন** বাটনে ক্লিক করুন।\n২. আপনার পছন্দের ক্যাটাগরি সিলেক্ট করুন।\n৩. অ্যানিমেশন টেক্সটগুলো এক এক লাইন করে পাঠান এবং নির্দেশ অনুযায়ী শেষ চিঠিটি লিখে পাঠিয়ে দিন।\n৪. তৈরি হওয়া লিঙ্কটি কপি করে আপনার বিশেষ মানুষকে পাঠান। তারা লিঙ্কটি ওপেন করলেই আপনি বটের মাধ্যমে সাথে সাথে নোটিফিকেশন পেয়ে যাবেন!\n\n❌ যেকোনো রানিং সেশন বাতিল করতে /cancel লিখুন।`,
        feedback_prompt: "📝 অনুগ্রহ করে আপনার মতামত বা পরামর্শ এখানে মেসেজ আকারে লিখে পাঠান:",
        feedback_short: "❌ মতামত একটু বড় করে লিখুন (কমপক্ষে ৫টি অক্ষর)।",
        feedback_success: "✅ আপনার মূল্যবান মতামত সফলভাবে জমা হয়েছে। ধন্যবাদ!",
        session_cancelled: "❌ আপনার চলমান লিঙ্ক তৈরির সেশনটি বাতিল করা হয়েছে।",
        no_session: "💡 আপনার কোনো একটিভ সেশন নেই।",
        invalid_cmd: (cmd) => `❌ **ভুল কমান্ড:** \`${cmd}\` এই বটটিতে গ্রহণযোগ্য নয়!\n\nঅনুগ্রহ করে নিচের বাটনগুলো অথবা সঠিক কমান্ড ব্যবহার করুন।`,
        btn_open_help: "❓ সাহায্য মেনু দেখুন",
        maint_msg: "🚧 **বটের কাজ চলছে (Under Maintenance)!**\n\nঅনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন। ধৈর্যের জন্য ধন্যবাদ।",
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
        demo_ready: (type, url) => `✨ **আপনার অনুরোধ করা ডেমো লিঙ্কটি তৈরি!**\n\n🏷️ ক্যাটাগরি: \`${type.toUpperCase()}\`\n🔗 ডেমো লিঙ্ক: ${url}\n\n💖 আপনার নিজের লেখা দিয়ে তৈরি করতে মেইন মেনু থেকে 🚀 **লিঙ্ক তৈরি করুন** ব্যবহার করুন!`,
        input_anim_success: (count) => `✅ চমৎকার! আপনি ${count} লাইনের অ্যানিমেশন যোগ করেছেন।\n\n💌 এবার খামের ভেতরের মূল চিঠি বা মেসেজটি লিখে পাঠান:`,
        link_ready: (url) => `💝 অভিনন্দন! আপনার কাস্টমাইজড লিঙ্ক সম্পূর্ণ রেডি:\n\n${url}\n\nএটি কপি করে পাঠিয়ে দিন। সে ওপেন করলেই আপনি নোটিফিকেশন পাবেন!`,
        btn_rate_feedback: "📝 বটটি কেমন লাগলো? মতামত দিন",
        someone_opened: (type, time) => `👀 **বিজ্ঞপ্তি:** কেউ একজন আপনার তৈরি করা \`${type.toUpperCase()}\` লিঙ্কটি ওপেন করেছে!\n⏰ **সময়:** ${time}`,
        new_response: (type, res) => `💌 আপনার কাস্টম \`${type.toUpperCase()}\` লিঙ্কে একটি নতুন রেসপন্স এসেছে!\n\nউত্তর: ${res}`
    },
    en: {
        welcome: (name) => `💝 **Hello ${name}!** 💝\n\nWelcome to All-in-One Wishing & Confession Bot. Choose an option from below:`,
        btn_make: "🚀 Make Link",
        btn_demo: "👀 Demo",
        btn_stats: "📊 Stats",
        btn_off: "🔒 Off Link",
        btn_feedback: "📝 Feedback",
        btn_help: "❓ Help",
        btn_lang: "🌐 Change Language",
        btn_back: "🔙 Main Menu",
        choose_cat: "✨ **Which category link do you want to create? Select below:**",
        cat_love: "❤️ Love Letter", cat_crush: "💖 Crush Confession", cat_birthday: "🎂 Birthday Wish",
        cat_anniversary: "💍 Anniversary Wish", cat_newyear: "🎉 New Year Wish", cat_boishakh: "🌾 Pohela Boishakh",
        cat_friend: "🫂 Best Friend", cat_eid: "🌙 Eid Wish", cat_sorry: "🥺 Sorry Letter",
        help_text: `❓ **How to use?**\n\n1. First, click on the 🚀 **Make Link** button.\n2. Select your preferred category.\n3. Send the animation texts line by line and then send the final letter text as instructed.\n4. Copy the generated link and send it to your special person. You will get instant notifications when they open it!\n\n❌ Type /cancel to cancel any running session.`,
        feedback_prompt: "📝 Please send your feedback or suggestions here as a message:",
        feedback_short: "❌ Please write your feedback with some more details.",
        feedback_success: "✅ Your valuable feedback has been successfully submitted. Thank you!",
        session_cancelled: "❌ Your current link generation session has been cancelled.",
        no_session: "💡 You don't have any active session.",
        invalid_cmd: (cmd) => `❌ **Invalid Command:** \`${cmd}\` is not recognized by this bot!\n\nPlease use the buttons below or standard commands to proceed.`,
        btn_open_help: "❓ Open Help Menu",
        maint_msg: "🚧 **Bot is under maintenance!**\n\nPlease try again later. Thank you for your patience.",
        no_links: "❌ You haven't created any links yet.",
        profile_report: (name, list) => `📊 **Your Profile Report:**\n\n👤 Name: ${name}\n🎫 Your Links:\n${list}`,
        btn_want_deactivate: "🔒 Want to deactivate a link?",
        no_active_links: "💡 You have no active links at the moment.",
        off_link_title: "🔒 **Which link do you want to deactivate? Click below:**",
        off_all_links: "❌ Off All Links",
        deactivate_success_all: (count) => `✅ Successfully deactivated all (\`${count}\`) of your active links!`,
        deactivate_success_single: (id) => `✅ Successfully deactivated your link (\`${id}\`).`,
        link_not_found: "❌ Link not found or already deactivated.",
        session_started: (cat) => `✨ Custom ${cat.toUpperCase()} Link session started!\n\n👉 Send the animation texts first.`,
        demo_title: "👀 **Which demo page do you want to see? Select below:**",
        demo_ready: (type, url) => `✨ **Your requested demo link has been generated!**\n\n🏷️ Category: \`${type.toUpperCase()}\`\n🔗 Demo Link: ${url}\n\n💖 To make one with your custom texts, use 🚀 **Make Link** from main menu!`,
        input_anim_success: (count) => `✅ Great! You added ${count} animation lines.\n\n💌 Now write and send the main letter or message inside the envelope:`,
        link_ready: (url) => `💝 Congratulations! Your customized link is completely ready:\n\n${url}\n\nCopy and send it. You'll get notified when they open it!`,
        btn_rate_feedback: "📝 How did you like our bot? Give feedback",
        someone_opened: (type, time) => `👀 **Notification:** Someone just opened your custom \`${type.toUpperCase()}\` link!\n⏰ **Time:** ${time}`,
        new_response: (type, res) => `💌 New response received on your \`${type.toUpperCase()}\` link!\n\nAnswer: ${res}`
    }
};

// 🛠️ মেইনটেন্যান্স ও ব্যান ফিল্টার (অ্যাডমিন বাইপাস এবং কমপ্লিট ব্লক লজিক)
bot.use((ctx, next) => {
    const userId = ctx.chat ? ctx.chat.id : (ctx.from ? ctx.from.id : null);
    if (!userId) return next();
    
    // 👑 অ্যাডমিন হলে কোনো ফিল্টার ছাড়াই সরাসরি পরের স্টেপে চলে যাবে
    if (String(userId) === String(ADMIN_CHAT_ID)) {
        return next();
    }
    
    // মেইনটেন্যান্স মোড অন থাকলে সাধারণ ইউজারদের কোনো কম্যান্ড বা বাটন কাজ করবে না
    if (isMaintenanceMode) {
        const lang = userLanguages[userId] || 'bn';
        return ctx.reply(locale[lang].maint_msg);
    }
    
    // ইউজার ব্যান থাকলে ব্লক থাকবে
    if (bannedUsers.has(userId) || bannedUsers.has(Number(userId))) return;
    
    return next();
});

// 🔄 মূল মেনু মেসেজ (ইউজারদের জন্য ল্যাঙ্গুয়েজ নির্ভর)
function sendMainMenu(ctx, isEdit = false) {
    const userId = ctx.chat.id;
    const lang = userLanguages[userId] || 'bn'; // ডিফল্ট বাংলা
    const firstName = ctx.from ? ctx.from.first_name : "User";
    
    const text = locale[lang].welcome(firstName);
    
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback(locale[lang].btn_make, 'menu_makelink'), Markup.button.callback(locale[lang].btn_demo, 'menu_demo')],
        [Markup.button.callback(locale[lang].btn_stats, 'menu_stats'), Markup.button.callback(locale[lang].btn_off, 'menu_off')],
        [Markup.button.callback(locale[lang].btn_feedback, 'menu_feedback'), Markup.button.callback(locale[lang].btn_help, 'menu_help')],
        [Markup.button.callback(locale[lang].btn_lang, 'menu_lang')]
    ]);

    if (isEdit) {
        return ctx.editMessageText(text, keyboard).catch(e => {});
    } else {
        return ctx.reply(text, keyboard);
    }
}

// 👑 অ্যাডমিন ড্যাশবোর্ড ফাংশন (সবসময় English)
function sendAdminDashboard(ctx, isEdit = false) {
    const text = `👑 **Welcome Boss! Your Complete Admin Dashboard:**\n\nUse the buttons below to control the bot's activities instantly.`;
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📊 Bot Live Stats', 'adm_stats'), Markup.button.callback('📋 All Links List', 'adm_alllinks_main')],
        [Markup.button.callback('⚙️ Maintenance (On/Off)', 'adm_toggle_maint'), Markup.button.callback('📢 Broadcast Message', 'adm_prompt_broadcast')],
        [Markup.button.callback('🧼 Clean Inactive Links', 'adm_clean'), Markup.button.callback('💾 Database Backup', 'adm_backup')],
        [Markup.button.callback('🔥 Delete All Links (NUKE)', 'adm_prompt_nuke')]
    ]);

    if (isEdit) {
        return ctx.editMessageText(text, keyboard).catch(e => {});
    } else {
        return ctx.reply(text, keyboard);
    }
}

// 🎯 স্টার্ট কম্যান্ড
bot.command('start', (ctx) => {
    const userId = ctx.chat.id;
    registeredUsers.add(userId);
    sendMainMenu(ctx, false);
});

// 🌐 ভাষা পরিবর্তন করার মেনু অপশন
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

// 🔙 ব্যাক বাটন অ্যাকশন
bot.action('go_to_main_menu', (ctx) => {
    ctx.answerCbQuery();
    sendMainMenu(ctx, true);
});

bot.action('go_to_admin_dashboard', (ctx) => {
    ctx.answerCbQuery();
    sendAdminDashboard(ctx, true);
});

// 👑 ==================== COMPLETE ADMIN MODULE ==================== 👑

// ১. /adm কম্যান্ড (ইউজার রেস্ট্রিকশনসহ)
bot.command('adm', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) {
        return ctx.reply("⚠️ **Access Denied!** This command is strictly reserved for the **Bot Admin** only.");
    }
    sendAdminDashboard(ctx, false);
});

// ২. বটের লাইভ স্ট্যাটাস বাটন + এক্সট্রা অপশনস
bot.action('adm_stats', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    ctx.answerCbQuery();
    
    const totalUsers = registeredUsers.size;
    let totalLinks = 0;
    Object.keys(linkDatabase).forEach(id => { if(!id.startsWith('demo_')) totalLinks++; });
    
    const text = `📊 **Bot Live Statistics Summary:**\n\n👥 Total Active Users: \`${totalUsers}\`\n🔗 Total Links Generated: \`${totalLinks}\`\n🚫 Total Banned Users: \`${bannedUsers.size}\`\n⚙️ Maintenance Mode: \`${isMaintenanceMode ? "ON 🚧" : "OFF 🟢"}\`\n\n💡 Choose any deeper option below to view full logs or manage users.`;
    
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('👥 User List', 'adm_sub_userlist'), Markup.button.callback('📋 All Links List', 'adm_alllinks_stats')],
        [Markup.button.callback('🚫 Banned Users List', 'adm_sub_banlist')],
        [Markup.button.callback('🔙 Back to Dashboard', 'go_to_admin_dashboard')]
    ]);

    ctx.editMessageText(text, keyboard);
});

// ৩. সাব অপশন: User List প্রদর্শন + Ban User বাটন লজিক
bot.action('adm_sub_userlist', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    ctx.answerCbQuery();

    let userArr = Array.from(registeredUsers);
    let text = `👥 **Registered Users List (${userArr.length}):**\n\n`;
    
    if (userArr.length === 0) {
        text += "💡 No users have registered yet.";
    } else {
        userArr.slice(0, 50).forEach((uId, idx) => {
            const isBanned = bannedUsers.has(uId) || bannedUsers.has(Number(uId));
            text += `${idx + 1}. User ID: \`${uId}\` ${isBanned ? '🔴 (Banned)' : '🟢 (Active)'}\n`;
        });
        if (userArr.length > 50) text += `\n...and ${userArr.length - 50} more users.`;
    }

    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🚫 Ban User', 'adm_prompt_input_ban')],
        [Markup.button.callback('🔙 Back to Stats', 'adm_stats')]
    ]);

    ctx.editMessageText(text, keyboard);
});

// ৪. সাব... অপশন: Ban User ইনপুট প্রম্পট
bot.action('adm_prompt_input_ban', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    ctx.answerCbQuery();

    userSessions[ctx.chat.id] = { step: 'AWAITING_BAN_ID_INPUT' };
    ctx.reply("🚫 Please write or paste the **User ID** you want to ban from this bot:");
});

// ৫. সাব অপশন: Banned Users List প্রদর্শন + Unban বাটন লজিক
bot.action('adm_sub_banlist', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    ctx.answerCbQuery();

    let banArr = Array.from(bannedUsers).filter(item => typeof item === 'number' || !isNaN(item));
    let uniqueBans = [...new Set(banArr.map(Number))];

    let text = `🚫 **Banned Users List (${uniqueBans.length}):**\n\n`;
    
    if (uniqueBans.length === 0) {
        text += "💡 No users are currently banned.";
    } else {
        uniqueBans.forEach((uId, idx) => {
            text += `${idx + 1}. User ID: \`${uId}\` 🚫\n`;
        });
    }

    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔓 Unban User', 'adm_prompt_input_unban')],
        [Markup.button.callback('🔙 Back to Stats', 'adm_stats')]
    ]);

    ctx.editMessageText(text, keyboard);
});

// ৬. সাব অপশন: Unban করার জন্য আইডি ইনপুট প্রম্পট
bot.action('adm_prompt_input_unban', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    ctx.answerCbQuery();

    userSessions[ctx.chat.id] = { step: 'AWAITING_UNBAN_ID_INPUT' };
    ctx.reply("🔓 Please write or paste the **User ID** you want to UNBAN:");
});

// ৭. সব লিঙ্কের লিস্ট দেখার বাটন (কমন ফাংশন রাউটার)
const renderAllLinksList = (ctx) => {
    let list = [];
    Object.keys(linkDatabase).forEach(id => {
        if (!id.startsWith('demo_')) {
            const status = linkDatabase[id].isActive !== false ? "🟢" : "🔴";
            list.push(`${status} ID: \`${id}\` | \`${linkDatabase[id].type.toUpperCase()}\` | Maker: ${linkDatabase[id].name}`);
        }
    });
    
    if (list.length === 0) {
        return "💡 No links generated in database yet.";
    }
    
    const text = `📋 **All Generated Links List:**\n\n${list.slice(0, 30).join('\n')}\n\n💡 To ban a link: /banlink [ID]\n🔍 To view details: /linkdetails [ID]`;
    return text;
};

bot.action('adm_alllinks_main', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    ctx.answerCbQuery();
    ctx.editMessageText(renderAllLinksList(ctx), Markup.inlineKeyboard([[Markup.button.callback('🔙 Back to Dashboard', 'go_to_admin_dashboard')]]));
});

bot.action('adm_alllinks_stats', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    ctx.answerCbQuery();
    ctx.editMessageText(renderAllLinksList(ctx), Markup.inlineKeyboard([[Markup.button.callback('🔙 Back to Stats', 'adm_stats')]]));
});

// ৮. মেইনটেন্যান্স অন/অফ টগল বাটন
bot.action('adm_toggle_maint', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    ctx.answerCbQuery();
    
    isMaintenanceMode = !isMaintenanceMode;
    ctx.reply(`⚙️ Maintenance Mode has been successfully turned **${isMaintenanceMode ? "ON 🚧 (Users Blocked)" : "OFF 🟢 (Users Allowed)"}**!`);
    sendAdminDashboard(ctx, false);
});

// ৯. নিষ্ক্রিয় লিঙ্ক ক্লিন বাটন
bot.action('adm_clean', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    ctx.answerCbQuery();
    
    let count = 0;
    Object.keys(linkDatabase).forEach(id => {
        if (!id.startsWith('demo_') && linkDatabase[id].isActive === false) { delete linkDatabase[id]; count++; }
    });
    
    ctx.reply(`🧼 Database cleared! Total \`${count}\` inactive/deactivated links have been permanently deleted.`);
});

// ১০. ডাটাবেজ ব্যাকআপ বাটন
bot.action('adm_backup', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    ctx.answerCbQuery();
    
    try {
        const backupData = JSON.stringify(linkDatabase, null, 2);
        fs.writeFileSync('backup.txt', backupData);
        ctx.replyWithDocument({ source: fs.createReadStream('backup.txt'), filename: 'database_backup.txt' }, { caption: "💾 Current database backup file." });
    } catch(e) { ctx.reply("❌ Error generating backup file."); }
});

// ১১. ব্রডকাস্ট মেসেজ প্রম্পট বাটন
bot.action('adm_prompt_broadcast', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    ctx.answerCbQuery();
    
    const userId = ctx.chat.id;
    userSessions[userId] = { step: 'AWAITING_BROADCAST' };
    ctx.reply("📢 Type and send your notification message that you want to broadcast to all users:");
});

// ১২. নিউক প্রম্পট বাটন
bot.action('adm_prompt_nuke', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    ctx.answerCbQuery();
    
    ctx.editMessageText("⚠️ **WARNING BOSS!** Are you sure you want to completely destroy all users' links from the database? This action cannot be undone.", 
        Markup.inlineKeyboard([
            [Markup.button.callback('💥 Yes, Delete Everything!', 'adm_confirm_nuke')],
            [Markup.button.callback('❌ No, Cancel', 'go_to_admin_dashboard')]
        ])
    );
});

// ১৩. নিউক কনফার্মেশন বাটন
bot.action('adm_confirm_nuke', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    ctx.answerCbQuery();
    
    let count = 0;
    for (let key in linkDatabase) {
        if (!key.startsWith('demo_')) { delete linkDatabase[key]; count++; }
    }
    ctx.editMessageText(`🔥 **Operation Successful Boss!**\n\nTotal \`${count}\` user links have been successfully completely wiped from the database!`, Markup.inlineKeyboard([[Markup.button.callback('🔙 Back to Dashboard', 'go_to_admin_dashboard')]]));
});

// 🎯 ইউজার সাইড বাটন অপশনসমূহ (ল্যাঙ্গুয়েজ ডিপেন্ডেন্ট)
bot.action('menu_makelink', (ctx) => {
    ctx.answerCbQuery();
    const lang = userLanguages[ctx.chat.id] || 'bn';
    ctx.editMessageText(locale[lang].choose_cat, 
        Markup.inlineKeyboard([
            [Markup.button.callback(locale[lang].cat_love, 'startmake_love'), Markup.button.callback(locale[lang].cat_crush, 'startmake_crush')],
            [Markup.button.callback(locale[lang].cat_birthday, 'startmake_birthday'), Markup.button.callback(locale[lang].cat_anniversary, 'startmake_anniversary')],
            [Markup.button.callback(locale[lang].cat_newyear, 'startmake_newyear'), Markup.button.callback(locale[lang].cat_boishakh, 'startmake_boishakh')],
            [Markup.button.callback(locale[lang].cat_friend, 'startmake_friend'), Markup.button.callback(locale[lang].cat_eid, 'startmake_eid')],
            [Markup.button.callback(locale[lang].cat_sorry, 'startmake_sorry')],
            [Markup.button.callback(locale[lang].btn_back, 'go_to_main_menu')]
        ])
    );
});

bot.action('menu_demo', (ctx) => {
    ctx.answerCbQuery();
    const lang = userLanguages[ctx.chat.id] || 'bn';
    ctx.editMessageText(locale[lang].demo_title, 
        Markup.inlineKeyboard([
            [Markup.button.callback(locale[lang].cat_love, 'demo_love'), Markup.button.callback(locale[lang].cat_crush, 'demo_crush')],
            [Markup.button.callback(locale[lang].cat_birthday, 'demo_birthday'), Markup.button.callback(locale[lang].cat_anniversary, 'demo_anniversary')],
            [Markup.button.callback(locale[lang].cat_newyear, 'demo_newyear'), Markup.button.callback(locale[lang].cat_boishakh, 'demo_boishakh')],
            [Markup.button.callback(locale[lang].cat_friend, 'demo_friend'), Markup.button.callback(locale[lang].cat_eid, 'demo_eid')],
            [Markup.button.callback(locale[lang].cat_sorry, 'demo_sorry')],
            [Markup.button.callback(locale[lang].btn_back, 'go_to_main_menu')]
        ])
    );
});

bot.action('menu_help', (ctx) => {
    ctx.answerCbQuery();
    const lang = userLanguages[ctx.chat.id] || 'bn';
    ctx.editMessageText(locale[lang].help_text,
        Markup.inlineKeyboard([[Markup.button.callback(locale[lang].btn_back, 'go_to_main_menu')]])
    );
});

bot.action('menu_feedback', (ctx) => {
    ctx.answerCbQuery();
    const userId = ctx.chat.id;
    const lang = userLanguages[userId] || 'bn';
    userSessions[userId] = { step: 'AWAITING_FEEDBACK', name: ctx.from.first_name };
    ctx.reply(locale[lang].feedback_prompt);
});

bot.action('menu_stats', (ctx) => {
    ctx.answerCbQuery();
    const userId = ctx.chat.id; 
    const lang = userLanguages[userId] || 'bn';
    let myLinks = [];
    Object.keys(linkDatabase).forEach(id => {
        if (linkDatabase[id].userId === userId && !id.startsWith('demo_')) {
            const status = linkDatabase[id].isActive !== false ? (lang === 'bn' ? "🟢 সক্রিয়" : "🟢 Active") : (lang === 'bn' ? "🔴 নিষ্ক্রিয়" : "🔴 Deactivated");
            myLinks.push(`🎫 ID: \`${id}\` (${linkDatabase[id].type.toUpperCase()}) [${status}]`);
        }
    });
    
    const responseText = myLinks.length === 0 
        ? locale[lang].no_links 
        : locale[lang].profile_report(ctx.from.first_name, myLinks.join('\n'));
    
    ctx.editMessageText(responseText, 
        Markup.inlineKeyboard([
            [Markup.button.callback(locale[lang].btn_want_deactivate, 'menu_off')],
            [Markup.button.callback(locale[lang].btn_back, 'go_to_main_menu')]
        ])
    ).catch(e => {});
});

bot.action('menu_off', (ctx) => {
    ctx.answerCbQuery();
    const userId = ctx.chat.id;
    const lang = userLanguages[userId] || 'bn';
    let buttons = [];
    
    Object.keys(linkDatabase).forEach(id => {
        if (linkDatabase[id].userId === userId && !id.startsWith('demo_') && linkDatabase[id].isActive !== false) {
            buttons.push([Markup.button.callback(`🚫 Off Link: ${id} (${linkDatabase[id].type.toUpperCase()})`, `deactivate_${id}`)]);
        }
    });
    
    if (buttons.length === 0) {
        return ctx.editMessageText(locale[lang].no_active_links, 
            Markup.inlineKeyboard([[Markup.button.callback(locale[lang].btn_back, 'go_to_main_menu')]])
        ).catch(e => {});
    }
    
    buttons.push([Markup.button.callback(locale[lang].off_all_links, 'deactivate_all')]);
    buttons.push([Markup.button.callback(locale[lang].btn_back, 'go_to_main_menu')]);
    
    ctx.editMessageText(locale[lang].off_link_title, Markup.inlineKeyboard(buttons)).catch(e => {});
});

bot.action(/^deactivate_/, (ctx) => {
    ctx.answerCbQuery();
    const target = ctx.match.input.replace('deactivate_', '');
    const userId = ctx.chat.id;
    const lang = userLanguages[userId] || 'bn';
    
    if (target === 'all') {
        let count = 0;
        Object.keys(linkDatabase).forEach(id => {
            if (linkDatabase[id].userId === userId && !id.startsWith('demo_') && linkDatabase[id].isActive !== false) {
                linkDatabase[id].isActive = false;
                count++;
            }
        });
        return ctx.reply(locale[lang].deactivate_all_links(count));
    }
    
    if (linkDatabase[target] && linkDatabase[target].userId === userId) {
        linkDatabase[target].isActive = false;
        ctx.reply(locale[lang].deactivate_success_single(target));
    } else {
        ctx.reply(locale[lang].link_not_found);
    }
});

bot.action(/^startmake_/, (ctx) => {
    ctx.answerCbQuery();
    const type = ctx.match.input.replace('startmake_', '');
    const userId = ctx.chat.id;
    const lang = userLanguages[userId] || 'bn';
    
    userSessions[userId] = {
        step: 'AWAITING_ANIMATION_TEXT',
        type: type,
        name: `${ctx.from.first_name} ${ctx.from.last_name || ''}`,
        username: ctx.from.username ? '@' + ctx.from.username : 'None'
    };
    ctx.reply(locale[lang].session_started(type));
});

bot.action(/^demo_/, (ctx) => {
    const selectedType = ctx.match.input.replace('demo_', '');
    const userId = ctx.chat.id;
    const lang = userLanguages[userId] || 'bn';
    const demoUrl = `${SERVER_URL}/love/demo_${selectedType}`;
    ctx.answerCbQuery();
    ctx.reply(locale[lang].demo_ready(selectedType, demoUrl));
});

// 🎯 টেক্সট ইনপুট প্রসেসিং (মেইন রাউটার)
bot.on('text', (ctx) => {
    const userId = ctx.chat.id; const session = userSessions[userId]; const text = ctx.message.text;
    const lang = userLanguages[userId] || 'bn';
    
    // অ্যাডমিন ইনস্ট্যান্ট টেক্সট কম্যান্ডস (স্ল্যাশ কম্যান্ডস - সবসময় ইংলিশ রেসপন্স)
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
            return ctx.reply(`🔍 **Link ID: ${targetId} Details:**\n\n👤 Creator: ${data.name} (${data.username})\n🏷 Category: \`${data.type}\`\n🎬 Animations: \`${JSON.stringify(data.animations)}\`\n💌 Letter:\n"${data.letter}"`);
        }
        if (text.startsWith('/blockuser')) {
            const targetUid = text.replace('/blockuser', '').trim();
            if (!targetUid || String(targetUid) === String(ADMIN_CHAT_ID)) return ctx.reply("❌ Invalid User ID!");
            bannedUsers.add(Number(targetUid)); bannedUsers.add(targetUid);
            return ctx.reply(`🚫 User \`${targetUid}\` has been successfully banned from bot!`);
        }
        if (text.startsWith('/unblockuser')) {
            const targetUid = text.replace('/unblockuser', '').trim();
            if (!targetUid) return ctx.reply("❌ Invalid User ID!");
            bannedUsers.delete(Number(targetUid)); bannedUsers.delete(targetUid);
            return ctx.reply(`🔓 User \`${targetUid}\` has been unbanned.`);
        }
    }

    // ❌ ভুল বা অজানা কম্যান্ড চেক হ্যান্ডলার (ল্যাঙ্গুয়েজ নির্ভর)
    if (!session && text.startsWith('/')) {
        if (text !== '/start' && text !== '/cancel') {
            const wrongCommand = text.split(' ')[0];
            const helpKeyboard = Markup.inlineKeyboard([
                [Markup.button.callback(locale[lang].btn_open_help, 'menu_help')],
                [Markup.button.callback(locale[lang].btn_back, 'go_to_main_menu')]
            ]);
            return ctx.reply(locale[lang].invalid_cmd(wrongCommand), helpKeyboard);
        }
    }

    if (!session) return; 

    // 🎯 বাটন ট্রিপের মাধ্যমে ইউজার ব্যান করার রিয়েল-টাইম লজিক (অ্যাডমিন)
    if (session.step === 'AWAITING_BAN_ID_INPUT' && String(userId) === String(ADMIN_CHAT_ID)) {
        const targetUid = text.trim();
        if (!targetUid || String(targetUid) === String(ADMIN_CHAT_ID)) {
            delete userSessions[userId];
            return ctx.reply("❌ Invalid User ID or you tried to ban yourself!");
        }
        bannedUsers.add(Number(targetUid)); 
        bannedUsers.add(targetUid);
        ctx.reply(`✅ **Success!** User ID \`${targetUid}\` has been successfully banned from the bot.`);
        delete userSessions[userId];
        return;
    }

    // 🎯 বাটন ট্রিপের মাধ্যমে ইউজার আনব্যান করার রিয়েল-টাইম লজিক (অ্যাডমিন)
    if (session.step === 'AWAITING_UNBAN_ID_INPUT' && String(userId) === String(ADMIN_CHAT_ID)) {
        const targetUid = text.trim();
        if (!targetUid) {
            delete userSessions[userId];
            return ctx.reply("❌ Invalid User ID!");
        }
        bannedUsers.delete(Number(targetUid));
        bannedUsers.delete(targetUid);
        ctx.reply(`🔓 **Success!** User ID \`${targetUid}\` has been successfully unbanned and can now use the bot.`);
        delete userSessions[userId];
        return;
    }

    // ব্রডকাস্ট প্রসেসিং (অ্যাডমিন)
    if (session.step === 'AWAITING_BROADCAST' && String(userId) === String(ADMIN_CHAT_ID)) {
        let successCount = 0;
        registeredUsers.forEach(uId => {
            bot.telegram.sendMessage(uId, `📢 **Official Notification:**\n\n${text}`).then(() => { successCount++; }).catch(e => {});
        });
        ctx.reply(`📢 Broadcast finished! Successfully sent message to \`${successCount}\` users.`);
        delete userSessions[userId];
        sendAdminDashboard(ctx, false);
        return;
    }

    // ইউজার ফিডব্যাক প্রসেসিং
    if (session.step === 'AWAITING_FEEDBACK') {
        if (text.trim().length < 5) return ctx.reply(locale[lang].feedback_short);
        bot.telegram.sendMessage(ADMIN_CHAT_ID, `💬 **Feedback From ${session.name} (ID: ${userId}):** ${text}`).catch(e => {});
        ctx.reply(locale[lang].feedback_success);
        delete userSessions[userId]; return;
    }

    // কাস্টম লিঙ্ক অ্যানিমেশন প্রসেসিং
    if (session.step === 'AWAITING_ANIMATION_TEXT') {
        const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        if (lines.length === 0) return ctx.reply("❌ Please send at least 1 line!");
        session.animations = lines; session.step = 'AWAITING_LETTER_TEXT'; 
        ctx.reply(locale[lang].input_anim_success(lines.length));
        return;
    }

    // ফাইনাল কাস্টম লেটার এবং লিঙ্ক জেনারেশন প্রসেসিং
    if (session.step === 'AWAITING_LETTER_TEXT') {
        const uniqueId = Math.random().toString(36).substring(2, 9);
        linkDatabase[uniqueId] = {
            userId: userId, name: session.name, username: session.username,
            type: session.type, animations: session.animations, letter: text.trim(), isActive: true 
        };
        const generatedLink = `${SERVER_URL}/love/${uniqueId}`;
        
        ctx.reply(locale[lang].link_ready(generatedLink),
            Markup.inlineKeyboard([[Markup.button.callback(locale[lang].btn_rate_feedback, 'menu_feedback')]])
        );
        
        const currentTime = new Date().toLocaleString("en-US", {timeZone: "Asia/Dhaka"});
        if (String(userId) !== String(ADMIN_CHAT_ID)) {
            bot.telegram.sendMessage(ADMIN_CHAT_ID, `🚨 **New Link!**\n👤 **Creator:** ${session.name}\n🏷 **Type:** ${session.type.toUpperCase()}\n🎫 **ID:** ${uniqueId}\n⏰ **Time:** ${currentTime}`).catch(e => {});
        }
        delete userSessions[userId]; return;
    }
});

bot.command('cancel', (ctx) => {
    const userId = ctx.chat.id;
    const lang = userLanguages[userId] || 'bn';
    if (userSessions[userId]) { delete userSessions[userId]; ctx.reply(locale[lang].session_cancelled); }
    else ctx.reply(locale[lang].no_session);
});

// 🎯 এক্সপ্রেস ফ্রন্টএন্ড এবং এপিআই রাউটিং মেকানিজম
app.get('/love/:id', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.post('/api/get-content', async (req, res) => {
    const { id } = req.body; const linkData = linkDatabase[id];
    if (linkData) {
        if (linkData.isActive === false) return res.json({ success: false, error: "expired" });
        if (id.startsWith('demo_')) return res.json({ success: true, type: linkData.type, animations: linkData.animations, letter: linkData.letter });

        const openTime = new Date().toLocaleString("en-US", {timeZone: "Asia/Dhaka"});
        const userLang = userLanguages[linkData.userId] || 'bn';
        bot.telegram.sendMessage(linkData.userId, locale[userLang].someone_opened(linkData.type, openTime));
        return res.json({ success: true, type: linkData.type, animations: linkData.animations, letter: linkData.letter });
    }
    res.json({ success: false, error: "invalid" });
});

app.post('/api/respond', (req, res) => {
    const { response, id } = req.body; const linkData = linkDatabase[id]; 
    if (linkData && linkData.isActive !== false) {
        if (!id.startsWith('demo_')) {
            const userLang = userLanguages[linkData.userId] || 'bn';
            bot.telegram.sendMessage(linkData.userId, locale[userLang].new_response(linkData.type, response),
                Markup.inlineKeyboard([[Markup.button.callback(locale[userLang].btn_rate_feedback, 'menu_feedback')]])
            );
        }
        res.json({ success: true });
    } else res.json({ success: false });
});

app.get('/ping_test', (req, res) => res.send("Awake!"));
setInterval(() => { axios.get(`${SERVER_URL}/ping_test`).catch(e=>''); }, 270000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server live on port ${PORT}`);
    bot.launch()
        .then(() => console.log("Telegram Bot successfully started with Full Multi-Language Suite! 🚀"))
        .catch(e => console.error("Bot launch error:", e));
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('TERM', () => bot.stop('SIGTERM'));
