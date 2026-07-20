const axios = require('axios');

const BIN_ID = process.env.JSONBIN_ID;
const MASTER_KEY = process.env.JSONBIN_KEY;
const API_URL = `https://api.jsonbin.io/v3/b/${BIN_ID}`;

// ডাটা নিয়ে আসার জন্য
async function getData() {
    try {
        const response = await axios.get(API_URL, {
            headers: { 'X-Master-Key': MASTER_KEY }
        });
        return response.data.record;
    } catch (error) {
        console.error("Error fetching data from JSONBin:", error);
        return {}; // ডাটা না পেলে খালি অবজেক্ট রিটার্ন করবে
    }
}

// ডাটা সেভ করার জন্য
async function saveData(data) {
    try {
        await axios.put(API_URL, data, {
            headers: { 
                'Content-Type': 'application/json',
                'X-Master-Key': MASTER_KEY 
            }
        });
    } catch (error) {
        console.error("Error saving data to JSONBin:", error);
    }
}

module.exports = { getData, saveData };
