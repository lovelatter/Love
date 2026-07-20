const axios = require('axios');

const BIN_ID = process.env.JSONBIN_ID;
const MASTER_KEY = process.env.JSONBIN_KEY;

async function getDB() {
    try {
        const res = await axios.get(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
            headers: { 'X-Master-Key': MASTER_KEY }
        });
        return res.data.record;
    } catch (e) {
        console.error("Error reading DB:", e);
        return null;
    }
}

async function saveDB(data) {
    try {
        await axios.put(`https://api.jsonbin.io/v3/b/${BIN_ID}`, data, {
            headers: { 
                'X-Master-Key': MASTER_KEY, 
                'Content-Type': 'application/json' 
            }
        });
    } catch (e) {
        console.error("Error saving DB:", e);
    }
}

module.exports = { getDB, saveDB };
