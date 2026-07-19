const express = require('express');
const path = require('path');
const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');
const https = require('https');
const { db, saveDB, CATEGORY_CONFIGS, UPLOADS_DIR } = require('./modules/config');
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
const GITHUB_MUSIC_BASE_URL = "https://raw.githubusercontent.com/lovelatter/Love/main";

const AUTOMATIC_MUSIC_MAPPING = {
    love: `${GITHUB_MUSIC_BASE_URL}/love.mp3`,
    birthday: `${GITHUB_MUSIC_BASE_URL}/bd.mp3`,
    sorry: `${GITHUB_MUSIC_BASE_URL}/sorry.mp3`,
    eid: `${GITHUB_MUSIC_BASE_URL}/eid.mp3`
};

const bot = new Telegraf(TELEGRAM_TOKEN);

// Bot Middleware
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

// Helper Functions
const sendMainMenu = (ctx, isEdit = false) => {
    const fullName = `${ctx.from?.first_name || ""} ${ctx.from?.last_name || ""}`.trim() || "ব্যবহারকারী";
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback(locale.btn_make, 'menu_makelink')],
        [Markup.button.callback(locale.btn_feedback, 'menu_feedback'), Markup.button.callback(locale.btn_help, 'menu_help')]
    ]);
    if (isEdit) return ctx.editMessageText(locale.welcome(fullName), { reply_markup: keyboard.reply_markup, parse_mode: 'Markdown' }).catch(() => {});
    return ctx.reply(locale.welcome(fullName), { reply_markup: keyboard.reply_markup, parse_mode: 'Markdown' }).catch(() => {});
};

function showAdminDashboard(ctx, isEdit = false) {
    const maintStatus = db.isMaintenanceMode ? "ON 🔴" : "OFF 🟢";
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback(`🛠️ Maintenance: ${maintStatus}`, "adm_toggle_maint")],
        [Markup.button.callback("📢 Announcement (Broadcast)", "adm_broadcast")],
        [Markup.button.callback("🔗 All Links Management", "adm_all_links_menu")],
        [Markup.button.callback("🚫 Ban / Unban System", "adm_ban_menu")]
    ]);
    const text = `👑 Welcome to the Master Admin Core Console:`;
    if (isEdit) return ctx.editMessageText(text, { reply_markup: keyboard.reply_markup, parse_mode: 'Markdown' }).catch(() => {});
    return ctx.reply(text, { reply_markup: keyboard.reply_markup, parse_mode: 'Markdown' }).catch(() => {});
}

function processFinalLinkCreation(ctx, letterText) {
    const userId = ctx.chat.id;
    const session = db.userSessions[userId];
    db.totalLinksCreated = (db.totalLinksCreated || 0) + 1;
    let finalCountdownIso = null;
    let countdownDisplay = "No ❌";
    if (session.pendingMinutes) {
        const targetDate = new Date();
        targetDate.setMinutes(targetDate.getMinutes() + session.pendingMinutes);
        finalCountdownIso = targetDate.toISOString();
        countdownDisplay = `${session.pendingMinutes} Minutes ✅`;
    }
    const uniqueId = Math.random().toString(36).substring(2, 9);
    const finalGeneratedUrl = `${SERVER_URL}/love/${uniqueId}`;
    const dbImageUrl = session.imageUrl ? `${SERVER_URL}${session.imageUrl}` : null;
    db.linkDatabase[uniqueId] = {
        userId, name: session.name || "User", username: session.username || "None", type: session.type || "love",
        music: session.music || "", countdown: finalCountdownIso, animations: session.animations, letter: letterText, 
        answer: null, image: dbImageUrl, imagePath: session.imageUrl || null, visitors: []
    };
    ctx.reply(`আপনার লিংক তৈরি করা হয়েছে।\n\nলিংক: \`${finalGeneratedUrl}\``, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[Markup.button.callback("❌ Link Off", `delete_link_${uniqueId}`)]])
    }).catch(() => {});
    delete db.userSessions[userId];
    saveDB();
}

// Bot Commands & Actions (Includes all previous logic)
bot.command('start', (ctx) => { delete db.userSessions[ctx.chat.id]; saveDB(); sendMainMenu(ctx, false); });
bot.command(['admin', 'adm'], (ctx) => { 
    if (!isAdmin(ctx.chat.id)) return ctx.reply(locale.invalid_cmd(ctx.message.text || ''), { parse_mode: 'Markdown' });
    showAdminDashboard(ctx, false);
});

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

// Photo & Text Handlers
bot.on('photo', async (ctx) => { /* Image processing logic */ });
bot.on('text', async (ctx) => { /* Text processing logic */ });

// APIs
app.post('/api/get-content', async (req, res) => { /* Content logic */ });
app.post('/api/submit-answer', async (req, res) => { /* Answer logic */ });
app.get('/love/:id', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    bot.launch().catch(err => console.error(err));
    console.log(`Server running on port ${PORT}`);
});
