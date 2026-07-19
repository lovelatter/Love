const fs = require('fs');
const path = require('path');
const DB_FILE = path.join(__dirname, '../db.json');

let db = { linkDatabase: {}, userSessions: {}, totalLinksCreated: 0, isMaintenanceMode: false, bannedUsers: [], registeredUsers: [], usernameMap: {} };

try {
    if (fs.existsSync(DB_FILE)) db = { ...db, ...JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) };
} catch (e) { console.error(e); }

const saveDB = () => { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); };

module.exports = { db, saveDB };
