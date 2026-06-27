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

// 🎯 ডেমো ডাটাবেজ ক্যাটাগরি সেটআপ
const categories = ['love', 'crush', 'birthday', 'anniversary', 'newyear', 'boishakh', 'friend', 'eid', 'sorry'];
categories.forEach(cat => {
    linkDatabase[`demo_${cat}`] = {
        userId: ADMIN_CHAT_ID,
        name: "Developer",
        username: "@admin",
        type: cat,
        animations: ["Hello Dear", "How are you?", "I have a surprise for you... 👀"],
        letter: `This is a demo page.\nWhen you create your custom link, your written letter will be displayed beautifully inside the envelope like this! ✨`,
        isActive: true
    };
});

// 🛠️ মেইনটেন্যান্স ও ব্যান ফিল্টার (অ্যাডমিন বাইপাস এবং কমপ্লিট ব্লক লজিক)
bot.use((ctx, next) => {
    const userId = ctx.chat ? ctx.chat.id : (ctx.from ? ctx.from.id : null);
    if (!userId) return next();
    
    // 👑 অ্যাডমিন হলে কোনো ফিল্টার ছাড়াই সরাসরি পরের স্টেপে চলে যাবে
    if (String(userId) === String(ADMIN_CHAT_ID)) {
        return next();
    }
    
    // মেইনটেন্যান্স মোড অন থাকলে সাধারণ ইউজারদের কোনো কম্যান্ড বা বাটন কাজ করবে না
    if (isMaintenanceMode) {
        return ctx.reply("🚧 **Bot is under maintenance!**\n\nPlease try again later. Thank you for your patience.");
    }
    
    // ইউজার ব্যান থাকলে ব্লক থাকবে
    if (bannedUsers.has(userId) || bannedUsers.has(Number(userId))) return;
    
    return next();
});

// 🔄 মূল মেনু মেসেজ (ইউজারদের জন্য)
function sendMainMenu(ctx, isEdit = false) {
    const firstName = ctx.from ? ctx.from.first_name : "User";
    const text = `💝 **Hello ${firstName}!** 💝\n\n` +
                 `Welcome to All-in-One Wishing & Confession Bot. Choose an option from below:`;
    
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

// 👑 অ্যাডমিন ড্যাশবোর্ড ফাংশন
function sendAdminDashboard(ctx, isEdit = false) {
    const text = `👑 **Welcome Boss! Your Complete Admin Dashboard:**\n\nUse the buttons below to control the bot's activities instantly.`;
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📊 Bot Live Stats', 'adm_stats'), Markup.button.callback('📋 All Links List', 'adm_alllinks_main')],
        [Markup.button.callback('⚙️ Maintenance (On/Off)', 'adm_toggle_maint'), Markup.button.callback('📢 Broadcast Message', 'adm_prompt_broadcast')],
        [Markup.button.callback('🧼 Clean Inactive Links', 'adm_clean'), Markup.button.callback('💾 Database Backup', 'adm_backup')],
        [Markup.button.callback('🔥 Delete All Links (NUKE)', 'adm_prompt_nuke')]
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

// 🔙 ব্যাক বাটন অ্যাকশন
bot.action('go_to_main_menu', (ctx) => {
    ctx.answerCbQuery();
    sendMainMenu(ctx, true);
});

bot.action('go_to_admin_dashboard', (ctx) => {
    ctx.answerCbQuery();
    sendAdminDashboard(ctx, true);
});

// 👑 ==================== COMPLETE ADMIN MODULE ==================== 👑

// ১. /adm কম্যান্ড
bot.command('adm', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return;
    sendAdminDashboard(ctx, false);
});

// ২. বটের লাইভ স্ট্যাটাস বাটন + এক্সট্রা অপশনস
bot.action('adm_stats', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    ctx.answerCbQuery();
    
    const totalUsers = registeredUsers.size;
    let totalLinks = 0;
    Object.keys(linkDatabase).forEach(id => { if(!id.startsWith('demo_')) totalLinks++; });
    
    const text = `📊 **Bot Live Statistics Summary:**\n\n👥 Total Active Users: \`${totalUsers}\`\n🔗 Total Links Generated: \`${totalLinks}\`\n🚫 Total Banned Users: \`${bannedUsers.size}\`\n⚙️ Maintenance Mode: \`${isMaintenanceMode ? "ON 🚧" : "OFF 🟢"}\`\n\n💡 Choose any deeper option below to view full logs or manage users.`;
    
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('👥 User List', 'adm_sub_userlist'), Markup.button.callback('📋 All Links List', 'adm_alllinks_stats')],
        [Markup.button.callback('🚫 Banned Users List', 'adm_sub_banlist')],
        [Markup.button.callback('🔙 Back to Dashboard', 'go_to_admin_dashboard')]
    ]);

    ctx.editMessageText(text, keyboard);
});

// ৩. সাব অপশন: User List প্রদর্শন + Ban User বাটন লজিক
bot.action('adm_sub_userlist', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    ctx.answerCbQuery();

    let userArr = Array.from(registeredUsers);
    let text = `👥 **Registered Users List (${userArr.length}):**\n\n`;
    
    if (userArr.length === 0) {
        text += "💡 No users have registered yet.";
    } else {
        userArr.slice(0, 50).forEach((uId, idx) => {
            const isBanned = bannedUsers.has(uId) || bannedUsers.has(Number(uId));
            text += `${idx + 1}. User ID: \`${uId}\` ${isBanned ? '🔴 (Banned)' : '🟢 (Active)'}\n`;
        });
        if (userArr.length > 50) text += `\n...and ${userArr.length - 50} more users.`;
    }

    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🚫 Ban User', 'adm_prompt_input_ban')],
        [Markup.button.callback('🔙 Back to Stats', 'adm_stats')]
    ]);

    ctx.editMessageText(text, keyboard);
});

// ৪. সাব... অপশন: Ban User ইনপুট প্রম্পট
bot.action('adm_prompt_input_ban', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    ctx.answerCbQuery();

    userSessions[ctx.chat.id] = { step: 'AWAITING_BAN_ID_INPUT' };
    ctx.reply("🚫 Please write or paste the **User ID** you want to ban from this bot:");
});

// ৫. সাব অপশন: Banned Users List প্রদর্শন + Unban বাটন লজিক
bot.action('adm_sub_banlist', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    ctx.answerCbQuery();

    let banArr = Array.from(bannedUsers).filter(item => typeof item === 'number' || !isNaN(item));
    let uniqueBans = [...new Set(banArr.map(Number))];

    let text = `🚫 **Banned Users List (${uniqueBans.length}):**\n\n`;
    
    if (uniqueBans.length === 0) {
        text += "💡 No users are currently banned.";
    } else {
        uniqueBans.forEach((uId, idx) => {
            text += `${idx + 1}. User ID: \`${uId}\` 🚫\n`;
        });
    }

    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔓 Unban User', 'adm_prompt_input_unban')],
        [Markup.button.callback('🔙 Back to Stats', 'adm_stats')]
    ]);

    ctx.editMessageText(text, keyboard);
});

// ৬. সাব অপশন: Unban করার জন্য আইডি ইনপুট প্রম্পট
bot.action('adm_prompt_input_unban', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    ctx.answerCbQuery();

    userSessions[ctx.chat.id] = { step: 'AWAITING_UNBAN_ID_INPUT' };
    ctx.reply("🔓 Please write or paste the **User ID** you want to UNBAN:");
});

// ৭. সব লিঙ্কের লিস্ট দেখার বাটন (কমন ফাংশন রাউটার)
const renderAllLinksList = (ctx) => {
    let list = [];
    Object.keys(linkDatabase).forEach(id => {
        if (!id.startsWith('demo_')) {
            const status = linkDatabase[id].isActive !== false ? "🟢" : "🔴";
            list.push(`${status} ID: \`${id}\` | \`${linkDatabase[id].type.toUpperCase()}\` | Maker: ${linkDatabase[id].name}`);
        }
    });
    
    if (list.length === 0) {
        return ctx.editMessageText("💡 No links generated in database yet.", Markup.inlineKeyboard([[Markup.button.callback('🔙 Back', 'adm_stats')]]));
    }
    
    const text = `📋 **All Generated Links List:**\n\n${list.slice(0, 30).join('\n')}\n\n💡 To ban a link: /banlink [ID]\n🔍 To view details: /linkdetails [ID]`;
    return text;
};

bot.action('adm_alllinks_main', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    ctx.answerCbQuery();
    ctx.editMessageText(renderAllLinksList(ctx), Markup.inlineKeyboard([[Markup.button.callback('🔙 Back to Dashboard', 'go_to_admin_dashboard')]]));
});

bot.action('adm_alllinks_stats', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    ctx.answerCbQuery();
    ctx.editMessageText(renderAllLinksList(ctx), Markup.inlineKeyboard([[Markup.button.callback('🔙 Back to Stats', 'adm_stats')]]));
});

// ৮. মেইনটেন্যান্স অন/অফ টগল বাটন
bot.action('adm_toggle_maint', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    ctx.answerCbQuery();
    
    isMaintenanceMode = !isMaintenanceMode;
    ctx.reply(`⚙️ Maintenance Mode has been successfully turned **${isMaintenanceMode ? "ON 🚧 (Users Blocked)" : "OFF 🟢 (Users Allowed)"}**!`);
    sendAdminDashboard(ctx, false);
});

// ৯. নিষ্ক্রিয় লিঙ্ক ক্লিন বাটন
bot.action('adm_clean', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    ctx.answerCbQuery();
    
    let count = 0;
    Object.keys(linkDatabase).forEach(id => {
        if (!id.startsWith('demo_') && linkDatabase[id].isActive === false) { delete linkDatabase[id]; count++; }
    });
    
    ctx.reply(`🧼 Database cleared! Total \`${count}\` inactive/deactivated links have been permanently deleted.`);
});

// ১০. ডাটাবেজ ব্যাকআপ বাটন
bot.action('adm_backup', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    ctx.answerCbQuery();
    
    try {
        const backupData = JSON.stringify(linkDatabase, null, 2);
        fs.writeFileSync('backup.txt', backupData);
        ctx.replyWithDocument({ source: fs.createReadStream('backup.txt'), filename: 'database_backup.txt' }, { caption: "💾 Current database backup file." });
    } catch(e) { ctx.reply("❌ Error generating backup file."); }
});

// ১১. ব্রডকাস্ট মেসেজ প্রম্পট বাটন
bot.action('adm_prompt_broadcast', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    ctx.answerCbQuery();
    
    const userId = ctx.chat.id;
    userSessions[userId] = { step: 'AWAITING_BROADCAST' };
    ctx.reply("📢 Type and send your notification message that you want to broadcast to all users:");
});

// ১২. নিউক প্রম্পট বাটন
bot.action('adm_prompt_nuke', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    ctx.answerCbQuery();
    
    ctx.editMessageText("⚠️ **WARNING BOSS!** Are you sure you want to completely destroy all users' links from the database? This action cannot be undone.", 
        Markup.inlineKeyboard([
            [Markup.button.callback('💥 Yes, Delete Everything!', 'adm_confirm_nuke')],
            [Markup.button.callback('❌ No, Cancel', 'go_to_admin_dashboard')]
        ])
    );
});

// ১৩. নিউক কনফার্মেশন বাটন
bot.action('adm_confirm_nuke', (ctx) => {
    if (String(ctx.chat.id) !== String(ADMIN_CHAT_ID)) return ctx.answerCbQuery();
    ctx.answerCbQuery();
    
    let count = 0;
    for (let key in linkDatabase) {
        if (!key.startsWith('demo_')) { delete linkDatabase[key]; count++; }
    }
    ctx.editMessageText(`🔥 **Operation Successful Boss!**\n\nTotal \`${count}\` user links have been successfully completely wiped from the database!`, Markup.inlineKeyboard([[Markup.button.callback('🔙 Back to Dashboard', 'go_to_admin_dashboard')]]));
});

// 🎯 ইউজার সাইড বাটন অপশনসমূহ
bot.action('menu_makelink', (ctx) => {
    ctx.answerCbQuery();
    ctx.editMessageText("✨ **Which category link do you want to create? Select below:**", 
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

bot.action('menu_demo', (ctx) => {
    ctx.answerCbQuery();
    ctx.editMessageText("👀 **Which demo page do you want to see? Select below:**", 
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

bot.action('menu_help', (ctx) => {
    ctx.answerCbQuery();
    ctx.editMessageText(`❓ **How to use?**\n\n1. First, click on the 🚀 **Make Link** button.\n2. Select your preferred category.\n3. Send the animation texts line by line and then send the final letter text as instructed.\n4. Copy the generated link and send it to your special person. You will get instant notifications when they open it!\n\n❌ Type /cancel to cancel any running session.`,
        Markup.inlineKeyboard([[Markup.button.callback('🔙 Back to Main Menu', 'go_to_main_menu')]])
    );
});

bot.action('menu_feedback', (ctx) => {
    ctx.answerCbQuery();
    const userId = ctx.chat.id;
    userSessions[userId] = { step: 'AWAITING_FEEDBACK', name: ctx.from.first_name };
    ctx.reply("📝 Please send your feedback or suggestions here as a message.");
});

bot.action('menu_stats', (ctx) => {
    ctx.answerCbQuery();
    const userId = ctx.chat.id; 
    let myLinks = [];
    Object.keys(linkDatabase).forEach(id => {
        if (linkDatabase[id].userId === userId && !id.startsWith('demo_')) {
            const status = linkDatabase[id].isActive !== false ? "🟢 Active" : "🔴 Deactivated";
            myLinks.push(`🎫 ID: \`${id}\` (${linkDatabase[id].type.toUpperCase()}) [${status}]`);
        }
    });
    
    const responseText = myLinks.length === 0 
        ? "❌ You haven't created any links yet." 
        : `📊 **Your Profile Report:**\n\n👤 Name: ${ctx.from.first_name}\n🎫 Your Links:\n${myLinks.join('\n')}`;
    
    ctx.editMessageText(responseText, 
        Markup.inlineKeyboard([
            [Markup.button.callback('🔒 Want to deactivate a link?', 'menu_off')],
            [Markup.button.callback('🔙 Back to Main Menu', 'go_to_main_menu')]
        ])
    ).catch(e => {});
});

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
        return ctx.editMessageText("💡 You have no active links at the moment.", 
            Markup.inlineKeyboard([[Markup.button.callback('🔙 Back to Main Menu', 'go_to_main_menu')]])
        ).catch(e => {});
    }
    
    buttons.push([Markup.button.callback('❌ Off All Links', 'deactivate_all')]);
    buttons.push([Markup.button.callback('🔙 Back to Main Menu', 'go_to_main_menu')]);
    
    ctx.editMessageText("🔒 **Which link do you want to deactivate? Click below:**", Markup.inlineKeyboard(buttons)).catch(e => {});
});

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
        return ctx.reply(`✅ Successfully deactivated all (\`${count}\`) of your active links!`);
    }
    
    if (linkDatabase[target] && linkDatabase[target].userId === userId) {
        linkDatabase[target].isActive = false;
        ctx.reply(`✅ Successfully deactivated your link (\`${target}\`).`);
    } else {
        ctx.reply("❌ Link not found or already deactivated.");
    }
});

bot.action(/^startmake_/, (ctx) => {
    ctx.answerCbQuery();
    const type = ctx.match.input.replace('startmake_', '');
    
    let msgText = "";
    switch(type) {
        case 'love': msgText = "✨ Custom Love Link session started!\n\n👉 Send the animation texts first."; break;
        case 'crush': msgText = "💖 Crush Confession Link session started!\n\n👉 Send the animation texts first."; break;
        case 'birthday': msgText = "🎂 Custom Birthday Wish Link session started!\n\n👉 Send the animation texts first."; break;
        case 'anniversary': msgText = "💍 Custom Anniversary Wish Link session started!\n\n👉 Send the animation texts first."; break;
        case 'newyear': msgText = "🎉 Happy New Year Wish Link session started!\n\n👉 Send the animation texts first."; break;
        case 'boishakh': msgText = "🌾 Pohela Boishakh Wish Link session started!\n\n👉 Send the animation texts first."; break;
        case 'friend': msgText = "🫂 Best Friend Wish Link session started!\n\n👉 Send the animation texts first."; break;
        case 'eid': msgText = "🌙 Eid Wish Link session started!\n\n👉 Send the animation texts first."; break;
        case 'sorry': msgText = "🥺 Sorry Letter Link session started!\n\n👉 Send the animation texts first."; break;
    }
    
    const userId = ctx.chat.id;
    userSessions[userId] = {
        step: 'AWAITING_ANIMATION_TEXT',
        type: type,
        name: `${ctx.from.first_name} ${ctx.from.last_name || ''}`,
        username: ctx.from.username ? '@' + ctx.from.username : 'None'
    };
    ctx.reply(msgText);
});

bot.action(/^demo_/, (ctx) => {
    const selectedType = ctx.match.input.replace('demo_', '');
    const demoUrl = `${SERVER_URL}/love/demo_${selectedType}`;
    ctx.answerCbQuery();
    ctx.reply(`✨ **Your requested demo link has been generated!**\n\n🏷️ Category: \`${selectedType.toUpperCase()}\`\n🔗 Demo Link: ${demoUrl}\n\n💖 To make one with your custom texts, use 🚀 **Make Link** from main menu!`);
});

// 🎯 টেক্সট ইনপুট প্রসেসিং (মেইন রাউটার)
bot.on('text', (ctx) => {
    const userId = ctx.chat.id; const session = userSessions[userId]; const text = ctx.message.text;
    
    // অ্যাডমিন ইনস্ট্যান্ট টেক্সট কম্যান্ডস (স্ল্যাশ কম্যান্ডস)
    if (String(userId) === String(ADMIN_CHAT_ID)) {
        if (text.startsWith('/userinfo')) {
            const targetUid = text.replace('/userinfo', '').trim();
            if (!targetUid) return ctx.reply("❌ Usage: /userinfo [User_ID]");
            let userLinksCount = 0;
            Object.keys(linkDatabase).forEach(id => { if (String(linkDatabase[id].userId) === String(targetUid)) userLinksCount++; });
            const isBanned = bannedUsers.has(Number(targetUid)) || bannedUsers.has(targetUid);
            return ctx.reply(`👤 **User Information:**\n\n🆔 User ID: \`${targetUid}\`\n📊 Total Links Created: \`${userLinksCount}\` \n🚦 Status: ${isBanned ? "🔴 Banned" : "🟢 Active"}`);
        }
        if (text.startsWith('/banlink')) {
            const targetId = text.replace('/banlink', '').trim();
            if (!targetId || !linkDatabase[targetId] || targetId.startsWith('demo_')) return ctx.reply("❌ Invalid Link ID!");
            linkDatabase[targetId].isActive = false;
            ctx.reply(`🚫 Link \`${targetId}\` has been successfully blocked!`);
            return bot.telegram.sendMessage(linkDatabase[targetId].userId, `⚠️ **Notice:** Your link (\`${targetId}\`) has been blocked by Admin.`).catch(e => {});
        }
        if (text.startsWith('/linkdetails')) {
            const targetId = text.replace('/linkdetails', '').trim();
            if (!targetId || !linkDatabase[targetId]) return ctx.reply("❌ Invalid Link ID!");
            const data = linkDatabase[targetId];
            return ctx.reply(`🔍 **Link ID: ${targetId} Details:**\n\n👤 Creator: ${data.name} (${data.username})\n🏷 Category: \`${data.type}\`\n🎬 Animations: \`${JSON.stringify(data.animations)}\`\n💌 Letter:\n"${data.letter}"`);
        }
        if (text.startsWith('/blockuser')) {
            const targetUid = text.replace('/blockuser', '').trim();
            if (!targetUid || String(targetUid) === String(ADMIN_CHAT_ID)) return ctx.reply("❌ Invalid User ID!");
            bannedUsers.add(Number(targetUid)); bannedUsers.add(targetUid);
            return ctx.reply(`🚫 User \`${targetUid}\` has been successfully banned from bot!`);
        }
        if (text.startsWith('/unblockuser')) {
            const targetUid = text.replace('/unblockuser', '').trim();
            if (!targetUid) return ctx.reply("❌ Invalid User ID!");
            bannedUsers.delete(Number(targetUid)); bannedUsers.delete(targetUid);
            return ctx.reply(`🔓 User \`${targetUid}\` has been unbanned.`);
        }
    }

    if (!session) return; 

    // 🎯 বাটন ট্রিপের মাধ্যমে ইউজার ব্যান করার রিয়েল-টাইম লজিক
    if (session.step === 'AWAITING_BAN_ID_INPUT' && String(userId) === String(ADMIN_CHAT_ID)) {
        const targetUid = text.trim();
        if (!targetUid || String(targetUid) === String(ADMIN_CHAT_ID)) {
            delete userSessions[userId];
            return ctx.reply("❌ Invalid User ID or you tried to ban yourself!");
        }
        
        bannedUsers.add(Number(targetUid)); 
        bannedUsers.add(targetUid);
        
        ctx.reply(`✅ **Success!** User ID \`${targetUid}\` has been successfully banned from the bot.`);
        delete userSessions[userId];
        return;
    }

    // 🎯 বাটন ট্রিপের মাধ্যমে ইউজার আনব্যান করার রিয়েল-টাইম লজিক
    if (session.step === 'AWAITING_UNBAN_ID_INPUT' && String(userId) === String(ADMIN_CHAT_ID)) {
        const targetUid = text.trim();
        if (!targetUid) {
            delete userSessions[userId];
            return ctx.reply("❌ Invalid User ID!");
        }
        
        bannedUsers.delete(Number(targetUid));
        bannedUsers.delete(targetUid);
        
        ctx.reply(`🔓 **Success!** User ID \`${targetUid}\` has been successfully unbanned and can now use the bot.`);
        delete userSessions[userId];
        return;
    }

    // ব্রডকাস্ট প্রসেসিং
    if (session.step === 'AWAITING_BROADCAST' && String(userId) === String(ADMIN_CHAT_ID)) {
        let successCount = 0;
        registeredUsers.forEach(uId => {
            bot.telegram.sendMessage(uId, `📢 **Official Notification:**\n\n${text}`).then(() => { successCount++; }).catch(e => {});
        });
        ctx.reply(`📢 Broadcast finished! Successfully sent message to \`${successCount}\` users.`);
        delete userSessions[userId];
        sendAdminDashboard(ctx, false);
        return;
    }

    if (session.step === 'AWAITING_FEEDBACK') {
        if (text.trim().length < 5) return ctx.reply("❌ Please write your feedback with some more details.");
        bot.telegram.sendMessage(ADMIN_CHAT_ID, `💬 **Feedback From ${session.name}:** ${text}`).catch(e => {});
        ctx.reply("✅ Your valuable feedback has been successfully submitted. Thank you!");
        delete userSessions[userId]; return;
    }

    if (session.step === 'AWAITING_ANIMATION_TEXT') {
        const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        if (lines.length === 0) return ctx.reply("❌ Please send at least 1 line!");
        session.animations = lines; session.step = 'AWAITING_LETTER_TEXT'; 
        ctx.reply(`✅ Great! You added ${lines.length} animation lines.\n\n💌 Now write and send the main letter or message inside the envelope:`);
        return;
    }

    if (session.step === 'AWAITING_LETTER_TEXT') {
        const uniqueId = Math.random().toString(36).substring(2, 9);
        linkDatabase[uniqueId] = {
            userId: userId, name: session.name, username: session.username,
            type: session.type, animations: session.animations, letter: text.trim(), isActive: true 
        };
        const generatedLink = `${SERVER_URL}/love/${uniqueId}`;
        
        ctx.reply(`💝 Congratulations! Your customized link is completely ready:\n\n${generatedLink}\n\nCopy and send it. You'll get notified when they open it!`,
            Markup.inlineKeyboard([[Markup.button.callback('📝 How did you like our bot? Give feedback', 'menu_feedback')]])
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
    if (userSessions[userId]) { delete userSessions[userId]; ctx.reply("❌ Your current link generation session has been cancelled."); }
    else ctx.reply("💡 You don't have any active session.");
});

// 🎯 এক্সপ্রেস ফ্রন্টএন্ড এবং এপিআই রাউটিং মেকানিজম
app.get('/love/:id', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.post('/api/get-content', async (req, res) => {
    const { id } = req.body; const linkData = linkDatabase[id];
    if (linkData) {
        if (linkData.isActive === false) return res.json({ success: false, error: "expired" });
        if (id.startsWith('demo_')) return res.json({ success: true, type: linkData.type, animations: linkData.animations, letter: linkData.letter });

        const openTime = new Date().toLocaleString("en-US", {timeZone: "Asia/Dhaka"});
        bot.telegram.sendMessage(linkData.userId, `👀 **Notification:** Someone just opened your custom \`${linkData.type.toUpperCase()}\` link!\n⏰ **Time:** ${openTime}`);
        return res.json({ success: true, type: linkData.type, animations: linkData.animations, letter: linkData.letter });
    }
    res.json({ success: false, error: "invalid" });
});

app.post('/api/respond', (req, res) => {
    const { response, id } = req.body; const linkData = linkDatabase[id]; 
    if (linkData && linkData.isActive !== false) {
        if (!id.startsWith('demo_')) {
            bot.telegram.sendMessage(linkData.userId, `💌 New response received on your \`${linkData.type.toUpperCase()}\` link!\n\nAnswer: ${response}`,
                Markup.inlineKeyboard([[Markup.button.callback('📝 How did you like our bot? Give feedback', 'menu_feedback')]])
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
        .then(() => console.log("Telegram Bot successfully started with Full Admin Suite! 🚀"))
        .catch(e => console.error("Bot launch error:", e));
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('TERM', () => bot.stop('SIGTERM'));
