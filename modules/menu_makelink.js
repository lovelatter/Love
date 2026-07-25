const { Markup } = require('telegraf');
const { music_set } = require('./music');

const cat_config = {
    love: { title: "আমার মনের কিছু কথা", emojis: ["❤️", "💖", "💕"], question: "Do you love me? 🥺", buttons: ["Yes", "No"], label: "❤️ প্রেমের চিঠি (Love)" },
    birthday: { title: "Happy Birthday", emojis: ["🎈", "🎉", "🎊"], question: "Are you happy? 😊", buttons: ["Yes", "No"], label: "🎂 জন্মদিনের শুভেচ্ছা (Birthday)" },
    sorry: { title: "I'm Sorry", emojis: ["😭", "😞", "😥"], question: "Do you forgive me? 🥺", buttons: ["Yes", "No"], label: "🥺 দুঃখ প্রকাশ (Sorry)" },
    eid: { title: "Eid Mubarak", emojis: ["🤝", "🎇", "🫂"], question: "EID Mubarak 🌙", buttons: ["EID Mubarak"], label: "🌙 ঈদ মোবারক (Eid)" }
};

const cat_name = {
    choose_cat: "✨ কোন ক্যাটাগরির লিঙ্ক বানাতে চান?",
    cat_love: cat_config.love.label,
    cat_birthday: cat_config.birthday.label,
    cat_sorry: cat_config.sorry.label,
    cat_eid: cat_config.eid.label
};

function setupMakeLink(bot, db, saveDB, showCountdownPrompt, showMusicUploadPrompt) {
    bot.action('menu_makelink', (ctx) => {
        ctx.answerCbQuery();
        ctx.editMessageText(cat_name.choose_cat, Markup.inlineKeyboard([
            [Markup.button.callback(cat_name.cat_love, 'make_love')],
            [Markup.button.callback(cat_name.cat_birthday, 'make_birthday')],
            [Markup.button.callback(cat_name.cat_sorry, 'make_sorry')],
            [Markup.button.callback(cat_name.cat_eid, 'make_eid')],
            [Markup.button.callback("🔙 Back", 'go_to_main_menu')]
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
        showCountdownPrompt(ctx, db, saveDB, (c, d, s) => showMusicUploadPrompt(c, d, s, null), null);
    });
}

module.exports = { cat_config, cat_name, setupMakeLink };
