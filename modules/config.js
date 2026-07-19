module.exports = {
    GITHUB_MUSIC_BASE_URL: "https://raw.githubusercontent.com/lovelatter/Love/main",
    AUTOMATIC_MUSIC_MAPPING: {
        love: "https://raw.githubusercontent.com/lovelatter/Love/main/love.mp3",
        birthday: "https://raw.githubusercontent.com/lovelatter/Love/main/bd.mp3",
        sorry: "https://raw.githubusercontent.com/lovelatter/Love/main/sorry.mp3",
        eid: "https://raw.githubusercontent.com/lovelatter/Love/main/eid.mp3"
    },
    CATEGORY_CONFIGS: {
        love: { title: "আমার মনের কিছু কথা", emojis: ["❤️", "💖", "💕"], question: "Do you love me? 🥺", buttons: ["Yes", "No"] },
        birthday: { title: "Happy Birthday", emojis: ["🎈", "🎉", "🎊"], question: "Are you happy? 😊", buttons: ["Yes", "No"] },
        sorry: { title: "I'm Sorry", emojis: ["😭", "😞", "😥"], question: "Do you forgive me? 🥺", buttons: ["Yes", "No"] },
        eid: { title: "Eid Mubarak", emojis: ["🤝", "🎇", "🫂"], question: "EID Mubarak 🌙", buttons: ["EID Mubarak"] }
    }
};
