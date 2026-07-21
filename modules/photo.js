const { Markup } = require('telegraf');
const { uploadToCatbox } = require('./catbox');

const img_msg = {
    img_ask: "📸 ছবি যুক্ত করতে চাইলে ছবিটি এখানে পাঠান অথবা Skip করুন।"
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
            return ctx.reply("❌ এটি গ্রহণযোগ্য নয়! দয়া করে নিচের 'Skip' বাটন চাপুন অথবা একটি সঠিক ছবি (Photo) আপলোড করুন। অন্য কোনো ফাইল বা টেক্সট গ্রহণযোগ্য নয়।");
        }

        return (async () => {
            const loadingMsg = await ctx.reply("⏳ Uploading image to Catbox...").catch(() => null);
            try {
                const photoArray = ctx.message.photo;
                const fileId = photoArray[photoArray.length - 1].file_id;
                const fileUrlObj = await bot.telegram.getFileLink(fileId);
                const fileUrl = fileUrlObj.href;
                
                const catboxUrl = await uploadToCatbox(fileUrl, 'jpg');
                
                if (catboxUrl && catboxUrl.startsWith('http')) {
                    db.userSessions[userId].imageUrl = catboxUrl;
                    saveDB();
                    if (loadingMsg) bot.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, null, "📸 ছবি সফলভাবে আপলোড হয়েছে।").catch(() => {});
                    showAnimationIntro(ctx);
                } else {
                    if (loadingMsg) bot.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, null, "⚠️ ছবি আপলোড করতে সমস্যা হয়েছে, আবার চেষ্টা করুন।").catch(() => {});
                }
            } catch (error) {
                if (loadingMsg) bot.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, null, "⚠️ ইমেজ প্রসেস করতে ব্যর্থ হয়েছে।").catch(() => {});
            }
        })();
    }
}

module.exports = { handlePhotoUpload, showImageUploadPrompt };
