const fs = require('fs');
const path = require('path');
const https = require('https');
const { Markup } = require('telegraf');

const UPLOADS_DIR = path.join(__dirname, '../uploads');

const music_msg = {
    music_ask: "ব্যাকগ্রাউন্ড মিউজিক দিতে চাইলে এখানে আপলোড করুন। ডিফল্ট মিউজিক রাখতে চাইলে ডিফল্ট বাটনে ট্যাপ করুন।"
};

function showMusicUploadPrompt(ctx, db, saveDB, locale) {
    const userId = ctx.chat.id;
    if (!db.userSessions[userId]) db.userSessions[userId] = {};
    db.userSessions[userId].step = 'AWAITING_MUSIC_CHOICE';
    saveDB();
    
    const message = music_msg.music_ask;
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback("❌ No Music", 'music_no')],
        [Markup.button.callback("🎵 Default Music", 'music_default')],
        [Markup.button.callback("🔙 পেছনে যান", 'menu_makelink')]
    ]);

    ctx.editMessageText(message, keyboard).catch(() => {
        ctx.reply(message, keyboard).catch(() => {});
    });
}

function handleMusicChoice(ctx, db, saveDB, showImageUploadPrompt, music_set, locale) {
    const userId = ctx.chat.id;
    const session = db.userSessions[userId];
    if (!session) return;

    const action = ctx.callbackQuery.data;
    if (action === 'music_no') {
        session.music = "";
        saveDB();
        ctx.answerCbQuery("কোনো ব্যাকগ্রাউন্ড মিউজিক রাখা হয়নি।");
        showImageUploadPrompt(ctx, db, saveDB, locale);
    } else if (action === 'music_default') {
        session.music = music_set[session.type] || "";
        saveDB();
        ctx.answerCbQuery("ডিফল্ট মিউজিক সেট করা হয়েছে।");
        showImageUploadPrompt(ctx, db, saveDB, locale);
    }
}

function handleAudioUpload(ctx, bot, db, saveDB, showImageUploadPrompt, locale) {
    const userId = ctx.chat.id;
    const session = db.userSessions[userId];
    
    if (session?.step === 'AWAITING_MUSIC_CHOICE') {
        if (!ctx.message || !ctx.message.audio) {
            return ctx.reply("এখানে সঠিক ফরম্যাটের অডিও (Audio) ফাইল দিতে হবে। অনুগ্রহ করে একটি অডিও ফাইল আপলোড করুন অথবা নিচের বাটনগুলো ব্যবহার করুন।");
        }

        return (async () => {
            const loadingMsg = await ctx.reply("⏳ Uploading audio...").catch(() => null);
            try {
                const audio = ctx.message.audio;
                const fileId = audio.file_id;
                const fileUrlObj = await bot.telegram.getFileLink(fileId);
                const fileUrl = fileUrlObj.href;
                const filename = `audio_${Date.now()}_${Math.random().toString(36).substring(2, 5)}.mp3`;
                const localPath = path.join(UPLOADS_DIR, filename);
                
                const fileStream = fs.createWriteStream(localPath);
                https.get(fileUrl, (response) => {
                    response.pipe(fileStream);
                    fileStream.on('finish', () => {
                        fileStream.close();
                        db.userSessions[userId].music = `/uploads/${filename}`;
                        saveDB();
                        if (loadingMsg) bot.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, null, "🎵 অডিও সফলভাবে আপলোড হয়েছে।").catch(() => {});
                        showImageUploadPrompt(ctx, db, saveDB, locale);
                    });
                }).on('error', () => {
                    if (loadingMsg) bot.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, null, "⚠️ অডিও আপলোড করতে সমস্যা হয়েছে, আবার চেষ্টা করুন।").catch(() => {});
                });
            } catch (error) {
                if (loadingMsg) bot.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, null, "⚠️ অডিও প্রসেস করতে ব্যর্থ হয়েছে।").catch(() => {});
            }
        })();
    }
}

module.exports = { handleAudioUpload, showMusicUploadPrompt, handleMusicChoice };
