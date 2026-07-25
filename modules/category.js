const cat_config = {
    love: { title: "আমার মনের কিছু কথা", emojis: ["❤️", "💖", "💕"], question: "Do you love me? 🥺", buttons: ["Yes", "No"], label: "❤️ প্রেমের চিঠি (Love)" },
    birthday: { title: "Happy Birthday", emojis: ["🎈", "🎉", "🎊"], question: "Are you happy? 😊", buttons: ["Yes", "No"], label: "🎂 জন্মদিনের শুভেচ্ছা (Birthday)" },
    sorry: { title: "I'm Sorry", emojis: ["😭", "😞", "😥"], question: "Do you forgive me? 🥺", buttons: ["Yes", "No"], label: "🥺 দুঃখ প্রকাশ (Sorry)" },
    eid: { title: "Eid Mubarak", emojis: ["🤝", "🎇", "🫂"], question: "EID Mubarak 🌙", buttons: ["EID Mubarak"], label: "🌙 ঈদ মোবারক (Eid)" }
};

const localeCategories = {
    choose_cat: "✨ কোন ক্যাটাগরির লিঙ্ক বানাতে চান?",
    cat_love: cat_config.love.label,
    cat_birthday: cat_config.birthday.label,
    cat_sorry: cat_config.sorry.label,
    cat_eid: cat_config.eid.label
};

module.exports = { cat_config, localeCategories };
