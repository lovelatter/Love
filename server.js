const express = require('express');
const path = require('path');
const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');

const app = express();
app.use(express.json());

// কনফিগারেশন (আপনার টোকেন এবং আইডি এখানে দিন)
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
const SERVER_URL = "https://love-bb7p.onrender.com";
const DB_FILE = path.join(__dirname, 'db.json');

const bot = new Telegraf(TELEGRAM_TOKEN);

// 🗄️ ডাটাবেস লোড ও সেভ
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

// 🌐 মেসেজ ডিকশনারি (শুধুমাত্র বাংলা)
const locale = {
    welcome: (name) => `💝 **হ্যালো ${name}!** 💝\n\nবটের পক্ষ থেকে স্বাগতম। আপনার প্রিয়জনের জন্য আকর্ষণীয় টাইম কাউন্টডাউন করা ওয়েব লিঙ্ক তৈরি করুন একদম ফ্রিতে।\n\nনিচের যেকোনো একটি অপশন সিলেক্ট করুন:`,
    btn_make: "🚀 লিঙ্ক তৈরি করুন", btn_card: "🖼️ উইশ কার্ড বানান", btn_demo: "👀 ডেমো দেখুন", btn_stats: "📊 স্ট্যাটাস", btn_off: "🔒 লিঙ্ক বন্ধ করুন", btn_feedback: "📝 মতামত", btn_help: "❓ সাহায্য",
    choose_cat: "✨ **আপনি কোন ক্যাটাগরির লিঙ্ক তৈরি করতে চান?**",
    prompt_countdown_ask: "⏰ **আপনি কি এই লিঙ্কে নির্দিষ্ট টাইম কাউন্টডাউন সেট করতে চান?**",
    prompt_time_input: "⏳ লিঙ্কটি কত মিনিট পর খুলবে তা শুধু সংখ্যায় (১-১০০) লিখে পাঠান।",
    prompt_theme: "🎨 **একটি প্রিমিয়াম ওয়েব থিম সিলেক্ট করুন:**",
    prompt_music: "🎵 **একটি ব্যাকগ্রাউন্ড মিউজিক সিলেক্ট করুন:**",
    prompt_card_name: "🖼️ উইশ কার্ডে কার নাম লিখতে চান? নামটি লিখে পাঠান:",
    session_started: (cat) => `✨ আপনার কাস্টম \`${cat.toUpperCase()}\` লিঙ্ক তৈরির সেশন শুরু হয়েছে!\n\n👉 আপনার প্রিয়জনের জন্য **অ্যানিমেশন টেক্সটগুলো** পাঠান।\n\n💡 **লেখার নিয়ম:** লাইনগুলো কমা ( , ) দিয়ে অথবা এন্টার দিয়ে লিখুন।`,
    input_anim_success: (count) => `✅ চমৎকার! আপনি ${count} লাইনের অ্যানিমেশন যোগ করেছেন।\n\n💌 এবার খামের ভেতরের মূল চিঠি বা মেসেজটি লিখে পাঠান।`,
    link_ready: (url) => `💝 অভিনন্দন! আপনার কাস্টম লিঙ্ক রেডি:\n\n${url}`,
    maint_msg: "🚧 বটের কাজ চলছে! অনুগ্রহ করে পরে চেষ্টা করুন।"
};

// 🛡️ মিডলওয়্যার (ব্যান এবং মেইনটেন্যান্স চেক)
bot.use((ctx, next) => {
    const userId = ctx.chat?.id;
    if (!userId) return next();
    if (db.bannedUsers.includes(userId)) return;
    if (db.isMaintenanceMode && String(userId) !== String(ADMIN_CHAT_ID)) {
        return ctx.reply(locale.maint_msg);
    }
    return next();
});

// 👑 অ্যাডমিন প্যানেল (/adm বা /admin)
const openAdminPanel = (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return;
    ctx.reply("👑 **অ্যাডমিন কন্ট্রোল প্যানেল:**", Markup.inlineKeyboard([
        [Markup.button.callback("📊 পরিসংখ্যান", "admin_stats"), Markup.button.callback("📢 ব্রডকাস্ট", "admin_broadcast")],
        [Markup.button.callback(db.isMaintenanceMode ? "🟢 লাইভ মোড করুন" : "🚧 মেইনটেন্যান্স মোড", "admin_toggle_maint")],
        [Markup.button.callback("🚫 ইউজার ব্যান", "admin_ban_menu")]
    ]));
};
bot.command('admin', openAdminPanel);
bot.command('adm', openAdminPanel);

// 📌 অ্যাডমিন অ্যাকশন হ্যান্ডলার
bot.action('admin_stats', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    const totalLinks = Object.keys(db.linkDatabase).length;
    ctx.reply(`📊 পরিসংখ্যান:\nমোট ইউজার: ${db.registeredUsers.length}\nমোট লিঙ্ক তৈরি: ${totalLinks}`);
    ctx.answerCbQuery();
});

bot.action('admin_toggle_maint', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    db.isMaintenanceMode = !db.isMaintenanceMode;
    saveDB();
    ctx.reply(`মোড পরিবর্তন হয়েছে: ${db.isMaintenanceMode ? 'Maintenance ON' : 'Live ON'}`);
    ctx.answerCbQuery();
});

bot.action('admin_broadcast', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    db.userSessions[ctx.chat.id] = { step: 'AWAITING_ADMIN_BROADCAST' };
    ctx.reply("📢 ব্রডকাস্ট মেসেজটি লিখুন (এটি সব ইউজারের কাছে চলে যাবে):");
    ctx.answerCbQuery();
});

bot.action('admin_ban_menu', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    db.userSessions[ctx.chat.id] = { step: 'AWAITING_BAN_ID' };
    ctx.reply("🚫 ব্যান/আনব্যান করার জন্য ইউজারের Chat ID পাঠান:");
    ctx.answerCbQuery();
});

// 🏠 মেইন মেনু কমান্ড
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

// 🚀 মেইন মেনু বাটন অ্যাকশন হ্যান্ডলার (আপনার স্ক্রিনশটের সব বাটন এখানে)
bot.action('menu_makelink', (ctx) => {
    ctx.answerCbQuery();
    ctx.editMessageText(locale.choose_cat, Markup.inlineKeyboard([
        [Markup.button.callback("❤️ প্রেমের চিঠি", "make_love"), Markup.button.callback("💖 ক্রাশ কনফেশন", "make_crush")],
        [Markup.button.callback("🎂 জন্মদিন", "make_bday"), Markup.button.callback("💍 বিবাহবার্ষিকী", "make_anniv")],
        [Markup.button.callback("🔙 মেইন মেনু", "go_back")]
    ]));
});

bot.action('menu_cardgen', (ctx) => {
    ctx.answerCbQuery();
    db.userSessions[ctx.chat.id] = { step: 'AWAITING_CARD_NAME' };
    ctx.reply(locale.prompt_card_name);
});

bot.action('menu_demo', (ctx) => {
    ctx.answerCbQuery();
    ctx.reply("👀 ডেমো দেখতে নিচের লিঙ্কে ক্লিক করুন:\n" + SERVER_URL + "/love/demo");
});

bot.action('menu_stats', (ctx) => {
    ctx.answerCbQuery();
    const myLinks = Object.keys(db.linkDatabase).filter(id => db.linkDatabase[id].userId === ctx.chat.id);
    ctx.reply(`📊 আপনার প্রোফাইল:\nআপনার তৈরি করা মোট লিঙ্ক: ${myLinks.length}`);
});

bot.action('menu_off', (ctx) => {
    ctx.answerCbQuery();
    const myLinks = Object.keys(db.linkDatabase).filter(id => db.linkDatabase[id].userId === ctx.chat.id && db.linkDatabase[id].isActive);
    if (myLinks.length === 0) return ctx.reply("❌ আপনার কোনো একটিভ লিঙ্ক নেই।");
    
    const buttons = myLinks.map(id => [Markup.button.callback(`❌ বন্ধ করুন: ${id}`, `off_${id}`)]);
    ctx.reply("🔒 কোন লিঙ্কটি বন্ধ করতে চান?", Markup.inlineKeyboard(buttons));
});

bot.action(/^off_/, (ctx) => {
    const id = ctx.match.input.replace('off_', '');
    if (db.linkDatabase[id]) {
        db.linkDatabase[id].isActive = false;
        saveDB();
        ctx.reply("✅ লিঙ্কটি সফলভাবে বন্ধ করা হয়েছে।");
    }
    ctx.answerCbQuery();
});

bot.action('menu_feedback', (ctx) => {
    ctx.answerCbQuery();
    db.userSessions[ctx.chat.id] = { step: 'AWAITING_FEEDBACK' };
    ctx.reply(locale.feedback_prompt);
});

bot.action('menu_help', (ctx) => {
    ctx.answerCbQuery();
    ctx.reply("❓ সাহায্য: যেকোনো সমস্যার জন্য অ্যাডমিনের সাথে যোগাযোগ করুন। মেইন মেনু ফিরে পেতে /start লিখুন।");
});

bot.action('go_back', (ctx) => {
    ctx.answerCbQuery();
    sendMainMenu(ctx, true);
});

// 🛠️ লিঙ্ক তৈরির স্টেপ-বাই-স্টেপ লজিক
bot.action(/^make_/, (ctx) => {
    ctx.answerCbQuery();
    const type = ctx.match.input.replace('make_', '');
    db.userSessions[ctx.chat.id] = { type: type, step: 'ASK_TIMER' };
    ctx.editMessageText(locale.prompt_countdown_ask, Markup.inlineKeyboard([
        [Markup.button.callback("✅ হ্যাঁ", "timer_yes"), Markup.button.callback("❌ না", "timer_no")]
    ]));
});

bot.action('timer_yes', (ctx) => {
    ctx.answerCbQuery();
    db.userSessions[ctx.chat.id].step = 'AWAITING_TIME';
    ctx.reply(locale.prompt_time_input);
});

bot.action('timer_no', (ctx) => {
    ctx.answerCbQuery();
    db.userSessions[ctx.chat.id].timer = null;
    askTheme(ctx);
});

function askTheme(ctx) {
    ctx.reply(locale.prompt_theme, Markup.inlineKeyboard([
        [Markup.button.callback("✨ Pink Theme", "theme_pink"), Markup.button.callback("🌌 Neon Theme", "theme_neon")],
        [Markup.button.callback("❤️ Dark Theme", "theme_dark")]
    ]));
}

bot.action(/^theme_/, (ctx) => {
    ctx.answerCbQuery();
    db.userSessions[ctx.chat.id].theme = ctx.match.input.replace('theme_', '');
    ctx.reply(locale.prompt_music, Markup.inlineKeyboard([
        [Markup.button.callback("🎵 Flute", "music_flute"), Markup.button.callback("🎵 Piano", "music_piano")],
        [Markup.button.callback("🔇 No Music", "music_none")]
    ]));
});

bot.action(/^music_/, (ctx) => {
    ctx.answerCbQuery();
    db.userSessions[ctx.chat.id].music = ctx.match.input.replace('music_', '');
    db.userSessions[ctx.chat.id].step = 'AWAITING_ANIM';
    ctx.reply(locale.session_started(db.userSessions[ctx.chat.id].type));
});

// 📝 টেক্সট মেসেজ হ্যান্ডলার (সব ইনপুট প্রসেসিং এখানে)
bot.on('text', (ctx) => {
    const userId = ctx.chat.id;
    const session = db.userSessions[userId];
    const text = ctx.message.text.trim();

    if (!session) return;

    // ১. অ্যাডমিন ব্রডকাস্ট
    if (session.step === 'AWAITING_ADMIN_BROADCAST') {
        db.registeredUsers.forEach(id => bot.telegram.sendMessage(id, `📢 **নোটিশ:**\n\n${text}`).catch(()=>{}));
        ctx.reply("✅ ব্রডকাস্ট সম্পন্ন।");
        delete db.userSessions[userId]; return;
    }

    // ২. ইউজার ব্যান
    if (session.step === 'AWAITING_BAN_ID') {
        const targetId = parseInt(text);
        if (db.bannedUsers.includes(targetId)) {
            db.bannedUsers = db.bannedUsers.filter(id => id !== targetId);
            ctx.reply("🟢 ইউজারকে আনব্যান করা হয়েছে।");
        } else {
            db.bannedUsers.push(targetId);
            ctx.reply("🚫 ইউজারকে ব্যান করা হয়েছে।");
        }
        saveDB(); delete db.userSessions[userId]; return;
    }

    // ৩. টাইম ইনপুট
    if (session.step === 'AWAITING_TIME') {
        const mins = parseInt(text);
        if (isNaN(mins) || mins < 1 || mins > 100) return ctx.reply("❌ ১-১০০ এর মধ্যে সংখ্যা দিন।");
        session.timer = mins;
        askTheme(ctx);
        return;
    }

    // ৪. অ্যানিমেশন টেক্সট
    if (session.step === 'AWAITING_ANIM') {
        const anims = text.split(/[\n,，]+/).map(s => s.trim()).filter(s => s.length > 0);
        session.animations = anims;
        session.step = 'AWAITING_LETTER';
        ctx.reply(locale.input_anim_success(anims.length));
        return;
    }

    // ৫. ফাইনাল লেটার/চিঠি
    if (session.step === 'AWAITING_LETTER') {
        const uniqueId = Math.random().toString(36).substring(2, 9);
        let expiry = null;
        if (session.timer) {
            expiry = new Date(Date.now() + session.timer * 60000).toISOString();
        }

        db.linkDatabase[uniqueId] = {
            userId: userId,
            type: session.type,
            theme: session.theme,
            music: session.music,
            animations: session.animations,
            letter: text,
            expiry: expiry,
            isActive: true
        };
        saveDB();
        ctx.reply(locale.link_ready(`${SERVER_URL}/love/${uniqueId}`));
        delete db.userSessions[userId];
        return;
    }

    // ৬. উইশ কার্ড
    if (session.step === 'AWAITING_CARD_NAME') {
        ctx.reply("✨ কার্ড তৈরি হচ্ছে...");
        ctx.replyWithPhoto({ url: `https://dummyimage.com/600x400/ff4b72/fff.png&text=${encodeURIComponent(text)}` });
        delete db.userSessions[userId];
        return;
    }

    // ৭. মতামত
    if (session.step === 'AWAITING_FEEDBACK') {
        bot.telegram.sendMessage(ADMIN_CHAT_ID, `📝 মতামত (${userId}):\n${text}`);
        ctx.reply("✅ আপনার মতামত পাঠানো হয়েছে। ধন্যবাদ!");
        delete db.userSessions[userId];
        return;
    }
});

// 🏥 হেল্পার ফাংশন: মেইন মেনু পাঠানো
function sendMainMenu(ctx, isEdit = false) {
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback(locale.btn_make, 'menu_makelink'), Markup.button.callback(locale.btn_card, 'menu_cardgen')],
        [Markup.button.callback(locale.btn_demo, 'menu_demo'), Markup.button.callback(locale.btn_stats, 'menu_stats')],
        [Markup.button.callback(locale.btn_off, 'menu_off'), Markup.button.callback(locale.btn_feedback, 'menu_feedback')],
        [Markup.button.callback(locale.btn_help, 'menu_help')]
    ]);
    const msg = locale.welcome(ctx.from.first_name);
    if (isEdit) return ctx.editMessageText(msg, keyboard).catch(()=>{});
    return ctx.reply(msg, keyboard);
}

// 🌐 API এবং সার্ভার
app.post('/api/get-content', (req, res) => {
    const data = db.linkDatabase[req.body.id];
    if (!data || !data.isActive) return res.json({ success: false });
    res.json({ success: true, ...data });
});

app.get('/love/:id', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    bot.launch();
    console.log(`Server running on port ${PORT}`);
});
