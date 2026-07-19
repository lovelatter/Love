const express = require('express');
const path = require('path');
const { Telegraf, Markup } = require('telegraf');
const https = require('https');
const fs = require('fs');
const admin = require('firebase-admin');

// Firebase Initialization
const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://loveletter-4a9d8-default-rtdb.asia-southeast1.firebasedatabase.app"
});
const dbRef = admin.database().ref('bot_data');

const app = express();
app.use(express.json());
app.set('trust proxy', true);

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const ADMIN_IDS = (process.env.ADMIN_CHAT_ID || "").split(',').map(id => id.trim()).filter(id => id !== "");

const isAdmin = (userId) => ADMIN_IDS.includes(userId.toString());

const SERVER_URL = "https://love-bb7p.onrender.com";
const UPLOADS_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const GITHUB_MUSIC_BASE_URL = "https://raw.githubusercontent.com/lovelatter/Love/main";

const AUTOMATIC_MUSIC_MAPPING = {
    love: `${GITHUB_MUSIC_BASE_URL}/love.mp3`,
    birthday: `${GITHUB_MUSIC_BASE_URL}/bd.mp3`,
    sorry: `${GITHUB_MUSIC_BASE_URL}/sorry.mp3`,
    eid: `${GITHUB_MUSIC_BASE_URL}/eid.mp3`
};

const CATEGORY_CONFIGS = {
    love: { title: "আমার মনের কিছু কথা", emojis: ["❤️", "💖", "💕"], question: "Do you love me? 🥺", buttons: ["Yes", "No"] },
    birthday: { title: "Happy Birthday", emojis: ["🎈", "🎉", "🎊"], question: "Are you happy? 😊", buttons: ["Yes", "No"] },
    sorry: { title: "I'm Sorry", emojis: ["😭", "😞", "😥"], question: "Do you forgive me? 🥺", buttons: ["Yes", "No"] },
    eid: { title: "Eid Mubarak", emojis: ["🤝", "🎇", "🫂"], question: "EID Mubarak 🌙", buttons: ["EID Mubarak"] }
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

async function loadDB() {
    const snapshot = await dbRef.once('value');
    if (snapshot.exists()) {
        db = { ...db, ...snapshot.val() };
    }
}

const saveDB = () => {
    dbRef.set(db).catch(e => console.error(e));
};

const bot = new Telegraf(TELEGRAM_TOKEN);

const locale = {
    welcome: (name) => `হ্যালো ${name}। বটের পক্ষ থেকে স্বাগতম।`,
    btn_make: "🚀 লিঙ্ক তৈরি করুন", btn_feedback: "📝 মতামত", btn_help: "❓ সাহায্য", btn_back: "🔙 মেইন মেনু",
    choose_cat: "✨ আপনি কোন ক্যাটাগরির লিঙ্ক করতে চান?",
    cat_love: "❤️ প্রেমের চিঠি (Love)", cat_birthday: "🎂 জন্মদিনের শুভেচ্ছা (Birthday)", cat_sorry: "🥺 দুঃখ প্রকাশ (Sorry)", cat_eid: "🌙 ঈদ মোবারক (Eid)",
    prompt_countdown_ask: "⏰ টাইম কাউন্টডাউন সেট করুন।",
    btn_no_countdown: "❌ No Countdown",
    prompt_image_ask: "📸 আপনি কি কোনো ছবি যুক্ত করতে চান?\n\nতাহলে ছবিটি এখানে পাঠান অথবা নিচে Skip করুন।",
    btn_skip_image: "⏭️ Skip করুন",
    help_text: `❓ বট ব্যবহারের সঠিক নিয়ম (Help Guide):\n\n1️⃣ প্রথমে 🚀 লিঙ্ক তৈরি করুন বাটনে ক্লিক করুন।\n2️⃣ আপনার পছন্দের ক্যাটাগরি (Love, Birthday, etc.) সিলেক্ট করুন।\n3️⃣ লিঙ্কটি কতক্ষণ পর আনলক হবে তার জন্য একটি টাইম কাউন্টডাউন সিলেক্ট করুন।\n4️⃣ বটের ইচ্ছে অনুযায়ী একটি ছবি আপলোড করুন অথবা Skip করুন।\n5️⃣ বটের নির্দেশনা অনুযায়ী 😊 অ্যানিমেশন টেক্সট এবং খামের ভেতরের মূল চিঠিটি লিখে পাঠান।\n6️⃣ সবশেষে বট আপনাকে একটি ইউনিক লিঙ্ক জেনারেট করে দেবে যা আপনি শেয়ার করতে পারবেন!`,
    feedback_prompt: "📝 মতামত ও রিপোর্ট:\n\nঅ্যাডমিনের কাছে কোনো রিপোর্ট, নতুন আপদেশের আইডিয়া বা অন্য কোনো কিছু বলার থাকলে আপনার মেসেজটি নিচে লিখে পাঠিয়ে দিন:",
    feedback_short: "❌ মেসেজটি একটু বিস্তারিত লিখুন (কমপক্ষে ৫টি অক্ষর)।",
    feedback_success: "✅ আপনার মেসেজটি অ্যাডমিনের কাছে সফলভাবে পাঠানো হয়েছে। ধন্যবাদ!",
    invalid_cmd: (cmd) => `❌ ভুল ইনপুট বা আদেশ: \`${cmd}\` নম্বর বা কমান্ডটি গ্রহণযোগ্য নয়। নিচে সঠিক সাহায্য গাইডটি দেওয়া হলো:`,
    maint_msg: "🚧 বটের কাজ চলছে (Under Maintenance)! খুব শীঘ্রই আমরা ফিরে আসছি।\n\nঅ্যাডমিনকে কিছু বলার থাকলে নিচে মতামত জানাতে পারেন।",
    session_started: () => `✨ অ্যানিমেশন মেসেজ লিখুন।\n\n💡লেখার নিয়ম:\n• প্রতি লাইনের পর কীবোর্ডের Enter চেপে নতুন লাইনে লিখুন অথবা প্রতিটি লাইনের মাঝে কমা ( , ) ব্যবহার করুন। যেমন হ্যালো, প্রিয়, কেমন আছো।`,
    input_anim_success: (count) => `✅ চমৎকার! আপনি ${count} লাইনের অ্যানিমেশন যোগ করেছেন।\n\n💌 এবার খামের ভেতরের মূল চিঠি বা উইশ মেসেজটি লিখে পাঠান।`,
    general_error: "⚠️ দুঃখিত, একটি অভ্যন্তরীণ ত্রুটি ঘটেছে। অনুগ্রহ করে আবার চেষ্টা করুন."
};

bot.use(async (ctx, next) => {
    const userId = ctx.chat?.id;
    if (!userId) return;
    if (!db.registeredUsers.includes(userId)) db.registeredUsers.push(userId);
    if (ctx.from?.username) db.usernameMap[ctx.from.username.toLowerCase()] = userId;
    saveDB();
    if (isAdmin(userId)) return next();
    if (db.bannedUsers.includes(userId)) return;
    if (db.isMaintenanceMode) {
        const session = db.userSessions[userId];
        if (session?.step === 'AWAITING_USER_FEEDBACK') return next();
        if (ctx.callbackQuery?.data === 'menu_feedback') return next();
        const maintKeyboard = Markup.inlineKeyboard([[Markup.button.callback(locale.btn_feedback, 'menu_feedback')]]);
        if (ctx.callbackQuery) {
            ctx.answerCbQuery().catch(() => {});
            return ctx.editMessageText(locale.maint_msg, maintKeyboard).catch(() => {});
        }
        return ctx.reply(locale.maint_msg, maintKeyboard).catch(() => {});
    }
    return next();
});

const sendMainMenu = (ctx, isEdit = false) => {
    const fullName = `${ctx.from?.first_name || ""} ${ctx.from?.last_name || ""}`.trim() || "User";
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback(locale.btn_make, 'menu_makelink')],
        [Markup.button.callback(locale.btn_feedback, 'menu_feedback'), Markup.button.callback(locale.btn_help, 'menu_help')]
    ]);
    if (isEdit) return ctx.editMessageText(locale.welcome(fullName), { reply_markup: keyboard.reply_markup, parse_mode: 'Markdown' }).catch(() => {});
    return ctx.reply(locale.welcome(fullName), { reply_markup: keyboard.reply_markup, parse_mode: 'Markdown' }).catch(() => {});
};

bot.command('start', (ctx) => { delete db.userSessions[ctx.chat.id]; saveDB(); sendMainMenu(ctx, false); });

const showAdminDashboard = (ctx, isEdit = false) => {
    const maintStatus = db.isMaintenanceMode ? "ON 🔴" : "OFF 🟢";
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback(`🛠️ Maintenance: ${maintStatus}`, "adm_toggle_maint")],
        [Markup.button.callback("📢 Announcement", "adm_broadcast")],
        [Markup.button.callback("🔗 All Links", "adm_all_links_menu")],
        [Markup.button.callback("🚫 Ban / Unban", "adm_ban_menu")]
    ]);
    const text = `👑 Admin Console:`;
    if (isEdit) return ctx.editMessageText(text, { reply_markup: keyboard.reply_markup, parse_mode: 'Markdown' }).catch(() => {});
    return ctx.reply(text, { reply_markup: keyboard.reply_markup, parse_mode: 'Markdown' }).catch(() => {});
};

bot.command(['admin', 'adm'], (ctx) => {
    if (!isAdmin(ctx.chat.id)) return ctx.reply("❌");
    showAdminDashboard(ctx, false);
});

bot.action('adm_toggle_maint', (ctx) => {
    if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery();
    db.isMaintenanceMode = !db.isMaintenanceMode;
    saveDB();
    ctx.answerCbQuery(`Maintenance: ${db.isMaintenanceMode}`);
    showAdminDashboard(ctx, true);
});

bot.action('adm_broadcast', (ctx) => {
    if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery();
    db.userSessions[ctx.chat.id] = { step: 'AWAITING_ADMIN_BROADCAST_MSG' };
    saveDB();
    ctx.answerCbQuery();
    ctx.reply("📢 মেসেজ পাঠান:");
});

bot.action('adm_all_links_menu', (ctx) => {
    if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery();
    ctx.editMessageText("🔗 Manage Links:", Markup.inlineKeyboard([
        [Markup.button.callback("📜 View All", "adm_view_links_list")],
        [Markup.button.callback("💥 Delete All", "adm_delete_all_links_confirm")],
        [Markup.button.callback("🔙 Back", "adm_back_to_dashboard")]
    ]));
});

bot.action('adm_view_links_list', (ctx) => {
    if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery();
    const keys = Object.keys(db.linkDatabase);
    if (!keys.length) return ctx.answerCbQuery("Empty!", { show_alert: true });
    ctx.reply("📜 List:");
    keys.forEach(key => {
        ctx.reply(`ID: ${key}`, Markup.inlineKeyboard([[Markup.button.callback(`❌ Del`, `adm_instant_del_${key}`)]]));
    });
});

bot.action(/^adm_instant_del_(.+)$/, (ctx) => {
    if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery();
    delete db.linkDatabase[ctx.match[1]];
    saveDB();
    ctx.answerCbQuery("Deleted");
    showAdminDashboard(ctx, true);
});

bot.action('adm_delete_all_links_confirm', (ctx) => {
    if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery();
    db.linkDatabase = {};
    saveDB();
    ctx.editMessageText("💥 All Deleted!");
});

bot.action('adm_ban_menu', (ctx) => {
    if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery();
    db.userSessions[ctx.chat.id] = { step: 'AWAITING_BAN_USER_INPUT' };
    saveDB();
    ctx.reply(`🆔 ID/Username পাঠান:`);
});

bot.action('adm_back_to_dashboard', (ctx) => {
    if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery();
    delete db.userSessions[ctx.chat.id];
    saveDB();
    showAdminDashboard(ctx, true);
});

bot.action('go_to_main_menu', (ctx) => { ctx.answerCbQuery(); sendMainMenu(ctx, true); });

bot.action('menu_makelink', (ctx) => {
    ctx.editMessageText(locale.choose_cat, Markup.inlineKeyboard([
        [Markup.button.callback(locale.cat_love, 'make_love')],
        [Markup.button.callback(locale.cat_birthday, 'make_birthday')],
        [Markup.button.callback(locale.cat_sorry, 'make_sorry')],
        [Markup.button.callback(locale.cat_eid, 'make_eid')],
        [Markup.button.callback(locale.btn_back, 'go_to_main_menu')]
    ]));
});

bot.action(/^make_/, (ctx) => {
    const cat = ctx.match.input.replace('make_', '');
    db.userSessions[ctx.chat.id] = { type: cat, name: ctx.from.first_name, step: 'AWAITING_COUNTDOWN_SELECTION' };
    saveDB();
    showCountdownPrompt(ctx);
});

function showCountdownPrompt(ctx) {
    ctx.editMessageText(locale.prompt_countdown_ask, Markup.inlineKeyboard([
        [Markup.button.callback(locale.btn_no_countdown, 'timer_no')],
        [Markup.button.callback('🕒 ৩ মিনিট', 'set_time_3'), Markup.button.callback('🕒 ৫ মিনিট', 'set_time_5')],
        [Markup.button.callback("🔙", 'menu_makelink')]
    ]));
}

bot.action('timer_no', (ctx) => { db.userSessions[ctx.chat.id].pendingMinutes = null; saveDB(); showImageUploadPrompt(ctx); });
bot.action(/^set_time_/, (ctx) => { db.userSessions[ctx.chat.id].pendingMinutes = parseInt(ctx.match.input.replace('set_time_', ''), 10); saveDB(); showImageUploadPrompt(ctx); });

function showImageUploadPrompt(ctx) {
    db.userSessions[ctx.chat.id].step = 'AWAITING_IMAGE_UPLOAD';
    saveDB();
    ctx.editMessageText(locale.prompt_image_ask, Markup.inlineKeyboard([[Markup.button.callback(locale.btn_skip_image, 'skip_image_upload')]]));
}

bot.action('skip_image_upload', (ctx) => { showAnimationIntro(ctx); });

function showAnimationIntro(ctx) {
    db.userSessions[ctx.chat.id].step = 'AWAITING_ANIMATION_TEXT';
    saveDB();
    ctx.editMessageText(locale.session_started());
}

bot.action('menu_feedback', (ctx) => { db.userSessions[ctx.chat.id] = { step: 'AWAITING_USER_FEEDBACK' }; saveDB(); ctx.reply(locale.feedback_prompt); });

bot.action('menu_help', (ctx) => { ctx.reply(locale.help_text); });

bot.on('photo', async (ctx) => {
    const userId = ctx.chat.id;
    if (db.userSessions[userId]?.step === 'AWAITING_IMAGE_UPLOAD') {
        const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
        const link = await bot.telegram.getFileLink(fileId);
        db.userSessions[userId].imageUrl = link.href;
        saveDB();
        showAnimationIntro(ctx);
    }
});

bot.on('text', async (ctx) => {
    const userId = ctx.chat.id;
    const session = db.userSessions[userId];
    const text = ctx.message.text.trim();

    if (session?.step === 'AWAITING_USER_FEEDBACK') {
        ADMIN_IDS.forEach(id => bot.telegram.sendMessage(id, `Feedback: ${text}`).catch(() => {}));
        delete db.userSessions[userId];
        saveDB();
        return ctx.reply(locale.feedback_success);
    }
    
    if (isAdmin(userId) && session?.step === 'AWAITING_ADMIN_BROADCAST_MSG') {
        db.registeredUsers.forEach(id => bot.telegram.sendMessage(id, text).catch(() => {}));
        delete db.userSessions[userId];
        saveDB();
        return ctx.reply("Done");
    }

    if (session?.step === 'AWAITING_ANIMATION_TEXT') {
        db.userSessions[userId].animations = text.split(',');
        db.userSessions[userId].step = 'AWAITING_LETTER_TEXT';
        saveDB();
        return ctx.reply("💌 চিঠি লিখুন:");
    }

    if (session?.step === 'AWAITING_LETTER_TEXT') {
        const uniqueId = Math.random().toString(36).substring(2, 9);
        db.linkDatabase[uniqueId] = { userId, ...db.userSessions[userId], letter: text };
        delete db.userSessions[userId];
        saveDB();
        ctx.reply(`লিঙ্ক: ${SERVER_URL}/love/${uniqueId}`);
    }
});

app.post('/api/get-content', async (req, res) => {
    const data = db.linkDatabase[req.body.id];
    if (!data) return res.json({ success: false });
    res.json({ success: true, ...data });
});

app.get('/love/:id', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 3000;
loadDB().then(() => {
    app.listen(PORT, () => {
        bot.launch();
        console.log(`Server running on port ${PORT}`);
    });
});
