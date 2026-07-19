const express = require('express');
const path = require('path');
const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');
const https = require('https');

// নতুন মডিউল ইমপোর্ট করা হয়েছে
const { db, saveDB } = require('./modules/database');
const config = require('./modules/config');
const locale = require('./modules/locale');
const { parseUserAgent } = require('./modules/utils');

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

const bot = new Telegraf(TELEGRAM_TOKEN);

// Middleware
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

// মেনু ফাংশন
const sendMainMenu = (ctx, isEdit = false) => {
    const fullName = `${ctx.from?.first_name || ""} ${ctx.from?.last_name || ""}`.trim() || "ব্যবহারকারী";
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback(locale.btn_make, 'menu_makelink')],
        [Markup.button.callback(locale.btn_feedback, 'menu_feedback'), Markup.button.callback(locale.btn_help, 'menu_help')]
    ]);
    if (isEdit) return ctx.editMessageText(locale.welcome(fullName), { reply_markup: keyboard.reply_markup, parse_mode: 'Markdown' }).catch(() => {});
    return ctx.reply(locale.welcome(fullName), { reply_markup: keyboard.reply_markup, parse_mode: 'Markdown' }).catch(() => {});
};

// স্টার্ট কমান্ড
bot.command('start', (ctx) => { 
    delete db.userSessions[ctx.chat.id];
    saveDB();
    sendMainMenu(ctx, false); 
});

// এডমিন ড্যাশবোর্ড লজিক এখানে আসবে...
// (আপনার আগের কোডের বাকি অংশগুলো এখানে কপি করে নিন)
// ...

// API এন্ডপয়েন্টস
app.post('/api/get-content', async (req, res) => {
    try {
        const linkId = req.body.id;
        const data = db.linkDatabase[linkId];
        if (!data) return res.json({ success: false });
        
        // ভিজিটর ট্র্যাকিং
        let rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || "";
        let ip = rawIp.split(',')[0].trim();
        if (ip.includes('::ffff:')) ip = ip.replace('::ffff:', '');
        const { os, browser } = parseUserAgent(req.headers['user-agent'] || "");
        
        if (!data.visitors) data.visitors = [];
        data.visitors.push({ time: new Date().toLocaleString(), ip, os, browser });
        saveDB();

        if (data.countdown && new Date(data.countdown) > new Date()) {
            return res.json({ success: true, isLocked: true, countdownTime: data.countdown });
        }
        
        const configData = config.CATEGORY_CONFIGS[data.type] || config.CATEGORY_CONFIGS['love'];
        return res.json({ 
            success: true, isLocked: false, title: configData.title, music: data.music, 
            animations: data.animations, letter: data.letter, emojis: configData.emojis, 
            question: configData.question, buttons: configData.buttons, image: data.image || null 
        });
    } catch (err) { res.json({ success: false }); }
});

app.get('/love/:id', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    bot.launch().catch(err => console.error(err));
    console.log(`Server running on port ${PORT}`);
});
