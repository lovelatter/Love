const { Markup } = require('telegraf');

const feedmsg = {
    prompt: "📝 মতামত ও রিপোর্ট:\n\nঅ্যাডমিনের কাছে কোনো রিপোর্ট, নতুন আপডেটের আইডিয়া বা অন্য কোনো কিছু বলার থাকলে আপনার মেসেজটি এখানে লিখে পাঠিয়ে দিন:",
    success: "✅ আপনার মেসেজটি অ্যাডমিনের কাছে সফলভাবে পাঠানো হয়েছে।",
    feedback_short: "❌ মেসেজটি একটু বিস্তারিত লিখুন (কমপক্ষে ৫টি অক্ষর)।"
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

async function handleFeedbackText(ctx, db, saveDB, bot, ADMIN_IDS, locale) {
    const userId = ctx.chat.id;
    const session = db.userSessions[userId];
    const text = ctx.message.text.trim();

    if (text.length < 5) {
        await ctx.deleteMessage().catch(() => {});
        if (session.feedbackWarningMsgId) {
            await bot.telegram.deleteMessage(userId, session.feedbackWarningMsgId).catch(() => {});
        }
        const warnMsg = await ctx.reply("⚠️ অনুগ্রহ করে অন্তত ৫ অক্ষরের বেশি মতামত দিন।");
        db.userSessions[userId].feedbackWarningMsgId = warnMsg.message_id;
        await saveDB();
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
        const adminMsg = `📝 নতুন ফিডব্যাক\nনাম: ${fullName}\nআইডি: <code>${userId}</code>\nইউজারনেম: ${userName}\n\nমেসেজ: ${text}`;
        
        const keyboard = Markup.inlineKeyboard([[Markup.button.callback("💬 রিপ্লাই দিন", `admin_reply_${userId}`)]]);
        
        ADMIN_IDS.forEach(id => {
            bot.telegram.sendMessage(id, adminMsg, { parse_mode: 'HTML', reply_markup: keyboard.reply_markup }).catch(() => {});
        });
        
        delete db.userSessions[userId];
        await saveDB();
        const backBtnText = locale?.btn_back || "🔙 পিছনে যান";
        await ctx.reply(feedmsg.success, Markup.inlineKeyboard([[Markup.button.callback(backBtnText, 'go_to_main_menu')]]));
        return true;
    }
}

async function handleFeedbackMessages(ctx, userId, session, text, db, saveDB, bot, ADMIN_IDS, locale, isAdmin) {
    if (isAdmin(userId) && session?.step === 'AWAITING_ADMIN_REPLY') {
        const targetUserId = session.targetUserId;
        delete db.userSessions[userId];
        await saveDB();

        const userMsg = `আপনার ফিডব্যাক থেকে এডমিন রিপ্লাই করেছেন。\n\nমেসেজ: ${text}\n\nআপনি রিপ্লাই দিতে চাইলে রিপ্লাই বাটনে ক্লিক করুন।`;
        const userKeyboard = Markup.inlineKeyboard([[Markup.button.callback("💬 রিপ্লাই", 'user_reply_chat')]]);

        await bot.telegram.sendMessage(targetUserId, userMsg, { reply_markup: userKeyboard.reply_markup }).catch(() => {
            return ctx.reply("❌ মেসেজটি ইউজারের কাছে পাঠানো যায়নি।");
        });
        await ctx.reply("✅ ইউজারের কাছে উত্তর সফলভাবে পাঠানো হয়েছে।");
        return true;
    }

    if (session?.step === 'AWAITING_USER_CHAT_REPLY') {
        delete db.userSessions[userId];
        await saveDB();

        const fullName = `${ctx.from?.first_name || ""} ${ctx.from?.last_name || ""}`.trim() || "User";
        const userName = ctx.from?.username ? `@${ctx.from.username}` : "None";
        const adminMsg = `ইউজার রিপ্লাই করেছে。\nনাম: ${fullName}\nআইডি: <code>${userId}</code>\nইউজারনেম: ${userName}\n\nমেসেজ: ${text}`;
        const adminKeyboard = Markup.inlineKeyboard([[Markup.button.callback("💬 রিপ্লাই", `admin_reply_${userId}`)]]);

        ADMIN_IDS.forEach(id => {
            bot.telegram.sendMessage(id, adminMsg, { parse_mode: 'HTML', reply_markup: adminKeyboard.reply_markup }).catch(() => {});
        });

        await ctx.reply("✅ আপনার মেসেজটি অ্যাডমিনের কাছে সফলভাবে পাঠানো হয়েছে।");
        return true;
    }

    if (session?.step === 'AWAITING_USER_FEEDBACK') {
        return await handleFeedbackText(ctx, db, saveDB, bot, ADMIN_IDS, locale);
    }

    return false;
}

function setupFeedbackActions(bot, db, saveDB, ADMIN_IDS, locale) {
    bot.action('menu_feedback', (ctx) => {
        handleFeedbackStart(ctx, db, saveDB);
    });

    bot.action(/^admin_reply_(\d+)$/, async (ctx) => {
        ctx.answerCbQuery();
        const targetUserId = ctx.match[1];
        const adminId = ctx.chat.id;
        
        if (!db.userSessions[adminId]) db.userSessions[adminId] = {};
        db.userSessions[adminId].step = 'AWAITING_ADMIN_REPLY';
        db.userSessions[adminId].targetUserId = targetUserId;
        await saveDB();
        
        await ctx.reply("রিপ্লাই মেসেজ লিখে এখানে দিন:");
    });

    bot.action(/^user_reply_chat$/, async (ctx) => {
        ctx.answerCbQuery();
        const userId = ctx.chat.id;
        
        if (!db.userSessions[userId]) db.userSessions[userId] = {};
        db.userSessions[userId].step = 'AWAITING_USER_CHAT_REPLY';
        await saveDB();
        
        await ctx.reply("রিপ্লাই মেসেজ লিখে এখানে দিন। আপনার মেসেজটি এডমিনের কাছে পৌঁছে দেয়া হবে।");
    });
}

module.exports = { handleFeedbackStart, handleFeedbackText, handleFeedbackMessages, setupFeedbackActions, feedmsg };
