const express = require('express');
const path = require('path');
const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');
const https = require('https');
const photohandle = require('./modules/photohandle');

// মডিউলসমূহ ইমপোর্ট করা হলো
const { showCountdownPrompt, handleTimerNo, handleSetTime } = require('./modules/countdown');
const { CATEGORY_CONFIGS, getCategoryKeyboard, CATEGORY_MENU_TEXT } = require('./modules/category');
const { handleFeedbackMenu, processFeedbackText } = require('./modules/feedback');

const app = express();
app.use(express.json());
app.set('trust proxy', true);

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const ADMIN_IDS = (process.env.ADMIN_CHAT_ID || "").split(',').map(id => id.trim()).filter(id => id !== "");

const isAdmin = (userId) => ADMIN_IDS.includes(userId.toString());

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
    console.error(e);
}

const saveDB = () => {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    } catch (e) {
        console.error(e);
    }
};

const bot = new Telegraf(TELEGRAM_TOKEN);

const locale = {
    welcome: (name) => `হ্যালো ${name}। বটের পক্ষ থেকে স্বাগতম।`,
    btn_make: "🚀 লিঙ্ক তৈরি করুন", btn_feedback: "📝 মতামত", btn_help: "❓ সাহায্য", btn_back: "🔙 মেইন মেনু",
    prompt_image_ask: "📸 আপনি কি কোনো ছবি যুক্ত করতে চান?\n\nতাহলে ছবিটি এখানে পাঠান অথবা নিচে Skip করুন।",
    btn_skip_image: "⏭️ Skip করুন",
    help_text: `❓ বট ব্যবহারের সঠিক নিয়ম (Help Guide):\n\n1️⃣ প্রথমে 🚀 লিঙ্ক তৈরি করুন বাটনে ক্লিক করুন।\n2️⃣ আপনার পছন্দের ক্যাটাগরি (Love, Birthday, etc.) সিলেক্ট করুন।\n3️⃣ লিঙ্কটি কতক্ষণ পর আনলক হবে তার জন্য একটি টাইম কাউন্টডাউন সিলেক্ট করুন।\n4️⃣ বটের ইচ্ছে অনুযায়ী একটি ছবি আপলোড করুন অথবা Skip করুন।\n5️⃣ বটের নির্দেশনা অনুযায়ী 😊 অ্যানিমেশন টেক্সট এবং খামের ভেতরের মূল চিঠিটি লিখে পাঠান।\n6️⃣ সবশেষে বট আপনাকে একটি ইউনিক লিঙ্ক জেনারেট করে দেবে যা আপনি শেয়ার করতে পারবেন!`,
    invalid_cmd: (cmd) => `❌ ভুল ইনপুট বা আদেশ: \`${cmd}\` নম্বর বা কমান্ডটি গ্রহণযোগ্য নয়। নিচে সঠিক সাহায্য গাইডটি দেওয়া হলো:`,
    maint_msg: "🚧 বটের কাজ চলছে (Under Maintenance)! খুব শীঘ্রই আমরা ফিরে আসছি।\n\nঅ্যাডমিনকে কিছু বলার থাকলে নিচে মতামত জানাতে পারেন।",
    session_started: () => `✨ অ্যানিমেশন মেসেজ লিখুন।\n\n💡লেখার নিয়ম:\n• প্রতি লাইনের পর কীবোর্ডের Enter চেপে নতুন লাইনে লিখুন অথবা প্রতিটি লাইনের মাঝে কমা ( , ) ব্যবহার করুন। যেমন হ্যালো, প্রিয়, কেমন আছো।`,
    input_anim_success: (count) => `✅ চমৎকার! আপনি ${count} লাইনের অ্যানিমেশন যোগ করেছেন।\n\n💌 এবার খামের ভেতরের মূল চিঠি বা উইশ মেসেজটি লিখে পাঠান।`,
    general_error: "⚠️ দুঃখিত, একটি অভ্যন্তরীণ ত্রুটি ঘটেছে। অনুগ্রহ করে আবার চেষ্টা করুন."
};

function showAnimationIntro(ctx) {
    db.userSessions[ctx.chat.id].step = 'AWAITING_ANIMATION_TEXT';
    saveDB();
    const text = locale.session_started();
    ctx.editMessageText(text, Markup.inlineKeyboard([[Markup.button.callback("🔙 পেছনে যান", 'menu_makelink')]], { parse_mode: 'Markdown' })).catch(() => {
        ctx.reply(text, Markup.inlineKeyboard([[Markup.button.callback("🔙 পেছনে যান", 'menu_makelink')]], { parse_mode: 'Markdown' })).catch(() => {});
    });
}

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
    if (!isAdmin(ctx.chat.id)) {
        ctx.reply(locale.invalid_cmd(ctx.message.text || ''), { parse_mode: 'Markdown' }).catch(() => {});
        return ctx.reply(locale.help_text, Markup.inlineKeyboard([[Markup.button.callback(locale.btn_back, 'go_to_main_menu')]]), { parse_mode: 'Markdown' }).catch(() => {});
    }
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
    ctx.answerCbQuery();
    db.userSessions[ctx.chat.id] = { step: 'AWAITING_ADMIN_BROADCAST_MSG' };
    saveDB();
    ctx.reply("📢 Announcement মেসেজটি পাঠান:\n\nবটের সকল ইউজারের কাছে চলে যাবে।", Markup.inlineKeyboard([[Markup.button.callback("❌ বাতিল করুন", "adm_back_to_dashboard")]]));
});

bot.action('adm_all_links_menu', (ctx) => {
    if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery();
    ctx.answerCbQuery();
    ctx.editMessageText("🔗 All Links Management Sub-Menu:", Markup.inlineKeyboard([
        [Markup.button.callback("📜 View All Links List", "adm_view_links_list")],
        [Markup.button.callback("💥 Turn Off & Delete All Links", "adm_delete_all_links_confirm")],
        [Markup.button.callback("🔙 ব্যাক টু ড্যাশবোর্ড", "adm_back_to_dashboard")]
    ]));
});

bot.action('adm_view_links_list', (ctx) => {
    if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery();
    ctx.answerCbQuery();
    const keys = Object.keys(db.linkDatabase);
    if (!keys.length) {
        return ctx.editMessageText("ℹ️ বর্তমানে সিস্টেমে কোনো একটিভ লিংক তৈরি করা নেই।", Markup.inlineKeyboard([[Markup.button.callback("🔙 পেছনে যান", "adm_all_links_menu")]]));
    }
    ctx.reply("📜 চলতি সকল লিংকের তালিকা (বন্ধ করতে লিংকে ক্লিক করুন):");
    keys.forEach(key => {
        const data = db.linkDatabase[key];
        ctx.reply(`👤 Creator: ${data.name}\n📂 Cat: ${data.type}\n🔗 Link ID: ${key}`, Markup.inlineKeyboard([[Markup.button.callback(`❌ Delete/Off: ${key}`, `adm_instant_del_${key}`)]])).catch(() => {});
    });
});

bot.action(/^adm_instant_del_(.+)$/, (ctx) => {
    if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery();
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
    if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery();
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
    if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery();
    ctx.answerCbQuery();
    db.userSessions[ctx.chat.id] = { step: 'AWAITING_BAN_USER_INPUT' };
    saveDB();
    ctx.reply(`🚫 Ban / Unban System\n\n📊 মোট ইউজার: ${db.registeredUsers.length}\n• ব্যান ইউজার: ${db.bannedUsers.length}\n\n👉 অনুগ্রহ করে ইউজারের ID অথবা Username লিখে পাঠান:`, Markup.inlineKeyboard([[Markup.button.callback("❌ বাতিল করুন", "adm_back_to_dashboard")]]));
});

bot.action('adm_back_to_dashboard', (ctx) => {
    if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery();
    ctx.answerCbQuery();
    delete db.userSessions[ctx.chat.id];
    saveDB();
    showAdminDashboard(ctx, true);
});

bot.action('menu_makelink', (ctx) => {
    ctx.answerCbQuery();
    ctx.editMessageText(CATEGORY_MENU_TEXT.choose_cat, getCategoryKeyboard(locale.btn_back));
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
    showCountdownPrompt(ctx, db, saveDB, showImageUploadPrompt);
});

bot.action('timer_no', (ctx) => handleTimerNo(ctx, db, saveDB, showImageUploadPrompt));
bot.action(/^set_time_/, (ctx) => handleSetTime(ctx, db, saveDB, showImageUploadPrompt));

bot.action('skip_image_upload', (ctx) => {
    ctx.answerCbQuery();
    const userId = ctx.chat.id;
    if (db.userSessions[userId]) db.userSessions[userId].imageUrl = null;
    showAnimationIntro(ctx);
});

bot.action('menu_feedback', (ctx) => handleFeedbackMenu(ctx, db, saveDB, locale.btn_back));
bot.action('menu_help', (ctx) => { ctx.answerCbQuery(); ctx.reply(locale.help_text, Markup.inlineKeyboard([[Markup.button.callback(locale.btn_back, 'go_to_main_menu')]]), { parse_mode: 'Markdown' }); });

bot.on('photo', async (ctx) => {
    await photohandle(ctx, bot, UPLOADS_DIR, db, saveDB, showAnimationIntro);
});

bot.on('text', async (ctx) => {
    const userId = ctx.chat.id;
    const session = db.userSessions[userId];
    const text = ctx.message.text.trim();
    if (session?.step === 'AWAITING_USER_FEEDBACK') {
        return processFeedbackText(ctx, text, db, saveDB, ADMIN_IDS, bot, locale.btn_back);
    }
    if (isAdmin(userId) && session) {
        if (session.step === 'AWAITING_ADMIN_BROADCAST_MSG') {
            db.registeredUsers.forEach(id => {
                bot.telegram.sendMessage(id, `📢 [Announcement]\n\n${text}`, { parse_mode: 'Markdown' }).catch(() => {});
            });
            ctx.reply("📡 Broadcast Completed.");
            delete db.userSessions[userId];
            saveDB();
            return showAdminDashboard(ctx, false);
        }
        if (session.step === 'AWAITING_BAN_USER_INPUT') {
            let targetId = parseInt(text, 10);
            if (isNaN(targetId)) targetId = db.usernameMap[text.replace('@', '').trim().toLowerCase()];
            if (!targetId) return ctx.reply("❌ দুঃখিত! এই ইউজারনেম/আইডি ডাটাবেজে পাওয়া যায়নি।");
            if (db.bannedUsers.includes(targetId)) {
                db.bannedUsers = db.bannedUsers.filter(id => id !== targetId);
                ctx.reply(`🟢 ইউজার \`${targetId}\` কে UNBAN করা হয়েছে।`, { parse_mode: 'Markdown' });
            } else {
                db.bannedUsers.push(targetId);
                ctx.reply(`🚫 ইউজার \`${targetId}\` কে BAN করা হয়েছে।`, { parse_mode: 'Markdown' });
            }
            delete db.userSessions[userId];
            saveDB();
            return showAdminDashboard(ctx, false);
        }
    }
    if (!session?.step) {
        ctx.reply(locale.invalid_cmd(text), { parse_mode: 'Markdown' }).catch(() => {});
        return ctx.reply(locale.help_text, Markup.inlineKeyboard([[Markup.button.callback(locale.btn_back, 'go_to_main_menu')]]), { parse_mode: 'Markdown' }).catch(() => {});
    }
    try {
        if (session.step === 'AWAITING_ANIMATION_TEXT') {
            const lines = text.split(/[\n,]+/).map(l => l.trim()).filter(l => l.length > 0);
            if (!lines.length) return ctx.reply("⚠️ অনুগ্রহ করে অন্তত একটি টেক্সট লিখুন।");
            db.userSessions[userId].animations = lines;
            db.userSessions[userId].step = 'AWAITING_LETTER_TEXT';
            saveDB();
            return ctx.reply(locale.input_anim_success(lines.length));
        }
        if (session.step === 'AWAITING_LETTER_TEXT') {
            processFinalLinkCreation(ctx, text);
        }
    } catch (error) {
        ctx.reply(locale.general_error).catch(() => {});
    }
});

function processFinalLinkCreation(ctx, letterText) {
    const userId = ctx.chat.id;
    const session = db.userSessions[userId];
    db.totalLinksCreated = (db.totalLinksCreated || 0) + 1;
    let finalCountdownIso = null;
    let countdownDisplay = "No ❌";
    if (session.pendingMinutes) {
        const targetDate = new Date();
        targetDate.setMinutes(targetDate.getMinutes() + session.pendingMinutes);
        finalCountdownIso = targetDate.toISOString();
        countdownDisplay = `${session.pendingMinutes} Minutes ✅`;
    }
    const uniqueId = Math.random().toString(36).substring(2, 9);
    const finalGeneratedUrl = `${SERVER_URL}/love/${uniqueId}`;
    const dbImageUrl = session.imageUrl ? `${SERVER_URL}${session.imageUrl}` : null;
    db.linkDatabase[uniqueId] = {
        userId, name: session.name || "User", username: session.username || "None", type: session.type || "love",
        music: session.music || "", countdown: finalCountdownIso, animations: session.animations, letter: letterText, 
        answer: null, image: dbImageUrl, imagePath: session.imageUrl || null, visitors: []
    };
    ctx.reply(`আপনার লিংক তৈরি করা হয়েছে।\n\nলিংক: \`${finalGeneratedUrl}\``, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[Markup.button.callback("❌ Link Off", `delete_link_${uniqueId}`)]])
    }).catch(() => {});
    let adminNotificationText = `🆕 নতুন লিংক তৈরি করা হয়েছে।
👤 Name: ${session.name || "User"}
🆔 ID: ${userId}
🏷️ Username: ${session.username || "None"}
📂 Category: ${String(session.type || "love").toUpperCase()}
⏳ Countdown: ${countdownDisplay}
📸 IMG Included: ${dbImageUrl ? "Yes ✅" : "No ❌"}`;
    if (dbImageUrl) adminNotificationText += `\n🖼️ IMG Link: ${dbImageUrl}`;
    adminNotificationText += `\n✨ Animation txt: ${(session.animations || []).join(", ")}
💌 Letter: ${letterText}
🔗 Main Link: ${finalGeneratedUrl}`;
    ADMIN_IDS.forEach(id => bot.telegram.sendMessage(id, adminNotificationText, Markup.inlineKeyboard([
        [Markup.button.callback("👀 Check Answer", `view_ans_${uniqueId}`), Markup.button.callback("👤 Visitor Info", `view_vi_${uniqueId}`)]
    ])).catch(() => {}));
    delete db.userSessions[userId];
    saveDB();
}

function parseUserAgent(ua) {
    let os = "Unknown OS";
    let browser = "Unknown Browser";
    if (!ua) return { os, browser };
    if (ua.includes("Windows")) os = "Windows PC";
    else if (ua.includes("Android")) os = "Android Mobile";
    else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS (iPhone/iPad)";
    else if (ua.includes("Macintosh")) os = "Mac OS";
    else if (ua.includes("Linux")) os = "Linux PC";
    if (ua.includes("Telegram")) browser = "Telegram App Browser";
    else if (ua.includes("FBAN") || ua.includes("FBAV")) browser = "Facebook App Browser";
    else if (ua.includes("Chrome")) browser = "Google Chrome";
    else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Safari";
    else if (ua.includes("Firefox")) browser = "Mozilla Firefox";
    else if (ua.includes("Edge")) browser = "Microsoft Edge";
    return { os, browser };
}

app.post('/api/get-content', async (req, res) => {
    try {
        const linkId = req.body.id;
        const data = db.linkDatabase[linkId];
        if (!data) return res.json({ success: false });
        bot.telegram.sendMessage(data.userId, "কেউ আপনার লিংক ওপেন করেছে!").catch(() => {});
        let rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || "";
        let ip = rawIp.split(',')[0].trim();
        if (ip.includes('::ffff:')) ip = ip.replace('::ffff:', '');
        const userAgent = req.headers['user-agent'] || "";
        const { os, browser } = parseUserAgent(userAgent);
        const currentTimeString = new Date().toLocaleString("en-US", { timeZone: "Asia/Dhaka" });
        let visitorObj = { time: currentTimeString, ip: ip, country: "Unknown", city: "Unknown", isp: "Unknown", os: os, browser: browser };
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
                        }
                    } catch (e) {}
                    if (!data.visitors) data.visitors = [];
                    data.visitors.push(visitorObj);
                    saveDB();
                });
            }).on('error', () => {
                if (!data.visitors) data.visitors = [];
                data.visitors.push(visitorObj);
                saveDB();
            });
        } else {
            if (!data.visitors) data.visitors = [];
            data.visitors.push(visitorObj);
            saveDB();
        }
        if (data.countdown && new Date(data.countdown) > new Date()) {
            return res.json({ success: true, isLocked: true, countdownTime: data.countdown });
        }
        const config = CATEGORY_CONFIGS[data.type] || CATEGORY_CONFIGS['love'];
        return res.json({ 
            success: true, isLocked: false, title: config.title, music: data.music, 
            animations: data.animations, letter: data.letter, emojis: config.emojis, 
            question: config.question, buttons: config.buttons, image: data.image || null 
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
        const config = CATEGORY_CONFIGS[data.type] || CATEGORY_CONFIGS['love'];
        bot.telegram.sendMessage(data.userId, `আপনার তৈরি করা লিংক থেকে রিপ্লাই এসেছে।\nQuestion: ${config.question}\nAns: ${answer}`, Markup.inlineKeyboard([[Markup.button.callback("❌ Link Off", `delete_link_${id}`)]])).catch(() => {});
        return res.json({ success: true });
    } catch (err) { res.json({ success: false }); }
});

app.get('/love/:id', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    bot.launch().catch(err => console.error(err));
    console.log(`Server running on port ${PORT}`);
});
