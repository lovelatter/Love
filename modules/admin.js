const { Markup } = require('telegraf');

function showAdminDashboard(ctx, db, isEdit = false) {
    const maintStatus = db.isMaintenanceMode ? "ON 🔴" : "OFF 🟢";
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback(`🛠️ Maintenance: ${maintStatus}`, "adm_toggle_maint")],
        [Markup.button.callback("📢 Announcement (Broadcast)", "adm_broadcast")],
        [Markup.button.callback("🔗 All Links Management", "adm_all_links_menu")],
        [Markup.button.callback("🚫 Ban / Unban System", "adm_ban_menu")]
    ]);
    const text = `👑 Master Admin Console:`;
    if (isEdit) return ctx.editMessageText(text, { reply_markup: keyboard.reply_markup, parse_mode: 'Markdown' }).catch(() => {});
    return ctx.reply(text, { reply_markup: keyboard.reply_markup, parse_mode: 'Markdown' }).catch(() => {});
}

function handleAdminAction(ctx, db, saveDB, action, bot) {
    const userId = ctx.chat.id;

    if (action === 'adm_toggle_maint') {
        db.isMaintenanceMode = !db.isMaintenanceMode;
        saveDB();
        ctx.answerCbQuery(`Maintenance: ${db.isMaintenanceMode}`);
        showAdminDashboard(ctx, db, true);
    } 
    else if (action === 'adm_broadcast') {
        ctx.answerCbQuery();
        db.userSessions[userId] = { step: 'AWAITING_ADMIN_BROADCAST_MSG' };
        saveDB();
        ctx.reply("📢 Announcement মেসেজটি লিখুন:", Markup.inlineKeyboard([[Markup.button.callback("❌ বাতিল", "adm_back_to_dashboard")]]));
    }
    else if (action === 'adm_all_links_menu') {
        ctx.answerCbQuery();
        ctx.editMessageText("🔗 লিংক ম্যানেজমেন্ট:", Markup.inlineKeyboard([
            [Markup.button.callback("💥 ডিলিট অল লিংকস", "adm_delete_all_links_confirm")],
            [Markup.button.callback("🔙 ব্যাক", "adm_back_to_dashboard")]
        ]));
    }
    else if (action === 'adm_back_to_dashboard') {
        ctx.answerCbQuery();
        delete db.userSessions[userId];
        saveDB();
        showAdminDashboard(ctx, db, true);
    }
}

module.exports = { showAdminDashboard, handleAdminAction };
