const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();

app.use(express.json());

// ⚙️ আপনার মূল বট টোকেনটি এখানে দিন
const TELEGRAM_TOKEN = "8922778423:AAGbdZfdUDol_5w3dPbeBH0aucf9qkgtPTA"; 
const SERVER_URL = process.env.RENDER_EXTERNAL_URL || "http://localhost:3000";

const linkDatabase = {}; 

// ১. টেলিগ্রাম বট থেকে যেকোনো ইউজারের /newlink কমান্ড রিসিভ করা
app.post(`/bot${TELEGRAM_TOKEN}`, (req, res) => {
    const message = req.body.message;
    
    if (message && message.text === '/newlink') {
        const userId = message.chat.id; 
        const uniqueId = Math.random().toString(36).substring(2, 9); // ইউনিক আইডি তৈরি (যেমন: a7x3k9)
        
        linkDatabase[uniqueId] = userId; 
        const generatedLink = `${SERVER_URL}/love/${uniqueId}`;
        
        axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
            chat_id: userId,
            text: `💝 আপনার জিএফ এর জন্য একটি নতুন ইউনিক লিঙ্ক তৈরি হয়েছে:\n\n${generatedLink}\n\nএটি কপি করে তাকে পাঠিয়ে দিন! সে উত্তর দিলে আপনি এখানে নোটিফিকেশন পাবেন।`
        });
    }
    return res.sendStatus(200);
});

// ২. জিএফ যখন ওয়েবসাইটে ঢুকবে তখন HTML ফাইল দেখানো
app.get('/love/:id', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ৩. ওয়েবসাইট থেকে Yes/No আসলে সঠিক ইউজারের চ্যাটে পাঠানো
app.post('/api/respond', (req, res) => {
    const { response, id } = req.body;
    const originalUserId = linkDatabase[id];
    
    if (originalUserId) {
        axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
            chat_id: originalUserId,
            text: `💌 আপনার পাঠানো লিঙ্কে একটি নতুন রেসপন্স এসেছে!\n\nউত্তর: ${response}`
        })
        .then(() => res.json({ success: true }))
        .catch(() => res.json({ success: false }));
    } else {
        res.json({ success: false, error: "Link expired or invalid" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
