const { Markup } = require('telegraf');
const { uploadToCatbox } = require('./catbox');

const img_msg = {
    img_ask: "📸 ছবি দিতে চাইলে ছবিটি এখানে আপলোড করুন অথবা Skip করুন।"
};

function showImageUploadPrompt(ctx, db, saveDB, locale) {
    const userId = ctx.chat.id;
    if (!db.userSessions[userId]) db.userSessions[userId] = {};
    db.userSessions[userId].step = 'AWAITING_IMAGE_UPLOAD';
    saveDB();
    
    const message = img_msg.img_ask;
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback(locale.btn_skip, 'skip_image_upload')],
        [Markup.button.callback("🔙 পেছনে যান", 'menu_makelink')]
    ]);

    ctx.editMessageText(message, keyboard).catch(() => {
        ctx.reply(message, keyboard).catch(() => {});
    });
}

function handlePhotoUpload(ctx, bot, db, saveDB, showAnimationIntro) {
    const userId = ctx.chat.id;
    const session = db.userSessions[userId];
    
    if (session?.step === 'AWAITING_IMAGE_UPLOAD') {
        if (!ctx.message || !ctx.message.photo) {
            ctx.deleteMessage().catch(() => {});
            return ctx.reply("এখানে সঠিক ফরম্যাটের ছবি (image) আপলোড করুন অথবা Skip করুন।").then(warningMsg => {
                db.userSessions[userId].lastImgWarningMsgId = warningMsg.message_id;
                saveDB();
            });
        }

        return (async () => {
            if (session.lastImgWarningMsgId) {
                await bot.telegram.deleteMessage(userId, session.lastImgWarningMsgId).catch(() => {});
                db.userSessions[userId].lastImgWarningMsgId = null;
            }
            await ctx.deleteMessage().catch(() => {});

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
                
                if (loadingMsg) {
                    await bot.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, null, "📸 ছবি আপলোড হয়েছে।").catch(() => {});
                    setTimeout(async () => {
                        try {
                            await bot.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);
                        } catch (e) {}
                    }, 2000);
                }
                
                showAnimationIntro(ctx);
            } catch (error) {
                if (loadingMsg) bot.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, null, "⚠️ ইমেজ প্রসেস করতে ব্যর্থ হয়েছে।").catch(() => {});
            }
        })();
    }
}

module.exports = { handlePhotoUpload, showImageUploadPrompt };
