const { Markup } = require('telegraf');
const { uploadToCatbox } = require('./catbox');

const gh_url = "https://raw.githubusercontent.com/lovelatter/Love/main";

const music_set = {
    love: `${gh_url}/love.mp3`,
    birthday: `${gh_url}/bd.mp3`,
    sorry: `${gh_url}/sorry.mp3`,
    eid: `${gh_url}/eid.mp3`
};

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

function handleMusicChoice(ctx, db, saveDB, showImageUploadPrompt, locale) {
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
            ctx.deleteMessage().catch(() => {});
            return ctx.reply("এখানে সঠিক ফরম্যাটের অডিও (Audio) ফাইল দিতে হবে। অনুগ্রহ করে একটি অডিও ফাইল আপলোড করুন অথবা নিচের বাটনগুলো ব্যবহার করুন।").then(warningMsg => {
                db.userSessions[userId].lastWarningMsgId = warningMsg.message_id;
                saveDB();
            });
        }

        return (async () => {
            if (session.lastWarningMsgId) {
                await bot.telegram.deleteMessage(userId, session.lastWarningMsgId).catch(() => {});
                db.userSessions[userId].lastWarningMsgId = null;
            }
            await ctx.deleteMessage().catch(() => {});

            const loadingMsg = await ctx.reply("⏳ Uploading audio...").catch(() => null);
            try {
                const audio = ctx.message.audio;
                const fileId = audio.file_id;
                const fileUrlObj = await bot.telegram.getFileLink(fileId);
                const fileUrl = fileUrlObj.href;
                
                const catboxUrl = await uploadToCatbox(fileUrl, 'mp3');
                
                if (!catboxUrl) {
                    if (loadingMsg) bot.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, null, "⚠️ অডিও আপলোড করতে সমস্যা হয়েছে, আবার চেষ্টা করুন।").catch(() => {});
                    return;
                }

                db.userSessions[userId].music = catboxUrl;
                saveDB();
                
                if (loadingMsg) {
                    await bot.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, null, "🎵 অডিও সফলভাবে আপলোড হয়েছে।").catch(() => {});
                    setTimeout(async () => {
                        try {
                            await bot.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);
                        } catch (e) {}
                    }, 2000);
                }
                
                showImageUploadPrompt(ctx, db, saveDB, locale);
            } catch (error) {
                if (loadingMsg) bot.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, null, "⚠️ অডিও প্রসেস করতে ব্যর্থ হয়েছে।").catch(() => {});
            }
        })();
    }
}

module.exports = { handleAudioUpload, showMusicUploadPrompt, handleMusicChoice, music_set };
