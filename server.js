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
const registeredUsers = new Set();
const bannedUsers = new Set();
let isMaintenanceMode = false;

const bot = new Telegraf(TELEGRAM_TOKEN);

// GitHub-এ আপনার আপলোড করা অডিও ফাইলের বেস URL (Raw format)
const GITHUB_MUSIC_BASE_URL = "https://raw.githubusercontent.com/lovelatter/Love/main";

// ক্যাটাগরি অনুযায়ী অটোমেটিক মিউজিক ফাইল ম্যাপিং
const AUTOMATIC_MUSIC_MAPPING = {
    love: `${GITHUB_MUSIC_BASE_URL}/love.mp3`,
    birthday: `${GITHUB_MUSIC_BASE_URL}/bd.mp3`,
    sorry: `${GITHUB_MUSIC_BASE_URL}/sorry.mp3`,
    eid: `${GITHUB_MUSIC_BASE_URL}/eid.mp3`
};

// 🗄️ Database Load & Save
let db = {
    linkDatabase: {},
    userSessions: {},
    totalLinksCreated: 0,
    isMaintenanceMode: false,
    bannedUsers: []
};

if (fs.existsSync(DB_FILE)) {
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function saveDB() {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// 🛡️ Markdown Escaping
function esc(text) {
    return text.toString().replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

// 📊 Global Stats Counters
let totalLinksCreated = 0;
let totalFeedbacksReceived = 0;

// 🌐 Messages Dictionary (শুধুমাত্র বাংলা)
const locale = {
    welcome: (name) => `💝 **হ্যালো ${name}!** 💝\n\nবটের পক্ষ থেকে স্বাগতম। আপনার প্রিয়জনের জন্য আকর্ষণীয় টাইম কাউন্টডাউন করা ওয়েব লিঙ্ক তৈরি করুন একদম ফ্রিতে।\n\nনিচের যেকোনো একটি অপশন সিলেক্ট করুন:`,
    btn_make: "🚀 লিঙ্ক তৈরি করুন", btn_feedback: "📝 মতামত", btn_help: "❓ সাহায্য", btn_back: "🔙 মেইন মেনু",
    choose_cat: "✨ **আপনি কোন ক্যাটাগরির লিঙ্ক তৈরি করতে চান?**",
    cat_love: "❤️ প্রেমের চিঠি (Love)", cat_birthday: "🎂 জন্মদিনের শুভেচ্ছা (Birthday)", cat_sorry: "🥺 দুঃখ প্রকাশ (Sorry)", cat_eid: "🌙 ঈদ মোবারক (Eid)",
    
    prompt_countdown_ask: "⏰ **আপনি কি এই লিঙ্কে নির্দিষ্ট টাইম কাউন্টডাউন (Time Countdown) সেট করতে চান?**\n\n(কাউন্টডাউন সেট করলে আপনার দেওয়া সময় শেষ হওয়ার আগে কেউ লিঙ্কের ভেতরের চিঠি দেখতে পারবে না।)",
    btn_no_countdown: "❌ No Countdown (টাইমার ছাড়া)",
    
    help_text: `❓ **সাহায্য গাইড:**\n\n💡 যেকোনো সমস্যায় এডমিনের সাথে যোগাযোগ করুন।`,
    
    feedback_prompt: "📝 **মতামত ও রিপোর্ট:**\n\nঅ্যাডমিনের কাছে কোনো রিপোর্ট, নতুন আপডেটের আইডিয়া বা অন্য কোনো কিছু বলার থাকলে আপনার মেসেজটি নিচে লিখে পাঠিয়ে দিন:",
    feedback_short: "❌ মেসেজটি একটু বিস্তারিত লিখুন (কমপক্ষে ৫টি অক্ষর)।",
    feedback_success: "✅ আপনার মেসেজটি অ্যাডমিনের কাছে সফলভাবে পাঠানো হয়েছে। ধন্যবাদ!",
    
    session_cancelled: "❌ আপনার চলমান লিঙ্ক তৈরির সেশনটি বাতিল করা হয়েছে।",
    no_session: "💡 আপনার কোনো একটিভ সেশন নেই।",
    invalid_cmd: (cmd) => `❌ **ভুল ইনপুট বা আদেশ:** \`${cmd}\` গ্রহণযোগ্য নয়। অনুগ্রহ করে নিচের মেইন মেনু ব্যবহার করুন অথবা সেশনটি বাতিল করতে /cancel লিখুন।`,
    maint_msg: "🚧 **বটের কাজ চলছে (Under Maintenance)!** খুব শীঘ্রই আমরা ফিরে আসছি।",
    session_started: (cat) => `✨ আপনার কাস্টম \`${cat.toUpperCase()}\` লিঙ্ক তৈরির সেশন শুরু হয়েছে!\n\n👉 আপনার প্রিয়জনের জন্য **অ্যানিমেশন টেক্সটগুলো** পাঠান।\n\n💡 **লেখার নিয়ম (How to write):**\n• প্রতি লাইনের পর কীবোর্ডের **Enter** চেপে নতুন লাইনে লিখুন।\n• অথবা প্রতিটি লাইনের মাঝে **কমা ( , )** ব্যবহার করুন।`,
    input_anim_success: (count) => `✅ চমৎকার! আপনি ${count} লাইনের অ্যানিমেশন যোগ করেছেন।\n\n💌 এবার খামের ভেতরের মূল চিঠি বা উইশ মেসেজটি লিখে পাঠান।`,
    link_ready: (url) => `💝 অভিনন্দন! আপনার কাস্টমাইজড প্রিমিয়াম লিঙ্ক সম্পূর্ণ রেডি:\n\n${url}\n\n👉 এই লিঙ্কটি আপনার প্রিয়জনের সাথে শেয়ার করুন।`,
    general_error: "⚠️ দুঃখিত, একটি অভ্যন্তরীণ ত্রুটি ঘটেছে। অনুগ্রহ করে আবার চেষ্টা করুন বা /cancel লিখে নতুন সেশন শুরু করুন।"
};

// 🛡️ Security Middlewares
bot.use((ctx, next) => {
    try {
        const userId = ctx.chat ? ctx.chat.id : null;
        if (!userId) return next();
        if (Number(userId) === Number(ADMIN_CHAT_ID)) return next();
        if (isMaintenanceMode) {
            return ctx.reply(locale.maint_msg);
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
        if (db.userSessions[userId]) {
            delete db.userSessions[userId];
            ctx.reply(locale.session_cancelled);
            sendMainMenu(ctx, false);
        } else { 
            ctx.reply(locale.no_session); 
        }
    } catch (err) { console.error(err); }
});

// Admin Engine Controls
const handleAdminConsole = (ctx) => {
    if (Number(ctx.chat.id) !== Number(ADMIN_CHAT_ID)) return;
    ctx.reply("👑 **Welcome to the Master Admin Core Console:**", Markup.inlineKeyboard([
        [Markup.button.callback("📊 System Status", "admin_stats"), Markup.button.callback("📢 Global Broadcast", "admin_broadcast")],
        [Markup.button.callback(isMaintenanceMode ? "🟢 Live Mode" : "🚧 Maint Mode", "admin_toggle_maint")],
        [Markup.button.callback("🚫 Ban Management", "admin_ban_menu"), Markup.button.callback("📜 View Logs", "admin_view_logs")]
    ]));
};
bot.command('admin', handleAdminConsole);
bot.command('adm', handleAdminConsole);

bot.action('admin_stats', (ctx) => {
    if (Number(ctx.chat.id) !== Number(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    ctx.answerCbQuery();
    const activeLinks = Object.keys(db.linkDatabase).filter(k => db.linkDatabase[k].isActive).length;
    ctx.reply(`📊 **Metrics:**\n\nUsers: \`${registeredUsers.size}\`\nActive Links: \`${activeLinks}\` (Total: \`${totalLinksCreated}\`)\nFeedbacks: \`${totalFeedbacksReceived}\``);
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
    db.userSessions[ctx.chat.id] = { step: 'AWAITING_ADMIN_BROADCAST_MSG' };
    saveDB();
    ctx.reply("📢 Enter the broadcast transmission message:");
});

bot.action('admin_ban_menu', (ctx) => {
    if (Number(ctx.chat.id) !== Number(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    ctx.answerCbQuery();
    db.userSessions[ctx.chat.id] = { step: 'AWAITING_BAN_USER_ID' };
    saveDB();
    ctx.reply("🚫 Send the Telegram Chat ID to BAN/UNBAN:");
});

bot.action('admin_view_logs', (ctx) => {
    if (Number(ctx.chat.id) !== Number(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    ctx.answerCbQuery();
    ctx.reply("📜 Logs: Engines running smoothly.");
});

bot.action('go_to_main_menu', (ctx) => { ctx.answerCbQuery(); sendMainMenu(ctx, true); });

// Link Creation Category View (Love, Birthday, Sorry, Eid এবং Back বাটন)
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
        name: ctx.from.first_name || "User",
        music: AUTOMATIC_MUSIC_MAPPING[cat] || "" // ক্যাটাগরি অনুযায়ী অটোমেটিক মিউজিক সেট
    };
    saveDB();
    showCountdownPrompt(ctx);
});

// টাইম কাউন্টডাউন প্রম্পট (No Countdown, 3, 5, 10 মিনিট এবং Back বাটন)
function showCountdownPrompt(ctx) {
    ctx.editMessageText(locale.prompt_countdown_ask, Markup.inlineKeyboard([
        [Markup.button.callback(locale.btn_no_countdown, 'timer_no')],
        [Markup.button.callback('🕒 ৩ মিনিট', 'set_time_3'), Markup.button.callback('🕒 ৫ মিনিট', 'set_time_5')],
        [Markup.button.callback('🕒 ১০ মিনিট', 'set_time_10')],
        [Markup.button.callback("🔙 পেছনে যান", 'menu_makelink')]
    ])).catch(()=>{});
}

bot.action('timer_no', (ctx) => { 
    ctx.answerCbQuery(); 
    db.userSessions[ctx.chat.id].pendingMinutes = null; 
    saveDB();
    showAnimationIntro(ctx); 
});

bot.action(/^set_time_/, (ctx) => {
    ctx.answerCbQuery();
    const userId = ctx.chat.id;
    const session = db.userSessions[userId];
    const minutes = parseInt(ctx.match.input.replace('set_time_', ''), 10);
    session.pendingMinutes = minutes;
    saveDB();
    showAnimationIntro(ctx);
});

// অ্যানিমেশন টেক্সট ইনপুট শুরু
function showAnimationIntro(ctx) {
    db.userSessions[ctx.chat.id].step = 'AWAITING_ANIMATION_TEXT';
    saveDB();
    ctx.editMessageText(locale.session_started(db.userSessions[ctx.chat.id].type), Markup.inlineKeyboard([
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
    ctx.reply(locale.help_text);
});

// 🎯 State Machine & Text Processing Engine
bot.on('text', (ctx) => {
    const userId = ctx.chat.id;
    const session = db.userSessions[userId];
    saveDB();
    const text = ctx.message.text.trim();

    if (text.startsWith('/')) return;

    if (!session) {
        ctx.reply(locale.invalid_cmd(text), { parse_mode: 'Markdown' });
        sendMainMenu(ctx, false);
        return;
    }

    try {
        if (Number(userId) === Number(ADMIN_CHAT_ID)) {
            if (session.step === 'AWAITING_ADMIN_BROADCAST_MSG') {
                registeredUsers.forEach(id => bot.telegram.sendMessage(id, `📢 **[Announcement]**\n\n${text}`, { parse_mode: 'Markdown' }).catch(()=>{}));
                ctx.reply("📡 Broadcast distribution cycle finished.");
                delete db.userSessions[userId]; return;
            }
            if (session.step === 'AWAITING_BAN_USER_ID') {
                const targetId = parseInt(text, 10);
                if (isNaN(targetId)) return ctx.reply("❌ Invalid Chat ID. Please send a numeric ID.");
                if (bannedUsers.has(targetId)) { bannedUsers.delete(targetId); ctx.reply("🟢 Target Unbanned successfully."); }
                else { bannedUsers.add(targetId); ctx.reply("🚫 Target Banned successfully."); }
                delete db.userSessions[userId]; return;
            }
        }

        if (session.step === 'AWAITING_USER_FEEDBACK') {
            if (text.length < 5) return ctx.reply(locale.feedback_short);
            totalFeedbacksReceived++;
            bot.telegram.sendMessage(ADMIN_CHAT_ID, `📝 Feedback from User ${userId}:\n\n${text}`).catch(()=>{});
            ctx.reply(locale.feedback_success);
            delete db.userSessions[userId]; sendMainMenu(ctx, false); return;
        }

        if (session.step === 'AWAITING_ANIMATION_TEXT') {
            session.animations = text.split(/[\n,，]+/).map(l => l.trim()).filter(l => l.length > 0);
            if (session.animations.length === 0) return ctx.reply("⚠️ অনুগ্রহ করে অন্তত একটি অ্যানিমেশন টেক্সট লিখুন।");
            
            session.step = 'AWAITING_LETTER_TEXT';
            ctx.reply(locale.input_anim_success(session.animations.length));
            return;
        }

        if (session.step === 'AWAITING_LETTER_TEXT') {
            processFinalLinkCreation(ctx, text);
            return;
        }

        ctx.reply(locale.invalid_cmd(text), { parse_mode: 'Markdown' });

    } catch (error) {
        console.error("Critical Runtime Error:", error);
        ctx.reply(locale.general_error);
    }
});

function processFinalLinkCreation(ctx, letterText) {
    const userId = ctx.chat.id;
    const session = db.userSessions[userId];
    saveDB();

    totalLinksCreated++;
    
    let finalCountdownIso = null;
    if (session.pendingMinutes) {
        const targetDate = new Date();
        targetDate.setMinutes(targetDate.getMinutes() + session.pendingMinutes);
        finalCountdownIso = targetDate.toISOString();
    }

    const uniqueId = Math.random().toString(36).substring(2, 9);
    db.linkDatabase[uniqueId] = {
        userId: userId, name: session.name, type: session.type,
        music: session.music, countdown: finalCountdownIso,
        animations: session.animations, letter: letterText, isActive: true
    };
    saveDB();
    
    ctx.reply(locale.link_ready(`${SERVER_URL}/love/${uniqueId}`));
    delete db.userSessions[userId];
}

function sendMainMenu(ctx, isEdit = false) {
    try {
        const userId = ctx.chat.id;
        const text = locale.welcome(ctx.from?.first_name || "User");
        const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback(locale.btn_make, 'menu_makelink')],
            [Markup.button.callback(locale.btn_feedback, 'menu_feedback'), Markup.button.callback(locale.btn_help, 'menu_help')]
        ]);
        if (isEdit) return ctx.editMessageText(text, keyboard).catch(()=>{});
        return ctx.reply(text, keyboard);
    } catch (err) { console.error(err); }
}

// API Route
app.post('/api/get-content', async (req, res) => {
    try {
        const { id } = req.body;
        const data = db.linkDatabase[id];
        if (!data || !data.isActive) return res.json({ success: false });

        bot.telegram.sendMessage(data.userId, esc(`👀 Link opened!`)).catch(e => console.error(e));

        if (data.countdown) {
            const now = new Date();
            const lockTime = new Date(data.countdown);
            if (lockTime > now) {
                return res.json({ success: true, isLocked: true, countdownTime: data.countdown });
            }
        }

        return res.json({ 
            success: true, 
            isLocked: false,
            music: data.music, 
            animations: data.animations, 
            letter: data.letter 
        });
    } catch (err) {
        res.json({ success: false });
    }
});

app.get('/love/:id', (req, res) => { res.sendFile(path.join(__dirname, 'index.html')); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    bot.launch();
    console.log(`Server & Bot running on port ${PORT}`);
});
