const { Markup } = require('telegraf');

const locale = {
    prompt_countdown_ask: "⏰ কাউন্টডাউন টাইমার সেট করুন।",
    btn_no_countdown: "❌ কাউন্টডাউন ছাড়া"
};

function showCountdownPrompt(ctx, db, saveDB, showImageUploadPrompt) {
    ctx.editMessageText(locale.prompt_countdown_ask, Markup.inlineKeyboard([
        [Markup.button.callback(locale.btn_no_countdown, 'timer_no')],
        [Markup.button.callback('🕒 ২ মিনিট', 'set_time_2'), Markup.button.callback('🕒 ৫ মিনিট', 'set_time_5')],
        [Markup.button.callback('🕒 ১০ মিনিট', 'set_time_10'), Markup.button.callback('🕒 ২০ মিনিট', 'set_time_20')],
        [Markup.button.callback("🔙 Back", 'menu_makelink')]
    ]), { parse_mode: 'Markdown' }).catch(() => {});
}

function setupCountdownActions(bot, db, saveDB, showMusicUploadPrompt) {
    bot.action('timer_no', async (ctx) => { 
        ctx.answerCbQuery(); 
        if (!db.userSessions[ctx.chat.id]) db.userSessions[ctx.chat.id] = {};
        db.userSessions[ctx.chat.id].pendingMinutes = null; 
        await saveDB();
        showMusicUploadPrompt(ctx, db, saveDB, null); 
    });

    bot.action(/^set_time_/, async (ctx) => {
        ctx.answerCbQuery();
        const userId = ctx.chat.id;
        if (!db.userSessions[userId]) db.userSessions[userId] = {};
        db.userSessions[userId].pendingMinutes = parseInt(ctx.match.input.replace('set_time_', ''), 10);
        await saveDB();
        showMusicUploadPrompt(ctx, db, saveDB, null);
    });
}

module.exports = { showCountdownPrompt, setupCountdownActions, locale };
