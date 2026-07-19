const express = require('express');
const path = require('path');
const { Telegraf, Markup } = require('telegraf');
const config = require('./modules/config');
const locale = require('./modules/locale');
const { db, saveDB, isAdmin } = require('./modules/utils');
const { sendMainMenu } = require('./modules/menu');
const { showAdminDashboard } = require('./modules/admin');
const { processFinalLinkCreation } = require('./modules/link');
const { handlePhoto } = require('./modules/photoHandler');

const app = express();
app.use(express.json());
app.set('trust proxy', true);
app.use('/uploads', express.static(config.UPLOADS_DIR));

const bot = new Telegraf(process.env.TELEGRAM_TOKEN);

bot.use(async (ctx, next) => {
    const userId = ctx.chat?.id;
    if (!userId) return;
    if (!db.registeredUsers.includes(userId)) db.registeredUsers.push(userId);
    if (ctx.from?.username) db.usernameMap[ctx.from.username.toLowerCase()] = userId;
    saveDB();
    if (isAdmin(userId, config.ADMIN_IDS)) return next();
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

bot.command('start', (ctx) => { 
    delete db.userSessions[ctx.chat.id];
    saveDB();
    sendMainMenu(ctx, false); 
});

bot.command(['admin', 'adm'], (ctx) => {
    if (!isAdmin(ctx.chat.id, config.ADMIN_IDS)) {
        ctx.reply(locale.invalid_cmd(ctx.message.text || ''), { parse_mode: 'Markdown' }).catch(() => {});
        return;
    }
    showAdminDashboard(ctx, false);
});

bot.on('photo', async (ctx) => {
    handlePhoto(ctx, bot, (ctx) => {
        db.userSessions[ctx.chat.id].step = 'AWAITING_ANIMATION_TEXT';
        saveDB();
        ctx.reply(locale.session_started(), Markup.inlineKeyboard([[Markup.button.callback("🔙 পেছনে যান", 'menu_makelink')]]));
    });
});

bot.on('text', async (ctx) => {
    const userId = ctx.chat.id;
    const session = db.userSessions[userId];
    const text = ctx.message.text.trim();
    
    if (session?.step === 'AWAITING_ANIMATION_TEXT') {
        const lines = text.split(/[\n,]+/).map(l => l.trim()).filter(l => l.length > 0);
        db.userSessions[userId].animations = lines;
        db.userSessions[userId].step = 'AWAITING_LETTER_TEXT';
        saveDB();
        return ctx.reply(locale.input_anim_success(lines.length));
    }
    
    if (session?.step === 'AWAITING_LETTER_TEXT') {
        return processFinalLinkCreation(ctx, text, bot);
    }
});

app.post('/api/get-content', async (req, res) => {
    const { handleGetContent } = require('./modules/api');
    const result = await handleGetContent(req, bot);
    res.json(result);
});

app.get('/love/:id', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    bot.launch().catch(err => console.error(err));
    console.log(`Server running on port ${PORT}`);
});
