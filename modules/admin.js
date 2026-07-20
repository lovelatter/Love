const { Markup } = require('telegraf');
const fs = require('fs');
const path = require('path');

const showAdminDashboard = (ctx, db, isEdit = false) => {
    // সরাসরি db রেফারেন্স ব্যবহার করা নিশ্চিত করা
    const maintStatus = db.isMaintenanceMode ? "ON 🔴" : "OFF 🟢";
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback(`🛠️ Maintenance: ${maintStatus}`, "adm_toggle_maint")],
        [Markup.button.callback("📢 Announcement", "adm_broadcast")],
        [Markup.button.callback("🔗 All Links", "adm_all_links_menu")],
        [Markup.button.callback("🚫 Ban/Unban", "adm_ban_menu")]
    ]);
    const text = `👑 Admin Dashboard\n\n📊 Total Links: ${Object.keys(db.linkDatabase || {}).length}`;
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
        ]));
    });

    bot.action('adm_view_links_list', (ctx) => {
        if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery();
        ctx.answerCbQuery();
        
        const links = db.linkDatabase || {};
        const keys = Object.keys(links);
        
        if (!keys.length) {
            return ctx.editMessageText("ℹ️ বর্তমানে সিস্টেমে কোনো একটিভ লিংক নেই।", Markup.inlineKeyboard([[Markup.button.callback("🔙 পেছনে যান", "adm_all_links_menu")]]));
        }
        
        let msg = "📜 সকল লিংক:\n\n";
        keys.forEach((key, index) => {
            const data = links[key];
            msg += `${index + 1}. 👤 ${data.name} | 📂 ${data.type}\n🔗 ID: ${key}\n\n`;
        });
        
        ctx.editMessageText(msg, Markup.inlineKeyboard([[Markup.button.callback("🔙 ব্যাক", "adm_all_links_menu")]]));
    });

    bot.action('adm_delete_all_links_confirm', (ctx) => {
        if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery();
        ctx.answerCbQuery();
        db.linkDatabase = {};
        saveDB();
        ctx.editMessageText("💥 সমস্ত একটিভ লিংক ডিলিট করে দেওয়া হয়েছে!", Markup.inlineKeyboard([[Markup.button.callback("🔙 পেছনে যান", "adm_all_links_menu")]]));
    });

    bot.action('adm_ban_menu', (ctx) => {
        if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery();
        ctx.answerCbQuery();
        db.userSessions[ctx.chat.id] = { step: 'AWAITING_BAN_USER_INPUT' };
        saveDB();
        ctx.reply(`🚫 Ban / Unban System\n\n📊 মোট ইউজার: ${db.registeredUsers?.length || 0}\n• ব্যান ইউজার: ${db.bannedUsers?.length || 0}\n\n👉 অনুগ্রহ করে ইউজারের ID লিখে পাঠান:`, Markup.inlineKeyboard([[Markup.button.callback("❌ বাতিল করুন", "adm_back_to_dashboard")]]));
    });

    bot.action('adm_back_to_dashboard', (ctx) => {
        if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery();
        ctx.answerCbQuery();
        delete db.userSessions[ctx.chat.id];
        saveDB();
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
        if (!data.visitors || data.visitors.length === 0) return ctx.reply("ℹ️ লিঙ্কটি এখনও কেউ ওপেন করেনি।");
        
        let report = `👤 Visitor Details for [ ${linkId} ]:\n\n`;
        data.visitors.forEach((v, i) => report += `${i+1}. 🗓️ ${v.time} | 🌍 ${v.country}\n🌐 IP: ${v.ip}\n\n`);
        ctx.reply(report);
    });
};

const handleAdminText = (ctx, text, session, db, saveDB, bot) => {
    const userId = ctx.chat.id;
    if (session.step === 'AWAITING_ADMIN_BROADCAST_MSG') {
        (db.registeredUsers || []).forEach(id => bot.telegram.sendMessage(id, `📢 [Announcement]\n\n${text}`).catch(() => {}));
        ctx.reply("📡 Announcement Sent.");
        delete db.userSessions[userId];
        saveDB();
        showAdminDashboard(ctx, db, false);
        return true;
    }
    if (session.step === 'AWAITING_BAN_USER_INPUT') {
        const targetId = parseInt(text, 10);
        if (!db.bannedUsers) db.bannedUsers = [];
        if (db.bannedUsers.includes(targetId)) {
            db.bannedUsers = db.bannedUsers.filter(id => id !== targetId);
            ctx.reply(`🟢 Unbanned: ${targetId}`);
        } else {
            db.bannedUsers.push(targetId);
            ctx.reply(`🚫 Banned: ${targetId}`);
        }
        delete db.userSessions[userId];
        saveDB();
        return true;
    }
    return false;
};

module.exports = { setupAdmin, handleAdminText };
