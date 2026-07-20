const axios = require('axios');

// এনভায়রনমেন্ট ভেরিয়েবল চেক করে নেওয়া
const BIN_ID = process.env.JSONBIN_ID;
const MASTER_KEY = process.env.JSONBIN_KEY;

/**
 * JSONBin থেকে ডাটা রিড করার ফাংশন
 */
async function getDB() {
    if (!BIN_ID || !MASTER_KEY) {
        console.error("❌ Error: JSONBIN_ID or JSONBIN_KEY is not defined in environment variables.");
        return null;
    }
    try {
        const res = await axios.get(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
            headers: { 
                'X-Master-Key': MASTER_KEY 
            }
        });
        return res.data.record;
    } catch (e) {
        console.error("❌ Error reading DB:", e.response ? e.response.data : e.message);
        return null;
    }
}

/**
 * JSONBin এ ডাটা সেভ করার ফাংশন
 * @param {Object} data 
 */
async function saveDB(data) {
    if (!BIN_ID || !MASTER_KEY) {
        console.error("❌ Error: Cannot save, missing BIN_ID or MASTER_KEY.");
        return;
    }
    try {
        await axios.put(`https://api.jsonbin.io/v3/b/${BIN_ID}`, data, {
            headers: { 
                'X-Master-Key': MASTER_KEY, 
                'Content-Type': 'application/json' 
            }
        });
        // কনসোল লগ প্রয়োজন হলে রাখতে পারেন
    } catch (e) {
        console.error("❌ Error saving DB:", e.response ? e.response.data : e.message);
    }
}

module.exports = { getDB, saveDB };
