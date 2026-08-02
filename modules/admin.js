const fs = require('fs');
const path = require('path');
const { Markup } = require('telegraf');

const showAdminDashboard = (ctx, db, isEdit = false) => {
    const maintStatus = db.isMaintenanceMode ? "ON 🔴" : "OFF 🟢";
    const feedbackCount = db.feedbacks ? db.feedbacks.length : 0;
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback(`🛠️ Maintenance: ${maintStatus}`, "adm_toggle_maint")],
        [Markup.button.callback(`📥 Feedbacks (${feedbackCount})`, "adm_feedback_list")],
        [Markup.button.callback("📢 Announcement", "adm_broadcast")],
        [Markup.button.callback("✉️ Msg User", "adm_msg_user")],
        [Markup.button.callback("🔗 All Links", "adm_all_links_menu")],
        [Markup.button.callback("🚫 Ban/Unban", "adm_ban_menu")],
        [Markup.button.callback("❌ Close", "adm_close_dashboard")]
    ]);
    const text = `👑 Admin Dashboard 👑\n\n- মোট: ${db.registeredUsers.length}\n- ব্যান: ${db.bannedUsers.length}\n- ফিডব্যাক: ${feedbackCount}\n`;
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
        if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery().catch(() => {});
        db.isMaintenanceMode = !db.isMaintenanceMode;
        saveDB();
        ctx.answerCbQuery(`Maintenance: ${db.isMaintenanceMode}`).catch(() => {});
        showAdminDashboard(ctx, db, true);
    });

    bot.action('adm_close_dashboard', (ctx) => {
        if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery().catch(() => {});
        ctx.answerCbQuery().catch(() => {});
        delete db.userSessions[ctx.chat.id];
        saveDB();
        ctx.deleteMessage().catch(() => {});
    });

    bot.action('adm_feedback_list', (ctx) => {
        if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery().catch(() => {});
        ctx.answerCbQuery().catch(() => {});
        if (!db.feedbacks || db.feedbacks.length === 0) {
            return ctx.editMessageText("ℹ️ বর্তমানে কোনো ফিডব্যাক বা রিপোর্ট জমা হয়নি।", Markup.inlineKeyboard([[Markup.button.callback("🔙 ব্যাক", "adm_back_to_dashboard")]] )).catch(() => {});
        }
        ctx.reply("📥 সকল ফিডব্যাক ও রিপোর্ট তালিকা:");
        db.feedbacks.forEach((f, index) => {
            const senderName = f.name || "Unknown";
            const senderId = f.userId;
            const senderUsername = f.username || "None";
            const msg = f.message || "";
            const textContent = `👤 Name: ${senderName}\n🆔 ID: \`${senderId}\`\n🌐 Username: ${senderUsername}\n💬 Message:\n${msg}`;
            ctx.reply(textContent, {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback("💬 রিপ্লাই দিন", `admin_reply_${senderId}`), Markup.button.callback("🗑️ ডিলিট", `adm_del_feedback_${index}`)]
                ])
            }).catch(() => {});
        });
    });

    bot.action(/^adm_del_feedback_(\d+)$/, (ctx) => {
        if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery().catch(() => {});
        const index = parseInt(ctx.match[1], 10);
        if (db.feedbacks && db.feedbacks[index]) {
            db.feedbacks.splice(index, 1);
            saveDB();
            ctx.answerCbQuery("✅ ফিডব্যাকটি ডিলিট করা হয়েছে।").catch(() => {});
            ctx.editMessageText("❌ ফিডব্যাকটি মুছে ফেলা হয়েছে।").catch(() => {});
        } else {
            ctx.answerCbQuery("⚠️ ফিডব্যাকটি পাওয়া যায়নি!").catch(() => {});
        }
    });

    bot.action('adm_broadcast', (ctx) => {
        if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery().catch(() => {});
        ctx.answerCbQuery().catch(() => {});
        db.userSessions[ctx.chat.id] = { step: 'AWAITING_ADMIN_BROADCAST_MSG' };
        saveDB();
        ctx.reply("📢 Announcement মেসেজটি পাঠান।", Markup.inlineKeyboard([[Markup.button.callback("❌ বাতিল করুন", "adm_back_to_dashboard")]]));
    });

    bot.action('adm_msg_user', (ctx) => {
        if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery().catch(() => {});
        ctx.answerCbQuery().catch(() => {});
        db.userSessions[ctx.chat.id] = { step: 'AWAITING_MSG_USER_TARGET' };
        saveDB();
        ctx.reply("যেই ইউজারকে মেসেজ দিতে চান তার ইউজার id বা ইউজারনেম দিন।", Markup.inlineKeyboard([[Markup.button.callback("❌ বাতিল করুন", "adm_back_to_dashboard")]]));
    });

    bot.action('adm_all_links_menu', (ctx) => {
        if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery().catch(() => {});
        ctx.answerCbQuery().catch(() => {});
        ctx.editMessageText("🔗 All Links Management Sub-Menu:", Markup.inlineKeyboard([
            [Markup.button.callback("📜 All Links List", "adm_view_links_list")],
            [Markup.button.callback("🔍 Filter Links", "adm_filter_links_prompt")],
            [Markup.button.callback("💥 Delete All Links", "adm_delete_all_links_confirm")],
            [Markup.button.callback("🔙 ব্যাক", "adm_back_to_dashboard")]
        ])).catch(() => {});
    });

    bot.action('adm_view_links_list', (ctx) => {
        if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery().catch(() => {});
        ctx.answerCbQuery().catch(() => {});
        const keys = Object.keys(db.linkDatabase || {});
        if (!keys.length) {
            return ctx.editMessageText("ℹ️ বর্তমানে সিস্টেমে কোনো একটিভ লিংক নেই।", Markup.inlineKeyboard([[Markup.button.callback("🔙 ব্যাক", "adm_back_to_dashboard")]] )).catch(() => {});
        }
        ctx.editMessageText("📜 সকল লিঙ্কের তালিকা নিচে দেওয়া হলো:", Markup.inlineKeyboard([[Markup.button.callback("🔙 ব্যাক", "adm_back_to_dashboard")]] )).catch(() => {});
        keys.forEach(key => {
            const data = db.linkDatabase[key];
            ctx.reply(`👤 Creator: ${data.name}\n📂 Category: ${data.type}\n🔗 Link ID: ${key}`, Markup.inlineKeyboard([[Markup.button.callback(`❌ Delete/Off: ${key}`, `adm_instant_del_${key}`)]])).catch(() => {});
        });
    });

    bot.action('adm_filter_links_prompt', (ctx) => {
        if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery().catch(() => {});
        ctx.answerCbQuery().catch(() => {});
        db.userSessions[ctx.chat.id] = { step: 'AWAITING_ADMIN_LINK_FILTER' };
        saveDB();
        ctx.reply("ফিল্টার করার কি দিন (category/username/userid):", Markup.inlineKeyboard([[Markup.button.callback("❌ বাতিল করুন", "adm_back_to_dashboard")]]));
    });

    bot.action(/^adm_instant_del_(.+)$/, (ctx) => {
        if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery().catch(() => {});
        const targetKey = ctx.match[1];
        if (db.linkDatabase[targetKey]) {
            if (db.linkDatabase[targetKey].imagePath) {
                const fullImgPath = path.join(baseDir, db.linkDatabase[targetKey].imagePath);
                if (fs.existsSync(fullImgPath)) fs.unlinkSync(fullImgPath);
            }
            delete db.linkDatabase[targetKey];
            saveDB();
            ctx.answerCbQuery("✅ লিংকটি রিমুভ করা হয়েছে।").catch(() => {});
            ctx.editMessageText("❌ লিংকটি ডিলিট করা হয়েছে।").catch(() => {});
        } else {
            ctx.answerCbQuery("⚠️ লিংকটি ইতিমধ্যে ডিলিট হয়ে গেছে!").catch(() => {});
        }
    });

    bot.action('adm_delete_all_links_confirm', (ctx) => {
        if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery().catch(() => {});
        ctx.answerCbQuery().catch(() => {});
        if (db.linkDatabase) {
            Object.keys(db.linkDatabase).forEach(key => {
                if (db.linkDatabase[key].imagePath) {
                    const fullImgPath = path.join(baseDir, db.linkDatabase[key].imagePath);
                    if (fs.existsSync(fullImgPath)) fs.unlinkSync(fullImgPath);
                }
            });
            db.linkDatabase = {};
            saveDB();
        }
        ctx.editMessageText("💥 সমস্ত একটিভ লিংক ডিলিট করে দেওয়া হয়েছে!", Markup.inlineKeyboard([[Markup.button.callback("🔙 ব্যাক", "adm_back_to_dashboard")]] )).catch(() => {});
    });

    bot.action('adm_ban_menu', (ctx) => {
        if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery().catch(() => {});
        ctx.answerCbQuery().catch(() => {});
        db.userSessions[ctx.chat.id] = { step: 'AWAITING_BAN_USER_INPUT' };
        saveDB();
        ctx.reply(`🚫 Ban / Unban System\n\n👉 অনুগ্রহ করে ইউজারের ID অথবা Username লিখে পাঠান:`, Markup.inlineKeyboard([[Markup.button.callback("❌ বাতিল করুন", "adm_back_to_dashboard")]]));
    });

    bot.action('adm_back_to_dashboard', (ctx) => {
        if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery().catch(() => {});
        ctx.answerCbQuery().catch(() => {});
        delete db.userSessions[ctx.chat.id];
        saveDB();
        showAdminDashboard(ctx, db, true);
    });

    bot.action(/^view_vi_(.+)$/, async (ctx) => {
        if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery().catch(() => {});
        const linkId = ctx.match[1];
        const data = db.linkDatabase[linkId];
        if (!data) return ctx.answerCbQuery("⚠️ লিঙ্কটি ডাটাবেজে পাওয়া যায়নি।", { show_alert: true }).catch(() => {});
        ctx.answerCbQuery().catch(() => {});
        
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
            const vendor = v.deviceVendor && v.deviceVendor !== "Unknown" ? v.deviceVendor : "";
            const model = v.deviceModel && v.deviceModel !== "Unknown" ? v.deviceModel : "";
            const deviceDetails = (vendor || model) ? `${vendor} ${model}`.trim() : "Unknown Device";

            const ansVal = v.answer ? v.answer : "উত্তর আসেনি!";
            const msgVal = v.message ? v.message : "মেসেজ আসেনি!";

            report += `${index + 1}. 🗓️ Time: ${v.time}\n` +
                      `💬 Answer: ${ansVal}\n` +
                      `✉️ Message: ${msgVal}\n` +
                      `🌐 IP: ${v.ip}\n` +
                      `🌍 Country: ${v.country} | City: ${v.city}\n` +
                      `📡 ISP: ${v.isp}\n` +
                      `🌐 Browser: ${v.browserName} (${v.browserVersion})\n` +
                      `💻 OS: ${v.osName} (${v.osVersion})\n` +
                      `📱 Device: ${deviceDetails} [${v.deviceType}]\n` +
                      `⚙️ Engine: ${v.engineName} (${v.engineVersion})\n` +
                      `🔲 CPU: ${v.cpuArchitecture}\n\n`;
        });
        if (report.length > 4000) {
            report = report.substring(0, 3900) + "\n...[Truncated]";
        }
        const sentMsg = await ctx.reply(report).catch(() => null);
        if (sentMsg) {
            setTimeout(async () => {
                try { await bot.telegram.deleteMessage(ctx.chat.id, sentMsg.message_id); } catch (e) {}
            }, 15000);
        }
    });

    bot.action(/^adm_off_link_(.+)$/, async (ctx) => {
        if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery().catch(() => {});
        const linkId = ctx.match[1];
        if (db.linkDatabase[linkId]) {
            delete db.linkDatabase[linkId];
            await saveDB();
            ctx.answerCbQuery("✅ লিঙ্কটি সফলভাবে বন্ধ করা হয়েছে।", { show_alert: true }).catch(() => {});
            ctx.editMessageText("❌ এই লিঙ্কটি অ্যাডমিন কর্তৃক বন্ধ করা হয়েছে।").catch(() => {});
        } else {
            ctx.answerCbQuery("⚠️ লিঙ্কটি ইতিমধ্যে মুছে ফেলা হয়েছে বা নেই।", { show_alert: true }).catch(() => {});
        }
    });

    bot.action(/^adm_ban_creator_(.+)$/, async (ctx) => {
        if (!isAdmin(ctx.chat.id)) return ctx.answerCbQuery().catch(() => {});
        const linkId = ctx.match[1];
        const data = db.linkDatabase[linkId];
        if (!data) return ctx.answerCbQuery("⚠️ লিঙ্কটি পাওয়া যায়নি।", { show_alert: true }).catch(() => {});
        
        const creatorId = Number(data.userId);
        if (!db.bannedUsers.includes(creatorId)) {
            db.bannedUsers.push(creatorId);
            await saveDB();
        }
        ctx.answerCbQuery(`🚫 ইউজার (${creatorId}) কে সফলভাবে ব্যান করা হয়েছে।`, { show_alert: true }).catch(() => {});
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

    if (session.step === 'AWAITING_ADMIN_LINK_FILTER') {
        delete db.userSessions[userId];
        saveDB();

        const query = text.toLowerCase();
        const categories = ['love', 'birthday', 'sorry', 'eid'];
        let matchedLinks = [];

        if (categories.includes(query)) {
            matchedLinks = Object.entries(db.linkDatabase || {}).filter(([_, data]) => data.type && data.type.toLowerCase() === query);
        } else {
            let targetUserId = parseInt(text, 10);
            if (isNaN(targetUserId)) {
                targetUserId = db.usernameMap[text.replace('@', '').trim().toLowerCase()];
            }

            matchedLinks = Object.entries(db.linkDatabase || {}).filter(([_, data]) => {
                if (!isNaN(targetUserId) && Number(data.userId) === Number(targetUserId)) return true;
                if (data.username && data.username.toLowerCase().replace('@', '') === text.replace('@', '').trim().toLowerCase()) return true;
                return false;
            });
        }

        if (matchedLinks.length === 0) {
            ctx.reply("❌ এই ফিল্টারের অধীনে কোনো লিংক পাওয়া যায়নি।", Markup.inlineKeyboard([[Markup.button.callback("🔙 ব্যাক", "adm_all_links_menu")]]));
            return true;
        }

        ctx.reply(`🔍 ফিল্টার রেজাল্ট (${matchedLinks.length} টি লিংক):`);
        matchedLinks.forEach(([key, data]) => {
            ctx.reply(`👤 Creator: ${data.name}\n📂 Category: ${data.type}\n🔗 Link ID: ${key}`, Markup.inlineKeyboard([[Markup.button.callback(`❌ Delete/Off: ${key}`, `adm_instant_del_${key}`)]]));
        });
        return true;
    }
    
    if (session.step === 'AWAITING_MSG_USER_TARGET') {
        let targetId = parseInt(text, 10);
        if (isNaN(targetId)) targetId = db.usernameMap[text.replace('@', '').trim().toLowerCase()];
        if (!targetId) {
            ctx.reply("❌ এই ইউজারনেম/আইডি ডাটাবেজে পাওয়া যায়নি।");
            return true;
        }
        session.targetUserId = targetId;
        session.targetInput = text;
        session.step = 'AWAITING_MSG_USER_TEXT';
        saveDB();
        ctx.reply(`ইউজার: ${text}\nযেই মেসেজ পাঠাতে চান সেই মেসেজটি লিখে দিন।`, Markup.inlineKeyboard([[Markup.button.callback("❌ বাতিল করুন", "adm_back_to_dashboard")]]));
        return true;
    }

    if (session.step === 'AWAITING_MSG_USER_TEXT') {
        const targetUserId = session.targetUserId;
        bot.telegram.sendMessage(targetUserId, text).then(() => {
            ctx.reply("✅ মেসেজটি সফলভাবে পাঠানো হয়েছে।");
        }).catch(() => {
            ctx.reply("❌ ইউজারের কাছে মেসেজ পাঠানো সম্ভব হয়নি।");
        });
        delete db.userSessions[userId];
        saveDB();
        showAdminDashboard(ctx, db, false);
        return true;
    }

    if (session.step === 'AWAITING_BAN_USER_INPUT') {
        let parsedId = parseInt(text, 10);
        if (isNaN(parsedId)) parsedId = db.usernameMap[text.replace('@', '').trim().toLowerCase()];
        if (!parsedId) {
            ctx.reply("❌ এই ইউজারনেম/আইডি ডাটাবেজে পাওয়া যায়নি।");
            return true;
        }
        if (db.bannedUsers.includes(parsedId)) {
            db.bannedUsers = db.bannedUsers.filter(id => id !== parsedId);
            ctx.reply(`🟢 ইউজার \`${parsedId}\` কে UNBAN করা হয়েছে।`, { parse_mode: 'Markdown' });
        } else {
            db.bannedUsers.push(parsedId);
            ctx.reply(`🚫 ইউজার \`${parsedId}\` কে BAN করা হয়েছে।`, { parse_mode: 'Markdown' });
        }
        delete db.userSessions[userId];
        saveDB();
        showAdminDashboard(ctx, db, false);
        return true;
    }
    
    return false;
};

module.exports = { setupAdmin, handleAdminText };
