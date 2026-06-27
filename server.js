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

// 🛠️ মেইনটেন্যান্স এবং ব্যান ফিল্টার
bot.use((ctx, next) => {
    const userId = ctx.chat ? ctx.chat.id : (ctx.from ? ctx.from.id : null);
    if (!userId) return next();
    
    if (String(userId) === String(ADMIN_CHAT_ID)) return next();
    
    if (bannedUsers.has(userId) || bannedUsers.has(Number(userId))) return;
    
    if (isMaintenanceMode && ctx.message && ctx.message.text !== '/start') {
        return ctx.reply("🚧 **বটে মেইনটেন্যান্স চলছে!**\n\nকিছুক্ষণ পর আবার চেষ্টা করুন।");
    }
    return next();
});

// 🔄 মূল মেনু মেসেজ জেনারেট করার ফাংশন
function sendMainMenu(ctx, isEdit = false) {
    const firstName = ctx.from ? ctx.from.first_name : "User";
    const text = `💝 **হ্যালো ${firstName}!** 💝\n\n` +
                 `All-in-One Wishing & Confession বটের মূল মেনুতে আপনাকে স্বাগতম। নিচে আপনার প্রয়োজনীয় অপশনটি বেছে নিন:`;
    
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🚀 Make Link', 'menu_makelink'), Markup.button.callback('👀 Demo', 'menu_demo')],
        [Markup.button.callback('📊 Stats', 'menu_stats'), Markup.button.callback('🔒 Off Link', 'menu_off')],
        [Markup.button.callback('📝 Feedback', 'menu_feedback'), Markup.button.callback('❓ Help', 'menu_help')]
    ]);

    if (isEdit) {
        return ctx.editMessageText(text, keyboard).catch(e => {});
    } else {
        return ctx.reply(text, keyboard);
    }
}

// 👑 অ্যাডমিন মেইন ড্যাশবোর্ড জেনারেট করার ফাংশন
function sendAdminDashboard(ctx, isEdit = false) {
    const text = `👑 **স্বাগতম বস! আপনার কমপ্লিট অ্যাডমিন ড্যাশবোর্ড:**\n\nনিচের বাটনগুলো ব্যবহার করে পুরো বটের অ্যাক্টিভিটি কন্ট্রোল করুন।`;
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📊 বটের লাইভ স্ট্যাটাস', 'adm_stats'), Markup.button.callback('📋 সব লিঙ্কের লিস্ট', 'adm_alllinks')],
        [Markup.button.callback('⚙️ মেইনটেন্যান্স (On/Off)', 'adm_toggle_maint'), Markup.button.callback('📢 ব্রডকাস্ট মেসেজ', 'adm_prompt_broadcast')],
        [Markup.button.callback('🧼 নিষ্ক্রিয় লিঙ্ক ডিলিট', 'adm_clean'), Markup.button.callback('💾 ডাটাবেজ ব্যাকআপ', 'adm_backup')],
        [Markup.button.callback('🔥 এক ক্লিকে সব ডিলিট (NUKE)', 'adm_prompt_nuke')]
    ]);

    if (isEdit) {
        return ctx.editMessageText(text, keyboard).catch(e => {});
    } else {
        return ctx.reply(text, keyboard);
    }
}

// 🎯 স্টার্ট কম্যান্ড
bot.command('start', (ctx) => {
    const userId = ctx.chat.id;
    registeredUsers.add(userId);
    sendMainMenu(ctx, false);
});

// 🔙 ব্যাক বাটনের অ্যাকশন হ্যান্ডলার
bot.action('go_to_main_menu', (ctx) => {
    ctx.answerCbQuery();
    sendMainMenu(ctx, true);
});

// 👑 অ্যাডমিন প্যানেলে ফিরে যাওয়ার ব্যাক বাটন হ্যান্ডলার
bot.action('go_to_admin_dashboard', (ctx) => {
    ctx.answerCbQuery();
    sendAdminDashboard(ctx, true);
});

// 🎯 Make Link সাব-মেনু
bot.action('menu_makelink', (ctx) => {
    ctx.answerCbQuery();
    ctx.editMessageText("✨ **কোন ক্যাটাগরির লিঙ্ক তৈরি করতে চান? নিচের বাটন থেকে নির্বাচন করুন:**", 
        Markup.inlineKeyboard([
            [Markup.button.callback('❤️ Love Letter', 'startmake_love'), Markup.button.callback('💖 Crush Confession', 'startmake_crush')],
            [Markup.button.callback('🎂 Birthday Wish', 'startmake_birthday'), Markup.button.callback('💍 Anniversary Wish', 'startmake_anniversary')],
            [Markup.button.callback('🎉 New Year Wish', 'startmake_newyear'), Markup.button.callback('🌾 Pohela Boishakh', 'startmake_boishakh')],
            [Markup.button.callback('🫂 Best Friend', 'startmake_friend'), Markup.button.callback('🌙 Eid Wish', 'startmake_eid')],
            [Markup.button.callback('🥺 Sorry Letter', 'startmake_sorry')],
            [Markup.button.callback('🔙 Back to Main Menu', 'go_to_main_menu')]
        ])
    );
});

// 🎯 Demo সাব-মেনু
bot.action('menu_demo', (ctx) => {
    ctx.answerCbQuery();
    ctx.editMessageText("👀 **আপনি কোন বিষয়ের ডেমো পেজটি দেখতে চান? নিচের বাটন থেকে নির্বাচন করুন:**", 
        Markup.inlineKeyboard([
            [Markup.button.callback('❤️ Love Letter', 'demo_love'), Markup.button.callback('💖 Crush Confession', 'demo_crush')],
            [Markup.button.callback('🎂 Birthday Wish', 'demo_birthday'), Markup.button.callback('💍 Anniversary Wish', 'demo_anniversary')],
            [Markup.button.callback('🎉 New Year Wish', 'demo_newyear'), Markup.button.callback('🌾 Pohela Boishakh', 'demo_boishakh')],
            [Markup.button.callback('🫂 Best Friend', 'demo_friend'), Markup.button.callback('🌙 Eid Wish', 'demo_eid')],
            [Markup.button.callback('🥺 Sorry Letter', 'demo_sorry')],
            [Markup.button.callback('🔙 Back to Main Menu', 'go_to_main_menu')]
        ])
    );
});

// 🎯 Help পেজ
bot.action('menu_help', (ctx) => {
    ctx.answerCbQuery();
    ctx.editMessageText(`❓ **কীভাবে ব্যবহার করবেন?**\n\n1. প্রথমে 🚀 **Make Link** বাটনে ক্লিক করুন।\n2. আপনার পছন্দের ক্যাটাগরি সিলেক্ট করুন।\n3. বটের নির্দেশ মতো অ্যানিমেশন টেক্সট (লাইন বাই লাইন) ও ফাইনাল মেসেজটি লিখে পাঠান।\n4. তৈরি হওয়া লিঙ্কটি কপি করে প্রিয় মানুষকে পাঠান। সে পেজটি ওপেন করলেই আপনি ইনস্ট্যান্ট নোটিফিকেশন পাবেন!\n\n❌ চলমান কোনো সেশন বাতিল করতে টাইপ করুন: /cancel`,
        Markup.inlineKeyboard([[Markup.button.callback('🔙 Back to Main Menu', 'go_to_main_menu')]])
    );
});

bot.action('menu_feedback', (ctx) => {
    ctx.answerCbQuery();
    const userId = ctx.chat.id;
    userSessions[userId] = { step: 'AWAITING_FEEDBACK', name: ctx.from.first_name };
    ctx.reply("📝 এই বটের ব্যাপারে আপনার যেকোনো মতামত বা পরামর্শ এখানে লিখে মেসেজ আকারে পাঠান।");
});

// 🎯 Stats পেজ
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
        ? "❌ আপনি অন্তত কোনো লিঙ্ক তৈরি করেননি।" 
        : `📊 **আপনার প্রোফাইল রিপোর্ট:**\n\n👤 নাম: ${ctx.from.first_name}\n🎫 আপনার লিঙ্কসমূহ:\n${myLinks.join('\n')}`;
    
    ctx.editMessageText(responseText, 
        Markup.inlineKeyboard([
            [Markup.button.callback('🔒 লিঙ্ক বন্ধ করতে চান?', 'menu_off')],
            [Markup.button.callback('🔙 Back to Main Menu', 'go_to_main_menu')]
        ])
    ).catch(e => {});
});

// 🎯 Off লিঙ্ক সাব-মেনু
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
        return ctx.editMessageText("💡 আপনার বর্তমানে কোনো একটিভ লিঙ্ক চালু নেই।", 
            Markup.inlineKeyboard([[Markup.button.callback('🔙 Back to Main Menu', 'go_to_main_menu')]])
        ).catch(e => {});
    }
    
    buttons.push([Markup.button.callback('❌ Off All Links', 'deactivate_all')]);
    buttons.push([Markup.button.callback('🔙 Back to Main Menu', 'go_to_main_menu')]);
    
    ctx.editMessageText("🔒 **আপনি কোন লিঙ্কটি বন্ধ করতে চান? নিচের বাটনে ক্লিক করুন:**", Markup.inlineKeyboard(buttons)).catch(e => {});
});

// লিঙ্ক নিষ্ক্রিয় করার অ্যাকশন
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

// 👑 ==================== অ্যাডমিন বাটন অ্যাকশন হ্যান্ডলারসমূহ ==================== 👑

// ১. /adm কম্যান্ড দিলে বাটন ড্যাশবোর্ড আসবে
bot.command('adm', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return;
    sendAdminDashboard(ctx, false);
});

// ২. বটের লাইভ স্ট্যাটাস বাটন অ্যাকশন
bot.action('adm_stats', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    ctx.answerCbQuery();
    
    const totalUsers = registeredUsers.size;
    let totalLinks = 0;
    Object.keys(linkDatabase).forEach(id => { if(!id.startsWith('demo_')) totalLinks++; });
    
    const text = `📊 **বটের লাইভ পরিসংখ্যান:**\n\n👥 মোট একটিভ ইউজার: \`${totalUsers}\` জন\n🔗 মোট জেনারেট হওয়া লিঙ্ক: \`${totalLinks}\` টি\n🚫 মোট ব্যান ইউজার: \`${bannedUsers.size}\` জন\n⚙️ মেইনটেন্যান্স মোড: \`${isMaintenanceMode ? "ON 🚧" : "OFF 🟢"}\`\n\n💡 নির্দিষ্ট কোনো ইউজার চেক করতে টাইপ করুন: /userinfo [ইউজার_আইডি]`;
    
    ctx.editMessageText(text, Markup.inlineKeyboard([[Markup.button.callback('🔙 ফিরে যান', 'go_to_admin_dashboard')]]));
});

// ৩. সব লিঙ্কের লিস্ট দেখার বাটন অ্যাকশন
bot.action('adm_alllinks', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    ctx.answerCbQuery();
    
    let list = [];
    Object.keys(linkDatabase).forEach(id => {
        if (!id.startsWith('demo_')) {
            const status = linkDatabase[id].isActive !== false ? "🟢" : "🔴";
            list.push(`${status} ID: \`${id}\` | \`${linkDatabase[id].type.toUpperCase()}\` | মেকার: ${linkDatabase[id].name}`);
        }
    });
    
    if (list.length === 0) {
        return ctx.editMessageText("💡 ডাটাবেজে কোনো লিঙ্ক তৈরি হয়নি।", Markup.inlineKeyboard([[Markup.button.callback('🔙 ফিরে যান', 'go_to_admin_dashboard')]]));
    }
    
    const text = `📋 **বটের সমস্ত লিঙ্কের লিস্ট:**\n\n${list.slice(0, 30).join('\n')}\n\n💡 কোনো লিঙ্ক ব্যান করতে টাইপ করুন: /banlink [আইডি]\n🔍 ডিটেইলস দেখতে টাইপ করুন: /linkdetails [আইডি]`;
    ctx.editMessageText(text, Markup.inlineKeyboard([[Markup.button.callback('🔙 ফিরে যান', 'go_to_admin_dashboard')]]));
});

// ৪. মেইনটেন্যান্স অন/অফ টগল বাটন অ্যাকশন
bot.action('adm_toggle_maint', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    ctx.answerCbQuery();
    
    isMaintenanceMode = !isMaintenanceMode;
    ctx.reply(`⚙️ মেইনটেন্যান্স মোড সফলভাবে **${isMaintenanceMode ? "चालू (ON 🚧)" : "বন্ধ (OFF 🟢)"}** করা হয়েছে!`);
    sendAdminDashboard(ctx, false);
});

// ৫. নিষ্ক্রিয় লিঙ্ক ডিলিট করার বাটন অ্যাকশন
bot.action('adm_clean', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    ctx.answerCbQuery();
    
    let count = 0;
    Object.keys(linkDatabase).forEach(id => {
        if (!id.startsWith('demo_') && linkDatabase[id].isActive === false) { delete linkDatabase[id]; count++; }
    });
    
    ctx.reply(`🧼 ডাটাবেজ ক্লিন করা হয়েছে। মোট \`${count}\`টি নিষ্ক্রিয় (Off করা) লিঙ্ক পার্মানেন্টলি ডিলিট করা হয়েছে।`);
});

// ৬. ডাটাবেজ ব্যাকআপ বাটন অ্যাকশন
bot.action('adm_backup', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    ctx.answerCbQuery();
    
    try {
        const backupData = JSON.stringify(linkDatabase, null, 2);
        fs.writeFileSync('backup.txt', backupData);
        ctx.replyWithDocument({ source: fs.createReadStream('backup.txt'), filename: 'database_backup.txt' }, { caption: "💾 বটের কারেন্ট ডাটাবেজ ব্যাকআপ ফাইল।" });
    } catch(e) { ctx.reply("❌ ব্যাকআপ নিতে সমস্যা হয়েছে।"); }
});

// ৭. ব্রডকাস্ট মেসেজ প্রম্পট বাটন অ্যাকশন
bot.action('adm_prompt_broadcast', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    ctx.answerCbQuery();
    
    const userId = ctx.chat.id;
    userSessions[userId] = { step: 'AWAITING_BROADCAST' };
    ctx.reply("📢 সব ইউজারের কাছে পাঠানোর জন্য আপনার নোটিফিকেশন মেসেজটি এখানে লিখে সেন্ড করুন:");
});

// ৮. নিউক/সব ডিলিট প্রম্পট বাটন অ্যাকশন
bot.action('adm_prompt_nuke', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    ctx.answerCbQuery();
    
    ctx.editMessageText("⚠️ **সাবধান বস!** আপনি কি সত্যিই ডাটাবেজের সকল ইউজারের সমস্ত লিঙ্ক এক ক্লিকে উড়িয়ে দিতে চান? এটি আর ফিরিয়ে আনা যাবে না।", 
        Markup.inlineKeyboard([
            [Markup.button.callback('💥 হ্যাঁ, সব উড়িয়ে দাও!', 'adm_confirm_nuke')],
            [Markup.button.callback('❌ না, ভুল করে চেপেছি', 'go_to_admin_dashboard')]
        ])
    );
});

// ৯. নিউক কনফার্মেশন বাটন অ্যাকশন
bot.action('adm_confirm_nuke', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    ctx.answerCbQuery();
    
    let count = 0;
    for (let key in linkDatabase) {
        if (!key.startsWith('demo_')) { delete linkDatabase[key]; count++; }
    }
    ctx.editMessageText(`🔥 **অপারেশন সাকসেসফুল বস!**\n\nডাটাবেজে থাকা সমস্ত ইউজারের তৈরি করা মোট \`${count}\`টি লিঙ্ক সফলভাবে ধ্বংস করা হয়েছে!`, Markup.inlineKeyboard([[Markup.button.callback('🔙 ব্যাক টু ড্যাশবোর্ড', 'go_to_admin_dashboard')]]));
});

// 🎯 লিঙ্ক বানানোর সেশন শুরুর হ্যান্ডলার
bot.action(/^startmake_/, (ctx) => {
    ctx.answerCbQuery();
    const type = ctx.match.input.replace('startmake_', '');
    
    let msgText = "";
    switch(type) {
        case 'love': msgText = "✨ কাস্টম লাভ লিঙ্ক তৈরি সেশন শুরু হয়েছে!\n\n👉 প্রথমে শুরুর অ্যানিমেশন টেক্সটগুলো দিন।"; break;
        case 'crush': msgText = "💖 ক্রাশ কনфেশন লিঙ্ক তৈরি সেশন শুরু হয়েছে!\n\n👉 প্রথমে শুরুর অ্যানিমেশন টেক্সটগুলো দিন।"; break;
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

// 🎯 টেক্সট ইনপুট প্রসেসিং এবং ব্রডকাস্ট মেসেজ হ্যান্ডলিং
bot.on('text', (ctx) => {
    const userId = ctx.chat.id; const session = userSessions[userId]; const text = ctx.message.text;
    
    // অ্যাডমিন কম্যান্ড যেগুলো টাইপ করতে হয় (সেগুলো সেশনের বাইরে রাখা হলো)
    if (String(userId) === String(ADMIN_CHAT_ID)) {
        if (text.startsWith('/userinfo')) {
            const targetUid = text.replace('/userinfo', '').trim();
            if (!targetUid) return ctx.reply("❌ ব্যবহার: /userinfo [User_ID]");
            let userLinksCount = 0;
            Object.keys(linkDatabase).forEach(id => { if (String(linkDatabase[id].userId) === String(targetUid)) userLinksCount++; });
            const isBanned = bannedUsers.has(Number(targetUid)) || bannedUsers.has(targetUid);
            return ctx.reply(`👤 **ইউজার ইনফরমেশন:**\n\n🆔 ইউজার আইডি: \`${targetUid}\`\n📊 তৈরি করা মোট লিঙ্ক: \`${userLinksCount}\` টি\n🚦 স্ট্যাটাস: ${isBanned ? "🔴 ব্যানড" : "🟢 সচল"}`);
        }
        if (text.startsWith('/banlink')) {
            const targetId = text.replace('/banlink', '').trim();
            if (!targetId || !linkDatabase[targetId] || targetId.startsWith('demo_')) return ctx.reply("❌ সঠিক লিঙ্ক আইডি দিন!");
            linkDatabase[targetId].isActive = false;
            ctx.reply(`🚫 লিঙ্ক \`${targetId}\` সফলভাবে ব্লক করা হয়েছে!`);
            return bot.telegram.sendMessage(linkDatabase[targetId].userId, `⚠️ **নোটিশ:** আপনার লিঙ্কটি (\`${targetId}\`) ব্লক করা হয়েছে।`).catch(e => {});
        }
        if (text.startsWith('/linkdetails')) {
            const targetId = text.replace('/linkdetails', '').trim();
            if (!targetId || !linkDatabase[targetId]) return ctx.reply("❌ সঠিক লিঙ্ক আইডি দিন!");
            const data = linkDatabase[targetId];
            return ctx.reply(`🔍 **লিঙ্ক আইডি: ${targetId} এর ডিটেইলস:**\n\n👤 মেকার: ${data.name} (${data.username})\n🏷 টাইপ: \`${data.type}\`\n🎬 অ্যানিমেশন: \`${JSON.stringify(data.animations)}\`\n💌 চিঠি:\n"${data.letter}"`);
        }
        if (text.startsWith('/blockuser')) {
            const targetUid = text.replace('/blockuser', '').trim();
            if (!targetUid || String(targetUid) === String(ADMIN_CHAT_ID)) return ctx.reply("❌ সঠিক ইউজার আইডি দিন!");
            bannedUsers.add(Number(targetUid)); bannedUsers.add(targetUid);
            return ctx.reply(`🚫 ইউজার \`${targetUid}\`-কে সফলভাবে বট থেকে ব্যান করা হয়েছে!`);
        }
        if (text.startsWith('/unblockuser')) {
            const targetUid = text.replace('/unblockuser', '').trim();
            if (!targetUid) return ctx.reply("❌ সঠিক ইউজার আইডি দিন!");
            bannedUsers.delete(Number(targetUid)); bannedUsers.delete(targetUid);
            return ctx.reply(`🔓 ইউজার \`${targetUid}\`-কে আনব্যান করা হয়েছে।`);
        }
    }

    if (!session) return; 

    // ব্রডকাস্ট প্রোসেস সম্পন্ন করা
    if (session.step === 'AWAITING_BROADCAST' && String(userId) === String(ADMIN_CHAT_ID)) {
        let successCount = 0;
        registeredUsers.forEach(uId => {
            bot.telegram.sendMessage(uId, `📢 **অফিসিয়াল নোটিফিকেশন:**\n\n${text}`).then(() => { successCount++; }).catch(e => {});
        });
        ctx.reply(`📢 ব্রডকাস্ট সম্পন্ন! সফলভাবে \`${successCount}\` জন ইউজারের কাছে মেসেজ পাঠানো হয়েছে।`);
        delete userSessions[userId];
        sendAdminDashboard(ctx, false);
        return;
    }

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
            bot.telegram.sendMessage(linkData.userId, `💌 আপনার \`${linkData.type.toUpperCase()}\` লিঙ্কে নতুন রেসপন্স এসেছে!\n\nউত্তর: ${response}`,
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
        .then(() => console.log("Telegram Bot successfully started with Inline Admin Dashboard! 🚀"))
        .catch(e => console.error("Bot launch error:", e));
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('TERM', () => bot.stop('SIGTERM'));
