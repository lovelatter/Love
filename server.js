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

// Middleware
bot.use(async (ctx, next) => {
    const userId = ctx.chat?.id;
    if (!userId) return;
    if (!db.registeredUsers.includes(userId)) db.registeredUsers.push(userId);
    if (ctx.from?.username) db.usernameMap[ctx.from.username.toLowerCase()] = userId;
    saveDB();
    if (isAdmin(userId, config.ADMIN_IDS)) return next();
    if (db.bannedUsers.includes(userId)) return;
    if (db.isMaintenanceMode) {
        if (ctx.callbackQuery?.data === 'menu_feedback') return next();
        const maintKeyboard = Markup.inlineKeyboard([[Markup.button.callback(locale.btn_feedback, 'menu_feedback')]]);
        return ctx.reply(locale.maint_msg, maintKeyboard).catch(() => {});
    }
    return next();
});

// Commands
bot.command('start', (ctx) => { 
    delete db.userSessions[ctx.chat.id];
    saveDB();
    sendMainMenu(ctx, false); 
});

bot.command(['admin', 'adm'], (ctx) => {
    if (isAdmin(ctx.chat.id, config.ADMIN_IDS)) showAdminDashboard(ctx, false);
});

// Action Handlers (Buttons)
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

bot.action('go_to_main_menu', (ctx) => { ctx.answerCbQuery(); sendMainMenu(ctx, true); });

bot.action('menu_feedback', (ctx) => { 
    ctx.answerCbQuery(); 
    db.userSessions[ctx.chat.id] = { step: 'AWAITING_USER_FEEDBACK' }; 
    saveDB(); 
    ctx.reply(locale.feedback_prompt); 
});

bot.action('menu_help', (ctx) => { 
    ctx.answerCbQuery(); 
    ctx.reply(locale.help_text, Markup.inlineKeyboard([[Markup.button.callback(locale.btn_back, 'go_to_main_menu')]]), { parse_mode: 'Markdown' }); 
});

bot.action(/^make_/, (ctx) => {
    ctx.answerCbQuery();
    const cat = ctx.match.input.replace('make_', '');
    db.userSessions[ctx.chat.id] = { 
        type: cat, 
        name: `${ctx.from.first_name || ""} ${ctx.from.last_name || ""}`.trim() || "User",
        step: 'AWAITING_IMAGE_UPLOAD'
    };
    saveDB();
    ctx.editMessageText(locale.prompt_image_ask, Markup.inlineKeyboard([
        [Markup.button.callback(locale.btn_skip_image, 'skip_image_upload')]
    ]));
});

bot.action('skip_image_upload', (ctx) => {
    ctx.answerCbQuery();
    db.userSessions[ctx.chat.id].step = 'AWAITING_ANIMATION_TEXT';
    saveDB();
    ctx.editMessageText(locale.session_started());
});

// Photo & Text Handler
bot.on('photo', async (ctx) => {
    handlePhoto(ctx, bot, (ctx) => {
        db.userSessions[ctx.chat.id].step = 'AWAITING_ANIMATION_TEXT';
        saveDB();
        ctx.reply(locale.session_started());
    });
});

bot.on('text', async (ctx) => {
    const userId = ctx.chat.id;
    const session = db.userSessions[userId];
    const text = ctx.message.text.trim();
    
    if (session?.step === 'AWAITING_ANIMATION_TEXT') {
        db.userSessions[userId].animations = text.split(/[\n,]+/);
        db.userSessions[userId].step = 'AWAITING_LETTER_TEXT';
        saveDB();
        return ctx.reply(locale.input_anim_success(db.userSessions[userId].animations.length));
    }
    if (session?.step === 'AWAITING_LETTER_TEXT') {
        return processFinalLinkCreation(ctx, text, bot);
    }
    if (session?.step === 'AWAITING_USER_FEEDBACK') {
        delete db.userSessions[userId];
        saveDB();
        return ctx.reply(locale.feedback_success);
    }
});

// API
app.post('/api/get-content', async (req, res) => {
    const { handleGetContent } = require('./modules/api');
    res.json(await handleGetContent(req, bot));
});

app.get('/love/:id', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    bot.launch();
    console.log(`Server running on port ${PORT}`);
});
