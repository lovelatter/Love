const { Markup } = require('telegraf');

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

const setupAdminHandlers = (bot, db, saveDB, isAdmin, locale, sendMainMenu) => {
    
    bot.command(['admin', 'adm'], (ctx) => {
        if (!isAdmin(ctx.chat.id)) return;
        showAdminDashboard(ctx, db, saveDB, false);
    });

    bot.action('adm_toggle_maint', (ctx) => {
        if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery();
        db.isMaintenanceMode = !db.isMaintenanceMode;
        saveDB();
        ctx.answerCbQuery(`Maintenance: ${db.isMaintenanceMode}`);
        showAdminDashboard(ctx, db, saveDB, true);
    });

    bot.action('adm_broadcast', (ctx) => {
        if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery();
        ctx.answerCbQuery();
        db.userSessions[ctx.chat.id] = { step: 'AWAITING_ADMIN_BROADCAST_MSG' };
        saveDB();
        ctx.reply("📢 Announcement মেসেজটি পাঠান:", Markup.inlineKeyboard([[Markup.button.callback("❌ বাতিল করুন", "adm_back_to_dashboard")]]));
    });

    bot.action('adm_all_links_menu', (ctx) => {
        if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery();
        ctx.answerCbQuery();
        ctx.editMessageText("🔗 All Links Management Sub-Menu:", Markup.inlineKeyboard([
            [Markup.button.callback("📜 View All Links List", "adm_view_links_list")],
            [Markup.button.callback("💥 Turn Off & Delete All Links", "adm_delete_all_links_confirm")],
            [Markup.button.callback("🔙 ব্যাক টু ড্যাশবোর্ড", "adm_back_to_dashboard")]
        ]));
    });

    bot.action('adm_view_links_list', (ctx) => {
        if (!isAdmin(ctx.chat.id)) return;
        ctx.answerCbQuery();
        const keys = Object.keys(db.linkDatabase);
        if (!keys.length) return ctx.editMessageText("ℹ️ কোনো লিংক নেই।", Markup.inlineKeyboard([[Markup.button.callback("🔙 ব্যাক", "adm_all_links_menu")]]));
        keys.forEach(key => {
            const data = db.linkDatabase[key];
            ctx.reply(`👤 Creator: ${data.name}\n🔗 ID: ${key}`, Markup.inlineKeyboard([[Markup.button.callback(`❌ Delete: ${key}`, `adm_instant_del_${key}`)]])).catch(() => {});
        });
    });

    bot.action(/^adm_instant_del_(.+)$/, (ctx) => {
        if (!isAdmin(ctx.chat.id)) return;
        const targetKey = ctx.match[1];
        delete db.linkDatabase[targetKey];
        saveDB();
        ctx.answerCbQuery("✅ ডিলিট হয়েছে।");
        ctx.editMessageText("❌ লিংকটি ডিলিট করা হয়েছে।").catch(() => {});
    });

    bot.action('adm_back_to_dashboard', (ctx) => {
        if (!isAdmin(ctx.chat.id)) return;
        ctx.answerCbQuery();
        delete db.userSessions[ctx.chat.id];
        saveDB();
        showAdminDashboard(ctx, db, saveDB, true);
    });

    bot.action('adm_ban_menu', (ctx) => {
        if (!isAdmin(ctx.chat.id)) return;
        ctx.answerCbQuery();
        db.userSessions[ctx.chat.id] = { step: 'AWAITING_BAN_USER_INPUT' };
        saveDB();
        ctx.reply("👉 ব্যান বা আনব্যান করতে ID লিখুন:", Markup.inlineKeyboard([[Markup.button.callback("❌ বাতিল", "adm_back_to_dashboard")]]));
    });
};

module.exports = { setupAdminHandlers, showAdminDashboard };
