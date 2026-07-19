const fs = require('fs');
const { DB_FILE } = require('./config');

let db = {
    linkDatabase: {}, userSessions: {}, totalLinksCreated: 0,
    isMaintenanceMode: false, bannedUsers: [], registeredUsers: [], usernameMap: {}
};

try {
    if (fs.existsSync(DB_FILE)) {
        db = { ...db, ...JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) };
    } else {
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    }
} catch (e) { console.error(e); }

const saveDB = () => {
    try { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); } catch (e) { console.error(e); }
};

const isAdmin = (userId, ADMIN_IDS) => ADMIN_IDS.includes(userId.toString());

const parseUserAgent = (ua) => {
    let os = "Unknown OS", browser = "Unknown Browser";
    if (!ua) return { os, browser };
    if (ua.includes("Windows")) os = "Windows PC";
    else if (ua.includes("Android")) os = "Android Mobile";
    else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS (iPhone/iPad)";
    else if (ua.includes("Macintosh")) os = "Mac OS";
    else if (ua.includes("Linux")) os = "Linux PC";
    if (ua.includes("Telegram")) browser = "Telegram App Browser";
    else if (ua.includes("FBA2N") || ua.includes("FBAV")) browser = "Facebook App Browser";
    else if (ua.includes("Chrome")) browser = "Google Chrome";
    else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Safari";
    else if (ua.includes("Firefox")) browser = "Mozilla Firefox";
    else if (ua.includes("Edge")) browser = "Microsoft Edge";
    return { os, browser };
};

module.exports = { db, saveDB, isAdmin, parseUserAgent };
