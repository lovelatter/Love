async function processAIAnimationGeneration(ctx, name, isEdit = false) {
    const userId = ctx.chat.id;
    const session = db.userSessions[userId];
    const category = session?.type || 'love';

    try {
        const lines = await generateAIAnimation(category, name);
        db.userSessions[userId].aiGeneratedAnimations = lines;
        db.userSessions[userId].step = 'AWAITING_AI_ANIM_CHOICE';
        await saveDB();

        const previewText = `🤖 AI দ্বারা তৈরিকৃত অ্যানিমেশন টেক্সট:\n\n${lines.join('\n')}\n\nএটি কি রাখতে চান, নাকি পরিবর্তন করবেন?`;
        const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback("✅ এটি রাখুন", 'ai_anim_keep'), Markup.button.callback("🔄 পরিবর্তন", 'ai_anim_change')]
        ]);

        if (isEdit && ctx.callbackQuery) {
            return await ctx.editMessageText(previewText, { reply_markup: keyboard.reply_markup }).catch(() => {});
        }
        await ctx.reply(previewText, keyboard);
    } catch (error) {
        await ctx.reply(error.message);
        showAnimationIntro(ctx);
    }
}

bot.action('ai_anim_change', async (ctx) => {
    ctx.answerCbQuery("নতুন অ্যানিমেশন তৈরি করা হচ্ছে...");
    const userId = ctx.chat.id;
    const name = db.userSessions[userId].aiName || null;
    await processAIAnimationGeneration(ctx, name, true); // true দেওয়ার কারণে এটি আগের মেসেজটিকেই এডিট করবে
});
