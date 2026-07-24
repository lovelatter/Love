const { Markup } = require('telegraf');

const feedmsg = {
    prompt: "📝 মতামত ও রিপোর্ট:\n\nঅ্যাডমিনের কাছে কোনো রিপোর্ট, নতুন আপডেটের আইডিয়া বা অন্য কোনো কিছু বলার থাকলে আপনার মেসেজটি এখানে লিখে পাঠিয়ে দিন:",
    success: "✅ আপনার মেসেজটি অ্যাডমিনের কাছে সফলভাবে পাঠানো হয়েছে[span_0](start_span)[span_0](end_span).",
    feedback_short: "❌ মেসেজটি একটু বিস্তারিত লিখুন (কমপক্ষে ৫টি অক্ষর)[span_1](start_span)[span_1](end_span)."
};

function handleFeedbackStart(ctx, db, saveDB) {
    ctx.answerCbQuery();
    const userId = ctx.chat.id;
    if (!db.userSessions[userId]) db.userSessions[userId] = {};
    db.userSessions[userId].step = 'AWAITING_USER_FEEDBACK';
    db.userSessions[userId].feedbackWarningMsgId = null;
    
    ctx.editMessageText(feedmsg.prompt, Markup.inlineKeyboard([[Markup.button.callback("🔙 পিছনে যান", 'go_to_main_menu')]])).then((sentMsg) => {
        db.userSessions[userId].feedbackPromptMsgId = sentMsg.message_id;
        saveDB();
    }).catch(() => {
        ctx.reply(feedmsg.prompt, Markup.inlineKeyboard([[Markup.button.callback("🔙 পিছনে যান", 'go_to_main_menu')]])).then((sentMsg) => {
            db.userSessions[userId].feedbackPromptMsgId = sentMsg.message_id;
            saveDB();
        }).catch(() => {});
    });
}

function handleFeedbackInput(ctx, db, saveDB, bot, ADMIN_IDS, locale) {
    const userId = ctx.chat.id;
    const text = ctx.message.text.trim();
    
    if (text.length < 5) return ctx.reply(feedmsg.feedback_short);
    
    const fullName = `${ctx.from?.first_name || ""} ${ctx.from?.last_name || ""}`.trim() || "User";
    const userName = ctx.from?.username ? `@${ctx.from.username}` : "None";
    const adminMsg = `📝 Feedback\nName: ${fullName}\nID: ${userId}\nUsername: ${userName}\n\n${text}`;
    
    ADMIN_IDS.forEach(id => {
        bot.telegram.sendMessage(id, adminMsg).catch(() => {});
    });
    
    delete db.userSessions[userId];
    saveDB();
    const backBtnText = locale?.btn_back || "🔙 পিছনে যান";
    return ctx.reply(feedmsg.success, Markup.inlineKeyboard([[Markup.button.callback(backBtnText, 'go_to_main_menu')]]));
}

function setupFeedbackActions(bot, db, saveDB) {
    bot.action('menu_feedback', (ctx) => {
        handleFeedbackStart(ctx, db, saveDB);
    });
}

module.exports = { handleFeedbackStart, handleFeedbackInput, setupFeedbackActions, feedmsg };
