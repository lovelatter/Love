const { Markup } = require('telegraf');

const feedmsg = {
    prompt: "📝 মতামত ও রিপোর্ট:\n\nঅ্যাডমিনের কাছে কোনো রিপোর্ট, নতুন আপডেটের আইডিয়া বা অন্য কোনো কিছু বলার থাকলে আপনার মেসেজটি এখানে লিখে পাঠিয়ে দিন:",
    success: "✅ আপনার মেসেজটি অ্যাডমিনের কাছে সফলভাবে পাঠানো হয়েছে।",
    feedback_short: "❌ মেসেজটি একটু বিস্তারিত লিখুন (কমপক্ষে ৫টি অক্ষর)।"
};

async function handleFeedbackStart(ctx, db, saveDB) {
    await ctx.answerCbQuery().catch(() => {});
    const userId = ctx.chat.id;
    if (!db.userSessions[userId]) db.userSessions[userId] = {};
    db.userSessions[userId].step = 'AWAITING_USER_FEEDBACK';
    db.userSessions[userId].feedbackWarningMsgId = null;
    
    try {
        const sentMsg = await ctx.editMessageText(feedmsg.prompt, Markup.inlineKeyboard([[Markup.button.callback("🔙 পিছনে যান", 'go_to_main_menu')]]));
        db.userSessions[userId].feedbackPromptMsgId = sentMsg.message_id;
        await saveDB().catch(() => {});
    } catch {
        const sentMsg = await ctx.reply(feedmsg.prompt, Markup.inlineKeyboard([[Markup.button.callback("🔙 পিছনে যান", 'go_to_main_menu')]]));
        db.userSessions[userId].feedbackPromptMsgId = sentMsg.message_id;
        await saveDB().catch(() => {});
    }
}

async function handleFeedbackText(ctx, db, saveDB, bot, ADMIN_IDS) {
    const userId = ctx.chat.id;
    const session = db.userSessions[userId];
    const text = ctx.message?.text?.trim() || "";

    if (text.length < 5) {
        await ctx.deleteMessage().catch(() => {});
        if (session.feedbackWarningMsgId) {
            await bot.telegram.deleteMessage(userId, session.feedbackWarningMsgId).catch(() => {});
        }
        const warnMsg = await ctx.reply("⚠️ অনুগ্রহ করে অন্তত ৫ অক্ষরের বেশি মতামত দিন.").catch(() => null);
        if (warnMsg) {
            db.userSessions[userId].feedbackWarningMsgId = warnMsg.message_id;
            await saveDB().catch(() => {});
        }
        return true;
    } else {
        if (session.feedbackWarningMsgId) {
            await bot.telegram.deleteMessage(userId, session.feedbackWarningMsgId).catch(() => {});
        }
        if (session.feedbackPromptMsgId) {
            await bot.telegram.deleteMessage(userId, session.feedbackPromptMsgId).catch(() => {});
        }
        await ctx.deleteMessage().catch(() => {});
        
        const fullName = `${ctx.from?.first_name || ""} ${ctx.from?.last_name || ""}`.trim() || "User";
        const userName = ctx.from?.username ? `@${ctx.from.username}` : "None";
        const adminMsg = `📝 Feedback\nName: ${fullName}\nID: ${userId}\nUsername: ${userName}\n\n${text}`;
        
        ADMIN_IDS.forEach(id => {
            bot.telegram.sendMessage(id, adminMsg).catch(() => {});
        });
        
        delete db.userSessions[userId];
        await saveDB().catch(() => {});
        await ctx.reply(feedmsg.success, Markup.inlineKeyboard([[Markup.button.callback("🔙 Back", 'go_to_main_menu')]])).catch(() => {});
        return true;
    }
}

function setupFeedbackActions(bot, db, saveDB, ADMIN_IDS) {
    bot.action('menu_feedback', (ctx) => {
        handleFeedbackStart(ctx, db, saveDB);
    });
}

module.exports = { handleFeedbackStart, handleFeedbackText, setupFeedbackActions, feedmsg };
