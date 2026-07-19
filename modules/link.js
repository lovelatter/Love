const { Markup } = require('telegraf');
const { db, saveDB } = require('./utils');
const { SERVER_URL, AUTOMATIC_MUSIC_MAPPING, ADMIN_IDS } = require('./config');

const processFinalLinkCreation = (ctx, letterText, bot) => {
    const userId = ctx.chat.id;
    const session = db.userSessions[userId];
    db.totalLinksCreated = (db.totalLinksCreated || 0) + 1;
    let finalCountdownIso = null;
    if (session.pendingMinutes) {
        const targetDate = new Date();
        targetDate.setMinutes(targetDate.getMinutes() + session.pendingMinutes);
        finalCountdownIso = targetDate.toISOString();
    }
    const uniqueId = Math.random().toString(36).substring(2, 9);
    const finalGeneratedUrl = `${SERVER_URL}/love/${uniqueId}`;
    const dbImageUrl = session.imageUrl ? `${SERVER_URL}${session.imageUrl}` : null;
    
    db.linkDatabase[uniqueId] = {
        userId, name: session.name || "User", username: session.username || "None", type: session.type || "love",
        music: session.music || "", countdown: finalCountdownIso, animations: session.animations, letter: letterText, 
        answer: null, image: dbImageUrl, imagePath: session.imageUrl || null, visitors: []
    };
    
    ctx.reply(`আপনার লিংক তৈরি করা হয়েছে।\n\nলিংক: \`${finalGeneratedUrl}\``, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[Markup.button.callback("❌ Link Off", `delete_link_${uniqueId}`)]])
    }).catch(() => {});
    
    delete db.userSessions[userId];
    saveDB();
};

module.exports = { processFinalLinkCreation };
