const express = require('express');
const path = require('path');
const axios = require('axios');
const { Telegraf, Markup } = require('telegraf');
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

// 🎯 প্রতিটি ক্যাটাগরির জন্য ডেমো ডাটাবেজ এন্ট্রি
const categories = ['love', 'crush', 'birthday', 'anniversary', 'newyear', 'boishakh', 'friend', 'eid', 'sorry'];
categories.forEach(cat => {
    linkDatabase[`demo_${cat}`] = {
        userId: ADMIN_CHAT_ID,
        name: "Developer",
        username: "@admin",
        type: cat,
        animations: ["হ্যালো প্রিয়", "কেমন আছো?", "তোমার জন্য একটা সারপ্রাইজ আছে... 👀"],
        letter: `এটি একটি ডেমো পেজ।\nআপনি যখন আপনার কাস্টম লিঙ্ক তৈরি করবেন, তখন আপনার দেওয়া চিঠিটি ঠিক এই খামের ভেতর এভাবে সুন্দর করে দেখাবে! ✨`,
        isActive: true
    };
});

// মেইনটেন্যান্স এবং ব্যান ফিল্টার
bot.use((ctx, next) => {
    const userId = ctx.chat ? ctx.chat.id : null;
    if (!userId) return next();
    if (String(userId) === String(ADMIN_CHAT_ID)) return next();
    if (bannedUsers.has(userId)) return;
    if (isMaintenanceMode && ctx.message && ctx.message.text !== '/start') {
        return ctx.reply("🚧 **বটে মেইনটেন্যান্স চলছে!**\n\nকিছুক্ষণ পর আবার চেষ্টা করুন।");
    }
    return next();
});

// ১. 🎯 স্টার্ট কম্যান্ডের মূল বাটন মেনু
bot.command('start', (ctx) => {
    const firstName = ctx.message.from.first_name;
    const userId = ctx.chat.id;
    registeredUsers.add(userId);

    ctx.reply(`💝 **হ্যালো ${firstName}!** 💝\n\n` +
              `All-in-One Wishing & Confession বটের মূল মেনুতে আপনাকে স্বাগতম। নিচে আপনার প্রয়োজনীয় অপশনটি বেছে নিন:`, 
        Markup.inlineKeyboard([
            [Markup.button.callback('🚀 Make Link', 'menu_makelink'), Markup.button.callback('👀 Demo', 'menu_demo')],
            [Markup.button.callback('📊 Stats', 'menu_stats'), Markup.button.callback('🔒 Off Link', 'menu_off')],
            [Markup.button.callback('📝 Feedback', 'menu_feedback'), Markup.button.callback('❓ Help', 'menu_help')]
        ])
    );
});

// ২. 🎯 মূল মেনুর বাটন অ্যাকশন হ্যান্ডলারসমূহ
bot.action('menu_makelink', (ctx) => {
    ctx.answerCbQuery();
    ctx.reply("✨ **কোন ক্যাটাগরির লিঙ্ক তৈরি করতে চান? নিচের বাটন থেকে নির্বাচন করুন:**", 
        Markup.inlineKeyboard([
            [Markup.button.callback('❤️ Love Letter', 'startmake_love'), Markup.button.callback('💖 Crush Confession', 'startmake_crush')],
            [Markup.button.callback('🎂 Birthday Wish', 'startmake_birthday'), Markup.button.callback('💍 Anniversary Wish', 'startmake_anniversary')],
            [Markup.button.callback('🎉 New Year Wish', 'startmake_newyear'), Markup.button.callback('🌾 Pohela Boishakh', 'startmake_boishakh')],
            [Markup.button.callback('🫂 Best Friend', 'startmake_friend'), Markup.button.callback('🌙 Eid Wish', 'startmake_eid')],
            [Markup.button.callback('🥺 Sorry Letter', 'startmake_sorry')]
        ])
    );
});

bot.action('menu_demo', (ctx) => {
    ctx.answerCbQuery();
    ctx.reply("👀 **আপনি কোন বিষয়ের ডেমো পেজটি দেখতে চান? নিচের বাটন থেকে নির্বাচন করুন:**", 
        Markup.inlineKeyboard([
            [Markup.button.callback('❤️ Love Letter', 'demo_love'), Markup.button.callback('💖 Crush Confession', 'demo_crush')],
            [Markup.button.callback('🎂 Birthday Wish', 'demo_birthday'), Markup.button.callback('💍 Anniversary Wish', 'demo_anniversary')],
            [Markup.button.callback('🎉 New Year Wish', 'demo_newyear'), Markup.button.callback('🌾 Pohela Boishakh', 'demo_boishakh')],
            [Markup.button.callback('🫂 Best Friend', 'demo_friend'), Markup.button.callback('🌙 Eid Wish', 'demo_eid')],
            [Markup.button.callback('🥺 Sorry Letter', 'demo_sorry')]
        ])
    );
});

bot.action('menu_help', (ctx) => {
    ctx.answerCbQuery();
    ctx.reply(`❓ **কীভাবে ব্যবহার করবেন?**\n\n1. প্রথমে 🚀 **Make Link** বাটনে ক্লিক করুন।\n2. আপনার পছন্দের ক্যাটাগরি সিলেক্ট করুন।\n3. বটের নির্দেশ মতো অ্যানিমেশন টেক্সট (লাইন বাই লাইন) ও ফাইনাল মেসেজটি লিখে পাঠান।\n4. তৈরি হওয়া লিঙ্কটি কপি করে প্রিয় মানুষকে পাঠান। সে পেজটি ওপেন করলেই আপনি ইনস্ট্যান্ট নোটিফিকেশন পাবেন!\n\n❌ চলমান কোনো সেশন বাতিল করতে টাইপ করুন: /cancel`);
});

bot.action('menu_feedback', (ctx) => {
    ctx.answerCbQuery();
    const userId = ctx.chat.id;
    userSessions[userId] = { step: 'AWAITING_FEEDBACK', name: ctx.from.first_name };
    ctx.reply("📝 এই বটের ব্যাপারে আপনার যেকোনো মতামত বা পরামর্শ এখানে লিখে মেসেজ আকারে পাঠান।");
});

bot.action('menu_stats', (ctx) => {
    ctx.answerCbQuery();
    const userId = ctx.chat.id; 
    let myLinks = [];
    Object.keys(linkDatabase).forEach(id => {
        if (linkDatabase[id].userId === userId && !id.startsWith('demo_')) {
            const status = linkDatabase[id].isActive !== false ? "🟢 চালু" : "🔴 বন্ধ";
            myLinks.push(`🎫 আইডি: \`${id}\` (${linkDatabase[id].type.toUpperCase()}) [${status}]`);
        }
    });
    
    const responseText = myLinks.length === 0 
        ? "❌ আপনি এখনও কোনো লিঙ্ক তৈরি করেননি।" 
        : `📊 **আপনার প্রোফাইল রিপোর্ট:**\n\n👤 নাম: ${ctx.from.first_name}\n🎫 আপনার লিঙ্কসমূহ:\n${myLinks.join('\n')}`;
    
    ctx.reply(responseText, Markup.inlineKeyboard([[Markup.button.callback('🔒 লিঙ্ক বন্ধ করতে চান?', 'menu_off')]]));
});

// ৩. 🎯 ইন্টারঅ্যাক্টিভ অফ লিঙ্ক মেকানিজম
bot.action('menu_off', (ctx) => {
    ctx.answerCbQuery();
    const userId = ctx.chat.id;
    let buttons = [];
    
    Object.keys(linkDatabase).forEach(id => {
        if (linkDatabase[id].userId === userId && !id.startsWith('demo_') && linkDatabase[id].isActive !== false) {
            buttons.push([Markup.button.callback(`🚫 Off Link: ${id} (${linkDatabase[id].type.toUpperCase()})`, `deactivate_${id}`)]);
        }
    });
    
    if (buttons.length === 0) {
        return ctx.reply("💡 আপনার বর্তমানে কোনো একটিভ লিঙ্ক চালু নেই।");
    }
    
    // সব নিচে "Off All Links" বাটন যোগ করা হলো
    buttons.push([Markup.button.callback('❌ Off All Links', 'deactivate_all')]);
    ctx.reply("🔒 **আপনি কোন লিঙ্কটি বন্ধ করতে চান? নিচের বাটনে ক্লিক করুন:**", Markup.inlineKeyboard(buttons));
});

// নির্দিষ্ট সিঙ্গেল লিঙ্ক অফ করার অ্যাকশন
bot.action(/^deactivate_/, (ctx) => {
    ctx.answerCbQuery();
    const target = ctx.match.input.replace('deactivate_', '');
    const userId = ctx.chat.id;
    
    if (target === 'all') {
        let count = 0;
        Object.keys(linkDatabase).forEach(id => {
            if (linkDatabase[id].userId === userId && !id.startsWith('demo_') && linkDatabase[id].isActive !== false) {
                linkDatabase[id].isActive = false;
                count++;
            }
        });
        return ctx.reply(`✅ আপনার সচল থাকা সকল (\`${count}\`টি) লিঙ্ক সফলভাবে বন্ধ করে দেওয়া হয়েছে!`);
    }
    
    if (linkDatabase[target] && linkDatabase[target].userId === userId) {
        linkDatabase[target].isActive = false;
        ctx.reply(`✅ সফলভাবে আপনার লিঙ্কটি (\`${target}\`) বন্ধ করে দেওয়া হয়েছে।`);
    } else {
        ctx.reply("❌ লিঙ্কটি খুঁজে পাওয়া যায়নি বা এটি অলরেডি বন্ধ।");
    }
});

// ৪. 🎯 লিঙ্ক বানানোর সেশন শুরুর হ্যান্ডলার (সাব-মেনু বাটন ক্লিক)
bot.action(/^startmake_/, (ctx) => {
    ctx.answerCbQuery();
    const type = ctx.match.input.replace('startmake_', '');
    
    let msgText = "";
    switch(type) {
        case 'love': msgText = "✨ কাস্টম লাভ লিঙ্ক তৈরি সেশন শুরু হয়েছে!\n\n👉 প্রথমে শুরুর অ্যানিমেশন টেক্সটগুলো দিন।"; break;
        case 'crush': msgText = "💖 ক্রাশ কনফেশন লিঙ্ক তৈরি সেশন শুরু হয়েছে!\n\n👉 প্রথমে শুরুর অ্যানিমেশন টেক্সটগুলো দিন।"; break;
        case 'birthday': msgText = "🎂 কাস্টম বার্থডে উইশ লিঙ্ক তৈরি সেশন শুরু হয়েছে!\n\n👉 প্রথমে শুরুর অ্যানিমেশন টেক্সটগুলো দিন।"; break;
        case 'anniversary': msgText = "💍 কাস্টম  অ্যানিভার্সারি উইশ লিঙ্ক তৈরি সেশন শুরু হয়েছে!\n\n👉 প্রথমে শুরুর অ্যানিমেশন টেক্সটগুলো দিন।"; break;
        case 'newyear': msgText = "🎉 হ্যাপি নিউ ইয়ার উইশ লিঙ্ক তৈরি সেশন শুরু হয়েছে!\n\n👉 প্রথমে শুরুর অ্যানিমেশন টেক্সটগুলো দিন।"; break;
        case 'boishakh': msgText = "🌾 পহেলা বৈশাখ উইশ লিঙ্ক তৈরি সেশন শুরু হয়েছে!\n\n👉 প্রথমে শুরুর অ্যানিমেশন টেক্সটগুলো দিন।"; break;
        case 'friend': msgText = "🫂 বেস্ট ফ্রেন্ড উইশ লিঙ্ক তৈরি সেশন শুরু হয়েছে!\n\n👉 প্রথমে শুরুর অ্যানিমেশন টেক্সটগুলো দিন।"; break;
        case 'eid': msgText = "🌙  ঈদ উইশ লিঙ্ক তৈরি সেশন শুরু হয়েছে!\n\n👉 প্রথমে শুরুর অ্যানিমেশন টেক্সটগুলো দিন।"; break;
        case 'sorry': msgText = "🥺 স্যরি লেটার লিঙ্ক তৈরি সেশন শুরু হয়েছে!\n\n👉 প্রথমে শুরুর অ্যানিমেশন টেক্সটগুলো দিন।"; break;
    }
    
    const userId = ctx.chat.id;
    userSessions[userId] = {
        step: 'AWAITING_ANIMATION_TEXT',
        type: type,
        name: `${ctx.from.first_name} ${ctx.from.last_name || ''}`,
        username: ctx.from.username ? '@' + ctx.from.username : 'নেই'
    };
    ctx.reply(msgText);
});

// 🎯 ডেমো বাটন হ্যান্ডলার
bot.action(/^demo_/, (ctx) => {
    const selectedType = ctx.match.input.replace('demo_', '');
    const demoUrl = `${SERVER_URL}/love/demo_${selectedType}`;
    ctx.answerCbQuery();
    ctx.reply(`✨ **আপনার কাঙ্ক্ষিত ডেমো লিঙ্কটি তৈরি করা হয়েছে!**\n\n🏷️ ক্যাটাগরি: \`${selectedType.toUpperCase()}\`\n🔗 ডেমো লিঙ্ক: ${demoUrl}\n\n💖 আপনার নিজের পছন্দের টেক্সট দিয়ে এমন লিঙ্ক বানাতে মূল মেনু থেকে 🚀 **Make Link** ব্যবহার করুন!`);
});

// 🎯 টেক্সট ইনপুট প্রসেসিং (সেশন এবং ফিডব্যাক)
bot.on('text', (ctx) => {
    const userId = ctx.chat.id; 
    const session = userSessions[userId]; 
    const text = ctx.message.text;
    
    if (!session) return; 

    if (session.step === 'AWAITING_FEEDBACK') {
        if (text.trim().length < 5) return ctx.reply("❌ দয়া করে আপনার মতামতটি একটু বিস্তারিত লিখুন।");
        bot.telegram.sendMessage(ADMIN_CHAT_ID, `💬 **Feedback From ${session.name}:** ${text}`).catch(e => {});
        ctx.reply("✅ আপনার মূল্যবান মতামতটি সফলভাবে পাঠানো হয়েছে। ধন্যবাদ!");
        delete userSessions[userId]; return;
    }

    if (session.step === 'AWAITING_ANIMATION_TEXT') {
        const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        if (lines.length === 0) return ctx.reply("❌ দয়া করে অন্তত ১টি সলিড লাইন লিখুন!");
        session.animations = lines; session.step = 'AWAITING_LETTER_TEXT'; 
        ctx.reply(`✅ চমৎকার! আপনি ${lines.length}টি অ্যানিমেশন লাইন যোগ করেছেন।\n\n💌 এবার খামের ভেতরের মূল চিঠি বা মেসেজটি লিখে পাঠান:`);
        return;
    }

    if (session.step === 'AWAITING_LETTER_TEXT') {
        const uniqueId = Math.random().toString(36).substring(2, 9);
        linkDatabase[uniqueId] = {
            userId: userId, name: session.name, username: session.username,
            type: session.type, animations: session.animations, letter: text.trim(), isActive: true 
        };
        const generatedLink = `${SERVER_URL}/love/${uniqueId}`;
        
        // ৫. 🎯 লিঙ্ক বানানোর পর ফিডব্যাক বাটন শো করা
        ctx.reply(`💝 অভিনন্দন! আপনার কাস্টমাইজড লিঙ্কটি সম্পূর্ণ রেডি:\n\n${generatedLink}\n\nএটি কপি করে পাঠিয়ে দিন। সে ওপেন করলেই নোটিফিকেশন পাবেন!`,
            Markup.inlineKeyboard([[Markup.button.callback('📝 আমাদের বট কেমন লাগলো? ফিডব্যাক দিন', 'menu_feedback')]])
        );
        
        const currentTime = new Date().toLocaleString("en-US", {timeZone: "Asia/Dhaka"});
        if (String(userId) !== String(ADMIN_CHAT_ID)) {
            bot.telegram.sendMessage(ADMIN_CHAT_ID, `🚨 **New Link!**\n👤 **Creator:** ${session.name}\n🏷 **Type:** ${session.type.toUpperCase()}\n🎫 **ID:** ${uniqueId}\n⏰ **Time:** ${currentTime}`).catch(e => {});
        }
        delete userSessions[userId]; return;
    }
});

// 🎯 অ্যাডমিন কম্যান্ডসমূহ
bot.command('adm', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return;
    ctx.reply(`👑 **স্বাগতম বস! আপনার কমপ্লিট অ্যাডমিন ড্যাশবোর্ড:**\n\n` +
              `📊 /admin - বটের পরিসংখ্যান দেখতে।\n` +
              `📋 /alllinks - সব তৈরি হওয়া লিঙ্কের লিস্ট দেখতে।\n` +
              `🚫 /banlink [আইডি] - নির্দিষ্ট কোনো লিঙ্ক ব্লক করতে।\n` +
              `🔍 /linkdetails [আইডি] - লিঙ্কের মেকার ও লেটার দেখতে।\n` +
              `🧼 /cleanlinks - অফ করা লিঙ্কগুলো ডাটাবেজ থেকে মুছে ফেলতে।\n` +
              `💥 /nukelinks - এক ক্লিকে সব ইউজারের সব লিঙ্ক ডিলিট করতে! 🔥\n\n` +
              `👤 /userinfo [User_ID] - নির্দিষ্ট ইউজারের তথ্য দেখতে。\n` +
              `⛔ /blockuser [User_ID] - ইউজারকে বট থেকে ব্যান করতে।\n` +
              `🔓 /unblockuser [User_ID] - ইউজারকে আনব্যান করতে।\n\n` +
              `⚙️ /maintenance [on/off] - মেইনটেন্যান্স মোড অন/অফ করতে।\n` +
              `💾 /backup - ডাটাবেজের টেক্সট ব্যাকআপ ফাইল নিতে।\n` +
              `📢 /broadcast [মেসেজ] - সব ইউজারকে নোটিফিকেশন পাঠাতে।`, { parse_mode: 'Markdown' });
});

bot.command('nukelinks', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return;
    let count = 0;
    for (let key in linkDatabase) {
        if (!key.startsWith('demo_')) { delete linkDatabase[key]; count++; }
    }
    ctx.reply(`🔥 **অপারেশন সাকসেসফুল বস!**\n\nডাটাবেজে থাকা সমস্ত ইউজারের তৈরি করা মোট \`${count}\`টি লিঙ্ক সফলভাবে ডিলিট করা হয়েছে!`, { parse_mode: 'Markdown' });
});

bot.command('admin', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return;
    const totalUsers = registeredUsers.size;
    let totalLinks = 0;
    Object.keys(linkDatabase).forEach(id => { if(!id.startsWith('demo_')) totalLinks++; });
    ctx.reply(`📊 **বটের লাইভ পরিসংখ্যান:**\n\n👥 মোট একটিভ ইউজার: \`${totalUsers}\` জন\n🔗 মোট জেনারেট হওয়া লিঙ্ক: \`${totalLinks}\` টি\n🚫 মোট ব্যান ইউজার: \`${bannedUsers.size}\` জন\n⚙️ মেইনটেন্যান্স মোড: \`${isMaintenanceMode ? "ON 🚧" : "OFF 🟢"}\``, { parse_mode: 'Markdown' });
});

bot.command('alllinks', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return;
    let list = [];
    Object.keys(linkDatabase).forEach(id => {
        if (!id.startsWith('demo_')) {
            const status = linkDatabase[id].isActive !== false ? "🟢 চালু" : "🔴 ব্লকড";
            list.push(`🎫 ID: \`${id}\` | টাইপ: \`${linkDatabase[id].type.toUpperCase()}\` | মেকার: ${linkDatabase[id].name} [${status}]`);
        }
    });
    if (list.length === 0) return ctx.reply("💡 ডাটাবেজে অন্তত কোনো লিঙ্ক তৈরি হয়নি।");
    ctx.reply(`📋 **বটের সমস্ত লিঙ্কের লিস্ট:**\n\n${list.join('\n')}`, { parse_mode: 'Markdown' });
});

bot.command('banlink', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return;
    const targetId = ctx.message.text.replace('/banlink', '').trim();
    if (!targetId || !linkDatabase[targetId] || targetId.startsWith('demo_')) return ctx.reply("❌ সঠিক লিঙ্ক আইডি দিন!");
    linkDatabase[targetId].isActive = false;
    ctx.reply(`🚫 লিঙ্ক \`${targetId}\` সফলভাবে ব্লক করা হয়েছে!`, { parse_mode: 'Markdown' });
    bot.telegram.sendMessage(linkDatabase[targetId].userId, `⚠️ **নোটিশ:** অ্যাডমিন প্যানেল থেকে আপনার লিঙ্কটি (\`${targetId}\`) ব্লক করা হয়েছে।`).catch(e => {});
});

bot.command('linkdetails', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return;
    const targetId = ctx.message.text.replace('/linkdetails', '').trim();
    if (!targetId || !linkDatabase[targetId]) return ctx.reply("❌ সঠিক লিঙ্ক আইডি দিন!");
    const data = linkDatabase[targetId];
    ctx.reply(`🔍 **লিঙ্ক আইডি: ${targetId} এর ডিটেইলস:**\n\n👤 মেকার: ${data.name} (${data.username})\n🏷 টাইপ: \`${data.type}\`\n🎬 অ্যানিমেশন: \`${JSON.stringify(data.animations)}\`\n💌 চিঠি:\n"${data.letter}"`, { parse_mode: 'Markdown' });
});

bot.command('cleanlinks', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return;
    let count = 0;
    Object.keys(linkDatabase).forEach(id => {
        if (!id.startsWith('demo_') && linkDatabase[id].isActive === false) { delete linkDatabase[id]; count++; }
    });
    ctx.reply(`🧼 ডাটাবেজ ক্লিন করা হয়েছে। মোট \`${count}\`টি নিষ্ক্রিয় লিঙ্ক ডিলিট করা হয়েছে।`, { parse_mode: 'Markdown' });
});

bot.command('userinfo', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return;
    const targetUid = ctx.message.text.replace('/userinfo', '').trim();
    if (!targetUid) return ctx.reply("❌ ব্যবহার: /userinfo [User_ID]");
    let userLinksCount = 0;
    Object.keys(linkDatabase).forEach(id => { if (String(linkDatabase[id].userId) === String(targetUid)) userLinksCount++; });
    const isBanned = bannedUsers.has(Number(targetUid)) || bannedUsers.has(targetUid);
    ctx.reply(`👤 **ইউজার ইনফরমেশন:**\n\n🆔 ইউজার আইডি: \`${targetUid}\`\n📊 তৈরি করা মোট লিঙ্ক: \`${userLinksCount}\` টি\n🚦 স্ট্যাটাস: ${isBanned ? "🔴 ব্যানড" : "🟢 সচল"}`, { parse_mode: 'Markdown' });
});

bot.command('blockuser', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return;
    const targetUid = ctx.message.text.replace('/blockuser', '').trim();
    if (!targetUid || String(targetUid) === String(ADMIN_CHAT_ID)) return ctx.reply("❌ সঠিক ইউজার আইডি দিন!");
    bannedUsers.add(Number(targetUid)); bannedUsers.add(targetUid);
    ctx.reply(`🚫 ইউজার \`${targetUid}\`-কে সফলভাবে বট থেকে ব্যান করা হয়েছে!`, { parse_mode: 'Markdown' });
});

bot.command('unblockuser', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return;
    const targetUid = ctx.message.text.replace('/unblockuser', '').trim();
    if (!targetUid) return ctx.reply("❌ সঠিক ইউজার আইডি দিন!");
    bannedUsers.delete(Number(targetUid)); bannedUsers.delete(targetUid);
    ctx.reply(`🔓 ইউজার \`${targetUid}\`-কে আনব্যান করা হয়েছে।`, { parse_mode: 'Markdown' });
});

bot.command('maintenance', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return;
    const mode = ctx.message.text.replace('/maintenance', '').trim().toLowerCase();
    if (mode === 'on') { isMaintenanceMode = true; ctx.reply("🚧 মেইনটেন্যান্স মোড **চালু** করা হয়েছে।"); }
    else if (mode === 'off') { isMaintenanceMode = false; ctx.reply("🟢 মেইনটেন্যান্স মোড **বন্ধ** করা হয়েছে।"); }
});

bot.command('backup', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return;
    try {
        const backupData = JSON.stringify(linkDatabase, null, 2);
        fs.writeFileSync('backup.txt', backupData);
        ctx.replyWithDocument({ source: fs.createReadStream('backup.txt'), filename: 'database_backup.txt' }, { caption: "💾 বটের ডাটাবেজ ব্যাকআপ ফাইল।" });
    } catch(e) { ctx.reply("❌ ব্যাকআপ নিতে সমস্যা হয়েছে।"); }
});

bot.command('broadcast', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return;
    const msg = ctx.message.text.replace('/broadcast', '').trim();
    if (!msg) return ctx.reply("❌ ব্যবহার নিয়ম: \`/broadcast আপনার মেসেজ\`");
    let successCount = 0;
    registeredUsers.forEach(uId => {
        bot.telegram.sendMessage(uId, `📢 **অফিসিয়াল নোটিফিকেশন:**\n\n${msg}`).then(() => { successCount++; }).catch(e => {});
    });
    ctx.reply(`📢 ব্রডকাস্ট সম্পন্ন! সফলভাবে \`${successCount}\` জন ইউজারের কাছে মেসেজ পাঠানো হয়েছে।`, { parse_mode: 'Markdown' });
});

bot.command('cancel', (ctx) => {
    const userId = ctx.chat.id;
    if (userSessions[userId]) { delete userSessions[userId]; ctx.reply("❌ আপনার চলতি সেশনটি বাতিল করা হয়েছে।"); }
    else ctx.reply("💡 আপনার কোনো অ্যাক্টিভ সেশন চালু নেই।");
});


// 🎯 এক্সপ্রেস ফ্রন্টএন্ড এবং এপিআই রাউটিং মেকানিজম
app.get('/love/:id', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.post('/api/get-content', async (req, res) => {
    const { id } = req.body; const linkData = linkDatabase[id];
    if (linkData) {
        if (linkData.isActive === false) return res.json({ success: false, error: "expired" });
        if (id.startsWith('demo_')) return res.json({ success: true, type: linkData.type, animations: linkData.animations, letter: linkData.letter });

        const openTime = new Date().toLocaleString("en-US", {timeZone: "Asia/Dhaka"});
        bot.telegram.sendMessage(linkData.userId, `👀 **Notification:** কেউ একজন এইমাত্র আপনার কাস্টম \`${linkData.type.toUpperCase()}\` লিঙ্কটি ওপেন করেছে!\n⏰ **সময়:** ${openTime}`);
        return res.json({ success: true, type: linkData.type, animations: linkData.animations, letter: linkData.letter });
    }
    res.json({ success: false, error: "invalid" });
});

app.post('/api/respond', (req, res) => {
    const { response, id } = req.body; const linkData = linkDatabase[id]; 
    if (linkData && linkData.isActive !== false) {
        if (!id.startsWith('demo_')) {
            // ৬. 🎯 লাইভ ইয়েস/নো রেসপন্স আসার ঠিক শেষে আবারও ফিডব্যাক বাটন অফার করা
            bot.telegram.sendMessage(linkData.userId, `💌 আপনার \`${linkData.type.toUpperCase()}\` লিঙ্কে নতুন রেসপন্স এসেছে!\n\nउत्तर: ${response}`,
                Markup.inlineKeyboard([[Markup.button.callback('📝 সার্ভিসটি কেমন লাগলো? ফিডব্যাক দিন', 'menu_feedback')]])
            );
        }
        res.json({ success: true });
    } else res.json({ success: false });
});

app.get('/ping_test', (req, res) => res.send("Awake!"));
setInterval(() => { axios.get(`${SERVER_URL}/ping_test`).catch(e=>''); }, 270000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server live on port ${PORT}`);
    bot.launch()
        .then(() => console.log("Telegram Bot successfully started with interactive buttons! 🚀"))
        .catch(e => console.error("Bot launch error:", e));
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('TERM', () => bot.stop('SIGTERM'));
