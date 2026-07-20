const axios = require('axios');

const BIN_ID = "6a5e6f7cda38895dfe779bd1";
const MASTER_KEY = "$2a$10$7d4vjd6O6sxPUgHsYHbtuOyGuv70ZikFBSsFwXRLkmLL7zY6dt6im";

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
