const { Markup } = require('telegraf');
const { uploadToCatbox } = require('./catbox');
const FormData = require('form-data');
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

const gh_url = "https://raw.githubusercontent.com/lovelatter/Love/main";

const music_set = {
    love: `${gh_url}/love.mp3`,
    birthday: `${gh_url}/bd.mp3`,
    sorry: `${gh_url}/sorry.mp3`,
    eid: `${gh_url}/eid.mp3`
};

const music_msg = {
    music_ask: "ব্যাকগ্রাউন্ড মিউজিক এখানে আপলোড করুন অথবা কোনো ইউটিউব লিংক দিন। ডিফল্ট মিউজিক রাখতে ডিফল্ট বাটনে ট্যাপ করুন।"
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

    ctx.editMessageText(message, keyboard).then((sentMsg) => {
        db.userSessions[userId].lastPromptMessageId = sentMsg.message_id;
        saveDB();
    }).catch(() => {
        ctx.reply(message, keyboard).then((sentMsg) => {
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
            return ctx.reply("এখানে সঠিক ফরম্যাটের অডিও ফাইল আপলোড করুন অথবা ইউটিউব লিংক দিন।");
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

                const successMsg = await ctx.reply("🎵 অডিও আপলোড হয়েছে।").catch(() => null);
                if (successMsg) {
                    setTimeout(async () => {
                        await bot.telegram.deleteMessage(userId, successMsg.message_id).catch(() => {});
                    }, 5000);
                }

                showImageUploadPrompt(ctx, db, saveDB, locale);
            } catch (error) {
                if (loadingMsg) bot.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, null, "⚠️ অডিও প্রসেস করতে ব্যর্থ হয়েছে।").catch(() => {});
            }
        })();
    }
}

async function handleYouTubeLinkText(ctx, text, bot, db, saveDB, showImageUploadPrompt, locale) {
    const userId = ctx.chat.id;
    const session = db.userSessions[userId];
    const userMessageId = ctx.message?.message_id;
    const promptMsgId = session.lastPromptMessageId;

    if (!text.includes('youtube.com') && !text.includes('youtu.be')) {
        return ctx.reply("⚠️ এটি কোনো সঠিক ইউটিউব লিংক নয়। দয়া করে সঠিক লিংক অথবা অডিও ফাইল দিন।");
    }

    const loadingMsg = await ctx.reply("⏳Downloading audio");

    try {
        const apiRes = await fetch('https://apis.davidcyriltech.my.id/youtube/mp3', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: text })
        });
        const apiData = await apiRes.json();

        if (!apiData || !apiData.success || !apiData.result || !apiData.result.downloadUrl) {
            await bot.telegram.editMessageText(userId, loadingMsg.message_id, null, "⚠️ ইউটিউব থেকে অডিও ডাউনলোড করা সম্ভব হয়নি। অন্য লিংক চেষ্টা করুন।").catch(() => {});
            return;
        }

        const downloadUrl = apiData.result.downloadUrl;

        const audioRes = await fetch(downloadUrl);
        const buffer = await audioRes.buffer();

        if (buffer.length > 15 * 1024 * 1024) {
            await bot.telegram.deleteMessage(userId, loadingMsg.message_id).catch(() => {});
            return ctx.reply("⚠️ এত বড় গানের লিংক দেওয়া যাবে না। ১০ মিনিটের কম এমন মিউজিক লিংক দিতে হবে।");
        }

        const form = new FormData();
        form.append('reqtype', 'fileupload');
        form.append('fileToUpload', buffer, { filename: 'audio.mp3', contentType: 'audio/mpeg' });

        const response = await fetch('https://catbox.moe/user/api.php', {
            method: 'POST',
            body: form
        });
        const catboxUrl = await response.text();

        if (!catboxUrl || !catboxUrl.startsWith('http')) {
            await bot.telegram.editMessageText(userId, loadingMsg.message_id, null, "⚠️ ইউটিউব অডিও প্রসেস বা আপলোড করতে সমস্যা হয়েছে।").catch(() => {});
            return;
        }

        db.userSessions[userId].music = catboxUrl.trim();
        saveDB();

        if (userMessageId) await bot.telegram.deleteMessage(userId, userMessageId).catch(() => {});
        if (promptMsgId) await bot.telegram.deleteMessage(userId, promptMsgId).catch(() => {});
        await bot.telegram.deleteMessage(userId, loadingMsg.message_id).catch(() => {});

        const successMsg = await ctx.reply("🎵 ইউটিউব থেকে অডিও সফলভাবে যুক্ত হয়েছে।").catch(() => null);
        if (successMsg) {
            setTimeout(async () => {
                await bot.telegram.deleteMessage(userId, successMsg.message_id).catch(() => {});
            }, 5000);
        }

        showImageUploadPrompt(ctx, db, saveDB, locale);

    } catch (error) {
        await bot.telegram.editMessageText(userId, loadingMsg.message_id, null, "⚠️ ইউটিউব থেকে অডিও ডাউনলোড করা সম্ভব হয়নি। অন্য লিংক চেষ্টা করুন।").catch(() => {});
    }
}

module.exports = { handleAudioUpload, showMusicUploadPrompt, handleMusicChoice, music_set, handleYouTubeLinkText };
