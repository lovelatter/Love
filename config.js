const path = require('path');
const fs = require('fs');

const ADMIN_IDS = (process.env.ADMIN_CHAT_ID || "").split(',').map(id => id.trim()).filter(id => id !== "");
const SERVER_URL = "https://love-bb7p.onrender.com";
const DB_FILE = path.join(__dirname, '../db.json');
const UPLOADS_DIR = path.join(__dirname, '../uploads');
const GITHUB_MUSIC_BASE_URL = "https://raw.githubusercontent.com/lovelatter/Love/main";

const AUTOMATIC_MUSIC_MAPPING = {
    love: `${GITHUB_MUSIC_BASE_URL}/love.mp3`,
    birthday: `${GITHUB_MUSIC_BASE_URL}/bd.mp3`,
    sorry: `${GITHUB_MUSIC_BASE_URL}/sorry.mp3`,
    eid: `${GITHUB_MUSIC_BASE_URL}/eid.mp3`
};

const CATEGORY_CONFIGS = {
    love: { title: "আমার মনের কিছু কথা", emojis: ["❤️", "💖", "💕"], question: "Do you love me? 🥺", buttons: ["Yes", "No"] },
    birthday: { title: "Happy Birthday", emojis: ["🎈", "🎉", "🎊"], question: "Are you happy? 😊", buttons: ["Yes", "No"] },
    sorry: { title: "I'm Sorry", emojis: ["😭", "😞", "😥"], question: "Do you forgive me? 🥺", buttons: ["Yes", "No"] },
    eid: { title: "Eid Mubarak", emojis: ["🤝", "🎇", "🫂"], question: "EID Mubarak 🌙", buttons: ["EID Mubarak"] }
};

if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

module.exports = { ADMIN_IDS, SERVER_URL, DB_FILE, UPLOADS_DIR, AUTOMATIC_MUSIC_MAPPING, CATEGORY_CONFIGS };
