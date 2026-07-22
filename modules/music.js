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
    music_ask: "ব্যাকগ্রাউন্ড মিউজিক সেট করতে নিচের অপশনগুলো ব্যবহার করুন:\n\n১. সরাসরি কোনো অডিও ফাইল আপলোড করুন।\n২. অথবা কোনো YouTube লিংকের লিংক এখানে পেস্ট করুন।\n৩. অথবা নিচের বাটন থেকে ডিফল্ট বা নো মিউজিক সিলেক্ট করুন।"
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
        [Markup.button.callback("🔙 Back", 'menu_makelink')]
    ]);

    ctx.editMessageText(message, keyboard, { parse_mode: 'Markdown' }).then((sentMsg) => {
        db.userSessions[userId].lastPromptMessageId = sentMsg.message_id;
        saveDB();
    }).catch(() => {
        ctx.reply(message, keyboard, { parse_mode: 'Markdown' }).then((sentMsg) => {
            db.userSessions[userId].lastPromptMessageId = sentMsg.message_id;
            saveDB();
        }).catch(() => {});
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
        ctx.deleteMessage().catch(() => {});
        showImageUploadPrompt(ctx, db, saveDB, locale);
    } else if (action === 'music_default') {
        session.music = music_set[session.type] || "";
        saveDB();
        ctx.answerCbQuery("ডিফল্ট মিউজিক সেট করা হয়েছে।");
        ctx.deleteMessage().catch(() => {});
        showImageUploadPrompt(ctx, db, saveDB, locale);
    }
}

function handleAudioUpload(ctx, bot, db, saveDB, showImageUploadPrompt, locale) {
    const userId = ctx.chat.id;
    const session = db.userSessions[userId];
    
    if (session?.step === 'AWAITING_MUSIC_CHOICE') {
        const userMessageId = ctx.message?.message_id;
        const promptMsgId = session.lastPromptMessageId;

        if (!ctx.message || !ctx.message.audio) {
            return ctx.reply("এখানে সঠিক ফরম্যাটের অডিও ফাইল অথবা ইউটিউব লিংক দিন।");
        }

        return (async () => {
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
                
                if (userMessageId) await bot.telegram.deleteMessage(userId, userMessageId).catch(() => {});
                if (promptMsgId) await bot.telegram.deleteMessage(userId, promptMsgId).catch(() => {});
                if (loadingMsg) await bot.telegram.deleteMessage(userId, loadingMsg.message_id).catch(() => {});

                const successMsg = await ctx.reply("🎵 অডিও সফলভাবে সেট হয়েছে!").catch(() => null);
                if (successMsg) {
                    setTimeout(async () => {
                        await bot.telegram.deleteMessage(userId, successMsg.message_id).catch(() => {});
                    }, 3000);
                }

                showImageUploadPrompt(ctx, db, saveDB, locale);
            } catch (error) {
                if (loadingMsg) bot.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, null, "⚠️ অডিও প্রসেস করতে ব্যর্থ হয়েছে।").catch(() => {});
            }
        })();
    }
}

async function handleYouTubeLinkInput(ctx, text, bot, db, saveDB, showImageUploadPrompt, locale) {
    const userId = ctx.chat.id;
    const session = db.userSessions[userId];

    const ytRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = text.match(ytRegex);

    if (match) {
        const ytUrl = `https://www.youtube.com/watch?v=${match[1]}`;
        session.music = ytUrl;
        saveDB();

        if (session.lastPromptMessageId) {
            await bot.telegram.deleteMessage(userId, session.lastPromptMessageId).catch(() => {});
        }
        await ctx.deleteMessage().catch(() => {});

        const successMsg = await ctx.reply("📺 ইউটিউব মিউজিক সফলভাবে সেট হয়েছে!").catch(() => null);
        if (successMsg) {
            setTimeout(async () => {
                await bot.telegram.deleteMessage(userId, successMsg.message_id).catch(() => {});
            }, 3000);
        }

        showImageUploadPrompt(ctx, db, saveDB, locale);
        return true;
    }
    return false;
}

module.exports = { handleAudioUpload, showMusicUploadPrompt, handleMusicChoice, handleYouTubeLinkInput, music_set };
