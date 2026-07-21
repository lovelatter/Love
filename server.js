const express = require('express');
const { Telegraf, Markup } = require('telegraf');

const { db, loadDB, saveDB } = require('./modules/db');
const { handlePhotoUpload } = require('./modules/photo');
const { handleAudioUpload } = require('./modules/music');
const { setupAdmin } = require('./modules/admin');
const { locale } = require('./modules/locale');
const { setupHandlers, showAnimationIntro } = require('./modules/handlers');
const { setupRoutes } = require('./modules/routes');

const app = express();
app.use(express.json());
app.set('trust proxy', true);

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const ADMIN_IDS = (process.env.ADMIN_CHAT_ID || "").split(',').map(id => id.trim()).filter(id => id !== "");

const isAdmin = (userId) => ADMIN_IDS.includes(userId.toString());

const SERVER_URL = "https://love-bb7p.onrender.com";

const gh_url = "https://raw.githubusercontent.com/lovelatter/Love/main";

const music_set = {
    love: `${gh_url}/love.mp3`,
    birthday: `${gh_url}/bd.mp3`,
    sorry: `${gh_url}/sorry.mp3`,
    eid: `${gh_url}/eid.mp3`
};

const bot = new Telegraf(TELEGRAM_TOKEN);

bot.use(async (ctx, next) => {
    const userId = ctx.chat?.id;
    if (!userId) return;
    if (!db.registeredUsers.includes(userId)) db.registeredUsers.push(userId);
    if (ctx.from?.username) db.usernameMap[ctx.from.username.toLowerCase()] = userId;
    await saveDB();
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

setupAdmin(bot, db, saveDB, isAdmin, __dirname, locale);

setupHandlers(bot, db, saveDB, isAdmin, ADMIN_IDS, SERVER_URL, music_set);

bot.on('audio', (ctx) => handleAudioUpload(ctx, bot, db, saveDB, () => {}, locale));
bot.on('photo', (ctx) => handlePhotoUpload(ctx, bot, db, saveDB, (c) => showAnimationIntro(c, db, saveDB)));

setupRoutes(app, db, saveDB, bot);

const PORT = process.env.PORT || 3000;

loadDB().then(() => {
    app.listen(PORT, () => {
        bot.launch().catch(err => console.error(err));
        console.log(`Server running on port ${PORT}`);
    });
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
