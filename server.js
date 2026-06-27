const express = require('express');
const path = require('path');
const axios = require('axios');
const { Telegraf } = require('telegraf');

const app = express();
app.use(express.json());

// ⚙️ আপনার টেলিগ্রাম বট টোকেন ও রেন্ডার লিঙ্ক
const TELEGRAM_TOKEN = "8922778423:AAGbdZfdUDol_5w3dPbeBH0aucf9qkgtPTA"; 
const SERVER_URL = "https://love-bb7p.onrender.com"; 
const ADMIN_CHAT_ID = "6719885052"; // 👈 আপনার চ্যাট আইডি পারফেক্টলি বসিয়ে দেওয়া হয়েছে

const bot = new Telegraf(TELEGRAM_TOKEN);
const linkDatabase = {}; 

// 🤖 ১. টেলিগ্রাম বট কমান্ড হ্যান্ডলার (Long Polling)
bot.command('newlink', (ctx) => {
    const fromUser = ctx.message.from;
    const userId = ctx.chat.id;
    const uniqueId = Math.random().toString(36).substring(2, 9);
    
    // ডাটাবেজে ইউজারের আইডি এবং নাম একসাথে সেভ করে রাখা হচ্ছে
    linkDatabase[uniqueId] = {
        userId: userId,
        name: `${fromUser.first_name} ${fromUser.last_name || ''}`,
        username: fromUser.username ? '@' + fromUser.username : 'নেই'
    }; 
    
    const generatedLink = `${SERVER_URL}/love/${uniqueId}`;
    
    // যে রিকোয়েস্ট করেছে তাকে লিঙ্ক পাঠানো
    ctx.reply(`💝 আপনার জিএফ এর জন্য একটি নতুন ইউনিক লিঙ্ক তৈরি হয়েছে:\n\n${generatedLink}\n\nএটি কপি করে তাকে পাঠিয়ে দিন! সে উত্তর দিলে আপনি এখানে নোটিফিকেশন পাবেন।`);

    // ২. অ্যাডভান্সড ট্র্যাকিং (ইউজার লিঙ্ক তৈরি করলে আপনাকে জানানো)
    const currentTime = new Date().toLocaleString("en-US", {timeZone: "Asia/Dhaka"});
    const userInfoMessage = `🚨 **New User Tracked!** 🚨\n\n` +
                            `👤 **Name:** ${linkDatabase[uniqueId].name}\n` +
                            `🆔 **User ID:** \`${userId}\`\n` +
                            `🔗 **Username:** ${linkDatabase[uniqueId].username}\n` +
                            `⏰ **Time (BD):** ${currentTime}\n` +
                            `📝 **Action:** Generated a new link (${uniqueId})`;

    // যদি রিকোয়েস্টকারী ব্যক্তি আপনি নিজে না হন, তবেই আপনাকে নোটিফিকেশন পাঠাবে
    if (String(userId) !== String(ADMIN_CHAT_ID)) {
        bot.telegram.sendMessage(ADMIN_CHAT_ID, userInfoMessage, { parse_mode: 'Markdown' })
            .catch(err => console.error("Admin notification failed:", err));
    }
});

// 🚀 ৩. বটের লং পোলিং কানেকশন চালু করা
bot.launch()
   .then(() => console.log("Super Advanced Telegram Bot started with ID: 6719885052"))
   .catch((err) => console.error("Bot launch failed:", err));

// 🌐 ৪. ওয়েবসাইট হ্যান্ডলার (জিএফ যখন লিঙ্কে ঢুকবে)
app.get('/love/:id', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 🔄 ৫. সেলফ-পিং এর জন্য রাউট
app.get('/ping_test', (req, res) => {
    res.send("Awake!");
});

// 💌 ৬. ওয়েবসাইট থেকে Yes/No রেসপন্স রিসিভ করা এবং আপনাকেও কপি পাঠানো
app.post('/api/respond', (req, res) => {
    const { response, id } = req.body;
    const linkData = linkDatabase[id]; 
    
    if (linkData) {
        // (A) মূল ইউজারের কাছে রেসপন্স পাঠানো
        bot.telegram.sendMessage(linkData.userId, `💌 আপনার পাঠানো লিঙ্কে একটি নতুন রেসপন্স এসেছে!\n\nউত্তর: ${response}`);
        
        // (B) আপনার (Admin) কাছেও রেসপন্স এবং ইউজারের নামসহ নোটিফিকেশন পাঠানো
        const adminResponseTime = new Date().toLocaleString("en-US", {timeZone: "Asia/Dhaka"});
        const adminNotification = `💬 **New Response Received!** 💬\n\n` +
                                  `👤 **User Name:** ${linkData.name}\n` +
                                  `🔗 **Username:** ${linkData.username}\n` +
                                  `🆔 **User ID:** \`${linkData.userId}\`\n` +
                                  `🎫 **Link ID:** ${id}\n` +
                                  `⏰ **Time:** ${adminResponseTime}\n\n` +
                                  `❤️ **GF's Reply:** \`${response}\``;

        // যদি এই রেসপন্সটি আপনার নিজের তৈরি করা লিঙ্ক থেকে না আসে, তবেই আপনাকে জানাবে
        if (String(linkData.userId) !== String(ADMIN_CHAT_ID)) {
            bot.telegram.sendMessage(ADMIN_CHAT_ID, adminNotification, { parse_mode: 'Markdown' })
                .catch(err => console.error("Admin response sync failed:", err));
        }

        res.json({ success: true });
    } else {
        res.json({ success: false, error: "Link expired or invalid" });
    }
});

// ⏰ ৭. সেলফ-পিং লজিক (রেন্ডারকে জাগিয়ে রাখতে)
setInterval(() => {
    axios.get(`${SERVER_URL}/ping_test`)
        .then(() => console.log("Self-Ping Successful!"))
        .catch((err) => console.log("Ping active."));
}, 270000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Web server running on port ${PORT}`));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
