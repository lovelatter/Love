const path = require('path');
const fs = require('fs');
const https = require('https');

const photoLocale = {
    prompt_image_ask: "📸 ছবি দিতে চাইলে এখানে আপলোড করুন অথবা Skip করুন।",
    loading_msg: "⏳ Uploading your image...",
    success_msg: "📸 ছবি সফলভাবে আপলোড হয়েছে।",
    error_upload: "⚠️ ছবি আপলোড করতে সমস্যা হয়েছে, আবার চেষ্টা করুন।",
    error_process: "⚠️ ইমেজ প্রসেস করতে ব্যর্থ হয়েছে।"
};

function handlePhotoUpload(ctx, bot, db, saveDB, UPLOADS_DIR, showAnimationIntro) {
    const userId = ctx.chat.id;
    const session = db.userSessions[userId];
    
    if (session?.step === 'AWAITING_IMAGE_UPLOAD') {
        ctx.reply(photoLocale.loading_msg).then(loadingMsg => {
            try {
                const photoArray = ctx.message.photo;
                const fileId = photoArray[photoArray.length - 1].file_id;
                bot.telegram.getFileLink(fileId).then(fileUrlObj => {
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
                            bot.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, null, photoLocale.success_msg).catch(() => {});
                            showAnimationIntro(ctx);
                        });
                    }).on('error', () => {
                        bot.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, null, photoLocale.error_upload).catch(() => {});
                    });
                });
            } catch (error) {
                bot.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, null, photoLocale.error_process).catch(() => {});
            }
        });
    }
}

module.exports = { handlePhotoUpload, photoLocale };
