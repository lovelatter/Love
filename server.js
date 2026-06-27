const express = require('express');
const path = require('path');
const axios = require('axios');
const { Telegraf } = require('telegraf');
const fs = require('fs');

const app = express();
app.use(express.json());

const TELEGRAM_TOKEN = "8922778423:AAGbdZfdUDol_5w3dPbeBH0aucf9qkgtPTA"; 
const SERVER_URL = "https://love-bb7p.onrender.com"; 
const ADMIN_CHAT_ID = "6719885052"; 

const bot = new Telegraf(TELEGRAM_TOKEN);

const linkDatabase = {}; 
const userSessions = {}; 
const registeredUsers = new Set(); 
const bannedUsers = new Set(); 
let isMaintenanceMode = false; 

linkDatabase['demo'] = {
    userId: ADMIN_CHAT_ID,
    name: "Developer",
    username: "@admin",
    type: "love",
    animations: ["হ্যালো প্রিয়", "কেমন আছো?", "তোমার জন্য একটা সারপ্রাইজ আছে... 👀"],
    letter: "এটি একটি ডেমো লাভ লেটার।\nআপনি যখন আপনার কাস্টম লিঙ্ক তৈরি করবেন, তখন আপনার দেওয়া চিঠিটি ঠিক এই খামের ভেতর এভাবে সুন্দর করে দেখাবে! ❤️",
    isActive: true
};

bot.use((ctx, next) => {
    const userId = ctx.chat ? ctx.chat.id : null;
    if (!userId) return next();

    if (String(userId) === String(ADMIN_CHAT_ID)) return next();
    if (bannedUsers.has(userId)) return;

    if (isMaintenanceMode && ctx.message && ctx.message.text !== '/start') {
        return ctx.reply("🚧 **বটে মেইনটেন্যান্স (উন্নয়নমূলক কাজ) চলছে!**\n\nকিছুক্ষণ পর আবার চেষ্টা করুন। সাময়িক অসুবিধার জন্য আমরা আন্তরিকভাবে দুঃখিত। 🛠");
    }

    return next();
});

bot.command('start', (ctx) => {
    const firstName = ctx.message.from.first_name;
    const userId = ctx.chat.id;
    
    registeredUsers.add(userId);

    ctx.reply(`💝 **হ্যালো ${firstName}!** 💝\n\n` +
              `স্পেশাল লাভ-লেটার এবং বার্থডে উইশ লিঙ্ক তৈরি করার বট-এ আপনাকে স্বাগত! 🥰\n\n` +
              `🚀 **নিচের কমান্ডগুলো ব্যবহার করুন:**\n\n` +
              `👉 /loveletter - নতুন লাভ লিঙ্ক তৈরি করুন। ❤️\n` +
              `👉 /birthdaywish - নতুন বার্থডে উইশ লিঙ্ক তৈরি করুন। 🎂\n` +
              `👀 /demo - পেজটি কেমন লাগবে তার ডেমো দেখুন।\n` +
              `🔒 /off - আপনার তৈরি করা কোনো লিঙ্ক বন্ধ করুন।\n` +
              `📊 /stats - আপনার তৈরি লিঙ্কের রিপোর্ট দেখুন।\n` +
              `📝 /feedback - ডেভেলপারের কাছে আপনার মতামত পাঠান।\n` +
              `❓ /help - বিস্তারিত গাইডলাইন দেখতে।`);
});

bot.command('adm', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return;

    ctx.reply(`👑 **স্বাগতম বস! আপনার কমপ্লিট অ্যাডমিন ড্যাশবোর্ড:**\n\n` +
              `📊 /admin - বটের পরিসংখ্যান দেখতে।\n` +
              `📋 /alllinks - সব তৈরি হওয়া লিঙ্কের লিস্ট দেখতে।\n` +
              `🚫 /banlink [আইডি] - নির্দিষ্ট কোনো লিঙ্ক ব্লক করতে。\n` +
              `🔍 /linkdetails [আইডি] - লিঙ্কের মেকার ও লেটার দেখতে।\n` +
              `🧼 /cleanlinks - অফ করা লিঙ্কগুলো ডাটাবেজ থেকে মুছে ফেলতে।\n` +
              `💥 /nukelinks - এক ক্লিকে সব ইউজারের সব লিঙ্ক ডিলিট করতে! 🔥\n\n` +
              `👤 /userinfo [User_ID] - নির্দিষ্ট ইউজারের তথ্য দেখতে।\n` +
              `⛔ /blockuser [User_ID] - ইউজারকে বট থেকে ব্যান করতে।\n` +
              `🔓 /unblockuser [User_ID] - ইউজারকে আনব্যান করতে।\n\n` +
              `⚙️ /maintenance [on/off] - মেইনটেন্যান্স মোড অন/অফ করতে।\n` +
              `💾 /backup - ডাটাবেজের টেক্সট ব্যাকআপ ফাইল নিতে।\n` +
              `📢 /broadcast [মেসেজ] - সব ইউজারকে নোটিফিকেশন পাঠাতে।`, { parse_mode: 'Markdown' });
});

bot.command('nukelinks', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return;

    const count = Object.keys(linkDatabase).length - 1; 
    
    for (let key in linkDatabase) {
        if (key !== 'demo') {
            delete linkDatabase[key];
        }
    }

    ctx.reply(`🔥 **অপারেশন সাকসেসফুল বস!**\n\nডাটাবেজে থাকা সমস্ত ইউজারের তৈরি করা মোট \`${count}\`টি লিঙ্ক সফলভাবে বন্ধ এবং ডিলিট করে দেওয়া হয়েছে!`, { parse_mode: 'Markdown' });
});

bot.command('admin', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return;
    const totalUsers = registeredUsers.size;
    const totalLinks = Object.keys(linkDatabase).length - 1; 
    ctx.reply(`📊 **বটের লাইভ পরিসংখ্যান:**\n\n👥 মোট একটিভ ইউজার: \`${totalUsers}\` জন\n🔗 মোট জেনারেট হওয়া লিঙ্ক: \`${totalLinks}\` টি\n🚫 মোট ব্যান ইউজার: \`${bannedUsers.size}\` জন\n⚙️ মেইনটেন্যান্স মোড: \`${isMaintenanceMode ? "ON 🚧" : "OFF 🟢"}\``, { parse_mode: 'Markdown' });
});

bot.command('alllinks', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return;
    let list = [];
    Object.keys(linkDatabase).forEach(id => {
        if (id !== 'demo') {
            const status = linkDatabase[id].isActive !== false ? "🟢 চালু" : "🔴 ব্লকড";
            const typeEmoji = linkDatabase[id].type === 'birthday' ? "🎂" : "💝";
            list.push(`${typeEmoji} ID: \`${id}\` | মেকার: ${linkDatabase[id].name} [${status}]`);
        }
    });
    if (list.length === 0) return ctx.reply("💡 ডাটাবেজে এখনও কোনো লিঙ্ক তৈরি হয়নি।");
    ctx.reply(`📋 **বটের সমস্ত লিঙ্কের লিস্ট:**\n\n${list.join('\n')}`, { parse_mode: 'Markdown' });
});

bot.command('banlink', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return;
    const targetId = ctx.message.text.replace('/banlink', '').trim();
    if (!targetId || !linkDatabase[targetId] || targetId === 'demo') return ctx.reply("❌ সঠিক লিঙ্ক আইডি দিন!");
    
    linkDatabase[targetId].isActive = false;
    ctx.reply(`🚫 লিঙ্ক \`${targetId}\` সফলভাবে ব্লক করা হয়েছে!`, { parse_mode: 'Markdown' });
    bot.telegram.sendMessage(linkDatabase[targetId].userId, `⚠️ **নোটিশ:** অ্যাডমিন প্যানেল থেকে আপনার লিঙ্কটি (\`${targetId}\`) ব্লক করা হয়েছে।`).catch(e => {});
});

bot.command('linkdetails', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return;
    const targetId = ctx.message.text.replace('/linkdetails', '').trim();
    if (!targetId || !linkDatabase[targetId]) return ctx.reply("❌ সঠিক লিঙ্ক আইডি দিন!");

    const data = linkDatabase[targetId];
    ctx.reply(`🔍 **লিঙ্ক আইডি: ${targetId} এর ডিটেইলস:**\n\n👤 মেকার: ${data.name} (${data.username})\n🏷 টাইপ: \`${data.type || 'love'}\`\n🎬 অ্যানিমেশন: \`${JSON.stringify(data.animations)}\`\n💌 চিঠি:\n"${data.letter}"`, { parse_mode: 'Markdown' });
});

bot.command('cleanlinks', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return;
    let count = 0;
    Object.keys(linkDatabase).forEach(id => {
        if (id !== 'demo' && linkDatabase[id].isActive === false) {
            delete linkDatabase[id];
            count++;
        }
    });
    ctx.reply(`🧼 ডাটাবেজ ক্লিন করা হয়েছে। মোট \`${count}\`টি নিষ্ক্রিয় লিঙ্ক ডিলিট করা হয়েছে।`, { parse_mode: 'Markdown' });
});

bot.command('userinfo', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return;
    const targetUid = ctx.message.text.replace('/userinfo', '').trim();
    if (!targetUid) return ctx.reply("❌ ব্যবহার: /userinfo [User_ID]");

    let userLinksCount = 0;
    Object.keys(linkDatabase).forEach(id => {
        if (String(linkDatabase[id].userId) === String(targetUid)) userLinksCount++;
    });

    const isBanned = bannedUsers.has(Number(targetUid)) || bannedUsers.has(targetUid);
    ctx.reply(`👤 **ইউজার ইনফরমেশন:**\n\n🆔 ইউজার আইডি: \`${targetUid}\`\n📊 তৈরি করা মোট লিঙ্ক: \`${userLinksCount}\` টি\n🚦 স্ট্যাটাস: ${isBanned ? "🔴 ব্যানড" : "🟢 সচল"}`, { parse_mode: 'Markdown' });
});

bot.command('blockuser', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return;
    const targetUid = ctx.message.text.replace('/blockuser', '').trim();
    if (!targetUid || String(targetUid) === String(ADMIN_CHAT_ID)) return ctx.reply("❌ সঠিক ইউজার আইডি দিন!");

    bannedUsers.add(Number(targetUid));
    bannedUsers.add(targetUid);
    ctx.reply(`🚫 ইউজার \`${targetUid}\`-কে সফলভাবে বট থেকে ব্যান করা হয়েছে!`, { parse_mode: 'Markdown' });
});

bot.command('unblockuser', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return;
    const targetUid = ctx.message.text.replace('/unblockuser', '').trim();
    if (!targetUid) return ctx.reply("❌ সঠিক ইউজার আইডি দিন!");

    bannedUsers.delete(Number(targetUid));
    bannedUsers.delete(targetUid);
    ctx.reply(`🔓 ইউজার \`${targetUid}\`-কে আনব্যান করা হয়েছে।`, { parse_mode: 'Markdown' });
});

bot.command('maintenance', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return;
    const mode = ctx.message.text.replace('/maintenance', '').trim().toLowerCase();
    
    if (mode === 'on') {
        isMaintenanceMode = true;
        ctx.reply("🚧 মেইনটেন্যান্স মোড **চালু (ON)** করা হয়েছে।");
    } else if (mode === 'off') {
        isMaintenanceMode = false;
        ctx.reply("🟢 মেইনটেন্যান্স মোড **বন্ধ (OFF)** করা হয়েছে।");
    }
});

bot.command('backup', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return;
    try {
        const backupData = JSON.stringify(linkDatabase, null, 2);
        fs.writeFileSync('backup.txt', backupData);
        ctx.replyWithDocument({ source: fs.createReadStream('backup.txt'), filename: 'database_backup.txt' }, { caption: "💾 বটের বর্তমান ডাটাবেজ ব্যাকআপ ফাইল।" });
    } catch(e) { ctx.reply("❌ ব্যাকআপ নিতে সমস্যা হয়েছে।"); }
});

bot.command('broadcast', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return;
    const msg = ctx.message.text.replace('/broadcast', '').trim();
    if (!msg) return ctx.reply("❌ ব্যবহার নিয়ম: \`/broadcast আপনার মেসেজ\`");

    let successCount = 0;
    registeredUsers.forEach(uId => {
        bot.telegram.sendMessage(uId, `📢 **অফিসিয়াল নোটিফিকেশন:**\n\n${msg}`).then(() => {
            successCount++;
        }).catch(e => {});
    });
    ctx.reply(`📢 ব্রডকাস্ট সম্পন্ন! সফলভাবে \`${successCount}\` জন ইউজারের কাছে মেসেজ পাঠানো হয়েছে।`, { parse_mode: 'Markdown' });
});

bot.command('help', (ctx) => {
    ctx.reply(`❓ **কীভাবে এই বটটি ব্যবহার করবেন?**\n\n১. লাভ লেটার লিঙ্ক তৈরি করতে /loveletter কমান্ড দিন।\n২. বার্থডে উইশ লিঙ্ক তৈরি করতে /birthdaywish কমান্ড দিন।\n\n🔒 **লিঙ্ক বন্ধ করার নিয়ম:**\nআপনার তৈরি করা কোনো লিঙ্ক বন্ধ করতে টাইপ করুন: \n\`/off লিঙ্ক_আইডি\`\n\n❌ মাঝপথে বাতিল করতে /cancel টাইপ করতে পারেন।`);
});

bot.command('stats', (ctx) => {
    const userId = ctx.chat.id;
    let myLinks = [];
    Object.keys(linkDatabase).forEach(id => {
        if (linkDatabase[id].userId === userId && id !== 'demo') {
            const status = linkDatabase[id].isActive !== false ? "🟢 চালু" : "🔴 বন্ধ";
            const typeText = linkDatabase[id].type === 'birthday' ? "Birthday" : "Love";
            myLinks.push(`🎫 আইডি: \`${id}\` (${typeText}) [${status}]`);
        }
    });
    if (myLinks.length === 0) {
        ctx.reply("❌ আপনি এখনও কোনো লিঙ্ক তৈরি করেননি। নতুন লিঙ্ক তৈরি করতে /loveletter বা /birthdaywish ব্যবহার করুন।");
    } else {
        ctx.reply(`📊 **আপনার প্রোফাইল রিপোর্ট:**\n\n👤 নাম: ${ctx.message.from.first_name}\n🎫 আপনার তৈরি করা লিঙ্কগুলো:\n${myLinks.join('\n')}`);
    }
});

bot.command('off', (ctx) => {
    const userId = ctx.chat.id;
    const linkId = ctx.message.text.replace('/off', '').trim();
    if (!linkId) return ctx.reply("❌ লিঙ্ক অফ করতে কমান্ডের পাশে লিঙ্ক আইডিটি লিখুন। যেমন: \`/off abc123\`");
    const linkData = linkDatabase[linkId];
    if (!linkData || linkId === 'demo') return ctx.reply("❌ এই আইডি দিয়ে কোনো ভ্যালিড লিঙ্ক পাওয়া যায়নি!");
    if (String(linkData.userId) !== String(userId)) return ctx.reply("❌ দুঃখিত, আপনি অন্য কারও লিঙ্ক বন্ধ করতে পারবেন না!");
    if (linkData.isActive === false) return ctx.reply("⚠️ এই লিঙ্কটি অলরেডি বন্ধ করা আছে!");
    linkData.isActive = false;
    ctx.reply(`✅ সফলভাবে আপনার লিঙ্কটি (\`${linkId}\`) বন্ধ করে দেওয়া হয়েছে।`);
});

bot.command('demo', (ctx) => {
    ctx.reply(`👀 **লাভ লেটার পেজের ডেমো:**\n\n${SERVER_URL}/love/demo\n\n💖 আপনার নিজের পছন্দের টেক্সট দিয়ে লিঙ্ক তৈরি করতে এখনই /loveletter বা /birthdaywish ব্যবহার করুন।`);
});

bot.command('cancel', (ctx) => {
    const userId = ctx.chat.id;
    if (userSessions[userId]) {
        delete userSessions[userId];
        ctx.reply("❌ আপনার চলতি সেশনটি সফলভাবে বাতিল করা হয়েছে।");
    } else {
        ctx.reply("💡 আপনার কোনো অ্যাক্টিভ সেশন চালু নেই।");
    }
});

bot.command('feedback', (ctx) => {
    const userId = ctx.chat.id;
    userSessions[userId] = {
        step: 'AWAITING_FEEDBACK',
        name: `${ctx.message.from.first_name} ${ctx.message.from.last_name || ''}`,
        username: ctx.message.from.username ? '@' + ctx.message.from.username : 'নেই'
    };
    ctx.reply("📝 এই বটের ব্যাপারে আপনার যেকোনো মতামত এখানে লিখে পাঠান।");
});

// 🟢 লাভ লেটার তৈরির নতুন কমান্ড
bot.command('loveletter', (ctx) => {
    const userId = ctx.chat.id;
    userSessions[userId] = {
        step: 'AWAITING_ANIMATION_TEXT',
        type: 'love', // টাইপ সেট করা হলো
        name: `${ctx.message.from.first_name} ${ctx.message.from.last_name || ''}`,
        username: ctx.message.from.username ? '@' + ctx.message.from.username : 'নেই'
    };
    ctx.reply("✨ কাস্টম লাভ লিঙ্ক তৈরি সেশন শুরু হয়েছে!\n\n👉 প্রথমে শুরুর অ্যানিমেশন টেক্সটগুলো দিন। প্রতি লাইনের পর একটি করে 'Enter' দিয়ে নতুন লাইনে লিখবেন।");
});

// 🟢 বার্থডে উইশ তৈরির নতুন কমান্ড
bot.command('birthdaywish', (ctx) => {
    const userId = ctx.chat.id;
    userSessions[userId] = {
        step: 'AWAITING_ANIMATION_TEXT',
        type: 'birthday', // টাইপ সেট করা হলো
        name: `${ctx.message.from.first_name} ${ctx.message.from.last_name || ''}`,
        username: ctx.message.from.username ? '@' + ctx.message.from.username : 'নেই'
    };
    ctx.reply("🎂 কাস্টম বার্থডে উইশ লিঙ্ক তৈরি সেশন শুরু হয়েছে!\n\n👉 প্রথমে বার্থডে শুরুর অ্যানিমেশন টেক্সটগুলো দিন। প্রতি লাইনের পর একটি করে 'Enter' দিয়ে নতুন লাইনে লিখবেন।");
});

bot.on('text', (ctx) => {
    const userId = ctx.chat.id;
    const session = userSessions[userId];
    const text = ctx.message.text;
    if (!session) return; 

    if (session.step === 'AWAITING_FEEDBACK') {
        const feedbackText = text.trim();
        if (feedbackText.length < 5) return ctx.reply("❌ দয়া করে আপনার মতামতটি একটু বিস্তারিত লিখুন।");
        const feedbackAlert = `📝 **New User Feedback Received!**\n\n👤 **From:** ${session.name}\n💬 **Message:** ${feedbackText}`;
        bot.telegram.sendMessage(ADMIN_CHAT_ID, feedbackAlert, { parse_mode: 'Markdown' }).catch(e => {});
        ctx.reply("✅ আপনার মূল্যবান মতামতটি সফলভাবে পাঠানো হয়েছে। ধন্যবাদ!");
        delete userSessions[userId];
        return;
    }

    if (session.step === 'AWAITING_ANIMATION_TEXT') {
        const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        if (lines.length === 0) return ctx.reply("❌ দয়া করে অন্তত ১টি সলিড লাইন লিখুন!");
        session.animations = lines;
        session.step = 'AWAITING_LETTER_TEXT'; 
        ctx.reply(`✅ চমৎকার! আপনি ${lines.length}টি অ্যানিমেশন লাইন যোগ করেছেন।\n\n💌 এবার খামের ভেতরের মূল চিঠি বা মেসেজটি লিখে পাঠান:`);
        return;
    }

    if (session.step === 'AWAITING_LETTER_TEXT') {
        const uniqueId = Math.random().toString(36).substring(2, 9);
        linkDatabase[uniqueId] = {
            userId: userId,
            name: session.name,
            username: session.username,
            type: session.type, // সেশন থেকে টাইপ সেভ হচ্ছে
            animations: session.animations,
            letter: text.trim(),
            isActive: true 
        };
        const generatedLink = `${SERVER_URL}/love/${uniqueId}`;
        const typeLabel = session.type === 'birthday' ? "বার্থডে উইশ" : "লাভ";
        
        ctx.reply(`💝 অভিনন্দন! আপনার কাস্টমাইজড ${typeLabel} লিঙ্কটি সম্পূর্ণ রেডি:\n\n${generatedLink}\n\nএটি কপি করে পাঠিয়ে দিন। সে ওপেন করলেই আপনি নোটিফিকেশন পেয়ে যাবেন!`);
        
        const currentTime = new Date().toLocaleString("en-US", {timeZone: "Asia/Dhaka"});
        const adminLog = `🚨 **New Link Created!** 🚨\n\n👤 **Creator:** ${session.name}\n🏷 **Type:** ${session.type.toUpperCase()}\n🎫 **Link ID:** ${uniqueId}\n⏰ **Time:** ${currentTime}`;
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

app.post('/api/get-content', async (req, res) => {
    const { id } = req.body;
    const linkData = linkDatabase[id];
    if (linkData) {
        if (linkData.isActive === false) return res.json({ success: false, error: "expired" });
        if (id === 'demo') return res.json({ success: true, type: linkData.type, animations: linkData.animations, letter: linkData.letter });

        let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
        if (ip.includes(',')) ip = ip.split(',')[0].trim();
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

        const typeLabel = linkData.type === 'birthday' ? "🎂 বার্থডে উইশ" : "👀 লাভ";
        bot.telegram.sendMessage(linkData.userId, `👀 **Notification:** কেউ একজন এইমাত্র আপনার কাস্টম ${typeLabel} লিঙ্কটি ওপেন করেছে!\n⏰ **সময়:** ${openTime}`);
        
        const adminAlert = `👁‍🗨 **Custom Link Opened Alert!** 👁‍🗨\n\n👤 **Creator User:** ${linkData.name}\n🏷 **Type:** ${linkData.type ? linkData.type.toUpperCase() : 'LOVE'}\n🎫 **Link ID:** ${id}\n⏰ **Time:** ${openTime}\n\n🌐 **IP:** \`${ip}\`\n${locationInfo}`;
        if (String(linkData.userId) !== String(ADMIN_CHAT_ID)) {
            bot.telegram.sendMessage(ADMIN_CHAT_ID, adminAlert, { parse_mode: 'Markdown' }).catch(e => {});
        }
        // ফ্রন্টএন্ডে type পাঠানো হচ্ছে (love অথবা birthday)
        return res.json({ success: true, type: linkData.type || 'love', animations: linkData.animations, letter: linkData.letter });
    }
    res.json({ success: false, error: "invalid" });
});

app.post('/api/respond', (req, res) => {
    const { response, id } = req.body;
    const linkData = linkDatabase[id]; 
    if (linkData && linkData.isActive !== false) {
        if (id === 'demo') return res.json({ success: true });
        const typeLabel = linkData.type === 'birthday' ? "বার্থডে" : "কাস্টম";
        bot.telegram.sendMessage(linkData.userId, `💌 আপনার ${typeLabel} লিঙ্কে একটি নতুন রেসপন্স এসেছে!\n\nউত্তর: ${response}`);
        res.json({ success: true });
    } else {
        res.json({ success: false });
    }
});

app.get('/ping_test', (req, res) => res.send("Awake!"));
setInterval(() => { axios.get(`${SERVER_URL}/ping_test`).catch(e=>''); }, 270000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server live on port ${PORT}`));
