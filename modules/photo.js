const { Markup } = require('telegraf');
const { uploadToCatbox } = require('./catbox');

const img_msg = {
    img_ask: "📸 ছবি দিতে চাইলে ছবিটি এখানে পাঠান অথবা Skip করুন।"
};

function showImageUploadPrompt(ctx, db, saveDB, locale) {
    const userId = ctx.chat.id;
    if (!db.userSessions[userId]) db.userSessions[userId] = {};
    db.userSessions[userId].step = 'AWAITING_IMAGE_UPLOAD';
    saveDB();
    
    const message = img_msg.img_ask;
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback(locale.btn_skip, 'skip_image_upload')],
        [Markup.button.callback("🔙 Back", 'menu_makelink')]
    ]);

    ctx.editMessageText(message, keyboard).then((sentMsg) => {
        db.userSessions[userId].lastPromptMessageId = sentMsg.message_id;
        saveDB();
    }).catch(() => {
        ctx.reply(message, keyboard).then((sentMsg) => {
            db.userSessions[userId].lastPromptMessageId = sentMsg.message_id;
            saveDB();
        }).catch(() => {});
    });
}

function handlePhotoUpload(ctx, bot, db, saveDB, showAnimationIntro) {
    const userId = ctx.chat.id;
    const session = db.userSessions[userId];
    
    if (session?.step === 'AWAITING_IMAGE_UPLOAD') {
        const userMessageId = ctx.message?.message_id;
        const promptMsgId = session.lastPromptMessageId;

        if (!ctx.message || !ctx.message.photo) {
            return ctx.reply("এখানে সঠিক ফরম্যাটের ছবি (Photo) আপলোড করুন অথবা নিচের বাটনগুলো ব্যবহার করুন।");
        }

        return (async () => {
            const loadingMsg = await ctx.reply("⏳ Uploading image...").catch(() => null);
            try {
                const photoArray = ctx.message.photo;
                const fileId = photoArray[photoArray.length - 1].file_id;
                const fileUrlObj = await bot.telegram.getFileLink(fileId);
                const fileUrl = fileUrlObj.href;
                
                const catboxUrl = await uploadToCatbox(fileUrl, 'jpg');
                
                if (!catboxUrl) {
                    if (loadingMsg) bot.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, null, "⚠️ ছবি আপলোড করতে সমস্যা হয়েছে, আবার চেষ্টা করুন।").catch(() => {});
                    return;
                }

                db.userSessions[userId].imageUrl = catboxUrl;
                saveDB();
                
                if (userMessageId) {
                    await bot.telegram.deleteMessage(userId, userMessageId).catch(() => {});
                }

                if (promptMsgId) {
                    await bot.telegram.deleteMessage(userId, promptMsgId).catch(() => {});
                }

                if (loadingMsg) {
                    await bot.telegram.deleteMessage(userId, loadingMsg.message_id).catch(() => {});
                }

                const successMsg = await ctx.reply("📸 ছবি আপলোড হয়েছে।").catch(() => null);
                if (successMsg) {
                    setTimeout(async () => {
                        await bot.telegram.deleteMessage(userId, successMsg.message_id).catch(() => {});
                    }, 5000);
                }

                showAnimationIntro(ctx);
            } catch (error) {
                if (loadingMsg) bot.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, null, "⚠️ ইমেজ প্রসেস করতে ব্যর্থ হয়েছে।").catch(() => {});
            }
        })();
    }
}

module.exports = { handlePhotoUpload, showImageUploadPrompt };
