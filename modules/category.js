const { Markup } = require('telegraf');

const CATEGORY_MENU_TEXT = {
    choose_cat: "✨ আপনি কোন ক্যাটাগরির লিঙ্ক করতে চান?",
    cat_love: "❤️ প্রেমের চিঠি (Love)",
    cat_birthday: "🎂 জন্মদিনের শুভেচ্ছা (Birthday)",
    cat_sorry: "🥺 দুঃখ প্রকাশ (Sorry)",
    cat_eid: "🌙 ঈদ মোবারক (Eid)"
};

const CATEGORY_CONFIGS = {
    love: { title: "আমার মনের কিছু কথা", emojis: ["❤️", "💖", "💕"], question: "Do you love me? 🥺", buttons: ["Yes", "No"] },
    birthday: { title: "Happy Birthday", emojis: ["🎈", "🎉", "🎊"], question: "Are you happy? 😊", buttons: ["Yes", "No"] },
    sorry: { title: "I'm Sorry", emojis: ["😭", "😞", "😥"], question: "Do you forgive me? 🥺", buttons: ["Yes", "No"] },
    eid: { title: "Eid Mubarak", emojis: ["🤝", "🎇", "🫂"], question: "EID Mubarak 🌙", buttons: ["EID Mubarak"] }
};

const getCategoryKeyboard = (btn_back) => {
    return Markup.inlineKeyboard([
        [Markup.button.callback(CATEGORY_MENU_TEXT.cat_love, 'make_love')],
        [Markup.button.callback(CATEGORY_MENU_TEXT.cat_birthday, 'make_birthday')],
        [Markup.button.callback(CATEGORY_MENU_TEXT.cat_sorry, 'make_sorry')],
        [Markup.button.callback(CATEGORY_MENU_TEXT.cat_eid, 'make_eid')],
        [Markup.button.callback(btn_back, 'go_to_main_menu')]
    ]);
};

module.exports = { CATEGORY_CONFIGS, getCategoryKeyboard, CATEGORY_MENU_TEXT };
