const { Markup } = require('telegraf');

const locale = {
    prompt_countdown_ask: "⏰ টাইম কাউন্টডাউন সেট করুন।",
    btn_no_countdown: "❌ No Countdown"
};

function showCountdownPrompt(ctx, db, saveDB, showImageUploadPrompt) {
    ctx.editMessageText(locale.prompt_countdown_ask, Markup.inlineKeyboard([
        [Markup.button.callback(locale.btn_no_countdown, 'timer_no')],
        [Markup.button.callback('🕒 ৩ মিনিট', 'set_time_3'), Markup.button.callback('🕒 ৫ মিনিট', 'set_time_5')],
        [Markup.button.callback('🕒 ১০ মিনিট', 'set_time_10'), Markup.button.callback('🕒 ২০ মিনিট', 'set_time_20')],
        [Markup.button.callback("🔙 পেছনে যান", 'menu_makelink')]
    ]), { parse_mode: 'Markdown' }).catch(() => {});
}

module.exports = { showCountdownPrompt, locale };
