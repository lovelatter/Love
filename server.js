const express = require('express');
const path = require('path');
const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');

const app = express();
app.use(express.json());

// কনফিগারেশন
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
const SERVER_URL = "https://love-bb7p.onrender.com";
const DB_FILE = path.join(__dirname, 'db.json');

const bot = new Telegraf(TELEGRAM_TOKEN);

// 🗄️ ডাটাবেস হ্যান্ডলিং
let db = {
    linkDatabase: {},
    userSessions: {},
    registeredUsers: [],
    bannedUsers: [],
    isMaintenanceMode: false
};

if (fs.existsSync(DB_FILE)) {
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function saveDB() {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// 🌐 টেক্সট মেসেজসমূহ
const msg = {
    welcome: (name) => `💝 **হ্যালো ${name}!** 💝\n\nবটের পক্ষ থেকে স্বাগতম। আপনার প্রিয়জনের জন্য আকর্ষণীয় টাইম কাউন্টডাউন করা ওয়েব লিঙ্ক তৈরি করুন একদম ফ্রিতে।\n\nনিচের যেকোনো একটি অপশন সিলেক্ট করুন:`,
    choose_cat: "✨ **আপনি কোন ক্যাটাগরির লিঙ্ক তৈরি করতে চান?**",
    session_start: (cat) => `✨ আপনার কাস্টম \`${cat.toUpperCase()}\` লিঙ্ক তৈরির সেশন শুরু হয়েছে!\n\n👉 আপনার প্রিয়জনের জন্য **অ্যানিমেশন টেক্সটগুলো** পাঠান।\n\n💡 **লেখার নিয়ম:** লাইনগুলো কমা ( , ) দিয়ে অথবা কিবোর্ডের এন্টার দিয়ে আলাদা করে লিখুন।`,
    anim_success: (count) => `✅ চমৎকার! আপনি ${count} লাইনের অ্যানিমেশন যোগ করেছেন।\n\n💌 এবার খামের ভেতরের মূল চিঠি বা উইশ মেসেজটি লিখে পাঠান।`
};

// 🛡️ মেইনটেন্যান্স এবং ব্যান চেক
bot.use((ctx, next) => {
    const userId = ctx.chat?.id;
    if (!userId) return next();
    if (db.bannedUsers.includes(userId)) return;
    if (db.isMaintenanceMode && String(userId) !== String(ADMIN_CHAT_ID)) {
        return ctx.reply("🚧 বটের কাজ চলছে! অনুগ্রহ করে পরে চেষ্টা করুন।");
    }
    return next();
});

// 👑 অ্যাডমিন কমান্ড (/adm)
bot.command(['admin', 'adm'], (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return;
    ctx.reply("👑 **অ্যাডমিন কন্ট্রোল প্যানেল:**", Markup.inlineKeyboard([
        [Markup.button.callback("📊 পরিসংখ্যান", "adm_stats"), Markup.button.callback("📢 ব্রডকাস্ট", "adm_broadcast")],
        [Markup.button.callback(db.isMaintenanceMode ? "🟢 লাইভ মোড" : "🚧 মেইনটেন্যান্স", "adm_toggle")],
        [Markup.button.callback("🚫 ব্যান ইউজার", "adm_ban")]
    ]));
});

// 📌 অ্যাডমিন অ্যাকশন
bot.action('adm_stats', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    ctx.reply(`📊 মোট ইউজার: ${db.registeredUsers.length}\nমোট লিঙ্ক: ${Object.keys(db.linkDatabase).length}`);
    ctx.answerCbQuery();
});

bot.action('adm_toggle', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    db.isMaintenanceMode = !db.isMaintenanceMode;
    saveDB();
    ctx.reply(`বট এখন ${db.isMaintenanceMode ? 'Maintenance' : 'Live'} মোডে আছে।`);
    ctx.answerCbQuery();
});

bot.action('adm_broadcast', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    db.userSessions[ctx.chat.id] = { step: 'ADM_BC' };
    ctx.reply("📢 ব্রডকাস্ট মেসেজটি লিখুন:");
    ctx.answerCbQuery();
});

bot.action('adm_ban', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    db.userSessions[ctx.chat.id] = { step: 'ADM_BAN' };
    ctx.reply("🚫 ব্যান করার জন্য ইউজার Chat ID দিন:");
    ctx.answerCbQuery();
});

// 🏠 স্টার্ট এবং মেইন মেনু
bot.command('start', (ctx) => {
    if (!db.registeredUsers.includes(ctx.chat.id)) {
        db.registeredUsers.push(ctx.chat.id);
        saveDB();
    }
    sendMainMenu(ctx);
});

bot.command('cancel', (ctx) => {
    delete db.userSessions[ctx.chat.id];
    ctx.reply("❌ সেশন বাতিল করা হয়েছে।");
    sendMainMenu(ctx);
});

// 🚀 মেইন মেনু বাটন হ্যান্ডলার
bot.action('menu_makelink', (ctx) => {
    ctx.answerCbQuery();
    ctx.editMessageText(msg.choose_cat, Markup.inlineKeyboard([
        [Markup.button.callback("❤️ প্রেমের চিঠি", "make_love"), Markup.button.callback("💖 ক্রাশ কনফেশন", "make_crush")],
        [Markup.button.callback("🎂 জন্মদিনের শুভেচ্ছা", "make_bday"), Markup.button.callback("💍 বিবাহবার্ষিকী", "make_anniv")],
        [Markup.button.callback("🎉 নতুন বছর", "make_ny"), Markup.button.callback("🌾 পহেলা বৈশাখ", "make_pb")],
        [Markup.button.callback("🫂 সেরা বন্ধু", "make_friend"), Markup.button.callback("🌙 ঈদ মোবারক", "make_eid")],
        [Markup.button.callback("🥺 দুঃখ প্রকাশ", "make_sorry")],
        [Markup.button.callback("🔙 মেইন মেনু", "go_back")]
    ]));
});

bot.action('menu_cardgen', (ctx) => {
    ctx.answerCbQuery();
    db.userSessions[ctx.chat.id] = { step: 'CARD_NAME' };
    ctx.reply("🖼️ উইশ কার্ডে কার নাম লিখতে চান? নামটি লিখে পাঠান:");
});

bot.action('menu_demo', (ctx) => {
    ctx.answerCbQuery();
    ctx.reply("👀 ডেমো দেখতে নিচের লিঙ্কে ক্লিক করুন:\n" + SERVER_URL + "/love/demo");
});

bot.action('menu_stats', (ctx) => {
    ctx.answerCbQuery();
    const count = Object.keys(db.linkDatabase).filter(id => db.linkDatabase[id].userId === ctx.chat.id).length;
    ctx.reply(`📊 আপনার স্ট্যাটাস:\nআপনার তৈরি করা মোট লিঙ্ক: ${count}`);
});

bot.action('menu_off', (ctx) => {
    ctx.answerCbQuery();
    const myLinks = Object.keys(db.linkDatabase).filter(id => db.linkDatabase[id].userId === ctx.chat.id && db.linkDatabase[id].isActive);
    if (myLinks.length === 0) return ctx.reply("❌ আপনার কোনো একটিভ লিঙ্ক নেই।");
    const btns = myLinks.map(id => [Markup.button.callback(`❌ বন্ধ করুন: ${id}`, `off_${id}`)]);
    ctx.reply("🔒 কোন লিঙ্কটি বন্ধ করতে চান?", Markup.inlineKeyboard(btns));
});

bot.action(/^off_/, (ctx) => {
    const id = ctx.match.input.replace('off_', '');
    if (db.linkDatabase[id]) {
        db.linkDatabase[id].isActive = false;
        saveDB();
        ctx.reply("✅ লিঙ্কটি বন্ধ করা হয়েছে।");
    }
    ctx.answerCbQuery();
});

bot.action('menu_feedback', (ctx) => {
    ctx.answerCbQuery();
    db.userSessions[ctx.chat.id] = { step: 'FEEDBACK' };
    ctx.reply("📝 আপনার মতামত বা অভিযোগ এখানে লিখে পাঠান:");
});

bot.action('menu_help', (ctx) => {
    ctx.answerCbQuery();
    ctx.reply("❓ সাহায্য: যেকোনো সমস্যায় অ্যাডমিনকে মেসেজ দিন। মেনু ফিরে পেতে /start লিখুন।");
});

bot.action('go_back', (ctx) => {
    ctx.answerCbQuery();
    sendMainMenu(ctx, true);
});

// 🛠️ লিঙ্ক তৈরির ফ্লো
bot.action(/^make_/, (ctx) => {
    ctx.answerCbQuery();
    const type = ctx.match.input.replace('make_', '');
    db.userSessions[ctx.chat.id] = { type, step: 'ASK_TIMER' };
    ctx.editMessageText("⏰ আপনি কি টাইম কাউন্টডাউন সেট করতে চান?", Markup.inlineKeyboard([
        [Markup.button.callback("✅ হ্যাঁ", "t_yes"), Markup.button.callback("❌ না", "t_no")]
    ]));
});

bot.action('t_yes', (ctx) => {
    ctx.answerCbQuery();
    db.userSessions[ctx.chat.id].step = 'GET_TIME';
    ctx.reply("⏳ কত মিনিট পর লিঙ্কটি খুলবে? (১-১০০ এর মধ্যে শুধু সংখ্যা দিন)");
});

bot.action('t_no', (ctx) => {
    ctx.answerCbQuery();
    db.userSessions[ctx.chat.id].timer = null;
    askTheme(ctx);
});

function askTheme(ctx) {
    ctx.reply("🎨 থিম সিলেক্ট করুন:", Markup.inlineKeyboard([
        [Markup.button.callback("✨ Pink", "th_pink"), Markup.button.callback("🌌 Neon", "th_neon")],
        [Markup.button.callback("❤️ Dark", "th_dark")]
    ]));
}

bot.action(/^th_/, (ctx) => {
    ctx.answerCbQuery();
    db.userSessions[ctx.chat.id].theme = ctx.match.input.replace('th_', '');
    ctx.reply("🎵 মিউজিক সিলেক্ট করুন:", Markup.inlineKeyboard([
        [Markup.button.callback("🎵 Flute", "mu_flute"), Markup.button.callback("🎵 Piano", "mu_piano")],
        [Markup.button.callback("🔇 No Music", "mu_none")]
    ]));
});

bot.action(/^mu_/, (ctx) => {
    ctx.answerCbQuery();
    db.userSessions[ctx.chat.id].music = ctx.match.input.replace('mu_', '');
    db.userSessions[ctx.chat.id].step = 'GET_ANIM';
    ctx.reply(msg.session_start(db.userSessions[ctx.chat.id].type));
});

// 📝 মেসেজ প্রসেসিং
bot.on('text', (ctx) => {
    const userId = ctx.chat.id;
    const session = db.userSessions[userId];
    const text = ctx.message.text.trim();

    if (!session) return;

    if (session.step === 'ADM_BC') {
        db.registeredUsers.forEach(id => bot.telegram.sendMessage(id, `📢 **নোটিশ:**\n\n${text}`).catch(()=>{}));
        ctx.reply("✅ ব্রডকাস্ট শেষ।");
        delete db.userSessions[userId]; return;
    }

    if (session.step === 'ADM_BAN') {
        const id = parseInt(text);
        if (db.bannedUsers.includes(id)) {
            db.bannedUsers = db.bannedUsers.filter(i => i !== id);
            ctx.reply("🟢 আনব্যান করা হয়েছে।");
        } else {
            db.bannedUsers.push(id);
            ctx.reply("🚫 ব্যান করা হয়েছে।");
        }
        saveDB(); delete db.userSessions[userId]; return;
    }

    if (session.step === 'GET_TIME') {
        const m = parseInt(text);
        if (isNaN(m) || m < 1 || m > 100) return ctx.reply("❌ ১ থেকে ১০০ এর মধ্যে সংখ্যা দিন।");
        session.timer = m;
        askTheme(ctx);
        return;
    }

    if (session.step === 'GET_ANIM') {
        const anims = text.split(/[\n,，]+/).map(s => s.trim()).filter(s => s.length > 0);
        if (anims.length === 0) return ctx.reply("⚠️ কিছু লিখুন।");
        session.animations = anims;
        session.step = 'GET_LETTER';
        ctx.reply(msg.anim_success(anims.length));
        return;
    }

    if (session.step === 'GET_LETTER') {
        const id = Math.random().toString(36).substring(2, 9);
        let exp = null;
        if (session.timer) exp = new Date(Date.now() + session.timer * 60000).toISOString();

        db.linkDatabase[id] = {
            userId, type: session.type, theme: session.theme, music: session.music,
            animations: session.animations, letter: text, expiry: exp, isActive: true
        };
        saveDB();
        ctx.reply(`💝 আপনার লিঙ্ক রেডি:\n\n${SERVER_URL}/love/${id}`);
        delete db.userSessions[userId];
        return;
    }

    if (session.step === 'CARD_NAME') {
        ctx.replyWithPhoto({ url: `https://dummyimage.com/600x400/ff4b72/fff.png&text=${encodeURIComponent(text)}` });
        delete db.userSessions[userId]; return;
    }

    if (session.step === 'FEEDBACK') {
        bot.telegram.sendMessage(ADMIN_CHAT_ID, `📝 মতামত (${userId}):\n${text}`);
        ctx.reply("✅ মতামত পাঠানো হয়েছে।");
        delete db.userSessions[userId]; return;
    }
});

function sendMainMenu(ctx, isEdit = false) {
    const kb = Markup.inlineKeyboard([
        [Markup.button.callback("🚀 লিঙ্ক তৈরি করুন", 'menu_makelink'), Markup.button.callback("🖼️ উইশ কার্ড বানান", 'menu_cardgen')],
        [Markup.button.callback("👀 ডেমো দেখুন", 'menu_demo'), Markup.button.callback("📊 স্ট্যাটাস", 'menu_stats')],
        [Markup.button.callback("🔒 লিঙ্ক বন্ধ করুন", 'menu_off'), Markup.button.callback("📝 মতামত", 'menu_feedback')],
        [Markup.button.callback("❓ সাহায্য", 'menu_help')]
    ]);
    if (isEdit) return ctx.editMessageText(msg.welcome(ctx.from.first_name), kb).catch(()=>{});
    return ctx.reply(msg.welcome(ctx.from.first_name), kb);
}

// 🌐 API
app.post('/api/get-content', (req, res) => {
    const data = db.linkDatabase[req.body.id];
    if (!data || !data.isActive) return res.json({ success: false });
    res.json({ success: true, ...data });
});

app.get('/love/:id', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    bot.launch();
    console.log(`Bot is running...`);
});
