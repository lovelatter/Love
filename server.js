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
    bannedUsers: []
};

if (fs.existsSync(DB_FILE)) {
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function saveDB() {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

let totalLinksCreated = 0;
let totalFeedbacksReceived = 0;

const locale = {
    welcome: (name) => `হ্যালো **${name}**। বটের পক্ষ থেকে স্বাগতম।`,
    btn_make: "🚀 লিঙ্ক তৈরি করুন", btn_feedback: "📝 মতামত", btn_help: "❓ সাহায্য", btn_back: "🔙 মেইন মেনু",
    choose_cat: "✨ **আপনি কোন ক্যাটাগরির লিঙ্ক করতে চান?**",
    cat_love: "❤️ প্রেমের চিঠি (Love)", cat_birthday: "🎂 জন্মদিনের শুভেচ্ছা (Birthday)", cat_sorry: "🥺 দুঃখ প্রকাশ (Sorry)", cat_eid: "🌙 ঈদ মোবারক (Eid)",
    
    prompt_countdown_ask: "⏰ **টাইম কাউন্টডাউন সেট করুন।**",
    btn_no_countdown: "❌ No Countdown",
    
    help_text: `❓ **সাহায্য গাইড:**\n\n💡 যেকোনো সমস্যায় এডমিনের সাথে যোগাযোগ করুন।`,
    
    feedback_prompt: "📝 **মতামত ও রিপোর্ট:**\n\nঅ্যাডমিনের কাছে কোনো রিপোর্ট, নতুন আপдейটের আইডিয়া বা অন্য কোনো কিছু বলার থাকলে আপনার মেসেজটি নিচে লিখে পাঠিয়ে দিন:",
    feedback_short: "❌ মেসেজটি একটু বিস্তারিত লিখুন (কমপক্ষে ৫টি অক্ষর)।",
    feedback_success: "✅ আপনার মেসেজটি অ্যাডমিনের কাছে সফলভাবে পাঠানো হয়েছে। ধন্যবাদ!",
    
    invalid_cmd: (cmd) => `❌ **ভুল ইনপুট বা আদেশ:** \`${cmd}\` গ্রহণযোগ্য নয়। অনুগ্রহ করে নিচের মেইন মেনু ব্যবহার করুন।`,
    maint_msg: "🚧 **বটের কাজ চলছে (Under Maintenance)!** খুব শীঘ্রই আমরা ফিরে আসছি।",
    session_started: () => `✨ **অ্যানিমেশন মেসেজ লিখুন।**\n\n💡**লেখার নিয়ম:**\n• প্রতি লাইনের পর কীবোর্ডের **Enter** চেপে নতুন লাইনে লিখুন অথবা প্রতিটি লাইনের মাঝে **কমা ( , )** ব্যবহার করুন। যেমন হ্যালো, প্রিয়, কেমন আছো।`,
    input_anim_success: (count) => `✅ চমৎকার! আপনি ${count} লাইনের অ্যানিমেশন যোগ করেছেন।\n\n💌 এবার খামের ভেতরের মূল চিঠি বা উইশ মেসেজটি লিখে পাঠান।`,
    general_error: "⚠️ দুঃখিত, একটি অভ্যন্তরীণ ত্রুটি ঘটেছে। অনুগ্রহ করে আবার চেষ্টা করুন।"
};

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

bot.command('start', (ctx) => { 
    try {
        registeredUsers.add(ctx.chat.id); 
        sendMainMenu(ctx, false); 
    } catch (err) { console.error(err); }
});

bot.action(/^chk_ans_(.+)$/, (ctx) => {
    if (Number(ctx.chat.id) !== Number(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    const linkId = ctx.match[1];
    const data = db.linkDatabase[linkId];
    
    if (!data) {
        return ctx.answerCbQuery("❌ লিঙ্কটি অলরেডি রিমুভ করা হয়েছে বা খুঁজে পাওয়া যায়নি।", { show_alert: true });
    }

    if (!data.answer) {
        return ctx.answerCbQuery("⏳ এখনো কোনো উত্তর আসেনি, অনুগ্রহ করে উত্তর আসা অবধি অপেক্ষা করুন।", { show_alert: true });
    }

    ctx.answerCbQuery();
    ctx.reply(`📊 **ইউজারের উত্তরের বিবরণ:**\n\nName: ${data.name}\nCategory: ${data.type.toUpperCase()}\nAns: ${data.answer}`);
});

bot.action(/^delete_link_(.+)$/, (ctx) => {
    const linkId = ctx.match[1];
    const data = db.linkDatabase[linkId];

    if (!data) {
        return ctx.answerCbQuery("⚠️ এই লিঙ্কটি ইতিমধ্যে রিমুভ করা হয়েছে!", { show_alert: true });
    }

    if (Number(data.userId) !== Number(ctx.chat.id)) {
        return ctx.answerCbQuery("❌ এই লিঙ্কটি ডিলিট করার পারমিশন আপনার নেই।", { show_alert: true });
    }

    ctx.answerCbQuery("✅ লিঙ্কটি সফলভাবে ডিলিট করা হয়েছে।", { show_alert: true });
    
    delete db.linkDatabase[linkId];
    saveDB();

    ctx.editMessageText("❌ **আপনার এই লিঙ্কটি চিরতরে বন্ধ এবং রিমুভ করে দেওয়া হয়েছে।**");
    sendMainMenu(ctx, false);
});

bot.action(/^copy_link_(.+)$/, (ctx) => {
    const linkId = ctx.match[1];
    const data = db.linkDatabase[linkId];
    if (!data) {
        return ctx.answerCbQuery("❌ লিঙ্কটি খুঁজে পাওয়া যায়নি।", { show_alert: true });
    }
    const finalGeneratedUrl = `${SERVER_URL}/love/${linkId}`;
    return ctx.answerCbQuery(`📋 লিংকটি নিচে দেওয়া হলো, চেপে ধরে কপি করুন:\n\n${finalGeneratedUrl}`, { show_alert: true });
});

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
    const activeLinks = Object.keys(db.linkDatabase).length;
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
        music: AUTOMATIC_MUSIC_MAPPING[cat] || ""
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

function showAnimationIntro(ctx) {
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
    ctx.reply(locale.help_text);
});

bot.on('text', (ctx) => {
    const userId = ctx.chat.id;
    const session = db.userSessions[userId];
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
                delete db.userSessions[userId]; 
                saveDB();
                return;
            }
            if (session.step === 'AWAITING_BAN_USER_ID') {
                const targetId = parseInt(text, 10);
                if (isNaN(targetId)) return ctx.reply("❌ Invalid Chat ID. Please send a numeric ID.");
                if (bannedUsers.has(targetId)) { bannedUsers.delete(targetId); ctx.reply("🟢 Target Unbanned successfully."); }
                else { bannedUsers.add(targetId); ctx.reply("🚫 Target Banned successfully."); }
                delete db.userSessions[userId]; 
                saveDB();
                return;
            }
        }

        if (session.step === 'AWAITING_USER_FEEDBACK') {
            if (text.length < 5) return ctx.reply(locale.feedback_short);
            totalFeedbacksReceived++;
            bot.telegram.sendMessage(ADMIN_CHAT_ID, `📝 Feedback from User ${userId}:\n\n${text}`).catch(()=>{});
            ctx.reply(locale.feedback_success);
            delete db.userSessions[userId]; 
            saveDB();
            sendMainMenu(ctx, false); 
            return;
        }

        if (session.step === 'AWAITING_ANIMATION_TEXT') {
            session.animations = text.split(/[\n,，]+/)
                                     .map(l => l.trim())
                                     .filter(l => l.length > 0);
                                     
            if (session.animations.length === 0) return ctx.reply("⚠️ অনুগ্রহ করে অন্তত একটি অ্যানিমেশন টেক্সট লিখুন।");
            
            session.step = 'AWAITING_LETTER_TEXT';
            saveDB();
            ctx.reply(locale.input_anim_success(session.animations.length));
            return;
        }

        // 🎯 ফিক্স: যখন ইউজার চিঠির টেক্সট দিবে, তখন সরাসরি এই কন্ডিশন এক্সিকিউট হবে এবং রিটার্ন করবে
        if (session.step === 'AWAITING_LETTER_TEXT') {
            processFinalLinkCreation(ctx, ctx.message.text); // হুবহু র-টেক্সট (স্পেস/নিউলাইনসহ) পাস করা হচ্ছে
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

    totalLinksCreated++;
    
    let finalCountdownIso = null;
    if (session.pendingMinutes) {
        const targetDate = new Date();
        targetDate.setMinutes(targetDate.getMinutes() + session.pendingMinutes);
        finalCountdownIso = targetDate.toISOString();
    }

    const uniqueId = Math.random().toString(36).substring(2, 9);
    const finalGeneratedUrl = `${SERVER_URL}/love/${uniqueId}`;
    
    db.linkDatabase[uniqueId] = {
        userId: userId, name: session.name, username: session.username, type: session.type,
        music: session.music, countdown: finalCountdownIso,
        animations: session.animations, letter: letterText, answer: null
    };
    
    const userSuccessMsg = `আপনার লিংক তৈরি করা হয়েছে। যাকে লিংক পাঠাতে চান, লিংকটি কপি করে তাকে পাঠিয়ে দিন।\n\nলিংক: \`${finalGeneratedUrl}\``;
    
    ctx.reply(userSuccessMsg, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [Markup.button.callback("📋 Copy Link", `copy_link_${uniqueId}`)],
            [Markup.button.callback("❌ Link Off", `delete_link_${uniqueId}`)]
        ])
    });

    const adminMsg = `নতুন লিংক তৈরি করা হয়েছে。\nName: ${session.name}\nID: ${userId}\nUsername: ${session.username}\nCategory: ${session.type.toUpperCase()}`;
    bot.telegram.sendMessage(ADMIN_CHAT_ID, adminMsg, Markup.inlineKeyboard([
        [Markup.button.callback("🔍 Check Answer", `chk_ans_${uniqueId}`)]
    ])).catch(e => console.error(e));

    delete db.userSessions[userId];
    saveDB();
}

function sendMainMenu(ctx, isEdit = false) {
    try {
        const userId = ctx.chat.id;
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
            if (lockTime > now) {
                return res.json({ success: true, isLocked: true, countdownTime: data.countdown });
            }
        }

        const currentConfig = CATEGORY_CONFIGS[data.type] || CATEGORY_CONFIGS['love'];

        return res.json({ 
            success: true, 
            isLocked: false,
            title: currentConfig.title, 
            music: data.music, 
            animations: data.animations, 
            letter: data.letter,
            emojis: currentConfig.emojis,
            question: currentConfig.question,
            buttons: currentConfig.buttons
        });
    } catch (err) {
        res.json({ success: false });
    }
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

        const adminNotifyMsg = `Name: ${data.name}\nCategory: ${data.type.toUpperCase()}\nAns: ${answer}`;
        bot.telegram.sendMessage(ADMIN_CHAT_ID, adminNotifyMsg).catch(e => console.error(e));

        return res.json({ success: true });
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
