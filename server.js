const express = require('express');
const path = require('path');
const { Telegraf } = require('telegraf');

const app = express();
app.use(express.json());

// ⚙️ আপনার টেলিগ্রাম বট টোকেন
const TELEGRAM_TOKEN = "8922778423:AAGbdZfdUDol_5w3dPbeBH0aucf9qkgtPTA"; 
const bot = new Telegraf(TELEGRAM_TOKEN);

// ⚙️ আপনার রেন্ডার সার্ভারের মূল লিঙ্ক (শেষে কোনো '/' থাকবে না)
const SERVER_URL = "https://love-bb7p.onrender.com"; 

// লিঙ্ক ট্র্যাকিং ডাটাবেজ
const linkDatabase = {};

// 🤖 টেলিগ্রাম বট কমান্ড (Long Polling-এর মাধ্যমে ইনস্ট্যান্ট কাজ করবে)
bot.command('newlink', (ctx) => {
    const userId = ctx.chat.id;
    const uniqueId = Math.random().toString(36).substring(2, 9); // ইউনিক আইডি জেনারেটর
    
    linkDatabase[uniqueId] = userId; 
    const generatedLink = `${SERVER_URL}/love/${uniqueId}`;
    
    ctx.reply(`💝 আপনার জিএফ এর জন্য একটি নতুন ইউনিক লিঙ্ক তৈরি হয়েছে:\n\n${generatedLink}\n\nএটি কপি করে তাকে পাঠিয়ে দিন! সে উত্তর দিলে আপনি এখানে নোটিফিকেশন পাবেন।`);
});

// 🚀 বটের লং পোলিং কানেকশন চালু করা
bot.launch()
   .then(() => console.log("Telegram Bot started via Long Polling!"))
   .catch((err) => console.error("Bot launch failed:", err));

// 🌐 জিএফ যখন লিঙ্কে ঢুকবে (ওয়েবসাইট হ্যান্ডলার)
app.get('/love/:id', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 💌 ওয়েবসাইট থেকে Yes/No রেসপন্স রিসিভ করা
app.post('/api/respond', (req, res) => {
    const { response, id } = req.body;
    const originalUserId = linkDatabase[id];
    
    if (originalUserId) {
        // ইনস্ট্যান্ট মেসেজ পাঠানো
        bot.telegram.sendMessage(originalUserId, `💌 আপনার পাঠানো লিঙ্কে একটি নতুন রেসপন্স এসেছে!\n\nউত্তর: ${response}`)
            .then(() => res.json({ success: true }))
            .catch(() => res.json({ success: false }));
    } else {
        res.json({ success: false, error: "Link expired or invalid" });
    }
});

// Render সার্ভারকে পোর্ট দেওয়া
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Web server running on port ${PORT}`));

// প্রোসেস বন্ধ হলে বট সেফলি বন্ধ করার কোড
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
