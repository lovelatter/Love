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
        if (!isAdmin(ctx.chat.id)) return;
        showAdminDashboard(ctx, db, false);
    });

    bot.action('adm_toggle_maint', async (ctx) => {
        if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery();
        db.isMaintenanceMode = !db.isMaintenanceMode;
        await saveDB();
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
        const keys = Object.keys(db.linkDatabase);
        if (!keys.length) return ctx.editMessageText("ℹ️ বর্তমানে কোনো লিংক নেই।", Markup.inlineKeyboard([[Markup.button.callback("🔙 পেছনে যান", "adm_all_links_menu")]]));
        keys.forEach(key => {
            const data = db.linkDatabase[key];
            ctx.reply(`👤 Creator: ${data.name}\n🔗 Link ID: ${key}`, Markup.inlineKeyboard([[Markup.button.callback(`❌ Delete: ${key}`, `adm_instant_del_${key}`)]])).catch(() => {});
        });
    });

    bot.action(/^adm_instant_del_(.+)$/, async (ctx) => {
        if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery();
        const targetKey = ctx.match[1];
        if (db.linkDatabase[targetKey]) {
            delete db.linkDatabase[targetKey];
            await saveDB();
            ctx.answerCbQuery("✅ লিংক রিমুভ করা হয়েছে।");
            ctx.editMessageText("❌ লিংকটি ডিলিট করা হয়েছে।").catch(() => {});
        }
    });

    bot.action('adm_delete_all_links_confirm', async (ctx) => {
        if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery();
        db.linkDatabase = {};
        await saveDB();
        ctx.editMessageText("💥 সমস্ত লিংক ডিলিট করা হয়েছে!", Markup.inlineKeyboard([[Markup.button.callback("🔙 পেছনে যান", "adm_all_links_menu")]]));
    });

    bot.action('adm_ban_menu', (ctx) => {
        if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery();
        ctx.answerCbQuery();
        db.userSessions[ctx.chat.id] = { step: 'AWAITING_BAN_USER_INPUT' };
        saveDB();
        ctx.reply(`🚫 Ban / Unban System`, Markup.inlineKeyboard([[Markup.button.callback("❌ বাতিল করুন", "adm_back_to_dashboard")]]));
    });

    bot.action('adm_back_to_dashboard', async (ctx) => {
        if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery();
        ctx.answerCbQuery();
        delete db.userSessions[ctx.chat.id];
        await saveDB();
        showAdminDashboard(ctx, db, true);
    });
};

const handleAdminText = async (ctx, text, session, db, saveDB, bot) => {
    const userId = ctx.chat.id;
    if (session.step === 'AWAITING_ADMIN_BROADCAST_MSG') {
        db.registeredUsers.forEach(id => bot.telegram.sendMessage(id, `📢 ${text}`).catch(() => {}));
        delete db.userSessions[userId];
        await saveDB();
        ctx.reply("📡 Announcement Sent.");
        return true;
    }
    if (session.step === 'AWAITING_BAN_USER_INPUT') {
        let targetId = parseInt(text, 10);
        if (db.bannedUsers.includes(targetId)) {
            db.bannedUsers = db.bannedUsers.filter(id => id !== targetId);
            ctx.reply(`🟢 UNBAN: ${targetId}`);
        } else {
            db.bannedUsers.push(targetId);
            ctx.reply(`🚫 BAN: ${targetId}`);
        }
        delete db.userSessions[userId];
        await saveDB();
        return true;
    }
    return false;
};

module.exports = { setupAdmin, handleAdminText };
