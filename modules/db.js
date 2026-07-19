const fs = require('fs');
const path = require('path');
const DB_FILE = path.join(__dirname, '../database.json');

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
        const fileContent = fs.readFileSync(DB_FILE, 'utf8');
        if (fileContent && fileContent.trim() !== "") {
            db = { ...db, ...JSON.parse(fileContent) };
        }
    } else {
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    }
} catch (e) {
    console.error("Database loading error, starting with fresh state:", e);
}

const saveDB = () => {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    } catch (e) {
        console.error("Failed to save database:", e);
    }
};

module.exports = { db, saveDB };
