const path = require('path');
const fs = require('fs');
const https = require('https');
const { db, saveDB } = require('./utils');
const { UPLOADS_DIR } = require('./config');

const handlePhoto = async (ctx, bot, showAnimationIntro) => {
    const userId = ctx.chat.id;
    const session = db.userSessions[userId];
    if (session?.step === 'AWAITING_IMAGE_UPLOAD') {
        const photoArray = ctx.message.photo;
        const fileId = photoArray[photoArray.length - 1].file_id;
        const fileUrlObj = await bot.telegram.getFileLink(fileId);
        const filename = `img_${Date.now()}.jpg`;
        const localPath = path.join(UPLOADS_DIR, filename);
        const fileStream = fs.createWriteStream(localPath);
        https.get(fileUrlObj.href, (res) => {
            res.pipe(fileStream);
            fileStream.on('finish', () => {
                db.userSessions[userId].imageUrl = `/uploads/${filename}`;
                saveDB();
                showAnimationIntro(ctx);
            });
        });
    }
};

module.exports = { handlePhoto };
