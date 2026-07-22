const express = require('express');
const { Telegraf, Markup } = require('telegraf');

const { db, loadDB, saveDB } = require('./modules/db');
const { showCountdownPrompt } = require('./modules/countdown');
const { handlePhotoUpload, showImageUploadPrompt } = require('./modules/photo');
const { handleAudioUpload, showMusicUploadPrompt, handleMusicChoice, music_set, handleYouTubeLinkText } = require('./modules/music');
const { handleFeedbackStart, handleFeedbackInput } = require('./modules/feedback');
const { setupAdmin, handleAdminText } = require('./modules/admin');
const { processFinalLinkCreation } = require('./modules/link');
const { setupRoutes } = require('./modules/routes');
const { locale } = require('./modules/locale');
const { generateRandomAnimation, generateRandomLetter } = require('./modules/random');

const app = express();
app.use(express.json());
app.set('trust proxy', true);

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const ADMIN_IDS = (process.env.ADMIN_CHAT_ID || "").split(',').map(id => id.trim()).filter(id => id !== "");

const isAdmin = (userId) => ADMIN_IDS.includes(userId.toString());

const SERVER_URL = "https://love-bb7p.onrender.com";

const bot = new Telegraf(TELEGRAM_TOKEN);

bot.use(async (ctx, next) => {
    const userId = ctx.chat?.id;
    if (!userId) return;
    if (!db.registeredUsers.includes(userId)) db.registeredUsers.push(userId);
    if (ctx.from?.username) db.usernameMap[ctx.from.username.toLowerCase()] = userId;
    await saveDB();
    if (isAdmin(userId)) return next();
    if (db.bannedUsers.includes(userId)) return;
    if (db.isMaintenanceMode) {
        const session = db.userSessions[userId];
        if (session?.step === 'AWAITING_USER_FEEDBACK') return next();
        if (ctx.callbackQuery?.data === 'menu_feedback') return next();
        const maintKeyboard = Markup.inlineKeyboard([[Markup.button.callback(locale.btn_feedback, 'menu_feedback')]]);
        if (ctx.callbackQuery) {
            ctx.answerCbQuery().catch(() => {});
            return ctx.editMessageText(locale.maint_msg, maintKeyboard).catch(() => {});
        }
        return ctx.reply(locale.maint_msg, maintKeyboard).catch(() => {});
    }
    return next();
});

setupAdmin(bot, db, saveDB, isAdmin, __dirname, locale);

const sendMainMenu = async (ctx, isEdit = false) => {
    const fullName = `${ctx.from?.first_name || ""} ${ctx.from?.last_name || ""}`.trim() || "ব্যবহারকারী";
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback(locale.btn_make, 'menu_makelink')],
        [Markup.button.callback(locale.btn_feedback, 'menu_feedback'), Markup.button.callback(locale.btn_help, 'menu_help')]
    ]);
    if (isEdit) return ctx.editMessageText(locale.welcome(fullName), { reply_markup: keyboard.reply_markup, parse_mode: 'Markdown' }).catch(() => {});
    return ctx.reply(locale.welcome(fullName), { reply_markup: keyboard.reply_markup, parse_mode: 'Markdown' }).catch(() => {});
};

bot.command('start', async (ctx) => { 
    delete db.userSessions[ctx.chat.id];
    await saveDB();
    sendMainMenu(ctx, false); 
});

bot.action('go_to_main_menu', (ctx) => { ctx.answerCbQuery(); sendMainMenu(ctx, true); });

bot.action('menu_makelink', (ctx) => {
    ctx.answerCbQuery();
    ctx.editMessageText(locale.choose_cat, Markup.inlineKeyboard([
        [Markup.button.callback(locale.cat_love, 'make_love')],
        [Markup.button.callback(locale.cat_birthday, 'make_birthday')],
        [Markup.button.callback(locale.cat_sorry, 'make_sorry')],
        [Markup.button.callback(locale.cat_eid, 'make_eid')],
        [Markup.button.callback(locale.btn_back, 'go_to_main_menu')]
    ]));
});

bot.action(/^make_/, async (ctx) => {
    ctx.answerCbQuery();
    const cat = ctx.match.input.replace('make_', '');
    db.userSessions[ctx.chat.id] = { 
        type: cat, 
        name: `${ctx.from.first_name || ""} ${ctx.from.last_name || ""}`.trim() || "User",
        username: ctx.from.username ? `@${ctx.from.username}` : "None",
        music: music_set[cat] || "",
        imageUrl: null,
        step: 'AWAITING_COUNTDOWN_SELECTION'
    };
    await saveDB();
    showCountdownPrompt(ctx, db, saveDB, (c, d, s) => showMusicUploadPrompt(c, d, s, locale), locale);
});

bot.action('timer_no', async (ctx) => { 
    ctx.answerCbQuery(); 
    if (!db.userSessions[ctx.chat.id]) db.userSessions[ctx.chat.id] = {};
    db.userSessions[ctx.chat.id].pendingMinutes = null; 
    await saveDB();
    showMusicUploadPrompt(ctx, db, saveDB, locale); 
});

bot.action(/^set_time_/, async (ctx) => {
    ctx.answerCbQuery();
    const userId = ctx.chat.id;
    if (!db.userSessions[userId]) db.userSessions[userId] = {};
    db.userSessions[userId].pendingMinutes = parseInt(ctx.match.input.replace('set_time_', ''), 10);
    await saveDB();
    showMusicUploadPrompt(ctx, db, saveDB, locale);
});

bot.action(['music_no', 'music_default'], (ctx) => {
    handleMusicChoice(ctx, db, saveDB, showImageUploadPrompt, locale);
});

bot.action('skip_image_upload', async (ctx) => {
    ctx.answerCbQuery();
    const userId = ctx.chat.id;
    if (db.userSessions[userId]) {
        db.userSessions[userId].imageUrl = null;
    }
    await saveDB();
    showAnimationIntro(ctx);
});

async function showAnimationIntro(ctx) {
    db.userSessions[ctx.chat.id].step = 'AWAITING_ANIMATION_TEXT';
    await saveDB();
    const text = locale.session_started();
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback("🎲 Random", 'random_anim_start')],
        [Markup.button.callback("🔙 পেছনে যান", 'menu_makelink')]
    ]);
    const sentMsg = await ctx.editMessageText(text, { reply_markup: keyboard.reply_markup, parse_mode: 'Markdown' }).catch(async () => {
        return await ctx.reply(text, { reply_markup: keyboard.reply_markup, parse_mode: 'Markdown' }).catch(() => null);
    });
    if (sentMsg) {
        db.userSessions[ctx.chat.id].lastPromptMsgId = sentMsg.message_id;
        await saveDB();
    }
}

bot.action('random_anim_start', async (ctx) => {
    ctx.answerCbQuery();
    const userId = ctx.chat.id;
    const session = db.userSessions[userId];
    if (!session) return;
    
    session.animHistory = [];
    session.currentAnimList = await generateRandomAnimation(session.type, session.animHistory);
    session.animHistory.push(...session.currentAnimList);
    session.step = 'PREVIEW_RANDOM_ANIM';
    await saveDB();
    await renderRandomAnimPreview(ctx, userId);
});

async function renderRandomAnimPreview(ctx, userId, showPrevBtn = false) {
    const session = db.userSessions[userId];
    const text = "জেনারেট করা অ্যানিমেশন টেক্সট:\n\n" + session.currentAnimList.join('\n');
    let buttons = [
        [Markup.button.callback("এটি রাখবো", 'anim_keep')],
        [Markup.button.callback("পরিবর্তন", 'anim_change')]
    ];
    if (showPrevBtn) {
        buttons = [
            [Markup.button.callback("এটি রাখবো", 'anim_keep')],
            [Markup.button.callback("আগেরটা", 'anim_prev'), Markup.button.callback("পরিবর্তন", 'anim_change')]
        ];
    }
    const keyboard = Markup.inlineKeyboard(buttons);
    await ctx.editMessageText(text, { reply_markup: keyboard.reply_markup }).catch(() => {});
}

bot.action('anim_change', async (ctx) => {
    ctx.answerCbQuery();
    const userId = ctx.chat.id;
    const session = db.userSessions[userId];
    if (!session) return;
    session.prevAnimList = [...session.currentAnimList];
    session.currentAnimList = await generateRandomAnimation(session.type, session.animHistory);
    session.animHistory.push(...session.currentAnimList);
    await saveDB();
    await renderRandomAnimPreview(ctx, userId, true);
});

bot.action('anim_prev', async (ctx) => {
    ctx.answerCbQuery();
    const userId = ctx.chat.id;
    const session = db.userSessions[userId];
    if (!session || !session.prevAnimList) return;
    const temp = [...session.currentAnimList];
    session.currentAnimList = [...session.prevAnimList];
    session.prevAnimList = temp;
    await saveDB();
    await renderRandomAnimPreview(ctx, userId, true);
});

bot.action('anim_keep', async (ctx) => {
    ctx.answerCbQuery();
    const userId = ctx.chat.id;
    const session = db.userSessions[userId];
    if (!session) return;
    session.animations = session.currentAnimList;
    session.step = 'AWAITING_LETTER_TEXT';
    await saveDB();
    const text = locale.input_anim_success(session.animations.length) + "\n\nএবার আপনার চিঠির জন্য টেক্সট দিন অথবা রেন্ডম ব্যবহার করুন:";
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback("🎲 Random", 'random_letter_start')],
        [Markup.button.callback("🔙 পেছনে যান", 'menu_makelink')]
    ]);
    const sentMsg = await ctx.editMessageText(text, { reply_markup: keyboard.reply_markup, parse_mode: 'Markdown' }).catch(async () => {
        return await ctx.reply(text, { reply_markup: keyboard.reply_markup, parse_mode: 'Markdown' }).catch(() => null);
    });
    if (sentMsg) {
        session.lastPromptMsgId = sentMsg.message_id;
        await saveDB();
    }
});

bot.action('random_letter_start', async (ctx) => {
    ctx.answerCbQuery();
    const userId = ctx.chat.id;
    const session = db.userSessions[userId];
    if (!session) return;
    
    session.letterHistory = [];
    session.currentLetterText = await generateRandomLetter(session.type, session.letterHistory);
    session.letterHistory.push(session.currentLetterText);
    session.step = 'PREVIEW_RANDOM_LETTER';
    await saveDB();
    await renderRandomLetterPreview(ctx, userId);
});

async function renderRandomLetterPreview(ctx, userId, showPrevBtn = false) {
    const session = db.userSessions[userId];
    const text = "জেনারেট করা চিঠি:\n\n" + session.currentLetterText;
    let buttons = [
        [Markup.button.callback("এটি রাখবো", 'letter_keep')],
        [Markup.button.callback("পরিবর্তন", 'letter_change')]
    ];
    if (showPrevBtn) {
        buttons = [
            [Markup.button.callback("এটি রাখবো", 'letter_keep')],
            [Markup.button.callback("আগেরটা", 'letter_prev'), Markup.button.callback("পরিবর্তন", 'letter_change')]
        ];
    }
    const keyboard = Markup.inlineKeyboard(buttons);
    await ctx.editMessageText(text, { reply_markup: keyboard.reply_markup }).catch(() => {});
}

bot.action('letter_change', async (ctx) => {
    ctx.answerCbQuery();
    const userId = ctx.chat.id;
    const session = db.userSessions[userId];
    if (!session) return;
    session.prevLetterText = session.currentLetterText;
    session.currentLetterText = await generateRandomLetter(session.type, session.letterHistory);
    session.letterHistory.push(session.currentLetterText);
    await saveDB();
    await renderRandomLetterPreview(ctx, userId, true);
});

bot.action('letter_prev', async (ctx) => {
    ctx.answerCbQuery();
    const userId = ctx.chat.id;
    const session = db.userSessions[userId];
    if (!session || !session.prevLetterText) return;
    const temp = session.currentLetterText;
    session.currentLetterText = session.prevLetterText;
    session.prevLetterText = temp;
    await saveDB();
    await renderRandomLetterPreview(ctx, userId, true);
});

bot.action('letter_keep', async (ctx) => {
    ctx.answerCbQuery();
    const userId = ctx.chat.id;
    const session = db.userSessions[userId];
    if (!session) return;
    const letterText = session.currentLetterText;
    if (session.lastPromptMsgId) {
        await bot.telegram.deleteMessage(userId, session.lastPromptMsgId).catch(() => {});
    }
    await processFinalLinkCreation(ctx, letterText, db, saveDB, bot, ADMIN_IDS, SERVER_URL);
});

bot.action('menu_feedback', async (ctx) => {
    ctx.answerCbQuery();
    const userId = ctx.chat.id;
    if (!db.userSessions[userId]) db.userSessions[userId] = {};
    db.userSessions[userId].step = 'AWAITING_USER_FEEDBACK';
    db.userSessions[userId].feedbackWarningMsgId = null;
    
    const sentMsg = await ctx.editMessageText(locale.feedback_prompt || "📝 মতামত ও রিপোর্ট:\n\nঅ্যাডমিনের কাছে কোনো রিপোর্ট, নতুন আপডেটের আইডিয়া বা অন্য কোনো কিছু বলার থাকলে আপনার মেসেজটি এখানে লিখে পাঠিয়ে দিন:", Markup.inlineKeyboard([[Markup.button.callback(locale.btn_back, 'go_to_main_menu')]]));
    db.userSessions[userId].feedbackPromptMsgId = sentMsg.message_id;
    await saveDB();
});

bot.action('menu_help', (ctx) => { 
    ctx.answerCbQuery(); 
    ctx.editMessageText(locale.help_text, Markup.inlineKeyboard([[Markup.button.callback(locale.btn_back, 'go_to_main_menu')]]), { parse_mode: 'Markdown' }); 
});

bot.action(/^delete_link_(.+)$/, async (ctx) => {
    const linkId = ctx.match[1];
    const data = db.linkDatabase[linkId];
    if (!data) return ctx.answerCbQuery("⚠️ এই লিঙ্কটি ইতিমধ্যে রিমুভ করা হয়েছে!", { show_alert: true });
    if (Number(data.userId) !== Number(ctx.chat.id)) return ctx.answerCbQuery("❌ পারমিশন নেই।", { show_alert: true });
    ctx.answerCbQuery("✅ লিঙ্কটি সফলভাবে ডিলিট করা হয়েছে।", { show_alert: true });
    delete db.linkDatabase[linkId];
    await saveDB();
    ctx.editMessageText("❌ আপনার এই লিঙ্কটি চিরতরে বন্ধ এবং রিমুভ করে দেওয়া হয়েছে।");
    sendMainMenu(ctx, false);
});

bot.on('audio', (ctx) => handleAudioUpload(ctx, bot, db, saveDB, showImageUploadPrompt, locale));
bot.on('photo', (ctx) => handlePhotoUpload(ctx, bot, db, saveDB, showAnimationIntro));

bot.on('text', async (ctx) => {
    const userId = ctx.chat.id;
    const session = db.userSessions[userId];
    const text = ctx.message.text.trim();
    
    if (session?.step === 'AWAITING_MUSIC_CHOICE') {
        if (text.includes('youtube.com') || text.includes('youtu.be')) {
            await ctx.deleteMessage().catch(() => {});
            return handleYouTubeLinkText(ctx, text, bot, db, saveDB, showImageUploadPrompt, locale);
        } else {
            return ctx.reply("⚠️ দয়া করে একটি সঠিক ইউটিউব লিংক দিন অথবা নিচের বাটনগুলো ব্যবহার করুন।");
        }
    }

    if (session?.step === 'AWAITING_USER_FEEDBACK') {
        if (text.length < 5) {
            await ctx.deleteMessage().catch(() => {});
            if (session.feedbackWarningMsgId) {
                await bot.telegram.deleteMessage(userId, session.feedbackWarningMsgId).catch(() => {});
            }
            const warnMsg = await ctx.reply("⚠️ অনুগ্রহ করে অন্তত ৫ অক্ষরের বেশি মতামত দিন।");
            db.userSessions[userId].feedbackWarningMsgId = warnMsg.message_id;
            await saveDB();
            return;
        } else {
            if (session.feedbackWarningMsgId) {
                await bot.telegram.deleteMessage(userId, session.feedbackWarningMsgId).catch(() => {});
            }
            if (session.feedbackPromptMsgId) {
                await bot.telegram.deleteMessage(userId, session.feedbackPromptMsgId).catch(() => {});
            }
            await ctx.deleteMessage().catch(() => {});
            return handleFeedbackInput(ctx, db, saveDB, bot, ADMIN_IDS, locale);
        }
    }

    if (isAdmin(userId) && session) {
        const handled = handleAdminText(ctx, text, session, db, saveDB, bot);
        if (handled) return;
    }
    
    if (!session?.step) {
        ctx.reply(locale.invalid_cmd(text), { parse_mode: 'Markdown' }).catch(() => {});
        return ctx.reply(locale.help_text, Markup.inlineKeyboard([[Markup.button.callback(locale.btn_back, 'go_to_main_menu')]]), { parse_mode: 'Markdown' }).catch(() => {});
    }
    try {
        if (session.step === 'AWAITING_ANIMATION_TEXT') {
            const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
            if (!lines.length) return ctx.reply("⚠️ অনুগ্রহ করে অন্তত একটি টেক্সট লিখুন।");
            db.userSessions[userId].animations = lines;
            db.userSessions[userId].step = 'AWAITING_LETTER_TEXT';
            if (session.lastPromptMsgId) {
                await bot.telegram.deleteMessage(userId, session.lastPromptMsgId).catch(() => {});
            }
            await ctx.deleteMessage().catch(() => {});
            const nextPrompt = await ctx.reply(locale.input_anim_success(lines.length) + "\n\nএবার আপনার চিঠির জন্য টেক্সট দিন অথবা রেন্ডম ব্যবহার করুন:", Markup.inlineKeyboard([
                [Markup.button.callback("🎲 Random", 'random_letter_start')],
                [Markup.button.callback("🔙 পেছনে যান", 'menu_makelink')]
            ]));
            db.userSessions[userId].lastPromptMsgId = nextPrompt.message_id;
            await saveDB();
            return;
        }
        if (session.step === 'AWAITING_LETTER_TEXT') {
            if (session.lastPromptMsgId) {
                await bot.telegram.deleteMessage(userId, session.lastPromptMsgId).catch(() => {});
            }
            await ctx.deleteMessage().catch(() => {});
            return await processFinalLinkCreation(ctx, text, db, saveDB, bot, ADMIN_IDS, SERVER_URL);
        }
    } catch (error) {
        ctx.reply(locale.general_error).catch(() => {});
    }
});

setupRoutes(app, db, saveDB, bot);

const PORT = process.env.PORT || 3000;

loadDB().then(() => {
    app.listen(PORT, () => {
        bot.launch().catch(err => console.error(err));
        console.log(`Server running on port ${PORT}`);
    });
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
