const { Markup } = require('telegraf');

function showCountdownPrompt(ctx, db, saveDB, showImageUploadPrompt) {
    ctx.editMessageText("⏰ কাউন্টডাউন টাইমার সেট করুন।", Markup.inlineKeyboard([
        [Markup.button.callback("❌ কাউন্টডাউন ছাড়া", 'timer_no')],
        [Markup.button.callback('🕒 ১ মিনিট', 'set_time_1'), Markup.button.callback('🕒 ২ মিনিট', 'set_time_2')],
        [Markup.button.callback('🕒 ৫ মিনিট', 'set_time_5'), Markup.button.callback('🕒 ১০ মিনিট', 'set_time_10')]
    ]), { parse_mode: 'Markdown' }).catch(() => {});
}

module.exports = { showCountdownPrompt };
