const express = require('express');
const path = require('path');
const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');
const https = require('https');

const app = express();
app.use(express.json());
app.set('trust proxy', true);

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
const SERVER_URL = "https://love-bb7p.onrender.com";
const DB_FILE = path.join(__dirname, 'db.json');
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

try {
    if (fs.existsSync(DB_FILE)) {
        db = { ...db, ...JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) };
    } else {
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    }
} catch (e) {
    console.error("Database initialization failed. Resetting...", e);
}

const saveDB = () => {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    } catch (e) {
        console.error("Database save error:", e);
    }
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
    general_error: "⚠️ দুঃখিত, একটি অভ্যন্তরীণ ত্রুটি ঘটেছে। অনুগ্রহ করে আবার চেষ্টা করুন।"
};

bot.use(async (ctx, next) => {
    const userId = ctx.chat?.id;
    if (!userId) return;

    if (!db.registeredUsers.includes(userId)) db.registeredUsers.push(userId);
    if (ctx.from?.username) db.usernameMap[ctx.from.username.toLowerCase()] = userId;
    saveDB();

    if (Number(userId) === Number(ADMIN_CHAT_ID)) return next();
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
    const fullName = `${ctx.from?.first_name || ""} ${ctx.from?.last_name || ""}`.trim() || "ব্যবহারকারী";
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback(locale.btn_make, 'menu_makelink')],
        [Markup.button.callback(locale.btn_feedback, 'menu_feedback'), Markup.button.callback(locale.btn_help, 'menu_help')]
    ]);
    if (isEdit) return ctx.editMessageText(locale.welcome(fullName), { reply_markup: keyboard.reply_markup, parse_mode: 'Markdown' }).catch(() => {});
    return ctx.reply(locale.welcome(fullName), { reply_markup: keyboard.reply_markup, parse_mode: 'Markdown' }).catch(() => {});
};

bot.command('start', (ctx) => { 
    delete db.userSessions[ctx.chat.id];
    saveDB();
    sendMainMenu(ctx, false); 
});

const showAdminDashboard = (ctx, isEdit = false) => {
    const maintStatus = db.isMaintenanceMode ? "ON 🔴" : "OFF 🟢";
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback(`🛠️ Maintenance: ${maintStatus}`, "adm_toggle_maint")],
        [Markup.button.callback("📢 Announcement (Broadcast)", "adm_broadcast")],
        [Markup.button.callback("🔗 All Links Management", "adm_all_links_menu")],
        [Markup.button.callback("🚫 Ban / Unban System", "adm_ban_menu")]
    ]);
    const text = `👑 Welcome to the Master Admin Core Console:`;
    if (isEdit) return ctx.editMessageText(text, { reply_markup: keyboard.reply_markup, parse_mode: 'Markdown' }).catch(() => {});
    return ctx.reply(text, { reply_markup: keyboard.reply_markup, parse_mode: 'Markdown' }).catch(() => {});
};

bot.command(['admin', 'adm'], (ctx) => {
    if (Number(ctx.chat.id) !== Number(ADMIN_CHAT_ID)) {
        ctx.reply(locale.invalid_cmd(ctx.message.text || ''), { parse_mode: 'Markdown' }).catch(() => {});
        return ctx.reply(locale.help_text, Markup.inlineKeyboard([[Markup.button.callback(locale.btn_back, 'go_to_main_menu')]]), { parse_mode: 'Markdown' }).catch(() => {});
    }
    showAdminDashboard(ctx, false);
});

bot.action('adm_toggle_maint', (ctx) => {
    if (Number(ctx.chat.id) !== Number(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    db.isMaintenanceMode = !db.isMaintenanceMode;
    saveDB();
    ctx.answerCbQuery(`Maintenance: ${db.isMaintenanceMode}`);
    showAdminDashboard(ctx, true);
});

bot.action('adm_broadcast', (ctx) => {
    if (Number(ctx.chat.id) !== Number(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    ctx.answerCbQuery();
    db.userSessions[ctx.chat.id] = { step: 'AWAITING_ADMIN_BROADCAST_MSG' };
    saveDB();
    ctx.reply("📢 Announcement মেসেজটি পাঠান:", Markup.inlineKeyboard([[Markup.button.callback("❌ বাতিল করুন", "adm_back_to_dashboard")]]));
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
    if (!keys.length) {
        return ctx.editMessageText("ℹ️ বর্তমানে সিস্টেমে কোনো একটিভ লিংক তৈরি করা নেই।", Markup.inlineKeyboard([[Markup.button.callback("🔙 পেছনে যান", "adm_all_links_menu")]]));
    }
    ctx.reply("📜 চলতি সকল লিংকের তালিকা:");
    keys.forEach(key => {
        const data = db.linkDatabase[key];
        ctx.reply(`👤 Creator: ${data.name}\n📂 Cat: ${data.type}\n🔗 Link ID: ${key}`, Markup.inlineKeyboard([[Markup.button.callback(`❌ Delete/Off: ${key}`, `adm_instant_del_${key}`)]])).catch(() => {});
    });
});

bot.action(/^adm_instant_del_(.+)$/, (ctx) => {
    if (Number(ctx.chat.id) !== Number(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    const targetKey = ctx.match[1];
    if (db.linkDatabase[targetKey]) {
        if (db.linkDatabase[targetKey].imagePath) {
            const fullImgPath = path.join(__dirname, db.linkDatabase[targetKey].imagePath);
            if (fs.existsSync(fullImgPath)) fs.unlinkSync(fullImgPath);
        }
        delete db.linkDatabase[targetKey];
        saveDB();
        ctx.answerCbQuery("✅ লিংকটি রিমুভ করা হয়েছে।");
        ctx.editMessageText("❌ এই লিংকটি অ্যাডমিন প্যানেল থেকে চিরতরে অফ এবং ডিলিট করা হয়েছে।").catch(() => {});
    } else {
        ctx.answerCbQuery("⚠️ লিংকটি ইতিমধ্যে ডিলিট হয়ে গেছে!");
    }
});

bot.action('adm_delete_all_links_confirm', (ctx) => {
    if (Number(ctx.chat.id) !== Number(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    ctx.answerCbQuery();
    Object.keys(db.linkDatabase).forEach(key => {
        if (db.linkDatabase[key].imagePath) {
            const fullImgPath = path.join(__dirname, db.linkDatabase[key].imagePath);
            if (fs.existsSync(fullImgPath)) fs.unlinkSync(fullImgPath);
        }
    });
    db.linkDatabase = {};
    saveDB();
    ctx.editMessageText("💥 সিস্টেমের সমস্ত একটিভ লিংক এক ক্লিকে চিরতরে ডিলিট করে দেওয়া হয়েছে!", Markup.inlineKeyboard([[Markup.button.callback("🔙 পেছনে যান", "adm_all_links_menu")]]));
});

bot.action('adm_ban_menu', (ctx) => {
    if (Number(ctx.chat.id) !== Number(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    ctx.answerCbQuery();
    db.userSessions[ctx.chat.id] = { step: 'AWAITING_BAN_USER_INPUT' };
    saveDB();
    ctx.reply(`🚫 Ban / Unban System\n\n📊 মোট ইউজার: ${db.registeredUsers.length}\n• ব্যান ইউজার: ${db.bannedUsers.length}\n\n👉 অনুগ্রহ করে ইউজারের ID অথবা Username লিখে পাঠান:`, Markup.inlineKeyboard([[Markup.button.callback("❌ বাতিল করুন", "adm_back_to_dashboard")]]));
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
        imageUrl: null,
        step: 'AWAITING_COUNTDOWN_SELECTION'
    };
    saveDB();
    ctx.editMessageText(locale.prompt_countdown_ask, Markup.inlineKeyboard([
        [Markup.button.callback(locale.btn_no_countdown, 'timer_no')],
        [Markup.button.callback('🕒 ৩ মিনিট', 'set_time_3'), Markup.button.callback('🕒 ৫ মিনিট', 'set_time_5')],
        [Markup.button.callback('🕒 ১০ মিনিট', 'set_time_10')],
        [Markup.button.callback("🔙 পেছনে যান", 'menu_makelink')]
    ]), { parse_mode: 'Markdown' }).catch(() => {});
});

bot.action('timer_no', (ctx) => { 
    ctx.answerCbQuery(); 
    if (!db.userSessions[ctx.chat.id]) db.userSessions[ctx.chat.id] = {};
    db.userSessions[ctx.chat.id].pendingMinutes = null; 
    saveDB();
    showImageUploadPrompt(ctx); 
});

bot.action(/^set_time_/, (ctx) => {
    ctx.answerCbQuery();
    const userId = ctx.chat.id;
    if (!db.userSessions[userId]) db.userSessions[userId] = {};
    db.userSessions[userId].pendingMinutes = parseInt(ctx.match.input.replace('set_time_', ''), 10);
    saveDB();
    showImageUploadPrompt(ctx);
});

function showImageUploadPrompt(ctx) {
    const userId = ctx.chat.id;
    if (!db.userSessions[userId]) db.userSessions[userId] = {};
    db.userSessions[userId].step = 'AWAITING_IMAGE_UPLOAD';
    saveDB();
    ctx.editMessageText(locale.prompt_image_ask, Markup.inlineKeyboard([
        [Markup.button.callback(locale.btn_skip_image, 'skip_image_upload')],
        [Markup.button.callback("🔙 পেছনে যান", 'menu_makelink')]
    ])).catch(() => {
        ctx.reply(locale.prompt_image_ask, Markup.inlineKeyboard([
            [Markup.button.callback(locale.btn_skip_image, 'skip_image_upload')],
            [Markup.button.callback("🔙 পেছনে যান", 'menu_makelink')]
        ])).catch(() => {});
    });
}

bot.action('skip_image_upload', (ctx) => {
    ctx.answerCbQuery();
    if (db.userSessions[ctx.chat.id]) db.userSessions[ctx.chat.id].imageUrl = null;
    db.userSessions[ctx.chat.id].step = 'AWAITING_ANIMATION_TEXT';
    saveDB();
    ctx.editMessageText(locale.session_started(), Markup.inlineKeyboard([[Markup.button.callback("🔙 পেছনে যান", 'menu_makelink')]], { parse_mode: 'Markdown' })).catch(() => {});
});

bot.action('menu_feedback', (ctx) => { 
    ctx.answerCbQuery(); 
    db.userSessions[ctx.chat.id] = { step: 'AWAITING_USER_FEEDBACK' }; 
    saveDB(); 
    ctx.reply(locale.feedback_prompt); 
});

bot.action('menu_help', (ctx) => { ctx.answerCbQuery(); ctx.reply(locale.help_text, Markup.inlineKeyboard([[Markup.button.callback(locale.btn_back, 'go_to_main_menu')]]), { parse_mode: 'Markdown' }); });

bot.action(/^delete_link_(.+)$/, (ctx) => {
    const linkId = ctx.match[1];
    const data = db.linkDatabase[linkId];
    if (!data) return ctx.answerCbQuery("⚠️ এই লিঙ্কটি ইতিমধ্যে রিমুভ করা হয়েছে!", { show_alert: true });
    if (data.imagePath) {
        const fullImgPath = path.join(__dirname, data.imagePath);
        if (fs.existsSync(fullImgPath)) fs.unlinkSync(fullImgPath);
    }
    delete db.linkDatabase[linkId];
    saveDB();
    ctx.answerCbQuery("✅ লিঙ্কটি সফলভাবে ডিলিট করা হয়েছে।", { show_alert: true });
    ctx.editMessageText("❌ আপনার এই লিঙ্কটি চিরতরে বন্ধ এবং রিমুভ করে দেওয়া হয়েছে।");
});

bot.action(/^view_ans_(.+)$/, (ctx) => {
    if (Number(ctx.chat.id) !== Number(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    const data = db.linkDatabase[ctx.match[1]];
    if (!data) return ctx.answerCbQuery("⚠️ লিঙ্কটি ডাটাবেজে পাওয়া যায়নি।", { show_alert: true });
    return ctx.answerCbQuery(data.answer ? `📩 ইউজারের উত্তর: ${data.answer}` : "⏳ ইউজার এখনও উত্তর দেয়নি!", { show_alert: true });
});

bot.action(/^view_vi_(.+)$/, async (ctx) => {
    if (Number(ctx.chat.id) !== Number(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    const linkId = ctx.match[1];
    const data = db.linkDatabase[linkId];
    if (!data) return ctx.answerCbQuery("⚠️ লিঙ্কটি পাওয়া যায়নি।", { show_alert: true });
    ctx.answerCbQuery();

    if (!data.visitors || data.visitors.length === 0) return ctx.reply("ℹ️ এই লিঙ্কটি এখনও কেউ ওপেন করেনি।");

    let report = `👤 Visitor Details for Link [ ${linkId} ]:\n\n`;
    data.visitors.forEach((v, idx) => {
        report += `${idx + 1}. 🗓️ Time: ${v.time}\n🌐 IP: ${v.ip}\n🌍 Country: ${v.country} | City: ${v.city}\n📡 ISP: ${v.isp}\n📮 Zip: ${v.zip} | ⏰ TZ: ${v.timezone}\n📱 Device: ${v.os} (${v.screen})\n🔋 Battery: ${v.battery}\n📶 Net: ${v.network} | 🌐 Lang: ${v.lang}\n🌐 Browser: ${v.browser}\n\n`;
    });

    if (report.length > 4000) report = report.substring(0, 3900) + "\n...[Truncated]";
    ctx.reply(report);
});

bot.on('photo', async (ctx) => {
    const userId = ctx.chat.id;
    const session = db.userSessions[userId];
    if (session?.step === 'AWAITING_IMAGE_UPLOAD') {
        try {
            const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
            const fileUrlObj = await bot.telegram.getFileLink(fileId);
            const filename = `img_${Date.now()}.jpg`;
            const localPath = path.join(UPLOADS_DIR, filename);
            const fileStream = fs.createWriteStream(localPath);
            https.get(fileUrlObj.href, (res) => {
                res.pipe(fileStream);
                fileStream.on('finish', () => {
                    fileStream.close();
                    db.userSessions[userId].imageUrl = `/uploads/${filename}`;
                    db.userSessions[userId].step = 'AWAITING_ANIMATION_TEXT';
                    saveDB();
                    ctx.reply("📸 ছবি সফলভাবে আপলোড হয়েছে।\n\n" + locale.session_started());
                });
            });
        } catch (e) { ctx.reply("⚠️ ইমেজ আপলোড ব্যর্থ হয়েছে।"); }
    }
});

bot.on('text', async (ctx) => {
    const userId = ctx.chat.id;
    const session = db.userSessions[userId];
    const text = ctx.message.text.trim();

    if (session?.step === 'AWAITING_USER_FEEDBACK') {
        if (text.length < 5) return ctx.reply(locale.feedback_short);
        bot.telegram.sendMessage(ADMIN_CHAT_ID, `📝 Feedback\nName: ${session.name}\nID: ${userId}\n\n${text}`).catch(() => {});
        delete db.userSessions[userId]; saveDB();
        return ctx.reply(locale.feedback_success);
    }

    if (Number(userId) === Number(ADMIN_CHAT_ID) && session) {
        if (session.step === 'AWAITING_ADMIN_BROADCAST_MSG') {
            db.registeredUsers.forEach(id => bot.telegram.sendMessage(id, `📢 [Announcement]\n\n${text}`).catch(() => {}));
            delete db.userSessions[userId]; saveDB();
            return ctx.reply("📡 Broadcast Transmission Completed.");
        }
        if (session.step === 'AWAITING_BAN_USER_INPUT') {
            let targetId = parseInt(text, 10) || db.usernameMap[text.replace('@', '').toLowerCase()];
            if (!targetId) return ctx.reply("❌ ইউজার পাওয়া যায়নি।");
            if (db.bannedUsers.includes(targetId)) db.bannedUsers = db.bannedUsers.filter(id => id !== targetId);
            else db.bannedUsers.push(targetId);
            delete db.userSessions[userId]; saveDB();
            return ctx.reply("✅ Ban/Unban অপারেশন সফল।");
        }
    }

    if (session?.step === 'AWAITING_ANIMATION_TEXT') {
        const lines = text.split(/[\n,]+/).map(l => l.trim()).filter(l => l.length > 0);
        db.userSessions[userId].animations = lines;
        db.userSessions[userId].step = 'AWAITING_LETTER_TEXT';
        saveDB();
        return ctx.reply(locale.input_anim_success(lines.length));
    }
    if (session?.step === 'AWAITING_LETTER_TEXT') {
        db.totalLinksCreated = (db.totalLinksCreated || 0) + 1;
        let finalCountdownIso = null;
        if (session.pendingMinutes) {
            const targetDate = new Date();
            targetDate.setMinutes(targetDate.getMinutes() + session.pendingMinutes);
            finalCountdownIso = targetDate.toISOString();
        }
        const uniqueId = Math.random().toString(36).substring(2, 9);
        const finalGeneratedUrl = `${SERVER_URL}/love/${uniqueId}`;
        const dbImageUrl = session.imageUrl ? `${SERVER_URL}${session.imageUrl}` : null;

        db.linkDatabase[uniqueId] = {
            userId, name: session.name, username: session.username, type: session.type,
            music: session.music, countdown: finalCountdownIso, animations: session.animations, letter: text, 
            answer: null, image: dbImageUrl, imagePath: session.imageUrl, visitors: []
        };
        ctx.reply(`আপনার লিংক তৈরি করা হয়েছে।\n\nলিংক: \`${finalGeneratedUrl}\``, { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback("❌ Link Off", `delete_link_${uniqueId}`)]]) });
        
        let adminMsg = `নতুন লিংক তৈরি করা হয়েছে।\nName: ${session.name}\nID: ${userId}\nCategory: ${String(session.type).toUpperCase()}\nImage: ${dbImageUrl ? "Yes" : "No"}\nLink: ${finalGeneratedUrl}`;
        bot.telegram.sendMessage(ADMIN_CHAT_ID, adminMsg, Markup.inlineKeyboard([[Markup.button.callback("👀 Check Answer", `view_ans_${uniqueId}`), Markup.button.callback("👤 Visitor Info", `view_vi_${uniqueId}`)]])).catch(() => {});
        
        delete db.userSessions[userId]; saveDB();
    }
});

function parseUserAgent(ua) {
    let os = "Unknown OS", browser = "Unknown Browser";
    if (!ua) return { os, browser };
    if (ua.includes("Windows")) os = "Windows PC";
    else if (ua.includes("Android")) os = "Android Mobile";
    else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS (iPhone)";
    else if (ua.includes("Macintosh")) os = "Mac OS";
    else if (ua.includes("Linux")) os = "Linux PC";
    if (ua.includes("Telegram")) browser = "Telegram Browser";
    else if (ua.includes("FBAN") || ua.includes("FBAV")) browser = "Facebook Browser";
    else if (ua.includes("Chrome")) browser = "Chrome";
    else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Safari";
    else if (ua.includes("Firefox")) browser = "Firefox";
    return { os, browser };
}

app.post('/api/get-content', async (req, res) => {
    try {
        const { id, screen, battery, network, lang } = req.body;
        const data = db.linkDatabase[id];
        if (!data) return res.json({ success: false });

        bot.telegram.sendMessage(data.userId, "কেউ আপনার লিংক ওপেন করেছে!").catch(() => {});

        let rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || "";
        let ip = rawIp.split(',')[0].trim().replace('::ffff:', '');
        const { os, browser } = parseUserAgent(req.headers['user-agent']);
        const currentTimeString = new Date().toLocaleString("en-US", { timeZone: "Asia/Dhaka" });

        let visitorObj = {
            time: currentTimeString, ip, country: "Unknown", city: "Unknown", isp: "Unknown", zip: "N/A", timezone: "N/A",
            os, browser, screen: screen || "Unknown", battery: battery || "Unknown", network: network || "Unknown", lang: lang || "Unknown"
        };

        if (ip && ip !== "127.0.0.1" && ip !== "::1") {
            https.get(`https://ip-api.com/json/${ip}`, (apiRes) => {
                let body = "";
                apiRes.on('data', chunk => body += chunk);
                apiRes.on('end', () => {
                    try {
                        const ipData = JSON.parse(body);
                        if (ipData.status === "success") {
                            visitorObj.country = ipData.country || "Unknown";
                            visitorObj.city = ipData.city || "Unknown";
                            visitorObj.isp = ipData.isp || "Unknown";
                            visitorObj.zip = ipData.zip || "N/A";
                            visitorObj.timezone = ipData.timezone || "N/A";
                        }
                    } catch (e) {}
                    if (!data.visitors) data.visitors = [];
                    data.visitors.push(visitorObj); saveDB();
                });
            }).on('error', () => { if (!data.visitors) data.visitors = []; data.visitors.push(visitorObj); saveDB(); });
        } else {
            if (!data.visitors) data.visitors = [];
            data.visitors.push(visitorObj); saveDB();
        }

        if (data.countdown && new Date(data.countdown) > new Date()) return res.json({ success: true, isLocked: true, countdownTime: data.countdown });
        const config = CATEGORY_CONFIGS[data.type] || CATEGORY_CONFIGS['love'];
        return res.json({ 
            success: true, isLocked: false, title: config.title, music: data.music, animations: data.animations, 
            letter: data.letter, emojis: config.emojis, question: config.question, buttons: config.buttons, image: data.image || null 
        });
    } catch (err) { res.json({ success: false }); }
});

app.post('/api/submit-answer', async (req, res) => {
    try {
        const { id, answer } = req.body;
        const data = db.linkDatabase[id];
        if (!data) return res.json({ success: false });
        data.answer = answer; saveDB();
        const config = CATEGORY_CONFIGS[data.type] || CATEGORY_CONFIGS['love'];
        bot.telegram.sendMessage(data.userId, `রিপ্লাই এসেছে।\nQuestion: ${config.question}\nAns: ${answer}`, Markup.inlineKeyboard([[Markup.button.callback("❌ Link Off", `delete_link_${id}`)]])).catch(() => {});
        return res.json({ success: true });
    } catch (err) { res.json({ success: false }); }
});

app.get('/love/:id', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    bot.launch().catch(err => console.error(err));
    console.log(`Server running on port ${PORT}`);
});
