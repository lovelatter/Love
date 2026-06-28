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

// 🌐 মাল্টি-ল্যাঙ্গুয়েজ ডিকশনারি
const locale = {
    bn: {
        welcome: (name) => `💝 **হ্যালো ${name}!** 💝\n\nঅল-ইন-ওয়ান উইшением বটের পক্ষ থেকে স্বাগতম। নিচের যেকোনো একটি অপশন সিলেক্ট করুন:`,
        btn_make: "🚀 লিঙ্ক তৈরি করুন",
        btn_card: "🖼️ উইশ কার্ড বানান",
        btn_demo: "👀 ডেমো দেখুন",
        btn_stats: "📊 স্ট্যাটাস",
        btn_off: "🔒 লিঙ্ক বন্ধ করুন",
        btn_feedback: "📝 মতামত",
        btn_help: "❓ সাহায্য",
        btn_lang: "🌐 Change Language",
        btn_back: "🔙 মেইন মেনু",
        choose_cat: "✨ **কোন ক্যাটাগরির লিঙ্ক তৈরি করতে চান? সিলেক্ট করুন:**",
        cat_love: "❤️ প্রেমের চিঠি", cat_crush: "💖 ক্রাশ কনফession", cat_birthday: "🎂 জন্মদিন",
        cat_anniversary: "💍 বিবাহবার্ষিকী", cat_newyear: "🎉 নতুন বছর", cat_boishakh: "🌾 পহেলা বৈশাখ",
        cat_friend: "🫂 সেরা বন্ধু", cat_eid: "🌙 ঈদ মোবারক", cat_sorry: "🥺 দুঃখ প্রকাশ",
        prompt_theme: "🎨 **একটি প্রিমিয়াম ওয়েব থিম সিলেক্ট করুন (সম্পূর্ণ ফ্রি):**",
        prompt_music: "🎵 **একটি ব্যাকগ্রাউন্ড মিউজিক সিলেক্ট করুন (সম্পূর্ণ ফ্রি):**",
        prompt_countdown_ask: "⏰ **আপনি কি এই লিঙ্কে কাউন্টডাউন টাইমার (Time Countdown) সেট করতে চান?**\n\n(টাইমার সেট করলে আপনার দেওয়া সময়ের আগে কেউ লিঙ্কের মূল মেসেজ দেখতে পারবে না, শুধু কাউন্টডাউন দেখবে।)",
        btn_yes: "✅ হ্যাঁ, চাই", btn_no: "❌ না, লাগবে না",
        prompt_time_input: "⏳ অনুগ্রহ করে কাউন্টডাউন শেষ হওয়ার তারিখ এবং সময় নিচের ফরম্যাটে লিখে পাঠান:\n\nFormat: `YYYY-MM-DD HH:MM`\nExample: `2026-12-31 23:59` (২৪ ঘণ্টার ফরম্যাটে লিখবেন)",
        invalid_time: "❌ ভুল ফরম্যাট! অনুগ্রহ করে সঠিক ফরম্যাটে লিখুন। উদাহরণ: `2026-06-30 18:00`",
        help_text: `❓ **কিভাবে ব্যবহার করবেন?**\n\n১. 🚀 **লিঙ্ক তৈরি করুন** বাটনে ক্লিক করে ক্যাটাগরি, ফ্রি থিম, মিউজিক ও কাউন্টডাউন সেট করুন।\n২. অ্যানিমেশন টেক্সট এবং মূল চিঠি পাঠান।\n৩. 🖼️ **উইশ কার্ড বানান** অপশন ব্যবহার করে ইন্সট্যান্ট গ্রাফিক্স কার্ড তৈরি করতে পারবেন।\n\n❌ সেশন বাতিল করতে /cancel লিখুন।`,
        prompt_card_name: "🖼️ উইশ কার্ডে কার নাম লিখতে চান? তার নামটি লিখে পাঠান:",
        card_ready: "✨ **আপনার প্রিমিয়াম উইশ কার্ডটি তৈরি হয়ে গেছে!** 👇",
        invalid_cmd: (cmd) => `❌ **ভুল কমান্ড:** \`${cmd}\` গ্রহণযোগ্য নয়!`,
        btn_open_help: "❓ সাহায্য মেনু",
        maint_msg: "🚧 Bot is under maintenance!",
        no_links: "❌ আপনি এখনো কোনো লিঙ্ক তৈরি করেননি।",
        profile_report: (name, list) => `📊 **আপনার প্রোফাইল রিপোর্ট:**\n\n👤 নাম: ${name}\n🎫 আপনার লিঙ্কসমূহ:\n${list}`,
        btn_want_deactivate: "🔒 লিঙ্ক বন্ধ করতে চান?",
        no_active_links: "💡 কোনো সক্রিয় লিঙ্ক নেই।",
        off_link_title: "🔒 **কোন লিঙ্কটি বন্ধ করতে চান?**",
        off_all_links: "❌ সব লিঙ্ক বন্ধ করুন",
        deactivate_success_single: (id) => `✅ লিঙ্ক (\`${id}\`) সফলভাবে বন্ধ করা হয়েছে।`,
        link_not_found: "❌ লিঙ্কটি পাওয়া যায়নি।",
        session_started: (cat) => `✨ কাস্টম লিঙ্ক সেশন শুরু হয়েছে!\n\n👉 প্রথমে অ্যানিমেশন টেক্সটগুলো পাঠান (প্রতি লাইনের পর এন্টার দিন):`,
        demo_title: "👀 **কোন ডেমো পেজটি দেখতে চান?**",
        demo_ready: (type, url) => `✨ **ডেমো লিঙ্ক রেডি:**\n🔗 ${url}`,
        input_anim_success: (count) => `✅ ${count} লাইনের অ্যানিমেশন যোগ হয়েছে।\n\n💌 এবার খামের ভেতরের মূল চিঠিটি লিখে পাঠান:`,
        link_ready: (url) => `💝 অভিনন্দন! আপনার প্রিমিয়াম মাল্টি-ফিচার লিঙ্ক রেডি:\n\n🔗 ${url}\n\nএটি শেয়ার করুন, ওপেন করলেই নোটিফিকেশন পাবেন!`,
        btn_rate_feedback: "📝 মতামত দিন",
        someone_opened: (type, time) => `👀 **বিজ্ঞপ্তি:** কেউ আপনার \`${type.toUpperCase()}\` লিঙ্কটি ওপেন করেছে!\n⏰ **সময়:** ${time}`,
        new_response: (type, res) => `💌 আপনার \`${type.toUpperCase()}\` লিঙ্কে নতুন উত্তর এসেছে:\n\nAnswer: ${res}`
    },
    en: {
        welcome: (name) => `💝 **Hello ${name}!** 💝\n\nWelcome to Wishing Bot. Choose an option:`,
        btn_make: "🚀 Make Link",
        btn_card: "🖼️ Wish Card Generator",
        btn_demo: "👀 Demo",
        btn_stats: "📊 Stats",
        btn_off: "🔒 Off Link",
        btn_feedback: "📝 Feedback",
        btn_help: "❓ Help",
        btn_lang: "🌐 বাংলা ভাষা করুন",
        btn_back: "🔙 Main Menu",
        choose_cat: "✨ **Select Category:**",
        cat_love: "❤️ Love Letter", cat_crush: "💖 Crush Confession", cat_birthday: "🎂 Birthday Wish",
        cat_anniversary: "💍 Anniversary", cat_newyear: "🎉 New Year", cat_boishakh: "🌾 Pohela Boishakh",
        cat_friend: "🫂 Best Friend", cat_eid: "🌙 Eid Wish", cat_sorry: "🥺 Sorry Letter",
        prompt_theme: "🎨 **Select a Premium Web Theme (Free):**",
        prompt_music: "🎵 **Select a Background Music (Free):**",
        prompt_countdown_ask: "⏰ **Do you want to set a Time Countdown Timer for this link?**",
        btn_yes: "✅ Yes", btn_no: "❌ No",
        prompt_time_input: "⏳ Send Countdown end date & time in this format:\n\nFormat: `YYYY-MM-DD HH:MM`\nExample: `2026-12-31 23:59`",
        invalid_time: "❌ Invalid format! Please follow: `2026-06-30 18:00`",
        help_text: `❓ **How to use?**\n\n1. Click 🚀 **Make Link**, choose free theme, music, and countdown setup.\n2. Paste your letter.\n3. Use 🖼️ **Wish Card** to generate custom card graphics.\n\n❌ Type /cancel to stop.`,
        prompt_card_name: "🖼️ Enter the name you want to print on the Wish Card:",
        card_ready: "✨ **Your premium Wish Card is ready!** 👇",
        invalid_cmd: (cmd) => `❌ **Invalid Command:** \`${cmd}\``,
        btn_open_help: "❓ Help Menu",
        maint_msg: "🚧 Bot is under maintenance!",
        no_links: "❌ You haven't created any links yet.",
        profile_report: (name, list) => `📊 **Profile:** ${name}\n🎫 Your Links:\n${list}`,
        btn_want_deactivate: "🔒 Deactivate a link?",
        no_active_links: "💡 No active links found.",
        off_link_title: "🔒 **Select link to turn off:**",
        off_all_links: "❌ Off All Links",
        deactivate_success_single: (id) => `✅ Link (\`${id}\`) deactivated successfully.`,
        link_not_found: "❌ Link not found.",
        session_started: (cat) => `✨ Custom ${cat.toUpperCase()} Link started!\n\n👉 Send animation texts line by line:`,
        demo_title: "👀 **Select Demo Page:**",
        demo_ready: (type, url) => `✨ **Demo Link Ready:**\n🔗 ${url}`,
        input_anim_success: (count) => `✅ Added ${count} lines.\n\n💌 Now send the main letter text:`,
        link_ready: (url) => `💝 Customized Link Ready:\n\n🔗 ${url}`,
        btn_rate_feedback: "📝 Feedback",
        someone_opened: (type, time) => `👀 **Notification:** Someone opened your \`${type.toUpperCase()}\` link!\n⏰ **Time:** ${time}`,
        new_response: (type, res) => `💌 New response on your \`${type.toUpperCase()}\` link:\n\nAnswer: ${res}`
    }
};

// 🔄 মূল মেনু (Wish Card বাটন পাশাপাশি সেট করা হয়েছে)
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

// 👑 অ্যাডমিন ড্যাশবোর্ড ফাংশন (English)
function sendAdminDashboard(ctx, isEdit = false) {
    const text = `👑 **Welcome Boss! Your Complete Admin Dashboard:**`;
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📊 Bot Live Stats', 'adm_stats'), Markup.button.callback('📋 All Links List', 'adm_alllinks_main')],
        [Markup.button.callback('⚙️ Maintenance (On/Off)', 'adm_toggle_maint'), Markup.button.callback('📢 Broadcast Message', 'adm_prompt_broadcast')],
        [Markup.button.callback('🔙 Back to User Menu', 'go_to_main_menu')]
    ]);
    if (isEdit) return ctx.editMessageText(text, keyboard).catch(e => {});
    return ctx.reply(text, keyboard);
}

// 🎯 স্টার্ট কম্যান্ড
bot.command('start', (ctx) => {
    registeredUsers.add(ctx.chat.id);
    sendMainMenu(ctx, false);
});

// 🌐 ল্যাঙ্গুয়েজ টগল বাটন ও ব্যাক অ্যাকশন
bot.action('menu_lang', (ctx) => {
    const current = userLanguages[ctx.chat.id] || 'bn';
    userLanguages[ctx.chat.id] = current === 'bn' ? 'en' : 'bn';
    ctx.answerCbQuery(userLanguages[ctx.chat.id] === 'bn' ? "ভাষা বাংলা করা হয়েছে!" : "Language set to English!");
    sendMainMenu(ctx, true);
});

bot.action('go_to_main_menu', (ctx) => { ctx.answerCbQuery(); sendMainMenu(ctx, true); });
bot.action('go_to_admin_dashboard', (ctx) => { ctx.answerCbQuery(); sendAdminDashboard(ctx, true); });

bot.command('adm', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return ctx.reply("⚠️ Access Denied!");
    sendAdminDashboard(ctx, false);
});

// 🖼️ ১. WISH CARD GENERATOR অপশন লজিক
bot.action('menu_cardgen', (ctx) => {
    ctx.answerCbQuery();
    const lang = userLanguages[ctx.chat.id] || 'bn';
    userSessions[ctx.chat.id] = { step: 'AWAITING_CARD_NAME' };
    ctx.reply(locale[lang].prompt_card_name);
});

// 🚀 ২. লিঙ্ক জেনারেটর ফ্লো (ক্যাটাগরি -> প্রিমিয়াম থিম -> মিউজিক -> টাইমার)
bot.action('menu_makelink', (ctx) => {
    ctx.answerCbQuery();
    const lang = userLanguages[ctx.chat.id] || 'bn';
    ctx.editMessageText(locale[lang].choose_cat, 
        Markup.inlineKeyboard([
            [Markup.button.callback(locale[lang].cat_love, 'make_love'), Markup.button.callback(locale[lang].cat_crush, 'make_crush')],
            [Markup.button.callback(locale[lang].cat_birthday, 'make_birthday'), Markup.button.callback(locale[lang].cat_anniversary, 'make_anniversary')],
            [Markup.button.callback(locale[lang].btn_back, 'go_to_main_menu')]
        ])
    );
});

bot.action(/^make_/, (ctx) => {
    ctx.answerCbQuery();
    const type = ctx.match.input.replace('make_', '');
    const lang = userLanguages[ctx.chat.id] || 'bn';
    userSessions[ctx.chat.id] = { type: type, name: ctx.from.first_name };
    
    // থিম সিলেকশন প্রম্পট
    ctx.editMessageText(locale[lang].prompt_theme,
        Markup.inlineKeyboard([
            [Markup.button.callback('✨ Classic Pink', 'set_theme_classic'), Markup.button.callback('🌌 Neon Magic', 'set_theme_neon')],
            [Markup.button.callback('🎈 Birthday Gold', 'set_theme_gold'), Markup.button.callback('❤️ Dark Romance', 'set_theme_dark')]
        ])
    );
});

bot.action(/^set_theme_/, (ctx) => {
    ctx.answerCbQuery();
    const theme = ctx.match.input.replace('set_theme_', '');
    const lang = userLanguages[ctx.chat.id] || 'bn';
    userSessions[ctx.chat.id].theme = theme;

    // মিউজিক সিলেকشن প্রম্পট
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

    // কাউন্টডাউন টাইমার প্রম্পট
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
    const lang = userLanguages[ctx.chat.id] || 'bn';
    userSessions[ctx.chat.id].countdown = null;
    userSessions[ctx.chat.id].step = 'AWAITING_ANIMATION_TEXT';
    ctx.reply(locale[lang].session_started(userSessions[ctx.chat.id].type));
});

// 🎯 টেক্সট প্রসেসিং অ্যান্ড ইনপুট রাউটার
bot.on('text', (ctx) => {
    const userId = ctx.chat.id;
    const session = userSessions[userId];
    const text = ctx.message.text;
    const lang = userLanguages[userId] || 'bn';

    if (!session) {
        if (text.startsWith('/')) return ctx.reply(locale[lang].invalid_cmd(text));
        return;
    }

    // উইশ কার্ডের নাম প্রসেসিং
    if (session.step === 'AWAITING_CARD_NAME') {
        ctx.reply(locale[lang].card_ready);
        // ডায়নামিক্যালি প্রফেশনাল গ্রাফিক্স কার্ড ইমেজ জেনারেট ইউআরএল
        const cardUrl = `https://dummyimage.com/800x500/ff4b72/fff.png&text=Best+Wishes+To+${encodeURIComponent(text)}!+✨`;
        ctx.replyWithPhoto(cardUrl).then(() => { delete userSessions[userId]; });
        return;
    }

    // কাউন্টডাউন টাইম ইনপুট নেওয়া
    if (session.step === 'AWAITING_COUNTDOWN_TIME') {
        const regex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;
        if (!regex.test(text.trim())) return ctx.reply(locale[lang].invalid_time);
        
        session.countdown = text.trim();
        session.step = 'AWAITING_ANIMATION_TEXT';
        ctx.reply(locale[lang].session_started(session.type));
        return;
    }

    // অ্যানিমেশন টেক্সট ইনপুট
    if (session.step === 'AWAITING_ANIMATION_TEXT') {
        session.animations = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        session.step = 'AWAITING_LETTER_TEXT';
        ctx.reply(locale[lang].input_anim_success(session.animations.length));
        return;
    }

    // ফাইনাল চিঠি ও লিঙ্ক জেনারেশন
    if (session.step === 'AWAITING_LETTER_TEXT') {
        const uniqueId = Math.random().toString(36).substring(2, 9);
        linkDatabase[uniqueId] = {
            userId: userId, name: session.name, type: session.type,
            theme: session.theme, music: session.music, countdown: session.countdown,
            animations: session.animations, letter: text.trim(), isActive: true 
        };
        
        ctx.reply(locale[lang].link_ready(`${SERVER_URL}/love/${uniqueId}`));
        delete userSessions[userId];
    }
});

bot.command('cancel', (ctx) => {
    delete userSessions[ctx.chat.id];
    ctx.reply("❌ Session cancelled.");
});

// 🎯 এক্সপ্রেস ও ফ্রন্টএন্ড এপিআই রাউটিং
app.get('/love/:id', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.post('/api/get-content', (req, res) => {
    const { id } = req.body;
    const data = linkDatabase[id];
    if (!data || data.isActive === false) return res.json({ success: false });

    // লাইভ সার্ভার কাউন্টডাউন টাইম ভ্যালিডেশন
    if (data.countdown) {
        const targetTime = new Date(data.countdown.replace(' ', 'T') + ':00');
        const now = new Date();
        if (targetTime > now) {
            // যদি সময় এখনও বাকি থাকে, শুধু টাইমারের ডাটা ফ্রন্টএন্ডে যাবে
            return res.json({ success: true, isLocked: true, targetTime: data.countdown, theme: data.theme });
        }
    }

    // টাইম শেষ বা টাইমার না থাকলে ফুল উইশিং পেজ আনলক হবে
    res.json({ 
        success: true, isLocked: false, type: data.type, theme: data.theme,
        music: data.music, animations: data.animations, letter: data.letter 
    });
});

app.post('/api/respond', (req, res) => {
    const { response, id } = req.body; const data = linkDatabase[id];
    if (data && data.isActive !== false) {
        bot.telegram.sendMessage(data.userId, `💌 New Response: ${response}`);
        res.json({ success: true });
    } else res.json({ success: false });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { bot.launch(); console.log(`Live on ${PORT}`); });
