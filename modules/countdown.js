const { Markup } = require('telegraf');

function showCountdownPrompt(ctx, db, saveDB, showImageUploadPrompt) {
    ctx.editMessageText("⏰ কাউন্টডাউন টাইমার সেট করুন।", Markup.inlineKeyboard([
        [Markup.button.callback("❌ কাউন্টডাউন ছাড়া", 'timer_no')],
        [Markup.button.callback('🕒 ১ মিনিট', 'set_time_1'), Markup.button.callback('🕒 ২ মিনিট', 'set_time_2')],
        [Markup.button.callback('🕒 ৫ মিনিট', 'set_time_5'), Markup.button.callback('🕒 ১০ মিনিট', 'set_time_10')]
    ]), { parse_mode: 'Markdown' }).catch(() => {});
}

function setupCountdownActions(bot, db, saveDB, showMusicUploadPrompt) {
    bot.action('timer_no', async (ctx) => { 
        ctx.answerCbQuery(); 
        if (!db.userSessions[ctx.chat.id]) db.userSessions[ctx.chat.id] = {};
        db.userSessions[ctx.chat.id].pendingMinutes = null; 
        await saveDB();
        showMusicUploadPrompt(ctx, db, saveDB); 
    });

    bot.action(/^set_time_/, async (ctx) => {
        ctx.answerCbQuery();
        const userId = ctx.chat.id;
        if (!db.userSessions[userId]) db.userSessions[userId] = {};
        db.userSessions[userId].pendingMinutes = parseInt(ctx.match.input.replace('set_time_', ''), 10);
        await saveDB();
        showMusicUploadPrompt(ctx, db, saveDB);
    });
}

module.exports = { showCountdownPrompt, setupCountdownActions };
