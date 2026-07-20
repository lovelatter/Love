const { Markup } = require('telegraf');
const feedbackMessages = {
    prompt: "📝 মতামত ও রিপোর্ট:\n\nঅ্যাডমিনের কাছে কোনো রিপোর্ট, নতুন আপদেশের আইডিয়া বা অন্য কোনো কিছু বলার থাকলে আপনার মেসেজটি নিচে লিখে পাঠিয়ে দিন:",
    success: "✅ আপনার মেসেজটি অ্যাডমিনের কাছে সফলভাবে পাঠানো হয়েছে। ধন্যবাদ!"
};

function handleFeedbackStart(ctx, db, saveDB) {
    ctx.answerCbQuery();
    db.userSessions[ctx.chat.id] = { step: 'AWAITING_USER_FEEDBACK' };
    saveDB();
    ctx.reply(feedbackMessages.prompt);
}

function handleFeedbackInput(ctx, db, saveDB, bot, ADMIN_IDS, locale) {
    const userId = ctx.chat.id;
    const text = ctx.message.text.trim();
    
    if (text.length < 5) return ctx.reply(locale.feedback_short);
    
    const fullName = `${ctx.from?.first_name || ""} ${ctx.from?.last_name || ""}`.trim() || "User";
    const userName = ctx.from?.username ? `@${ctx.from.username}` : "None";
    const adminMsg = `📝 Feedback\nName: ${fullName}\nID: ${userId}\nUsername: ${userName}\n\n${text}`;
    
    ADMIN_IDS.forEach(id => {
        bot.telegram.sendMessage(id, adminMsg).catch(() => {});
    });
    
    delete db.userSessions[userId];
    saveDB();
    return ctx.reply(feedbackMessages.success, Markup.inlineKeyboard([[Markup.button.callback(locale.btn_back, 'go_to_main_menu')]]));
}

module.exports = { handleFeedbackStart, handleFeedbackInput };
