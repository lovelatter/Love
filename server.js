const express = require('express');
const path = require('path');
const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');
const https = require('https');
const { db, saveDB } = require('./modules/db');
const { locale, AUTOMATIC_MUSIC_MAPPING, CATEGORY_CONFIGS } = require('./modules/locale');
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
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const bot = new Telegraf(TELEGRAM_TOKEN);
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
        if (ctx.callbackQuery) { ctx.answerCbQuery().catch(() => {}); return ctx.editMessageText(locale.maint_msg, maintKeyboard).catch(() => {}); }
        return ctx.reply(locale.maint_msg, maintKeyboard).catch(() => {});
    }
    return next();
});

const sendMainMenu = (ctx, isEdit = false) => {
    const fullName = `${ctx.from?.first_name || ""} ${ctx.from?.last_name || ""}`.trim() || "ব্যবহারকারী";
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback(locale.btn_make, 'menu_makelink')],
        [Markup.button.callback(locale.btn_feedback, 'menu_feedback'), Markup.button.callback(locale.btn_help, 'menu_help')]
    ]);
    if (isEdit) return ctx.editMessageText(locale.welcome(fullName), { reply_markup: keyboard.reply_markup, parse_mode: 'Markdown' }).catch(() => {});
    return ctx.reply(locale.welcome(fullName), { reply_markup: keyboard.reply_markup, parse_mode: 'Markdown' }).catch(() => {});
};

bot.command('start', (ctx) => { delete db.userSessions[ctx.chat.id]; saveDB(); sendMainMenu(ctx, false); });
bot.command(['admin', 'adm'], (ctx) => {
    if (!isAdmin(ctx.chat.id)) { ctx.reply(locale.invalid_cmd(ctx.message.text || ''), { parse_mode: 'Markdown' }); return ctx.reply(locale.help_text, Markup.inlineKeyboard([[Markup.button.callback(locale.btn_back, 'go_to_main_menu')]])); }
    showAdminDashboard(ctx, false);
});

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

bot.action('adm_toggle_maint', (ctx) => { if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery(); db.isMaintenanceMode = !db.isMaintenanceMode; saveDB(); ctx.answerCbQuery(`Maintenance: ${db.isMaintenanceMode}`); showAdminDashboard(ctx, true); });
bot.action('adm_broadcast', (ctx) => { if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery(); ctx.answerCbQuery(); db.userSessions[ctx.chat.id] = { step: 'AWAITING_ADMIN_BROADCAST_MSG' }; saveDB(); ctx.reply("📢 Announcement মেসেজটি পাঠান:", Markup.inlineKeyboard([[Markup.button.callback("❌ বাতিল", "adm_back_to_dashboard")]])); });
bot.action('adm_all_links_menu', (ctx) => { if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery(); ctx.answerCbQuery(); ctx.editMessageText("🔗 All Links Management:", Markup.inlineKeyboard([[Markup.button.callback("📜 View", "adm_view_links_list")], [Markup.button.callback("💥 Delete All", "adm_delete_all_links_confirm")], [Markup.button.callback("🔙 ব্যাক", "adm_back_to_dashboard")]])); });
bot.action('adm_view_links_list', (ctx) => { if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery(); ctx.answerCbQuery(); const keys = Object.keys(db.linkDatabase); if (!keys.length) return ctx.editMessageText("ℹ️ খালি।", Markup.inlineKeyboard([[Markup.button.callback("🔙 ব্যাক", "adm_all_links_menu")]])); ctx.reply("📜 তালিকা:"); keys.forEach(key => ctx.reply(`🔗 Link ID: ${key}`, Markup.inlineKeyboard([[Markup.button.callback(`❌ Delete`, `adm_instant_del_${key}`)]]))); });
bot.action(/^adm_instant_del_(.+)$/, (ctx) => { if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery(); const targetKey = ctx.match[1]; if (db.linkDatabase[targetKey]) { if (db.linkDatabase[targetKey].imagePath) { const p = path.join(__dirname, db.linkDatabase[targetKey].imagePath); if (fs.existsSync(p)) fs.unlinkSync(p); } delete db.linkDatabase[targetKey]; saveDB(); ctx.answerCbQuery("✅ ডিলিট করা হয়েছে।"); ctx.editMessageText("❌ ডিলিট হয়েছে।").catch(() => {}); } });
bot.action('adm_delete_all_links_confirm', (ctx) => { if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery(); ctx.answerCbQuery(); Object.keys(db.linkDatabase).forEach(key => { if (db.linkDatabase[key].imagePath) { const p = path.join(__dirname, db.linkDatabase[key].imagePath); if (fs.existsSync(p)) fs.unlinkSync(p); } }); db.linkDatabase = {}; saveDB(); ctx.editMessageText("💥 সব ডিলিট হয়েছে!", Markup.inlineKeyboard([[Markup.button.callback("🔙 ব্যাক", "adm_all_links_menu")]])); });
bot.action('adm_ban_menu', (ctx) => { if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery(); ctx.answerCbQuery(); db.userSessions[ctx.chat.id] = { step: 'AWAITING_BAN_USER_INPUT' }; saveDB(); ctx.reply(`🚫 ব্যান মেনু. ID বা Username পাঠান:`, Markup.inlineKeyboard([[Markup.button.callback("❌ বাতিল", "adm_back_to_dashboard")]])); });
bot.action('adm_back_to_dashboard', (ctx) => { if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery(); ctx.answerCbQuery(); delete db.userSessions[ctx.chat.id]; saveDB(); showAdminDashboard(ctx, true); });
bot.action('go_to_main_menu', (ctx) => { ctx.answerCbQuery(); sendMainMenu(ctx, true); });
bot.action('menu_makelink', (ctx) => { ctx.answerCbQuery(); ctx.editMessageText(locale.choose_cat, Markup.inlineKeyboard([[Markup.button.callback(locale.cat_love, 'make_love')], [Markup.button.callback(locale.cat_birthday, 'make_birthday')], [Markup.button.callback(locale.cat_sorry, 'make_sorry')], [Markup.button.callback(locale.cat_eid, 'make_eid')], [Markup.button.callback(locale.btn_back, 'go_to_main_menu')]])); });
bot.action(/^make_/, (ctx) => { ctx.answerCbQuery(); const cat = ctx.match.input.replace('make_', ''); db.userSessions[ctx.chat.id] = { type: cat, name: `${ctx.from.first_name || ""} ${ctx.from.last_name || ""}`.trim() || "User", username: ctx.from.username ? `@${ctx.from.username}` : "None", music: AUTOMATIC_MUSIC_MAPPING[cat] || "", imageUrl: null, step: 'AWAITING_COUNTDOWN_SELECTION' }; saveDB(); showCountdownPrompt(ctx); });

function showCountdownPrompt(ctx) { ctx.editMessageText(locale.prompt_countdown_ask, Markup.inlineKeyboard([[Markup.button.callback(locale.btn_no_countdown, 'timer_no')], [Markup.button.callback('🕒 ৩ মি', 'set_time_3'), Markup.button.callback('🕒 ৫ মি', 'set_time_5')], [Markup.button.callback('🕒 ১০ মি', 'set_time_10')], [Markup.button.callback("🔙 ব্যাক", 'menu_makelink')]])).catch(() => {}); }
bot.action('timer_no', (ctx) => { ctx.answerCbQuery(); if (!db.userSessions[ctx.chat.id]) db.userSessions[ctx.chat.id] = {}; db.userSessions[ctx.chat.id].pendingMinutes = null; saveDB(); showImageUploadPrompt(ctx); });
bot.action(/^set_time_/, (ctx) => { ctx.answerCbQuery(); const userId = ctx.chat.id; if (!db.userSessions[userId]) db.userSessions[userId] = {}; db.userSessions[userId].pendingMinutes = parseInt(ctx.match.input.replace('set_time_', ''), 10); saveDB(); showImageUploadPrompt(ctx); });
function showImageUploadPrompt(ctx) { const userId = ctx.chat.id; if (!db.userSessions[userId]) db.userSessions[userId] = {}; db.userSessions[userId].step = 'AWAITING_IMAGE_UPLOAD'; saveDB(); ctx.editMessageText(locale.prompt_image_ask, Markup.inlineKeyboard([[Markup.button.callback(locale.btn_skip_image, 'skip_image_upload')], [Markup.button.callback("🔙 ব্যাক", 'menu_makelink')]])).catch(() => {}); }
bot.action('skip_image_upload', (ctx) => { ctx.answerCbQuery(); if (db.userSessions[ctx.chat.id]) db.userSessions[ctx.chat.id].imageUrl = null; showAnimationIntro(ctx); });
function showAnimationIntro(ctx) { db.userSessions[ctx.chat.id].step = 'AWAITING_ANIMATION_TEXT'; saveDB(); const text = locale.session_started(); ctx.editMessageText(text, Markup.inlineKeyboard([[Markup.button.callback("🔙 ব্যাক", 'menu_makelink')]])).catch(() => {}); }
bot.action('menu_feedback', (ctx) => { ctx.answerCbQuery(); db.userSessions[ctx.chat.id] = { step: 'AWAITING_USER_FEEDBACK' }; saveDB(); ctx.reply(locale.feedback_prompt); });
bot.action('menu_help', (ctx) => { ctx.answerCbQuery(); ctx.reply(locale.help_text, Markup.inlineKeyboard([[Markup.button.callback(locale.btn_back, 'go_to_main_menu')]])); });
bot.action(/^delete_link_(.+)$/, (ctx) => { const linkId = ctx.match[1]; const data = db.linkDatabase[linkId]; if (!data) return ctx.answerCbQuery("⚠️ ডিলিট হয়েছে।", { show_alert: true }); if (Number(data.userId) !== Number(ctx.chat.id)) return ctx.answerCbQuery("❌ পারমিশন নেই।", { show_alert: true }); if (data.imagePath) { const p = path.join(__dirname, data.imagePath); if (fs.existsSync(p)) fs.unlinkSync(p); } delete db.linkDatabase[linkId]; saveDB(); ctx.editMessageText("❌ ডিলিট হয়েছে।"); sendMainMenu(ctx, false); });
bot.action(/^view_ans_(.+)$/, (ctx) => { if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery(); const data = db.linkDatabase[ctx.match[1]]; return ctx.answerCbQuery(data?.answer ? `📩 উত্তর: ${data.answer}` : "⏳ উত্তর নেই!", { show_alert: true }); });
bot.action(/^view_vi_(.+)$/, async (ctx) => { if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery(); const data = db.linkDatabase[ctx.match[1]]; if (!data) return ctx.answerCbQuery("⚠️ লিঙ্ক নেই।", { show_alert: true }); ctx.answerCbQuery(); if (!data.visitors?.length) return ctx.reply("ℹ️ ভিজিটর নেই।"); let report = `👤 ভিজিটর:\n`; data.visitors.forEach((v, i) => report += `${i+1}. 🕒 ${v.time} | 🌐 ${v.ip} | 🌍 ${v.country}\n`); ctx.reply(report); });

bot.on('photo', async (ctx) => {
    const userId = ctx.chat.id;
    if (db.userSessions[userId]?.step === 'AWAITING_IMAGE_UPLOAD') {
        const msg = await ctx.reply("⏳ আপলোড হচ্ছে...").catch(() => null);
        try {
            const fileId = ctx.message.photo.pop().file_id;
            const link = (await bot.telegram.getFileLink(fileId)).href;
            const filename = `img_${Date.now()}.jpg`;
            const p = path.join(UPLOADS_DIR, filename);
            https.get(link, (res) => { res.pipe(fs.createWriteStream(p)).on('finish', () => { db.userSessions[userId].imageUrl = `/uploads/${filename}`; saveDB(); if(msg) bot.telegram.editMessageText(userId, msg.message_id, null, "✅ সফল।"); showAnimationIntro(ctx); }); });
        } catch (e) { if(msg) bot.telegram.editMessageText(userId, msg.message_id, null, "⚠️ ত্রুটি।"); }
    }
});

bot.on('text', async (ctx) => {
    const userId = ctx.chat.id; const session = db.userSessions[userId]; const text = ctx.message.text.trim();
    if (session?.step === 'AWAITING_USER_FEEDBACK') { if(text.length < 5) return ctx.reply(locale.feedback_short); ADMIN_IDS.forEach(id => bot.telegram.sendMessage(id, `📝 Feedback from ${userId}: ${text}`)); delete db.userSessions[userId]; saveDB(); return ctx.reply(locale.feedback_success); }
    if (isAdmin(userId) && session?.step === 'AWAITING_ADMIN_BROADCAST_MSG') { db.registeredUsers.forEach(id => bot.telegram.sendMessage(id, text).catch(() => {})); delete db.userSessions[userId]; saveDB(); return showAdminDashboard(ctx, false); }
    if (isAdmin(userId) && session?.step === 'AWAITING_BAN_USER_INPUT') { let id = parseInt(text) || db.usernameMap[text.replace('@', '').toLowerCase()]; if (!id) return ctx.reply("❌ খুঁজে পাইনি।"); if (db.bannedUsers.includes(id)) db.bannedUsers = db.bannedUsers.filter(x => x !== id); else db.bannedUsers.push(id); delete db.userSessions[userId]; saveDB(); return showAdminDashboard(ctx, false); }
    if (session?.step === 'AWAITING_ANIMATION_TEXT') { const lines = text.split(/[\n,]+/).filter(l => l.trim()); if(!lines.length) return ctx.reply("⚠️ কিছু লিখুন।"); db.userSessions[userId].animations = lines; db.userSessions[userId].step = 'AWAITING_LETTER_TEXT'; saveDB(); return ctx.reply(locale.input_anim_success(lines.length)); }
    if (session?.step === 'AWAITING_LETTER_TEXT') return processFinalLinkCreation(ctx, text);
    ctx.reply(locale.help_text, Markup.inlineKeyboard([[Markup.button.callback(locale.btn_back, 'go_to_main_menu')]]));
});

function processFinalLinkCreation(ctx, letterText) {
    const userId = ctx.chat.id; const session = db.userSessions[userId];
    db.totalLinksCreated++;
    let target = null; if (session.pendingMinutes) { target = new Date(); target.setMinutes(target.getMinutes() + session.pendingMinutes); }
    const id = Math.random().toString(36).substring(2, 9);
    db.linkDatabase[id] = { userId, name: session.name, type: session.type, music: session.music, countdown: target ? target.toISOString() : null, animations: session.animations, letter: letterText, imagePath: session.imageUrl, visitors: [] };
    ctx.reply(`✅ লিংক তৈরি হয়েছে: \`${SERVER_URL}/love/${id}\``, { parse_mode: 'Markdown' });
    delete db.userSessions[userId]; saveDB();
}

app.post('/api/get-content', async (req, res) => {
    const data = db.linkDatabase[req.body.id];
    if (!data) return res.json({ success: false });
    const { os, browser } = parseUserAgent(req.headers['user-agent']);
    data.visitors.push({ time: new Date().toLocaleString(), ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress, os, browser });
    saveDB();
    if (data.countdown && new Date(data.countdown) > new Date()) return res.json({ success: true, isLocked: true, countdownTime: data.countdown });
    const cfg = CATEGORY_CONFIGS[data.type] || CATEGORY_CONFIGS['love'];
    res.json({ success: true, isLocked: false, title: cfg.title, music: data.music, animations: data.animations, letter: data.letter, emojis: cfg.emojis, question: cfg.question, buttons: cfg.buttons, image: data.imagePath ? `${SERVER_URL}${data.imagePath}` : null });
});

app.post('/api/submit-answer', async (req, res) => {
    const data = db.linkDatabase[req.body.id];
    if (!data) return res.json({ success: false });
    data.answer = req.body.answer; saveDB();
    bot.telegram.sendMessage(data.userId, `📩 উত্তর এসেছে: ${req.body.answer}`).catch(() => {});
    res.json({ success: true });
});

app.get('/love/:id', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { bot.launch(); console.log(`Server: ${PORT}`); });
```[span_0](start_span)[span_0](end_span)
