const https = require('https');

const BIN_ID = process.env.JSONBIN_ID;
const MASTER_KEY = process.env.JSONBIN_KEY;
const API_URL = `https://api.jsonbin.io/v3/b/${BIN_ID}`;

let db = {
    linkDatabase: {},
    userSessions: {},
    totalLinksCreated: 0,
    isMaintenanceMode: false,
    bannedUsers: [],
    registeredUsers: [],
    usernameMap: {}
};

// JSONBin Load Function
const loadDB = () => {
    return new Promise((resolve) => {
        if (!BIN_ID || !MASTER_KEY) {
            console.log("JSONBin credentials missing, using default empty db.");
            return resolve();
        }
        const url = `${API_URL}/latest`;
        https.get(url, {
            headers: {
                'X-Master-Key': MASTER_KEY
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed && parsed.record) {
                        db.linkDatabase = parsed.record.linkDatabase || {};
                        db.userSessions = parsed.record.userSessions || {};
                        db.totalLinksCreated = parsed.record.totalLinksCreated || 0;
                        db.isMaintenanceMode = parsed.record.isMaintenanceMode || false;
                        db.bannedUsers = parsed.record.bannedUsers || [];
                        db.registeredUsers = parsed.record.registeredUsers || [];
                        db.usernameMap = parsed.record.usernameMap || {};
                        
                        console.log("Database loaded successfully from JSONBin. Total Users:", db.registeredUsers.length);
                    }
                } catch (e) {
                    console.error("Error parsing JSONBin data:", e);
                }
                resolve();
            });
        }).on('error', (err) => {
            console.error("Error loading from JSONBin:", err);
            resolve();
        });
    });
};

// JSONBin Save Function (Promiseified for safety)
const saveDB = () => {
    return new Promise((resolve) => {
        if (!BIN_ID || !MASTER_KEY) return resolve();
        const dataString = JSON.stringify(db);
        
        const req = https.request(API_URL, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Master-Key': MASTER_KEY,
                'Content-Length': Buffer.byteLength(dataString)
            }
        }, (res) => {
            let responseBody = '';
            res.on('data', chunk => responseBody += chunk);
            res.on('end', () => {
                if (res.statusCode !== 200) {
                    console.error("Failed to update JSONBin, status:", res.statusCode, responseBody);
                }
                resolve();
            });
        });

        req.on('error', (e) => {
            console.error("Error saving to JSONBin:", e);
            resolve();
        });

        req.write(dataString);
        req.end();
    });
};

module.exports = {
    db,
    loadDB,
    saveDB
};
