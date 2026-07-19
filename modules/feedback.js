const { Markup } = require('telegraf');
2
const FEEDBACK_MESSAGES = {
    prompt: "📝 মতামত ও রিপোর্ট:\n\nঅ্যাডমিনের কাছে কোনো রিপোর্ট, নতুন আপদেশের আইডিয়া বা অন্য কোনো কিছু বলার থাকলে আপনার মেসেজটি নিচে লিখে পাঠিয়ে দিন:",
    short: "❌ মেসেজটি একটু বিস্তারিত লিখুন (কমপক্ষে ৫টি অক্ষর)।",
    success: "✅ আপনার মেসেজটি অ্যাডমিনের কাছে সফলভাবে পাঠানো হয়েছে। ধন্যবাদ!"
};

const handleFeedbackMenu = (ctx, db, saveDB, btn_back) => {
    ctx.answerCbQuery();
    db.userSessions[ctx.chat.id] = { step: 'AWAITING_USER_FEEDBACK' };
    saveDB();
    ctx.reply(FEEDBACK_MESSAGES.prompt);
};

const processFeedbackText = (ctx, text, db, saveDB, ADMIN_IDS, bot, btn_back) => {
    const userId = ctx.chat.id;
    if (text.length < 5) return ctx.reply(FEEDBACK_MESSAGES.short);
    
    const fullName = `${ctx.from?.first_name || ""} ${ctx.from?.last_name || ""}`.trim() || "User";
    const userName = ctx.from?.username ? `@${ctx.from.username}` : "None";
    
    ADMIN_IDS.forEach(id => {
        bot.telegram.sendMessage(id, `📝 Feedback\nName: ${fullName}\nID: ${userId}\nUsername: ${userName}\n\n${text}`).catch(() => {});
    });
    
    delete db.userSessions[userId];
    saveDB();
    return ctx.reply(FEEDBACK_MESSAGES.success, Markup.inlineKeyboard([[Markup.button.callback("🔙 মেইন মেনু", 'go_to_main_menu')]]));
};

module.exports = { handleFeedbackMenu, processFeedbackText, FEEDBACK_MESSAGES };
