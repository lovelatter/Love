const { Markup } = require('telegraf');

const COUNTDOWN_CONFIG = {
    prompt: "⏰ টাইম কাউন্টডাউন সেট করুন।",
    btn_no: "❌ No Countdown"
};

function showCountdownPrompt(ctx, db, saveDB, showImageUploadPrompt) {
    ctx.editMessageText(COUNTDOWN_CONFIG.prompt, Markup.inlineKeyboard([
        [Markup.button.callback(COUNTDOWN_CONFIG.btn_no, 'timer_no')],
        [Markup.button.callback('🕒 ৩ মিনিট', 'set_time_3'), Markup.button.callback('🕒 ৫ মিনিট', 'set_time_5')],
        [Markup.button.callback('🕒 ১০ মিনিট', 'set_time_10')],
        [Markup.button.callback("🔙 পেছনে যান", 'menu_makelink')]
    ]), { parse_mode: 'Markdown' }).catch(() => {});
}

function handleTimerNo(ctx, db, saveDB, showImageUploadPrompt) {
    ctx.answerCbQuery();
    if (!db.userSessions[ctx.chat.id]) db.userSessions[ctx.chat.id] = {};
    db.userSessions[ctx.chat.id].pendingMinutes = null;
    saveDB();
    showImageUploadPrompt(ctx);
}

function handleSetTime(ctx, db, saveDB, showImageUploadPrompt) {
    ctx.answerCbQuery();
    const userId = ctx.chat.id;
    if (!db.userSessions[userId]) db.userSessions[userId] = {};
    const minutes = parseInt(ctx.match.input.replace('set_time_', ''), 10);
    db.userSessions[userId].pendingMinutes = minutes;
    saveDB();
    showImageUploadPrompt(ctx);
}

module.exports = { showCountdownPrompt, handleTimerNo, handleSetTime, COUNTDOWN_CONFIG };
