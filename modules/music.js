const { Markup } = require('telegraf');
const { uploadToCatbox } = require('./catbox');

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
        const audioFile = ctx.message.audio || ctx.message.voice;
        
        if (!audioFile) {
            return ctx.reply("❌ এটি গ্রহণযোগ্য নয়! দয়া করে নিচের বাটনগুলো চাপুন অথবা একটি সঠিক অডিও ফাইল (যেমন: .mp3) আপলোড করুন। অন্য কোনো ফাইল গ্রহণযোগ্য নয়।");
        }

        return (async () => {
            const loadingMsg = await ctx.reply("⏳ Uploading audio to Catbox...").catch(() => null);
            try {
                const fileId = audioFile.file_id;
                const fileUrlObj = await bot.telegram.getFileLink(fileId);
                const fileUrl = fileUrlObj.href;
                
                const catboxUrl = await uploadToCatbox(fileUrl, 'mp3');
                
                if (catboxUrl && catboxUrl.startsWith('http')) {
                    db.userSessions[userId].music = catboxUrl;
                    saveDB();
                    if (loadingMsg) bot.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, null, "🎵 অডিও সফলভাবে আপলোড হয়েছে।").catch(() => {});
                    showImageUploadPrompt(ctx, db, saveDB, locale);
                } else {
                    if (loadingMsg) bot.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, null, "⚠️ সার্ভারে অডিও আপলোড করতে সমস্যা হয়েছে, আবার চেষ্টা করুন।").catch(() => {});
                }
            } catch (error) {
                if (loadingMsg) bot.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, null, "⚠️ অডিও প্রসেস করতে ব্যর্থ হয়েছে।").catch(() => {});
            }
        })();
    }
}

module.exports = { handleAudioUpload, showMusicUploadPrompt, handleMusicChoice };
