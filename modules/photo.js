const fs = require('fs');
const path = require('path');
const https = require('https');
const { Markup } = require('telegraf');

const UPLOADS_DIR = path.join(__dirname, '../uploads');

const CATEGORY_CONFIGS = {
    prompt_image_ask: "📸 ছবি যুক্ত করতে চাইলে ছবিটি এখানে পাঠান অথবা Skip করুন।"
};


function showImageUploadPrompt(ctx, db, saveDB, locale) {
    const userId = ctx.chat.id;
    if (!db.userSessions[userId]) db.userSessions[userId] = {};
    db.userSessions[userId].step = 'AWAITING_IMAGE_UPLOAD';
    saveDB();
    
    const message = locale.prompt_image_ask;
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
        return (async () => {
            const loadingMsg = await ctx.reply("⏳ Uploading image...").catch(() => null);
            try {
                const photoArray = ctx.message.photo;
                const fileId = photoArray[photoArray.length - 1].file_id;
                const fileUrlObj = await bot.telegram.getFileLink(fileId);
                const fileUrl = fileUrlObj.href;
                const filename = `img_${Date.now()}_${Math.random().toString(36).substring(2, 5)}.jpg`;
                const localPath = path.join(UPLOADS_DIR, filename);
                
                const fileStream = fs.createWriteStream(localPath);
                https.get(fileUrl, (response) => {
                    response.pipe(fileStream);
                    fileStream.on('finish', () => {
                        fileStream.close();
                        db.userSessions[userId].imageUrl = `/uploads/${filename}`;
                        saveDB();
                        if (loadingMsg) bot.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, null, "📸 ছবি সফলভাবে আপলোড হয়েছে।").catch(() => {});
                        showAnimationIntro(ctx);
                    });
                }).on('error', () => {
                    if (loadingMsg) bot.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, null, "⚠️ ছবি আপলোড করতে সমস্যা হয়েছে, আবার চেষ্টা করুন।").catch(() => {});
                });
            } catch (error) {
                if (loadingMsg) bot.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, null, "⚠️ ইমেজ প্রসেস করতে ব্যর্থ হয়েছে।").catch(() => {});
            }
        })();
    }
}

module.exports = { handlePhotoUpload, showImageUploadPrompt };
