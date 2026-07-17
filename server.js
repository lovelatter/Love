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

const GITHUB_MUSIC_BASE_URL = "https://raw.githubusercontent.com/lovelatter/Love/main";

const AUTOMATIC_MUSIC_MAPPING = {
    love: `${GITHUB_MUSIC_BASE_URL}/love.mp3`,
    birthday: `${GITHUB_MUSIC_BASE_URL}/bd.mp3`,
    sorry: `${GITHUB_MUSIC_BASE_URL}/sorry.mp3`,
    eid: `${GITHUB_MUSIC_BASE_URL}/eid.mp3`
};

const CATEGORY_CONFIGS = {
    love: {
        title: "আমার মনের কিছু কথা",
        emojis: ["❤️", "💖", "💕"],
        question: "Do you love me? 🥺",
        buttons: ["Yes", "No"]
    },
    birthday: {
        title: "Happy Birthday",
        emojis: ["🎈", "🎉", "🎊"],
        question: "Are you happy? 😊",
        buttons: ["Yes", "No"]
    },
    sorry: {
        title: "I'm Sorry",
        emojis: ["😭", "😞", "😥"],
        question: "Do you forgive me? 🥺",
        buttons: ["Yes", "No"]
    },
    eid: {
        title: "Eid Mubarak",
        emojis: ["🤝", "🎇", "🫂"],
        question: "EID Mubarak 🌙",
        buttons: ["EID Mubarak"]
    }
};

let db = {
    linkDatabase: {},
    userSessions: {},
    totalLinksCreated: 0,
    isMaintenanceMode: false,
    bannedUsers: [],
    registeredUsers: [],
    usernameMap: {}
};

if (fs.existsSync(DB_FILE)) {
    try {
        db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (e) {
        console.error("DB read error, resetting...", e);
    }
}

if (!Array.isArray(db.bannedUsers)) db.bannedUsers = [];
if (!Array.isArray(db.registeredUsers)) db.registeredUsers = [];
if (!db.linkDatabase) db.linkDatabase = {};
if (!db.userSessions) db.userSessions = {};
if (!db.usernameMap) db.usernameMap = {};

function saveDB() {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

const bot = new Telegraf(TELEGRAM_TOKEN);

const locale = {
    welcome: (name) => `হ্যালো ${name}। বটের পক্ষ থেকে স্বাগতম।`,
    btn_make: "🚀 লিঙ্ক তৈরি করুন", btn_feedback: "📝 মতামত", btn_help: "❓ সাহায্য", btn_back: "🔙 মেইন মেনু",
    choose_cat: "✨ আপনি কোন ক্যাটাগরির লিঙ্ক করতে চান?",
    cat_love: "❤️ প্রেমের চিঠি (Love)", cat_birthday: "🎂 জন্মদিনের শুভেচ্ছা (Birthday)", cat_sorry: "🥺 দুঃখ প্রকাশ (Sorry)", cat_eid: "🌙 ঈদ মোবারক (Eid)",
    
    prompt_countdown_ask: "⏰ টাইম কাউন্টডাউন সেট করুন।",
    btn_no_countdown: "❌ No Countdown",
    
    help_text: `❓ বট ব্যবহারের সঠিক নিয়ম (Help Guide):\n\n1️⃣ প্রথমে 🚀 লিঙ্ক তৈরি করুন বাটনে ক্লিক করুন।\n2️⃣ আপনার পছন্দের ক্যাটাগরি (Love, Birthday, etc.) সিলেক্ট করুন।\n3️⃣ লিঙ্কটি কতক্ষণ পর আনলক হবে তার জন্য একটি টাইম কাউন্টডাউন সিলেক্ট করুন (অথবা No Countdown দিন)।\n4️⃣ বটের নির্দেশনা অনুযায়ী 😊 অ্যানিমেশন টেক্সট এবং খামের ভেতরের মূল চিঠিটি লিখে পাঠান।\n5️⃣ সবশেষে বট আপনাকে একটি ইউনিক লিঙ্ক জেনারেট করে দেবে যা আপনি শেয়ার করতে পারবেন!`,
    
    feedback_prompt: "📝 মতামত ও রিপোর্ট:\n\nঅ্যাডমিনের কাছে কোনো রিপোর্ট, নতুন আপডেটের আইডিয়া বা অন্য কোনো কিছু বলার থাকলে আপনার মেসেজটি নিচে লিখে পাঠিয়ে দিন:",
    feedback_short: "❌ মেসেজটি একটু বিস্তারিত লিখুন (কমপক্ষে ৫টি অক্ষর)।",
    feedback_success: "✅ আপনার মেসেজটি অ্যাডমিনের কাছে সফলভাবে পাঠানো হয়েছে। ধন্যবাদ!",
    
    invalid_cmd: (cmd) => `❌ ভুল ইনপুট বা আদেশ: \`${cmd}\` নম্বর বা কমান্ডটি গ্রহণযোগ্য নয়। নিচে সঠিক সাহায্য গাইডটি দেওয়া হলো:`,
    maint_msg: "🚧 বটের কাজ চলছে (Under Maintenance)! খুব শীঘ্রই আমরা ফিরে আসছি।",
    session_started: () => `✨ অ্যানিমেশন মেসেজ লিখুন।\n\n💡লেখার নিয়ম:\n• প্রতি লাইনের পর কীবোর্ডের Enter চেপে নতুন লাইনে লিখুন অথবা প্রতিটি লাইনের মাঝে কমা ( , ) ব্যবহার করুন। যেমন হ্যালো, প্রিয়, কেমন আছো।`,
    input_anim_success: (count) => `✅ চমৎকার! আপনি ${count} লাইনের অ্যানিমেশন যোগ করেছেন।\n\n💌 এবার খামের ভেতরের মূল চিঠি বা উইশ মেসেজটি লিখে পাঠান।`,
    general_error: "⚠️ দুঃখিত, একটি অভ্যন্তরীণ ত্রুটি ঘটেছে। অনুগ্রহ করে আবার চেষ্টা করুন।"
};

bot.use((ctx, next) => {
    try {
        const userId = ctx.chat ? ctx.chat.id : null;
        if (!userId) return next();
        
        if (!db.registeredUsers.includes(userId)) {
            db.registeredUsers.push(userId);
        }
        if (ctx.from && ctx.from.username) {
            const uname = ctx.from.username.toLowerCase();
            db.usernameMap[uname] = userId;
        }
        saveDB();

        if (Number(userId) === Number(ADMIN_CHAT_ID)) return next();
        if (db.bannedUsers.includes(userId)) return;
        if (db.isMaintenanceMode) {
            return ctx.reply(locale.maint_msg);
        }

        return next();
    } catch (err) {
        console.error("Middleware Error:", err);
    }
});

bot.command('start', (ctx) => { 
    try {
        delete db.userSessions[ctx.chat.id];
        saveDB();
        sendMainMenu(ctx, false); 
    } catch (err) { console.error(err); }
});

function showAdminDashboard(ctx, isEdit = false) {
    const maintStatus = db.isMaintenanceMode ? "ON 🔴" : "OFF 🟢";
    const text = `👑 Welcome to the Master Admin Core Console:`;
    
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback(`🛠️ Maintenance: ${maintStatus}`, "adm_toggle_maint")],
        [Markup.button.callback("📢 Announcement (Broadcast)", "adm_broadcast")],
        [Markup.button.callback("🔗 All Links Management", "adm_all_links_menu")],
        [Markup.button.callback("🚫 Ban / Unban System", "adm_ban_menu")]
    ]);

    if (isEdit) {
        return ctx.editMessageText(text, { reply_markup: keyboard.reply_markup, parse_mode: 'Markdown' }).catch(()=>{});
    } else {
        return ctx.reply(text, { reply_markup: keyboard.reply_markup, parse_mode: 'Markdown' });
    }
}

function handleAdminSecureAccess(ctx) {
    if (Number(ctx.chat.id) !== Number(ADMIN_CHAT_ID)) {
        ctx.reply(locale.invalid_cmd(ctx.message.text), { parse_mode: 'Markdown' });
        ctx.reply(locale.help_text, Markup.inlineKeyboard([[Markup.button.callback(locale.btn_back, 'go_to_main_menu')]]), { parse_mode: 'Markdown' });
        return;
    }
    showAdminDashboard(ctx, false);
}

bot.command('admin', handleAdminSecureAccess);
bot.command('adm', handleAdminSecureAccess);

bot.action('adm_toggle_maint', (ctx) => {
    if (Number(ctx.chat.id) !== Number(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    db.isMaintenanceMode = !db.isMaintenanceMode;
    saveDB();
    ctx.answerCbQuery(`Maintenance Mode: ${db.isMaintenanceMode}`);
    showAdminDashboard(ctx, true);
});

bot.action('adm_broadcast', (ctx) => {
    if (Number(ctx.chat.id) !== Number(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    ctx.answerCbQuery();
    db.userSessions[ctx.chat.id] = { step: 'AWAITING_ADMIN_BROADCAST_MSG' };
    saveDB();
    ctx.reply("📢 Announcement মেসেজটি পাঠান:\n\nবটের সকল ইউজারের কাছে চলে যাবে।", Markup.inlineKeyboard([
        [Markup.button.callback("❌ বাতিল করুন", "adm_back_to_dashboard")]
    ]));
});

bot.action('adm_all_links_menu', (ctx) => {
    if (Number(ctx.chat.id) !== Number(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    ctx.answerCbQuery();
    ctx.editMessageText("🔗 All Links Management Sub-Menu:", Markup.inlineKeyboard([
        [Markup.button.callback("📜 View All Links List", "adm_view_links_list")],
        [Markup.button.callback("💥 Turn Off & Delete All Links", "adm_delete_all_links_confirm")],
        [Markup.button.callback("🔙 ব্যাক টু ড্যাশবোর্ড", "adm_back_to_dashboard")]
    ]));
});

bot.action('adm_view_links_list', (ctx) => {
    if (Number(ctx.chat.id) !== Number(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    ctx.answerCbQuery();
    
    const keys = Object.keys(db.linkDatabase);
    if (keys.length === 0) {
        return ctx.editMessageText("ℹ️ বর্তমানে সিস্টেমে কোনো একটিভ লিংক তৈরি করা নেই।", Markup.inlineKeyboard([
            [Markup.button.callback("🔙 পেছনে যান", "adm_all_links_menu")]
        ]));
    }

    ctx.reply("📜 চলতি সকল লিংকের তালিকা (বন্ধ করতে লিংকে ক্লিক করুন):");
    keys.forEach(key => {
        const linkData = db.linkDatabase[key];
        ctx.reply(`👤 Creator: ${linkData.name}\n📂 Cat: ${linkData.type}\n🔗 Link ID: ${key}`, Markup.inlineKeyboard([
            [Markup.button.callback(`❌ Delete/Off: ${key}`, `adm_instant_del_${key}`)]
        ]));
    });
});

bot.action(/^adm_instant_del_(.+)$/, (ctx) => {
    if (Number(ctx.chat.id) !== Number(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    const targetKey = ctx.match[1];
    if (db.linkDatabase[targetKey]) {
        delete db.linkDatabase[targetKey];
        saveDB();
        ctx.answerCbQuery("✅ লিংকটি সফলভাবে রিমুভ করা হয়েছে।");
        ctx.editMessageText("❌ এই লিংকটি অ্যাডমিন প্যানেল থেকে চিরতরে অফ এবং ডিলিট করা হয়েছে।");
    } else {
        ctx.answerCbQuery("⚠️ লিংকটি অলরেডি ডিলিট হয়ে গেছে!");
    }
});

bot.action('adm_delete_all_links_confirm', (ctx) => {
    if (Number(ctx.chat.id) !== Number(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    ctx.answerCbQuery();
    db.linkDatabase = {};
    saveDB();
    ctx.editMessageText("💥 সিস্টেমের সমস্ত একটিভ লিংক এক ক্লিকে চিরতরে ডিলিট করে দেওয়া হয়েছে!", Markup.inlineKeyboard([
        [Markup.button.callback("🔙 পেছনে যান", "adm_all_links_menu")]
    ]));
});

bot.action('adm_ban_menu', (ctx) => {
    if (Number(ctx.chat.id) !== Number(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    ctx.answerCbQuery();
    
    const totalUsersCount = db.registeredUsers.length;
    const bannedUsersCount = db.bannedUsers.length;

    db.userSessions[ctx.chat.id] = { step: 'AWAITING_BAN_USER_INPUT' };
    saveDB();

    ctx.reply(`🚫 Ban / Unban Management System\n\n📊 পরিসংখ্যান:\n• মোট ইউজার সংখ্যা: ${totalUsersCount}\n• ব্যান ইউজার: ${bannedUsersCount}\n\n👉 অনুগ্রহ করে যে ইউজারকে ব্যান বা আনব্যান করতে চান তার Telegram User ID অথবা Username নিচে লিখে পাঠান:`, Markup.inlineKeyboard([
        [Markup.button.callback("❌ বাতিল করুন", "adm_back_to_dashboard")]
    ]));
});

bot.action('adm_back_to_dashboard', (ctx) => {
    if (Number(ctx.chat.id) !== Number(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    ctx.answerCbQuery();
    delete db.userSessions[ctx.chat.id];
    saveDB();
    showAdminDashboard(ctx, true);
});

bot.action('go_to_main_menu', (ctx) => { ctx.answerCbQuery(); sendMainMenu(ctx, true); });

bot.action('menu_makelink', (ctx) => {
    ctx.answerCbQuery();
    ctx.editMessageText(locale.choose_cat, Markup.inlineKeyboard([
        [Markup.button.callback(locale.cat_love, 'make_love')],
        [Markup.button.callback(locale.cat_birthday, 'make_birthday')],
        [Markup.button.callback(locale.cat_sorry, 'make_sorry')],
        [Markup.button.callback(locale.cat_eid, 'make_eid')],
        [Markup.button.callback(locale.btn_back, 'go_to_main_menu')]
    ]));
});

bot.action(/^make_/, (ctx) => {
    ctx.answerCbQuery();
    const cat = ctx.match.input.replace('make_', '');
    db.userSessions[ctx.chat.id] = { 
        type: cat, 
        name: `${ctx.from.first_name || ""} ${ctx.from.last_name || ""}`.trim() || "User",
        username: ctx.from.username ? `@${ctx.from.username}` : "None",
        music: AUTOMATIC_MUSIC_MAPPING[cat] || "",
        step: 'AWAITING_COUNTDOWN_SELECTION'
    };
    saveDB();
    showCountdownPrompt(ctx);
});

function showCountdownPrompt(ctx) {
    ctx.editMessageText(locale.prompt_countdown_ask, Markup.inlineKeyboard([
        [Markup.button.callback(locale.btn_no_countdown, 'timer_no')],
        [Markup.button.callback('🕒 ৩ মিনিট', 'set_time_3'), Markup.button.callback('🕒 ৫ মিনিট', 'set_time_5')],
        [Markup.button.callback('🕒 ১০ মিনিট', 'set_time_10')],
        [Markup.button.callback("🔙 পেছনে যান", 'menu_makelink')]
    ]), { parse_mode: 'Markdown' }).catch(()=>{});
}

bot.action('timer_no', (ctx) => { 
    ctx.answerCbQuery(); 
    if (!db.userSessions[ctx.chat.id]) db.userSessions[ctx.chat.id] = {};
    db.userSessions[ctx.chat.id].pendingMinutes = null; 
    saveDB();
    showAnimationIntro(ctx); 
});

bot.action(/^set_time_/, (ctx) => {
    ctx.answerCbQuery();
    const userId = ctx.chat.id;
    if (!db.userSessions[userId]) db.userSessions[userId] = {};
    const minutes = parseInt(ctx.match.input.replace('set_time_', ''), 10);
    db.userSessions[userId].pendingMinutes = minutes;
    saveDB();
    showAnimationIntro(ctx);
});

function showAnimationIntro(ctx) {
    if (!db.userSessions[ctx.chat.id]) {
        db.userSessions[ctx.chat.id] = { type: 'love', name: 'User', username: 'None' };
    }
    db.userSessions[ctx.chat.id].step = 'AWAITING_ANIMATION_TEXT';
    saveDB();
    ctx.editMessageText(locale.session_started(), Markup.inlineKeyboard([
        [Markup.button.callback("🔙 পেছনে যান", 'back_to_timer_ask')]
    ]), { parse_mode: 'Markdown' }).catch(()=>{});
}

bot.action('back_to_timer_ask', (ctx) => {
    ctx.answerCbQuery();
    showCountdownPrompt(ctx);
});

bot.action('menu_feedback', (ctx) => { 
    ctx.answerCbQuery(); 
    db.userSessions[ctx.chat.id] = { step: 'AWAITING_USER_FEEDBACK' }; 
    saveDB();
    ctx.reply(locale.feedback_prompt); 
});

bot.action('menu_help', (ctx) => {
    ctx.answerCbQuery();
    ctx.reply(locale.help_text, Markup.inlineKeyboard([[Markup.button.callback(locale.btn_back, 'go_to_main_menu')]]), { parse_mode: 'Markdown' });
});

bot.action(/^delete_link_(.+)$/, (ctx) => {
    const linkId = ctx.match[1];
    const data = db.linkDatabase[linkId];
    if (!data) return ctx.answerCbQuery("⚠️ এই লিঙ্কটি ইতিমধ্যে রিমুভ করা হয়েছে!", { show_alert: true });
    if (Number(data.userId) !== Number(ctx.chat.id)) {
        return ctx.answerCbQuery("❌ এই লিঙ্কটি ডিলিট করার পারমিশন আপনার নেই।", { show_alert: true });
    }
    ctx.answerCbQuery("✅ লিঙ্কটি সফলভাবে ডিলিট করা হয়েছে।", { show_alert: true });
    delete db.linkDatabase[linkId];
    saveDB();
    ctx.editMessageText("❌ আপনার এই লিঙ্কটি চিরতরে বন্ধ এবং রিমুভ করে দেওয়া হয়েছে।");
    sendMainMenu(ctx, false);
});

bot.action(/^view_ans_(.+)$/, (ctx) => {
    if (Number(ctx.chat.id) !== Number(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    const linkId = ctx.match[1];
    const data = db.linkDatabase[linkId];
    
    if (!data) {
        return ctx.answerCbQuery("⚠️ লিঙ্কটি ডাটাবেজে পাওয়া যায়নি বা ডিলিট হয়ে গেছে।", { show_alert: true });
    }
    
    if (data.answer) {
        return ctx.answerCbQuery(`📩 ইউজারের উত্তর: ${data.answer}`, { show_alert: true });
    } else {
        return ctx.answerCbQuery("⏳ ইউজার এখনও কোনো উত্তর সাবমিট করেনি!", { show_alert: true });
    }
});

bot.on('text', (ctx) => {
    const userId = ctx.chat.id;
    const session = db.userSessions[userId];
    const text = ctx.message.text.trim();

    if (session && session.step === 'AWAITING_USER_FEEDBACK') {
        if (text.length < 5) {
            return ctx.reply(locale.feedback_short);
        }
        const fullName = `${ctx.from?.first_name || ""} ${ctx.from?.last_name || ""}`.trim() || "User";
        const userName = ctx.from?.username ? `@${ctx.from.username}` : "None";
        const formattedFeedback = `📝 Feedback\nName: ${fullName}\nID: ${userId}\nUsername: ${userName}\n\n${text}`;
        
        bot.telegram.sendMessage(ADMIN_CHAT_ID, formattedFeedback).catch(e => console.error(e));
        
        delete db.userSessions[userId]; 
        saveDB();
        
        ctx.reply(locale.feedback_success, Markup.inlineKeyboard([
            [Markup.button.callback(locale.btn_back, 'go_to_main_menu')]
        ])); 
        return;
    }

    if (Number(userId) === Number(ADMIN_CHAT_ID) && session) {
        if (session.step === 'AWAITING_ADMIN_BROADCAST_MSG') {
            db.registeredUsers.forEach(id => {
                bot.telegram.sendMessage(id, `📢 [Announcement]\n\n${text}`, { parse_mode: 'Markdown' }).catch(()=>{});
            });
            ctx.reply("📡 Broadcast Transmission Completed to All Users.");
            delete db.userSessions[userId]; 
            saveDB();
            showAdminDashboard(ctx, false);
            return;
        }
        
        if (session.step === 'AWAITING_BAN_USER_INPUT') {
            let targetId = parseInt(text, 10);
            if (isNaN(targetId)) {
                let cleanUsername = text.replace('@', '').trim().toLowerCase();
                targetId = db.usernameMap[cleanUsername];
                if (!targetId) {
                    return ctx.reply("❌ দুঃখিত! এই ইউজারনেমটি বটের ডাটাবেজে খুঁজে পাওয়া যায়নি।");
                }
            }
            
            let responseAdminMsg = "";
            if (db.bannedUsers.includes(targetId)) {
                db.bannedUsers = db.bannedUsers.filter(id => id !== targetId);
                responseAdminMsg = `🟢 ইউজার \`${targetId}\` কে সফলভাবে UNBAN করা হয়েছে।`;
            } else {
                db.bannedUsers.push(targetId);
                responseAdminMsg = `🚫 ইউজার \`${targetId}\` কে সফলভাবে BAN করা হয়েছে।`;
            }
            
            saveDB();
            ctx.reply(responseAdminMsg, { parse_mode: 'Markdown' });
            delete db.userSessions[userId]; 
            saveDB();
            showAdminDashboard(ctx, false);
            return;
        }
    }

    if (!session || !session.step) {
        ctx.reply(locale.invalid_cmd(text), { parse_mode: 'Markdown' });
        ctx.reply(locale.help_text, Markup.inlineKeyboard([[Markup.button.callback(locale.btn_back, 'go_to_main_menu')]]), { parse_mode: 'Markdown' });
        return;
    }

    try {
        if (session.step === 'AWAITING_ANIMATION_TEXT') {
            const lines = text.split(/[\n,，]+/).map(l => l.trim()).filter(l => l.length > 0);
            if (lines.length === 0) return ctx.reply("⚠️ অনুগ্রহ করে অন্তত একটি অ্যানিমেশন টেক্সট লিখুন।");
            
            db.userSessions[userId].animations = lines;
            db.userSessions[userId].step = 'AWAITING_LETTER_TEXT';
            saveDB();
            ctx.reply(locale.input_anim_success(lines.length));
            return;
        }

        if (session.step === 'AWAITING_LETTER_TEXT') {
            processFinalLinkCreation(ctx, text);
            return;
        }

        ctx.reply(locale.invalid_cmd(text), { parse_mode: 'Markdown' });
        ctx.reply(locale.help_text, Markup.inlineKeyboard([[Markup.button.callback(locale.btn_back, 'go_to_main_menu')]]), { parse_mode: 'Markdown' });

    } catch (error) {
        console.error("Critical Runtime Error:", error);
        ctx.reply(locale.general_error);
    }
});

function processFinalLinkCreation(ctx, letterText) {
    const userId = ctx.chat.id;
    const session = db.userSessions[userId];

    db.totalLinksCreated = (db.totalLinksCreated || 0) + 1;
    let finalCountdownIso = null;
    if (session.pendingMinutes) {
        const targetDate = new Date();
        targetDate.setMinutes(targetDate.getMinutes() + session.pendingMinutes);
        finalCountdownIso = targetDate.toISOString();
    }

    const uniqueId = Math.random().toString(36).substring(2, 9);
    const finalGeneratedUrl = `${SERVER_URL}/love/${uniqueId}`;
    
    db.linkDatabase[uniqueId] = {
        userId: userId, name: session.name || "User", username: session.username || "None", type: session.type || "love",
        music: session.music || "", countdown: finalCountdownIso,
        animations: session.animations, letter: letterText, answer: null
    };
    
    ctx.reply(`আপনার লিংক তৈরি করা হয়েছে।\n\nলিংক: \`${finalGeneratedUrl}\``, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [Markup.button.callback("❌ Link Off", `delete_link_${uniqueId}`)]
        ])
    });

    const adminMsg = `নতুন লিংক তৈরি করা হয়েছে。\nName: ${session.name}\nID: ${userId}\nUsername: ${session.username}\nCategory: ${session.type.toUpperCase()}`;
    bot.telegram.sendMessage(ADMIN_CHAT_ID, adminMsg, Markup.inlineKeyboard([
        [Markup.button.callback("👀 Check Answer", `view_ans_${uniqueId}`)]
    ])).catch(e => console.error(e));

    delete db.userSessions[userId];
    saveDB();
}

function sendMainMenu(ctx, isEdit = false) {
    try {
        const fullName = `${ctx.from?.first_name || ""} ${ctx.from?.last_name || ""}`.trim() || "ব্যবহারকারী";
        const text = locale.welcome(fullName);
        const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback(locale.btn_make, 'menu_makelink')],
            [Markup.button.callback(locale.btn_feedback, 'menu_feedback'), Markup.button.callback(locale.btn_help, 'menu_help')]
        ]);
        if (isEdit) return ctx.editMessageText(text, { reply_markup: keyboard.reply_markup, parse_mode: 'Markdown' }).catch(()=>{});
        return ctx.reply(text, { reply_markup: keyboard.reply_markup, parse_mode: 'Markdown' });
    } catch (err) { console.error(err); }
}

app.post('/api/get-content', async (req, res) => {
    try {
        const { id } = req.body;
        const data = db.linkDatabase[id];
        if (!data) return res.json({ success: false });

        bot.telegram.sendMessage(data.userId, "কেউ আপনার লিংক ওপেন করেছে!").catch(e => console.error(e));

        if (data.countdown) {
            const now = new Date();
            const lockTime = new Date(data.countdown);
            if (lockTime > now) return res.json({ success: true, isLocked: true, countdownTime: data.countdown });
        }

        const currentConfig = CATEGORY_CONFIGS[data.type] || CATEGORY_CONFIGS['love'];
        return res.json({ 
            success: true, isLocked: false,
            title: currentConfig.title, music: data.music, 
            animations: data.animations, letter: data.letter,
            emojis: currentConfig.emojis, question: currentConfig.question, buttons: currentConfig.buttons
        });
    } catch (err) { res.json({ success: false }); }
});

app.post('/api/submit-answer', async (req, res) => {
    try {
        const { id, answer } = req.body;
        const data = db.linkDatabase[id];
        if (!data) return res.json({ success: false });

        data.answer = answer;
        saveDB();

        const currentConfig = CATEGORY_CONFIGS[data.type] || CATEGORY_CONFIGS['love'];
        const userNotifyMsg = `আপনার তৈরি করা লিংক থেকে রিপ্লাই এসেছে।\nQuestion: ${currentConfig.question}\nAns: ${answer}`;
        bot.telegram.sendMessage(data.userId, userNotifyMsg, Markup.inlineKeyboard([
            [Markup.button.callback("❌ Link Off", `delete_link_${id}`)]
        ])).catch(e => console.error(e));

        return res.json({ success: true });
    } catch (err) { res.json({ success: false }); }
});

app.get('/love/:id', (req, res) => { res.sendFile(path.join(__dirname, 'index.html')); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    bot.launch();
    console.log(`Server running successfully on port ${PORT}`);
});
