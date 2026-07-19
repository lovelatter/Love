const path = require('path');
const fs = require('fs');

const DB_FILE = path.join(__dirname, '../db.json');
const UPLOADS_DIR = path.join(__dirname, '../uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

let db = {
    linkDatabase: {},
    userSessions: {},
    totalLinksCreated: 0,
    isMaintenanceMode: false,
    bannedUsers: [],
    registeredUsers: [],
    usernameMap: {}
};

try {
    if (fs.existsSync(DB_FILE)) {
        db = { ...db, ...JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) };
    } else {
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    }
} catch (e) {
    console.error(e);
}

const saveDB = () => {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    } catch (e) {
        console.error(e);
    }
};

const CATEGORY_CONFIGS = {
    love: { title: "আমার মনের কিছু কথা", emojis: ["❤️", "💖", "💕"], question: "Do you love me? 🥺", buttons: ["Yes", "No"] },
    birthday: { title: "Happy Birthday", emojis: ["🎈", "🎉", "🎊"], question: "Are you happy? 😊", buttons: ["Yes", "No"] },
    sorry: { title: "I'm Sorry", emojis: ["😭", "😞", "😥"], question: "Do you forgive me? 🥺", buttons: ["Yes", "No"] },
    eid: { title: "Eid Mubarak", emojis: ["🤝", "🎇", "🫂"], question: "EID Mubarak 🌙", buttons: ["EID Mubarak"] }
};

module.exports = { db, saveDB, CATEGORY_CONFIGS, UPLOADS_DIR };
