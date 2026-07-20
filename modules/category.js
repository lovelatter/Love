const CATEGORY_CONFIGS = {
    love: { title: "আমার মনের কিছু কথা", emojis: ["❤️", "💖", "💕"], question: "Do you love me? 🥺", buttons: ["Yes", "No"], label: "❤️ প্রেমের চিঠি (Love)" },
    birthday: { title: "Happy Birthday", emojis: ["🎈", "🎉", "🎊"], question: "Are you happy? 😊", buttons: ["Yes", "No"], label: "🎂 জন্মদিনের শুভেচ্ছা (Birthday)" },
    sorry: { title: "I'm Sorry", emojis: ["😭", "😞", "😥"], question: "Do you forgive me? 🥺", buttons: ["Yes", "No"], label: "🥺 দুঃখ প্রকাশ (Sorry)" },
    eid: { title: "Eid Mubarak", emojis: ["🤝", "🎇", "🫂"], question: "EID Mubarak 🌙", buttons: ["EID Mubarak"], label: "🌙 ঈদ মোবারক (Eid)" }
};

const localeCategories = {
    choose_cat: "✨ আপনি কোন ক্যাটাগরির লিঙ্ক করতে চান?",
    cat_love: CATEGORY_CONFIGS.love.label,
    cat_birthday: CATEGORY_CONFIGS.birthday.label,
    cat_sorry: CATEGORY_CONFIGS.sorry.label,
    cat_eid: CATEGORY_CONFIGS.eid.label
};

module.exports = { CATEGORY_CONFIGS, localeCategories };
