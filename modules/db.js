const axios = require('axios');

const BIN_ID = process.env.JSONBIN_ID;
const MASTER_KEY = process.env.JSONBIN_KEY;
const API_URL = `https://api.jsonbin.io/v3/b/${BIN_ID}`;

const loadDB = async () => {
    try {
        const response = await axios.get(API_URL, {
            headers: { 'X-Master-Key': MASTER_KEY }
        });
        return response.data.record;
    } catch (e) {
        console.error("Error loading DB from JSONBin:", e);
        return null;
    }
};

const saveDB = async (db) => {
    try {
        await axios.put(API_URL, db, {
            headers: { 
                'Content-Type': 'application/json',
                'X-Master-Key': MASTER_KEY 
            }
        });
    } catch (e) {
        console.error("Error saving DB to JSONBin:", e);
    }
};

module.exports = { loadDB, saveDB };
