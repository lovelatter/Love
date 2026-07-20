const { Markup } = require('telegraf');
const fs = require('fs');
const path = require('path');

const showAdminDashboard = (ctx, db, saveDB, isEdit = false) => {
    const maintStatus = db.isMaintenanceMode ? "ON 🔴" : "OFF 🟢";
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback(`🛠️ Maintenance: ${maintStatus}`, "adm_toggle_maint")],
        [Markup.button.callback("📢 Announcement (Broadcast)", "adm_broadcast")],
        [Markup.button.callback("🔗 All Links Management", "adm_all_links_menu")],
        [Markup.button.callback("🚫 Ban / Unban System", "adm_ban_menu")]
    ]);
    const text = `👑 Welcome to the Master Admin Core Console:`;
    if (isEdit) return ctx.editMessageText(text, { reply_markup: keyboard.reply_markup, parse_mode: 'Markdown' }).catch(() => {});
    return ctx.reply(text, { reply_markup: keyboard.reply_markup, parse_mode: 'Markdown' }).catch(() => {});
};

const setupAdminActions = (bot, db, saveDB, isAdmin) => {
    // Maintenance Toggle
    bot.action('adm_toggle_maint', (ctx) => {
        if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery();
        db.isMaintenanceMode = !db.isMaintenanceMode;
        saveDB();
        ctx.answerCbQuery(`Maintenance: ${db.isMaintenanceMode}`);
        showAdminDashboard(ctx, db, saveDB, true);
    });

    // Broadcast
    bot.action('adm_broadcast', (ctx) => {
        if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery();
        ctx.answerCbQuery();
        db.userSessions[ctx.chat.id] = { step: 'AWAITING_ADMIN_BROADCAST_MSG' };
        saveDB();
        ctx.reply("📢 Announcement মেসেজটি পাঠান:", Markup.inlineKeyboard([[Markup.button.callback("❌ বাতিল করুন", "adm_back_to_dashboard")]]));
    });

    // Links Management Menu
    bot.action('adm_all_links_menu', (ctx) => {
        if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery();
        ctx.answerCbQuery();
        ctx.editMessageText("🔗 All Links Management:", Markup.inlineKeyboard([
            [Markup.button.callback("📜 View All Links", "adm_view_links_list")],
            [Markup.button.callback("💥 Delete All Links", "adm_delete_all_links_confirm")],
            [Markup.button.callback("🔙 Back", "adm_back_to_dashboard")]
        ]));
    });

    // Ban Menu
    bot.action('adm_ban_menu', (ctx) => {
        if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery();
        ctx.answerCbQuery();
        db.userSessions[ctx.chat.id] = { step: 'AWAITING_BAN_USER_INPUT' };
        saveDB();
        ctx.reply(`🚫 Ban / Unban System\n\n👉 ইউজার ID অথবা Username পাঠান:`, Markup.inlineKeyboard([[Markup.button.callback("❌ বাতিল করুন", "adm_back_to_dashboard")]]));
    });

    // Back to Dashboard
    bot.action('adm_back_to_dashboard', (ctx) => {
        if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery();
        ctx.answerCbQuery();
        delete db.userSessions[ctx.chat.id];
        saveDB();
        showAdminDashboard(ctx, db, saveDB, true);
    });
};

module.exports = { showAdminDashboard, setupAdminActions };
