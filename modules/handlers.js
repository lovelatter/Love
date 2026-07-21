const { Markup } = require('telegraf');
const { showCountdownPrompt } = require('./countdown');
const { showImageUploadPrompt } = require('./photo');
const { showMusicUploadPrompt, handleMusicChoice } = require('./music');
const { handleFeedbackStart, handleFeedbackInput } = require('./feedback');
const { handleAdminText } = require('./admin');
const { processFinalLinkCreation } = require('./link');
const { locale } = require('./locale');

const sendMainMenu = async (ctx, isEdit = false) => {
    const fullName = `${ctx.from?.first_name || ""} ${ctx.from?.last_name || ""}`.trim() || "ব্যবহারকারী";
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback(locale.btn_make, 'menu_makelink')],
        [Markup.button.callback(locale.btn_feedback, 'menu_feedback'), Markup.button.callback(locale.btn_help, 'menu_help')]
    ]);
    if (isEdit) return ctx.editMessageText(locale.welcome(fullName), { reply_markup: keyboard.reply_markup, parse_mode: 'Markdown' }).catch(() => {});
    return ctx.reply(locale.welcome(fullName), { reply_markup: keyboard.reply_markup, parse_mode: 'Markdown' }).catch(() => {});
};

async function showAnimationIntro(ctx, db, saveDB) {
    db.userSessions[ctx.chat.id].step = 'AWAITING_ANIMATION_TEXT';
    await saveDB();
    const text = locale.session_started();
    ctx.editMessageText(text, Markup.inlineKeyboard([[Markup.button.callback("🔙 পেছনে যান", 'menu_makelink')]], { parse_mode: 'Markdown' })).catch(() => {
        ctx.reply(text, Markup.inlineKeyboard([[Markup.button.callback("🔙 পেছনে যান", 'menu_makelink')]], { parse_mode: 'Markdown' })).catch(() => {});
    });
}

function setupHandlers(bot, db, saveDB, isAdmin, ADMIN_IDS, SERVER_URL, music_set) {
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
        handleMusicChoice(ctx, db, saveDB, showImageUploadPrompt, music_set, locale);
    });

    bot.action('skip_image_upload', async (ctx) => {
        ctx.answerCbQuery();
        const userId = ctx.chat.id;
        if (db.userSessions[userId]) {
            db.userSessions[userId].imageUrl = null;
        }
        await saveDB();
        showAnimationIntro(ctx, db, saveDB);
    });

    bot.action('menu_feedback', (ctx) => handleFeedbackStart(ctx, db, saveDB));
    bot.action('menu_help', (ctx) => { ctx.answerCbQuery(); ctx.reply(locale.help_text, Markup.inlineKeyboard([[Markup.button.callback(locale.btn_back, 'go_to_main_menu')]]), { parse_mode: 'Markdown' }); });

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

    bot.on('text', async (ctx) => {
        const userId = ctx.chat.id;
        const session = db.userSessions[userId];
        const text = ctx.message.text.trim();
        
        if (session?.step === 'AWAITING_USER_FEEDBACK') {
            return handleFeedbackInput(ctx, db, saveDB, bot, ADMIN_IDS, locale);
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
                await saveDB();
                return ctx.reply(locale.input_anim_success(lines.length));
            }
            if (session.step === 'AWAITING_LETTER_TEXT') {
                return await processFinalLinkCreation(ctx, text, db, saveDB, bot, ADMIN_IDS, SERVER_URL);
            }
        } catch (error) {
            ctx.reply(locale.general_error).catch(() => {});
        }
    });
}

module.exports = { setupHandlers, showAnimationIntro };
