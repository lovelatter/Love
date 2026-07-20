const axios = require('axios');

const BIN_ID = process.env.JSONBIN_ID;
const MASTER_KEY = process.env.JSONBIN_KEY;
const API_URL = `https://api.jsonbin.io/v3/b/${BIN_ID}`;

// প্রাথমিক ডাটা স্ট্রাকচার
const defaultDB = {
    linkDatabase: {},
    userSessions: {},
    totalLinksCreated: 0,
    isMaintenanceMode: false,
    bannedUsers: [],
    registeredUsers: [],
    usernameMap: {}
};

let db = { ...defaultDB };

const loadDB = async () => {
    try {
        const response = await axios.get(`${API_URL}/latest`, {
            headers: { 'X-Master-Key': MASTER_KEY }
        });
        db = { ...defaultDB, ...response.data.record };
        return db;
    } catch (error) {
        console.error("Error loading DB from JSONBIN:", error.message);
        return db;
    }
};

const saveDB = async () => {
    try {
        await axios.put(API_URL, db, {
            headers: { 
                'Content-Type': 'application/json',
                'X-Master-Key': MASTER_KEY 
            }
        });
    } catch (error) {
        console.error("Error saving DB to JSONBIN:", error.message);
    }
};

module.exports = { 
    getDB: () => db, 
    loadDB, 
    saveDB 
};
