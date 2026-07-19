const path = require('path');
const fs = require('fs');
const https = require('https');

async function photohandle(ctx, bot, UPLOADS_DIR, db, saveDB, showAnimationIntro) {
    const userId = ctx.chat.id;
    const session = db.userSessions[userId];
    
    if (session?.step === 'AWAITING_IMAGE_UPLOAD') {
        const loadingMsg = await ctx.reply("⏳ Uploading your image...").catch(() => null);
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
                    if (loadingMsg) bot.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, null, "📸 ছবি সফলভাবে আপলোড এবং সেভ করা হয়েছে।").catch(() => {});
                    showAnimationIntro(ctx);
                });
            }).on('error', () => {
                if (loadingMsg) bot.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, null, "⚠️ ছবি আপলোড করতে সমস্যা হয়েছে, আবার চেষ্টা করুন।").catch(() => {});
            });
        } catch (error) {
            if (loadingMsg) bot.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, null, "⚠️ ইমেজ প্রসেস করতে ব্যর্থ হয়েছে।").catch(() => {});
        }
    }
}

module.exports = photohandle;
