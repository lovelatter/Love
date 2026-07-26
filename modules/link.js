const { Markup } = require('telegraf');

async function processFinalLinkCreation(ctx, letterText, db, saveDB, bot, ADMIN_IDS, SERVER_URL) {
    const userId = ctx.chat.id;
    const session = db.userSessions[userId];
    db.totalLinksCreated = (db.totalLinksCreated || 0) + 1;
    let finalCountdownIso = null;
    let countdownDisplay = "No ❌";
    
    if (session.pendingMinutes) {
        const targetDate = new Date();
        targetDate.setMinutes(targetDate.getMinutes() + session.pendingMinutes);
        finalCountdownIso = targetDate.toISOString();
        countdownDisplay = `${session.pendingMinutes} Minutes ✅`;
    }
    
    const uniqueId = Math.random().toString(36).substring(2, 9);
    const finalGeneratedUrl = `${SERVER_URL}/love/${uniqueId}`;
    
    const dbImageUrl = session.imageUrl || null;
    let finalMusicUrl = session.music || "";

    db.linkDatabase[uniqueId] = {
        userId, 
        name: session.name || "User", 
        username: session.username || "None", 
        type: session.type || "love",
        music: finalMusicUrl, 
        countdown: finalCountdownIso, 
        animations: session.animations, 
        letter: letterText, 
        answer: null,
        message: null, 
        image: dbImageUrl, 
        imagePath: null, 
        visitors: []
    };

    delete db.userSessions[userId];
    await saveDB();

    ctx.reply(`🔗 লিংক তৈরি করা হয়েছে।\n* লিংক থেকে কোন রিপ্লাই বা মেসেজ আসলে আপনাকে জানানো হবে।\n\nলিংক: \`${finalGeneratedUrl}\``, {
    parse_mode: 'Markdown'
    }).catch(() => {});


    let adminNotificationText = `🆕 নতুন লিংক তৈরি করা হয়েছে।
👤 Name: ${session.name || "User"}
🆔 ID: ${userId}
🏷️ Username: ${session.username || "None"}
📂 Category: ${String(session.type || "love").toUpperCase()}
⏳ Countdown: ${countdownDisplay}
📸 IMG Included: ${dbImageUrl ? "Yes ✅" : "No ❌"}`;
    
    if (dbImageUrl) {
        adminNotificationText += `\n🖼️ IMG Link: ${dbImageUrl}`;
    }
    adminNotificationText += `\n🎵 Music Included: ${finalMusicUrl ? "Yes ✅" : "No ❌"}`;
    if (finalMusicUrl) {
        adminNotificationText += `\n🎶 Music Link: ${finalMusicUrl}`;
    }
    adminNotificationText += `\n✨ Animation txt: ${(session.animations || []).join(", ")}
💌 Letter: ${letterText}
🔗 Main Link: ${finalGeneratedUrl}`;

    ADMIN_IDS.forEach(id => bot.telegram.sendMessage(id, adminNotificationText, Markup.inlineKeyboard([
        [Markup.button.callback("👁️‍🗨️ Answer & Msg", `view_ans_msg_${uniqueId}`), Markup.button.callback("👁️‍🗨️ Visitor Info", `view_vi_${uniqueId}`)],
        [Markup.button.callback("❌ Link off", `adm_off_link_${uniqueId}`), Markup.button.callback("🚫 Ban user", `adm_ban_creator_${uniqueId}`)]
    ])).catch(() => {}));
}

module.exports = { processFinalLinkCreation };
