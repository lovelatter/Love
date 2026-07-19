const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const path = require('path');
const { db, saveDB, AUTOMATIC_MUSIC_MAPPING, CATEGORY_CONFIGS, UPLOADS_DIR } = require('./modules/config');
const locale = require('./modules/locale');
const { parseUserAgent } = require('./modules/utils');
const { sendMainMenu } = require('./modules/handlers');

const app = express();
const bot = new Telegraf(process.env.TELEGRAM_TOKEN);
const ADMIN_IDS = (process.env.ADMIN_CHAT_ID || "").split(',').map(id => id.trim()).filter(id => id !== "");
const SERVER_URL = "https://love-bb7p.onrender.com";

app.use(express.json());
app.set('trust proxy', true);
app.use('/uploads', express.static(UPLOADS_DIR));

// Middleware
bot.use(async (ctx, next) => {
    const userId = ctx.chat?.id;
    if (!userId) return;
    if (!db.registeredUsers.includes(userId)) db.registeredUsers.push(userId);
    saveDB();
    if (ADMIN_IDS.includes(userId.toString())) return next();
    if (db.bannedUsers.includes(userId)) return;
    return next();
});

// Commands
bot.command('start', (ctx) => { delete db.userSessions[ctx.chat.id]; saveDB(); sendMainMenu(ctx, false); });

// Link Creation Handlers
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
    db.userSessions[ctx.chat.id] = { type: cat, step: 'AWAITING_COUNTDOWN_SELECTION' };
    saveDB();
    ctx.editMessageText(locale.prompt_countdown_ask, Markup.inlineKeyboard([
        [Markup.button.callback(locale.btn_no_countdown, 'timer_no')],
        [Markup.button.callback('🕒 ৩ মিনিট', 'set_time_3')],
        [Markup.button.callback("🔙 পেছনে যান", 'menu_makelink')]
    ]));
});

bot.action('go_to_main_menu', (ctx) => { ctx.answerCbQuery(); sendMainMenu(ctx, true); });

// API Endpoints
app.post('/api/get-content', async (req, res) => {
    const data = db.linkDatabase[req.body.id];
    if (!data) return res.json({ success: false });
    res.json({ success: true, title: CATEGORY_CONFIGS[data.type]?.title, music: data.music, animations: data.animations, letter: data.letter });
});

app.get('/love/:id', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    bot.launch();
    console.log(`Server running on port ${PORT}`);
});
