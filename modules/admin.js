const { Markup } = require('telegraf');
const fs = require('fs');
const path = require('path');
const HELP_TEXT = `❓ বট ব্যবহারের নিয়ম (Help Guide):\n\n*বট স্টার্ট করার পর\n1️⃣ প্রথমে 🚀 লিঙ্ক তৈরি করুন বাটনে ক্লিক করুন।\n2️⃣ আপনার পছন্দের ক্যাটাগরি সিলেক্ট করুন।\n3️⃣ কাউন্টডাউন টাইমার সেট করুন।\n4️⃣ মিউজিক আপলোড করুন অথবা ডিফল্ট রাখুন।\n5️⃣ ছবি আপলোড করুন করুন অথবা ছবি ছাড়া।\n6️⃣ অ্যানিমেশন টেক্সট দিন তারপর খামের ভেতরের মূল চিঠিটি লিখে পাঠান।\n7️⃣ সবশেষে বট আপনাকে লিঙ্ক জেনারেট করে দেবে যা আপনি শেয়ার করতে পারবেন!`;

const showAdminDashboard = (ctx, db, isEdit = false) => {
    const maintStatus = db.isMaintenanceMode ? "ON 🔴" : "OFF 🟢";
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback(`🛠️ Maintenance: ${maintStatus}`, "adm_toggle_maint")],
        [Markup.button.callback("📢 Announcement", "adm_broadcast")],
        [Markup.button.callback("🔗 All Links", "adm_all_links_menu")],
        [Markup.button.callback("🚫 Ban/Unban", "adm_ban_menu")]
    ]);
    const text = `👑 Admin Dashboard`;
    if (isEdit) return ctx.editMessageText(text, { reply_markup: keyboard.reply_markup, parse_mode: 'Markdown' }).catch(() => {});
    return ctx.reply(text, { reply_markup: keyboard.reply_markup, parse_mode: 'Markdown' }).catch(() => {});
};

const setupAdmin = (bot, db, saveDB, isAdmin, baseDir, locale) => {
    bot.command(['admin', 'adm'], (ctx) => {
        if (!isAdmin(ctx.chat.id)) {
            ctx.reply('❌ ভুল ইনপুট: \`${text}\` কমান্ডটি গ্রহণযোগ্য নয়। নিচে সঠিক সাহায্য গাইডটি দেওয়া হলো:`(ctx.message.text || ''), { parse_mode: 'Markdown' }).catch(() => {});
            return ctx.reply(HELP_TEXT, Markup.inlineKeyboard([[Markup.button.callback(locale.btn_back, 'go_to_main_menu')]]), { parse_mode: 'Markdown' }).catch(() => {});
        }
        showAdminDashboard(ctx, db, false);
    });

    bot.action('adm_toggle_maint', (ctx) => {
        if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery();
        db.isMaintenanceMode = !db.isMaintenanceMode;
        saveDB();
        ctx.answerCbQuery(`Maintenance: ${db.isMaintenanceMode}`);
        showAdminDashboard(ctx, db, true);
    });

    bot.action('adm_broadcast', (ctx) => {
        if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery();
        ctx.answerCbQuery();
        db.userSessions[ctx.chat.id] = { step: 'AWAITING_ADMIN_BROADCAST_MSG' };
        saveDB();
        ctx.reply("📢 Announcement মেসেজটি পাঠান।", Markup.inlineKeyboard([[Markup.button.callback("❌ বাতিল করুন", "adm_back_to_dashboard")]]));
    });

    bot.action('adm_all_links_menu', (ctx) => {
        if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery();
        ctx.answerCbQuery();
        ctx.editMessageText("🔗 All Links Management Sub-Menu:", Markup.inlineKeyboard([
            [Markup.button.callback("📜 All Links List", "adm_view_links_list")],
            [Markup.button.callback("💥 Delete All Links", "adm_delete_all_links_confirm")],
            [Markup.button.callback("🔙 ব্যাক", "adm_back_to_dashboard")]
        ])).catch(() => {});
    });

    bot.action('adm_view_links_list', (ctx) => {
        if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery();
        ctx.answerCbQuery();
        const keys = Object.keys(db.linkDatabase);
        if (!keys.length) {
            return ctx.editMessageText("ℹ️ বর্তমানে সিস্টেমে কোনো একটিভ লিংক নেই।", Markup.inlineKeyboard([[Markup.button.callback("🔙 পেছনে যান", "adm_all_links_menu")]])).catch(() => {});
        }
        ctx.reply("📜 সকল লিংক:");
        keys.forEach(key => {
            const data = db.linkDatabase[key];
            ctx.reply(`👤 Creator: ${data.name}\n📂 Category: ${data.type}\n🔗 Link ID: ${key}`, Markup.inlineKeyboard([[Markup.button.callback(`❌ Delete/Off: ${key}`, `adm_instant_del_${key}`)]])).catch(() => {});
        });
    });

    bot.action(/^adm_instant_del_(.+)$/, (ctx) => {
        if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery();
        const targetKey = ctx.match[1];
        if (db.linkDatabase[targetKey]) {
            if (db.linkDatabase[targetKey].imagePath) {
                const fullImgPath = path.join(baseDir, db.linkDatabase[targetKey].imagePath);
                if (fs.existsSync(fullImgPath)) fs.unlinkSync(fullImgPath);
            }
            delete db.linkDatabase[targetKey];
            saveDB();
            ctx.answerCbQuery("✅ লিংকটি রিমুভ করা হয়েছে।");
            ctx.editMessageText("❌ লিংকটি ডিলিট করা হয়েছে।").catch(() => {});
        } else {
            ctx.answerCbQuery("⚠️ লিংকটি ইতিমধ্যে ডিলিট হয়ে গেছে!");
        }
    });

    bot.action('adm_delete_all_links_confirm', (ctx) => {
        if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery();
        ctx.answerCbQuery();
        Object.keys(db.linkDatabase).forEach(key => {
            if (db.linkDatabase[key].imagePath) {
                const fullImgPath = path.join(baseDir, db.linkDatabase[key].imagePath);
                if (fs.existsSync(fullImgPath)) fs.unlinkSync(fullImgPath);
            }
        });
        db.linkDatabase = {};
        saveDB();
        ctx.editMessageText("💥 সমস্ত একটিভ লিংক ডিলিট করে দেওয়া হয়েছে!", Markup.inlineKeyboard([[Markup.button.callback("🔙 পেছনে যান", "adm_all_links_menu")]])).catch(() => {});
    });

    bot.action('adm_ban_menu', (ctx) => {
        if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery();
        ctx.answerCbQuery();
        db.userSessions[ctx.chat.id] = { step: 'AWAITING_BAN_USER_INPUT' };
        saveDB();
        ctx.reply(`🚫 Ban / Unban System\n\n📊 মোট ইউজার: ${db.registeredUsers.length}\n• ব্যান ইউজার: ${db.bannedUsers.length}\n\n👉 অনুগ্রহ করে ইউজারের ID অথবা Username লিখে পাঠান:`, Markup.inlineKeyboard([[Markup.button.callback("❌ বাতিল করুন", "adm_back_to_dashboard")]]));
    });

    bot.action('adm_back_to_dashboard', (ctx) => {
        if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery();
        ctx.answerCbQuery();
        delete db.userSessions[ctx.chat.id];
        saveDB();
        showAdminDashboard(ctx, db, true);
    });

    // Btn1: Answer & Msg (Pop-up)
    bot.action(/^view_ans_msg_(.+)$/, (ctx) => {
        if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery();
        const data = db.linkDatabase[ctx.match[1]];
        if (!data) return ctx.answerCbQuery("⚠️ লিঙ্কটি ডাটাবেজে পাওয়া যায়নি।", { show_alert: true });
        
        const ansText = data.answer ? data.answer : "⏳ এখনও উত্তর দেয়নি!";
        const msgText = data.message ? data.message : "কুনো মেসেজ আসেনি";
        
        return ctx.answerCbQuery(`ans: ${ansText}\nmsg: ${msgText}`, { show_alert: true });
    });

    // Btn2: Visitor Info (Auto-delete after 5 sec)
    bot.action(/^view_vi_(.+)$/, async (ctx) => {
        if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery();
        const linkId = ctx.match[1];
        const data = db.linkDatabase[linkId];
        if (!data) return ctx.answerCbQuery("⚠️ লিঙ্কটি ডাটাবেজে পাওয়া যায়নি।", { show_alert: true });
        ctx.answerCbQuery();
        
        if (!data.visitors || data.visitors.length === 0) {
            const emptyMsg = await ctx.reply("ℹ️ লিঙ্কটি এখনও কেউ ওপেন করেনি।").catch(() => null);
            if (emptyMsg) {
                setTimeout(async () => {
                    try { await bot.telegram.deleteMessage(ctx.chat.id, emptyMsg.message_id); } catch (e) {}
                }, 5000);
            }
            return;
        }
        let report = `👤 Visitor Details for Link [ ${linkId} ]:\n\n`;
        data.visitors.forEach((v, index) => {
            report += `${index + 1}. 🗓️ Time: ${v.time}\n🌐 IP: ${v.ip}\n🌍 Country: ${v.country} | City: ${v.city}\n📡 ISP: ${v.isp}\n📱 Device/OS: ${v.os}\n🌐 Browser: ${v.browser}\n\n`;
        });
        if (report.length > 4000) {
            report = report.substring(0, 3900) + "\n...[Truncated]";
        }
        const sentMsg = await ctx.reply(report).catch(() => null);
        if (sentMsg) {
            setTimeout(async () => {
                try { await bot.telegram.deleteMessage(ctx.chat.id, sentMsg.message_id); } catch (e) {}
            }, 5000);
        }
    });

    // Btn3: Link Off
    bot.action(/^adm_off_link_(.+)$/, async (ctx) => {
        if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery();
        const linkId = ctx.match[1];
        if (db.linkDatabase[linkId]) {
            delete db.linkDatabase[linkId];
            await saveDB();
            ctx.answerCbQuery("✅ লিঙ্কটি সফলভাবে বন্ধ করা হয়েছে।", { show_alert: true });
            ctx.editMessageText("❌ এই লিঙ্কটি অ্যাডমিন কর্তৃক বন্ধ করা হয়েছে।").catch(() => {});
        } else {
            ctx.answerCbQuery("⚠️ লিঙ্কটি ইতিমধ্যে মুছে ফেলা হয়েছে বা নেই।", { show_alert: true });
        }
    });

    // Btn4: Ban User (Creator)
    bot.action(/^adm_ban_creator_(.+)$/, async (ctx) => {
        if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery();
        const linkId = ctx.match[1];
        const data = db.linkDatabase[linkId];
        if (!data) return ctx.answerCbQuery("⚠️ লিঙ্কটি পাওয়া যায়নি।", { show_alert: true });
        
        const creatorId = Number(data.userId);
        if (!db.bannedUsers.includes(creatorId)) {
            db.bannedUsers.push(creatorId);
            await saveDB();
        }
        ctx.answerCbQuery(`🚫 ইউজার (${creatorId}) কে সফলভাবে ব্যান করা হয়েছে।`, { show_alert: true });
        ctx.editMessageText(`🚫 এই লিঙ্কের তৈরিকারী ইউজারকে (ID: ${creatorId}) ব্যান করা হয়েছে।`).catch(() => {});
    });
};

const handleAdminText = (ctx, text, session, db, saveDB, bot) => {
    const userId = ctx.chat.id;
    
    if (session.step === 'AWAITING_ADMIN_BROADCAST_MSG') {
        db.registeredUsers.forEach(id => {
            bot.telegram.sendMessage(id, `📢 [Announcement]\n\n${text}`, { parse_mode: 'Markdown' }).catch(() => {});
        });
        ctx.reply("📡 Announcement Completed.");
        delete db.userSessions[userId];
        saveDB();
        showAdminDashboard(ctx, db, false);
        return true;
    }
    
    if (session.step === 'AWAITING_BAN_USER_INPUT') {
        let targetId = parseInt(text, 10);
        if (isNaN(targetId)) targetId = db.usernameMap[text.replace('@', '').trim().toLowerCase()];
        if (!targetId) {
            ctx.reply("❌ এই ইউজারনেম/আইডি ডাটাবেজে পাওয়া যায়নি।");
            return true;
        }
        if (db.bannedUsers.includes(targetId)) {
            db.bannedUsers = db.bannedUsers.filter(id => id !== targetId);
            ctx.reply(`🟢 ইউজার \`${targetId}\` কে UNBAN করা হয়েছে।`, { parse_mode: 'Markdown' });
        } else {
            db.bannedUsers.push(targetId);
            ctx.reply(`🚫 ইউজার \`${targetId}\` কে BAN করা হয়েছে।`, { parse_mode: 'Markdown' });
        }
        delete db.userSessions[userId];
        saveDB();
        showAdminDashboard(ctx, db, false);
        return true;
    }
    
    return false;
};

module.exports = { setupAdmin, handleAdminText };
