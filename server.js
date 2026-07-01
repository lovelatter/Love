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

// 🗄️ Database Logic
let db = { linkDatabase: {}, userSessions: {}, totalLinksCreated: 0 };
if (fs.existsSync(DB_FILE)) { db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
function saveDB() { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); }

// 🌐 Messages
const locale = {
    bn: {
        welcome: (name) => `💝 **হ্যালো ${name}!** 💝\n\nবটের পক্ষ থেকে স্বাগতম। আপনার প্রিয়জনের জন্য আকর্ষণীয় টাইম কাউন্টডাউন করা ওয়েব লিঙ্ক তৈরি করুন একদম ফ্রিতে।\n\nনিচের যেকোনো একটি অপশন সিলেক্ট করুন:`,
        btn_make: "🚀 লিঙ্ক তৈরি করুন", btn_card: "🖼️ উইশ কার্ড বানান", btn_demo: "👀 ডেমো দেখুন", btn_stats: "📊 স্ট্যাটাস", btn_off: "🔒 লিঙ্ক বন্ধ করুন", btn_feedback: "📝 মতামত", btn_help: "❓ সাহায্য", btn_back: "🔙 মেইন মেনু",
        choose_cat: "✨ **ক্যাটাগরি সিলেক্ট করুন:**",
        cat_love: "❤️ প্রেমের চিঠি", cat_crush: "💖 ক্রাশ কনফেশন", cat_birthday: "🎂 জন্মদিনের শুভেচ্ছা", cat_anniversary: "💍 বিবাহবার্ষিকী",
        prompt_countdown_ask: "⏰ **টাইম কাউন্টডাউন সেট করতে চান?**",
        prompt_time_input: "⏳ কত মিনিট পর লিঙ্ক খুলবে? (১-১০০)",
        prompt_theme: "🎨 **থিম সিলেক্ট করুন:**",
        prompt_music: "🎵 **মিউজিক সিলেক্ট করুন:**",
        prompt_card_name: "🖼️ কার্ডে কার নাম লিখতে চান? নামটি লিখুন:",
        card_ready: "✨ **আপনার উইশ কার্ডটি তৈরি হয়েছে!**",
        demo_title: "👀 **কোন ডেমোটি দেখতে চান?**",
        help_text: `❓ **সাহায্য:** কোনো সমস্যা হলে এডমিনের সাথে যোগাযোগ করুন।`,
        feedback_prompt: "📝 আপনার মতামত বা অভিযোগ লিখে পাঠান:",
        feedback_success: "✅ আপনার মেসেজ এডমিনের কাছে পাঠানো হয়েছে।",
        session_cancelled: "❌ সেশন বাতিল হয়েছে।",
        no_links: "❌ আপনার কোনো একটিভ লিঙ্ক নেই।",
        off_link_title: "🔒 **কোন লিঙ্কটি বন্ধ করতে চান?**",
        session_started: (cat) => `✨ \`${cat.toUpperCase()}\` লিঙ্ক সেশন শুরু!\n\n👉 **অ্যানিমেশন টেক্সটগুলো** পাঠান। (এন্টার বা কমা দিয়ে আলাদা করুন)`,
        input_anim_success: (count) => `✅ ${count}টি অ্যানিমেশন যোগ হয়েছে।\n\n💌 এবার খামের ভেতরের মূল **চিঠিটি** লিখে পাঠান।`,
        link_ready: (url) => `💝 আপনার লিঙ্ক রেডি:\n\n${url}`
    }
};

// 📌 Middlewares
bot.use((ctx, next) => {
    const userId = ctx.chat?.id;
    if (!userId || bannedUsers.has(userId)) return;
    if (isMaintenanceMode && Number(userId) !== Number(ADMIN_CHAT_ID)) return ctx.reply(locale.bn.maint_msg);
    return next();
});

// 📌 Admin Commands
bot.command(['admin', 'adm'], (ctx) => {
    if (Number(ctx.chat.id) !== Number(ADMIN_CHAT_ID)) return;
    ctx.reply("👑 **Admin Console:**", Markup.inlineKeyboard([
        [Markup.button.callback("📊 Status", "admin_stats"), Markup.button.callback("📢 Broadcast", "admin_broadcast")],
        [Markup.button.callback("🚧 Toggle Maintenance", "admin_toggle_maint")]
    ]));
});

bot.action('admin_stats', (ctx) => {
    if (Number(ctx.chat.id) !== Number(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    ctx.answerCbQuery();
    const active = Object.keys(db.linkDatabase).filter(k => db.linkDatabase[k].isActive).length;
    ctx.reply(`📊 Stats: Active Links: ${active}`);
});

bot.action('admin_broadcast', (ctx) => {
    if (Number(ctx.chat.id) !== Number(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    ctx.answerCbQuery();
    db.userSessions[ctx.chat.id] = { step: 'ADMIN_BROADCAST' };
    ctx.reply("📢 ব্রডকাস্ট মেসেজটি লিখুন:");
});

// 📌 Main Menu Buttons Logic (Fixing the Issue)
bot.action('menu_makelink', (ctx) => {
    ctx.answerCbQuery();
    ctx.editMessageText(locale.bn.choose_cat, Markup.inlineKeyboard([
        [Markup.button.callback(locale.bn.cat_love, 'make_love'), Markup.button.callback(locale.bn.cat_crush, 'make_crush')],
        [Markup.button.callback(locale.bn.cat_birthday, 'make_birthday'), Markup.button.callback(locale.bn.cat_anniversary, 'make_anniversary')],
        [Markup.button.callback(locale.bn.btn_back, 'go_to_main_menu')]
    ]));
});

bot.action('menu_cardgen', (ctx) => {
    ctx.answerCbQuery();
    db.userSessions[ctx.chat.id] = { step: 'AWAITING_CARD_NAME' };
    ctx.reply(locale.bn.prompt_card_name);
});

bot.action('menu_demo', (ctx) => {
    ctx.answerCbQuery();
    ctx.editMessageText(locale.bn.demo_title, Markup.inlineKeyboard([
        [Markup.button.callback("❤️ Love Demo", "v_demo_love"), Markup.button.callback("🎂 Birthday Demo", "v_demo_bd")],
        [Markup.button.callback(locale.bn.btn_back, "go_to_main_menu")]
    ]));
});

bot.action(/^v_demo_/, (ctx) => {
    ctx.answerCbQuery();
    const type = ctx.match.input.replace('v_demo_', '');
    ctx.reply(`✨ ডেমো লিঙ্ক: ${SERVER_URL}/love/demo-${type}`);
});

bot.action('menu_stats', (ctx) => {
    ctx.answerCbQuery();
    const userId = ctx.chat.id;
    const links = Object.keys(db.linkDatabase).filter(k => db.linkDatabase[k].userId === userId && db.linkDatabase[k].isActive);
    let list = links.length === 0 ? locale.bn.no_links : links.map((id, i) => `${i+1}. ${SERVER_URL}/love/${id}`).join('\n');
    ctx.reply(`📊 আপনার একটিভ লিঙ্কসমূহ:\n\n${list}`);
});

bot.action('menu_off', (ctx) => {
    ctx.answerCbQuery();
    const userId = ctx.chat.id;
    const links = Object.keys(db.linkDatabase).filter(k => db.linkDatabase[k].userId === userId && db.linkDatabase[k].isActive);
    if (links.length === 0) return ctx.reply(locale.bn.no_links);
    const btns = links.map(id => [Markup.button.callback(`❌ বন্ধ করুন: ${id}`, `off_${id}`)]);
    btns.push([Markup.button.callback(locale.bn.btn_back, "go_to_main_menu")]);
    ctx.reply(locale.bn.off_link_title, Markup.inlineKeyboard(btns));
});

bot.action(/^off_/, (ctx) => {
    ctx.answerCbQuery();
    const id = ctx.match.input.replace('off_', '');
    if (db.linkDatabase[id]) db.linkDatabase[id].isActive = false;
    saveDB();
    ctx.reply("✅ লিঙ্কটি বন্ধ করা হয়েছে।");
});

bot.action('menu_feedback', (ctx) => {
    ctx.answerCbQuery();
    db.userSessions[ctx.chat.id] = { step: 'AWAITING_FEEDBACK' };
    ctx.reply(locale.bn.feedback_prompt);
});

bot.action('menu_help', (ctx) => {
    ctx.answerCbQuery();
    ctx.reply(locale.bn.help_text);
});

bot.action('go_to_main_menu', (ctx) => {
    ctx.answerCbQuery();
    sendMainMenu(ctx, true);
});

// 📌 Link Creation Steps
bot.action(/^make_/, (ctx) => {
    ctx.answerCbQuery();
    db.userSessions[ctx.chat.id] = { type: ctx.match.input.replace('make_', ''), name: ctx.from.first_name };
    ctx.editMessageText(locale.bn.prompt_countdown_ask, Markup.inlineKeyboard([
        [Markup.button.callback("✅ হ্যাঁ", 't_yes'), Markup.button.callback("❌ না", 't_no')]
    ]));
});

bot.action('t_yes', (ctx) => {
    ctx.answerCbQuery();
    db.userSessions[ctx.chat.id].step = 'AWAITING_TIME';
    ctx.reply(locale.bn.prompt_time_input);
});

bot.action('t_no', (ctx) => {
    ctx.answerCbQuery();
    db.userSessions[ctx.chat.id].pendingMinutes = null;
    askTheme(ctx);
});

function askTheme(ctx) {
    ctx.reply(locale.bn.prompt_theme, Markup.inlineKeyboard([
        [Markup.button.callback('✨ Classic Pink', 's_th_pink'), Markup.button.callback('🌌 Neon Magic', 's_th_neon')]
    ]));
}

bot.action(/^s_th_/, (ctx) => {
    ctx.answerCbQuery();
    db.userSessions[ctx.chat.id].theme = ctx.match.input.replace('s_th_', '');
    ctx.reply(locale.bn.prompt_music, Markup.inlineKeyboard([
        [Markup.button.callback('🎵 Soft Piano', 's_ms_piano'), Markup.button.callback('🔇 No Music', 's_ms_none')]
    ]));
});

bot.action(/^s_ms_/, (ctx) => {
    ctx.answerCbQuery();
    const session = db.userSessions[ctx.chat.id];
    session.music = ctx.match.input.replace('s_ms_', '');
    session.step = 'AWAITING_ANIM';
    ctx.reply(locale.bn.session_started(session.type));
});

// 🎯 Text Handling
bot.on('text', (ctx) => {
    const userId = ctx.chat.id;
    const session = db.userSessions[userId];
    const text = ctx.message.text.trim();
    if (text.startsWith('/')) {
        if (text === '/start') { registeredUsers.add(userId); return sendMainMenu(ctx, false); }
        if (text === '/cancel') { delete db.userSessions[userId]; return ctx.reply(locale.bn.session_cancelled); }
        return;
    }
    if (!session) return;

    if (session.step === 'AWAITING_TIME') {
        const m = parseInt(text);
        if (isNaN(m) || m < 1 || m > 100) return ctx.reply("❌ ১-১০০ এর মধ্যে সংখ্যা দিন।");
        session.pendingMinutes = m;
        askTheme(ctx);
    } else if (session.step === 'AWAITING_ANIM') {
        session.animations = text.split(/[\n,，]+/).map(l => l.trim()).filter(l => l.length > 0);
        session.step = 'AWAITING_LETTER';
        ctx.reply(locale.bn.input_anim_success(session.animations.length));
    } else if (session.step === 'AWAITING_LETTER') {
        const uniqueId = Math.random().toString(36).substring(2, 9);
        let countdown = null;
        if (session.pendingMinutes) {
            let d = new Date(); d.setMinutes(d.getMinutes() + session.pendingMinutes);
            countdown = d.toISOString();
        }
        db.linkDatabase[uniqueId] = { userId, theme: session.theme, music: session.music, animations: session.animations, letter: text, countdown, isActive: true, type: session.type };
        saveDB();
        ctx.reply(locale.bn.link_ready(`${SERVER_URL}/love/${uniqueId}`));
        delete db.userSessions[userId];
    } else if (session.step === 'AWAITING_CARD_NAME') {
        ctx.reply(locale.bn.card_ready);
        ctx.replyWithPhoto({ url: `https://dummyimage.com/600x400/ff4b72/fff.png&text=${encodeURIComponent(text)}` });
        delete db.userSessions[userId];
    } else if (session.step === 'AWAITING_FEEDBACK') {
        bot.telegram.sendMessage(ADMIN_CHAT_ID, `📝 Feedback: ${text}`);
        ctx.reply(locale.bn.feedback_success);
        delete db.userSessions[userId];
    } else if (session.step === 'ADMIN_BROADCAST' && Number(userId) === Number(ADMIN_CHAT_ID)) {
        registeredUsers.forEach(id => bot.telegram.sendMessage(id, `📢 নোটিশ:\n\n${text}`).catch(()=>{}));
        ctx.reply("✅ ব্রডকাস্ট সফল।");
        delete db.userSessions[userId];
    }
});

function sendMainMenu(ctx, isEdit = false) {
    const text = locale.bn.welcome(ctx.from?.first_name || "User");
    const kb = Markup.inlineKeyboard([
        [Markup.button.callback(locale.bn.btn_make, 'menu_makelink'), Markup.button.callback(locale.bn.btn_card, 'menu_cardgen')],
        [Markup.button.callback(locale.bn.btn_demo, 'menu_demo'), Markup.button.callback(locale.bn.btn_stats, 'menu_stats')],
        [Markup.button.callback(locale.bn.btn_off, 'menu_off'), Markup.button.callback(locale.bn.btn_feedback, 'menu_feedback')],
        [Markup.button.callback(locale.bn.btn_help, 'menu_help')]
    ]);
    return isEdit ? ctx.editMessageText(text, kb).catch(()=>{}) : ctx.reply(text, kb);
}

app.post('/api/get-content', (req, res) => {
    const data = db.linkDatabase[req.body.id];
    if (!data || !data.isActive) return res.json({ success: false });
    res.json({ success: true, ...data });
});
app.get('/love/:id', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.listen(process.env.PORT || 3000, () => bot.launch());
