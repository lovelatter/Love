const { Markup } = require('telegraf');
const fs = require('fs');
const path = require('path');

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
            ctx.reply(locale.invalid_cmd(ctx.message.text || ''), { parse_mode: 'Markdown' }).catch(() => {});
            return ctx.reply(locale.help_text, Markup.inlineKeyboard([[Markup.button.callback(locale.btn_back, 'go_to_main_menu')]]), { parse_mode: 'Markdown' }).catch(() => {});
        }
        showAdminDashboard(ctx, db, false);
    });

    bot.action('adm_toggle_maint', async (ctx) => {
        if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery();
        db.isMaintenanceMode = !db.isMaintenanceMode;
        await saveDB();
        ctx.answerCbQuery(`Maintenance: ${db.isMaintenanceMode}`);
        showAdminDashboard(ctx, db, true);
    });

    bot.action('adm_broadcast', async (ctx) => {
        if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery();
        ctx.answerCbQuery();
        db.userSessions[ctx.chat.id] = { step: 'AWAITING_ADMIN_BROADCAST_MSG' };
        await saveDB();
        ctx.reply("📢 Announcement মেসেজটি পাঠান।", Markup.inlineKeyboard([[Markup.button.callback("❌ বাতিল করুন", "adm_back_to_dashboard")]]));
    });

    bot.action('adm_all_links_menu', (ctx) => {
        if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery();
        ctx.answerCbQuery();
        ctx.editMessageText("🔗 All Links Management Sub-Menu:", Markup.inlineKeyboard([
            [Markup.button.callback("📜 All Links List", "adm_view_links_list")],
            [Markup.button.callback("💥 Delete All Links", "adm_delete_all_links_confirm")],
            [Markup.button.callback("🔙 ব্যাক", "adm_back_to_dashboard")]
        ]));
    });

    bot.action('adm_view_links_list', (ctx) => {
        if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery();
        ctx.answerCbQuery();
        const keys = Object.keys(db.linkDatabase);
        if (!keys.length) {
            return ctx.editMessageText("ℹ️ বর্তমানে সিস্টেমে কোনো একটিভ লিংক নেই।", Markup.inlineKeyboard([[Markup.button.callback("🔙 পেছনে যান", "adm_all_links_menu")]]));
        }
        ctx.reply("📜 সকল লিংক:");
        keys.forEach(key => {
            const data = db.linkDatabase[key];
            ctx.reply(`👤 Creator: ${data.name}\n📂 Category: ${data.type}\n🔗 Link ID: ${key}`, Markup.inlineKeyboard([[Markup.button.callback(`❌ Delete/Off: ${key}`, `adm_instant_del_${key}`)]])).catch(() => {});
        });
    });

    bot.action(/^adm_instant_del_(.+)$/, async (ctx) => {
        if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery();
        const targetKey = ctx.match[1];
        if (db.linkDatabase[targetKey]) {
            if (db.linkDatabase[targetKey].imagePath) {
                const fullImgPath = path.join(baseDir, db.linkDatabase[targetKey].imagePath);
                if (fs.existsSync(fullImgPath)) fs.unlinkSync(fullImgPath);
            }
            delete db.linkDatabase[targetKey];
            await saveDB();
            ctx.answerCbQuery("✅ লিংকটি রিমুভ করা হয়েছে।");
            ctx.editMessageText("❌ লিংকটি ডিলিট করা হয়েছে।").catch(() => {});
        } else {
            ctx.answerCbQuery("⚠️ লিংকটি ইতিমধ্যে ডিলিট হয়ে গেছে!");
        }
    });

    bot.action('adm_delete_all_links_confirm', async (ctx) => {
        if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery();
        ctx.answerCbQuery();
        Object.keys(db.linkDatabase).forEach(key => {
            if (db.linkDatabase[key].imagePath) {
                const fullImgPath = path.join(baseDir, db.linkDatabase[key].imagePath);
                if (fs.existsSync(fullImgPath)) fs.unlinkSync(fullImgPath);
            }
        });
        db.linkDatabase = {};
        await saveDB();
        ctx.editMessageText("💥 সমস্ত একটিভ লিংক ডিলিট করে দেওয়া হয়েছে!", Markup.inlineKeyboard([[Markup.button.callback("🔙 পেছনে যান", "adm_all_links_menu")]]));
    });

    bot.action('adm_ban_menu', async (ctx) => {
        if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery();
        ctx.answerCbQuery();
        db.userSessions[ctx.chat.id] = { step: 'AWAITING_BAN_USER_INPUT' };
        await saveDB();
        ctx.reply(`🚫 Ban / Unban System\n\n📊 মোট ইউজার: ${db.registeredUsers.length}\n• ব্যান ইউজার: ${db.bannedUsers.length}\n\n👉 অনুগ্রহ করে ইউজারের ID অথবা Username লিখে পাঠান:`, Markup.inlineKeyboard([[Markup.button.callback("❌ বাতিল করুন", "adm_back_to_dashboard")]]));
    });

    bot.action('adm_back_to_dashboard', async (ctx) => {
        if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery();
        ctx.answerCbQuery();
        delete db.userSessions[ctx.chat.id];
        await saveDB();
        showAdminDashboard(ctx, db, true);
    });

    bot.action(/^view_ans_(.+)$/, (ctx) => {
        if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery();
        const data = db.linkDatabase[ctx.match[1]];
        if (!data) return ctx.answerCbQuery("⚠️ লিঙ্কটি ডাটাবেজে পাওয়া যায়নি।", { show_alert: true });
        return ctx.answerCbQuery(data.answer ? `📩 উত্তর: ${data.answer}` : "⏳ এখনও উত্তর দেয়নি!", { show_alert: true });
    });

    bot.action(/^view_vi_(.+)$/, async (ctx) => {
        if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery();
        const linkId = ctx.match[1];
        const data = db.linkDatabase[linkId];
        if (!data) return ctx.answerCbQuery("⚠️ লিঙ্কটি ডাটাবেজে পাওয়া যায়নি।", { show_alert: true });
        ctx.answerCbQuery();
        if (!data.visitors || data.visitors.length === 0) {
            return ctx.reply("ℹ️ লিঙ্কটি এখনও কেউ ওপেন করেনি।");
        }
        let report = `👤 Visitor Details for Link [ ${linkId} ]:\n\n`;
        data.visitors.forEach((v, index) => {
            report += `${index + 1}. 🗓️ Time: ${v.time}\n🌐 IP: ${v.ip}\n🌍 Country: ${v.country} | City: ${v.city}\n📡 ISP: ${v.isp}\n📱 Device/OS: ${v.os}\n🌐 Browser: ${v.browser}\n\n`;
        });
        if (report.length > 4000) {
            report = report.substring(0, 3900) + "\n...[Truncated]";
        }
        ctx.reply(report);
    });
};

const handleAdminText = async (ctx, text, session, db, saveDB, bot) => {
    const userId = ctx.chat.id;
    
    if (session.step === 'AWAITING_ADMIN_BROADCAST_MSG') {
        db.registeredUsers.forEach(id => {
            bot.telegram.sendMessage(id, `📢 [Announcement]\n\n${text}`, { parse_mode: 'Markdown' }).catch(() => {});
        });
        ctx.reply("📡 Announcement Completed.");
        delete db.userSessions[userId];
        await saveDB();
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
        await saveDB();
        showAdminDashboard(ctx, db, false);
        return true;
    }
    
    return false;
};

module.exports = { setupAdmin, handleAdminText };
