const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const path = require('path');
const fs = require('fs');
const https = require('https');
const Datastore = require('nedb-promises');

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
const SERVER_URL = "https://love-bb7p.onrender.com"; // আপনার রেন্ডার ইউআরএল

const bot = new Telegraf(TELEGRAM_TOKEN);
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ডেটাবেস সেটআপ
const db = {};
db.users = Datastore.create({ filename: 'users.db', autoload: true });
db.links = Datastore.create({ filename: 'links.db', autoload: true });
db.settings = Datastore.create({ filename: 'settings.db', autoload: true });
db.sessions = Datastore.create({ filename: 'sessions.db', autoload: true });

async function isMaintenance() {
    const config = await db.settings.findOne({ key: 'config' });
    return config ? config.maintenance : false;
}

async function isBanned(userId) {
    const user = await db.users.findOne({ userId: String(userId) });
    return user ? user.banned : false;
}

async function getSession(userId) {
    return await db.sessions.findOne({ userId: String(userId) });
}

async function saveSession(userId, data) {
    await db.sessions.update({ userId: String(userId) }, { $set: data }, { upsert: true });
}

async function deleteSession(userId) {
    await db.sessions.remove({ userId: String(userId) }, {});
}

const mainKeyboard = (userId) => {
    return Markup.inlineKeyboard([
        [Markup.button.callback('🔗 লিংক তৈরি করুন', 'menu_generate')],
        [Markup.button.callback('📞 এডমিন যোগাযোগ', 'menu_contact'), Markup.button.callback('ℹ️ সাহায্য', 'menu_help')]
    ]);
};

// মিডলওয়্যার
bot.use(async (ctx, next) => {
    if (!ctx.from) return next();
    const userId = ctx.from.id;
    const maintenanceMode = await isMaintenance();
    const banned = await isBanned(userId);

    if (String(userId) === String(ADMIN_CHAT_ID)) {
        return next();
    }

    if (banned) return;

    if (maintenanceMode) {
        if (ctx.callbackQuery && ctx.callbackQuery.data === 'menu_contact_now') {
            return next();
        }
        const session = await getSession(userId);
        if (session && session.state === 'CONTACTING_ADMIN') {
            return next();
        }

        const msgText = "বট এর উন্নতির জন্য কাজ চলছে।";
        const kb = Markup.inlineKeyboard([[Markup.button.callback('Contact with Admin', 'menu_contact_now')]]);

        if (ctx.callbackQuery) {
            try { await ctx.answerCbQuery().catch(() => {}); } catch(e){}
            try { await ctx.editMessageText(msgText, kb); } catch (e) { await ctx.reply(msgText, kb); }
        } else {
            await ctx.reply(msgText, kb);
        }
        return;
    }

    return next();
});

// কমান্ড ও অ্যাকশনসমূহ
bot.start(async (ctx) => {
    const userId = String(ctx.from.id);
    const firstName = ctx.from.first_name || '';
    const username = ctx.from.username || '';

    let user = await db.users.findOne({ userId });
    if (!user) {
        await db.users.insert({
            userId,
            name: firstName,
            username,
            banned: false,
            joinedAt: Date.now()
        });
    }

    await deleteSession(userId);
    const welcomeMsg = `হ্যালো ${firstName}। বটের পক্ষ থেকে স্বাগতম। আপনার টপিক সিলেক্ট করুন।`;
    await ctx.reply(welcomeMsg, mainKeyboard(userId));
});

bot.command('adm', async (ctx) => {
    if (String(ctx.from.id) !== String(ADMIN_CHAT_ID)) return ctx.reply("ভুল কমান্ড!");
    await sendAdminDashboard(ctx);
});

async function sendAdminDashboard(ctx, edit = false) {
    const maintenanceMode = await isMaintenance();
    const txt = `অ্যাডমিন ড্যাশবোর্ড`;
    const kb = Markup.inlineKeyboard([
        [Markup.button.callback(`Maintenance: ${maintenanceMode ? 'ON' : 'OFF'}`, 'adm_toggle_m')],
        [Markup.button.callback('📢 Announcement', 'adm_announce')],
        [Markup.button.callback('🚫 Ban/Unban', 'adm_ban_unban_prompt')],
        [Markup.button.callback('👥 User List', 'adm_user_list'), Markup.button.callback('🚷 Ban List', 'adm_ban_list')]
    ]);

    if (edit) { await ctx.editMessageText(txt, kb); } else { await ctx.reply(txt, kb); }
}

bot.action('menu_main', async (ctx) => {
    try { await ctx.answerCbQuery().catch(() => {}); } catch(e){}
    const userId = ctx.from.id;
    await deleteSession(userId);
    const welcomeMsg = `হ্যালো ${ctx.from.first_name || ''}। বটের পক্ষ থেকে স্বাগতম। আপনার টপিক সিলেক্ট করুন।`;
    await ctx.editMessageText(welcomeMsg, mainKeyboard(userId));
});

bot.action('menu_help', async (ctx) => {
    try { await ctx.answerCbQuery().catch(() => {}); } catch(e){}
    const txt = "সাহায্যঃ\nএই বট দিয়ে আপনি সুন্দর ওয়েবসাইট লিংক তৈরি করতে পারেন। প্রথমে 'লিংক তৈরি করুন' বাটনে চাপ দিন, তারপর একে একে টপিক, কাউন্টডাউন সময়, অ্যানিমেশন টেক্সট এবং আপনার চিঠিটি ইনপুট দিন। শেষে আপনি একটি লিংক পাবেন যা প্রিয় মানুষকে পাঠাতে পারেন।";
    const kb = Markup.inlineKeyboard([[Markup.button.callback('🔙 ফিরে যান', 'menu_main')]]);
    await ctx.editMessageText(txt, kb);
});

bot.action('menu_contact_now', async (ctx) => {
    try { await ctx.answerCbQuery().catch(() => {}); } catch(e){}
    const userId = ctx.from.id;
    await saveSession(userId, { state: 'CONTACTING_ADMIN' });
    await ctx.editMessageText("এডমিন কে যা বলতে চান এখানে লিখে সেন্ট করুন আমি আপনার মতামত এডমিনের কাছে পৌঁছে দেবো।", Markup.inlineKeyboard([[Markup.button.callback('🔙 ফিরে যান', 'menu_main')]]));
});

bot.action('menu_contact', async (ctx) => {
    try { await ctx.answerCbQuery().catch(() => {}); } catch(e){}
    const userId = ctx.from.id;
    await saveSession(userId, { state: 'CONTACTING_ADMIN' });
    await ctx.editMessageText("এডমিন কে যা বলতে চান এখানে লিখে সেন্ট করুন আমি আপনার মতামত এডমিনের কাছে পৌঁছে দেবো।", Markup.inlineKeyboard([[Markup.button.callback('🔙 ফিরে যান', 'menu_main')]]));
});

bot.action('menu_generate', async (ctx) => { 
    try { await ctx.answerCbQuery().catch(() => {}); } catch(e){}
    await askTopic(ctx); 
});

async function askTopic(ctx) {
    const txt = "apni kun topic er jonno link banate chan seta select korun";
    const kb = Markup.inlineKeyboard([
        [Markup.button.callback('❤️ Crush', 'topic_crush'), Markup.button.callback('💕 Love', 'topic_love')],
        [Markup.button.callback('🎂 Birthday', 'topic_birthday'), Markup.button.callback('🥺 Sorry', 'topic_sorry')],
        [Markup.button.callback('🌙 Eid', 'topic_eid')],
        [Markup.button.callback('🔙 ফিরে যান', 'menu_main')]
    ]);
    await ctx.editMessageText(txt, kb);
}

const musicAndTitles = {
    crush: { src: "https://cdn.jsdelivr.net/gh/lovelatter/Love@main/love.mp3", title: "Crush" },
    love: { src: "https://cdn.jsdelivr.net/gh/lovelatter/Love@main/love.mp3", title: "Love" },
    birthday: { src: "https://cdn.jsdelivr.net/gh/lovelatter/Love@main/bd.mp3", title: "Birthday" },
    sorry: { src: "https://cdn.jsdelivr.net/gh/lovelatter/Love@main/sad.mp3", title: "Sorry" },
    eid: { src: "https://cdn.jsdelivr.net/gh/lovelatter/Love@main/eid.mp3", title: "Eid" }
};

bot.action(/^topic_(.+)$/, async (ctx) => {
    try { await ctx.answerCbQuery().catch(() => {}); } catch(e){}
    const topic = ctx.match[1];
    const userId = ctx.from.id;
    await saveSession(userId, {
        state: 'SELECTING_COUNTDOWN',
        topic: topic,
        music: musicAndTitles[topic].src,
        title: musicAndTitles[topic].title
    });

    const txt = "টাইম কাউন্টডাউন সিলেক্ট করুন। অথবা আপনি চাইলে মিনিট লিখে দিতে পারেন। মিনিট লিখলে শুধুমাত্র মিনিট সংখ্যাটাই লিখবেন। (লিমিট:1 মিনিট থেকে 100 মিনিট)";
    const kb = Markup.inlineKeyboard([
        [Markup.button.callback('3 Minute', 'cd_3'), Markup.button.callback('5 Minute', 'cd_5')],
        [Markup.button.callback('10 Minute', 'cd_10'), Markup.button.callback('20 Minute', 'cd_20')],
        [Markup.button.callback('🔙 ফিরে যান', 'menu_generate')]
    ]);
    await ctx.editMessageText(txt, kb);
});

bot.action(/^cd_(.+)$/, async (ctx) => {
    try { await ctx.answerCbQuery().catch(() => {}); } catch(e){}
    const minutes = parseInt(ctx.match[1], 10);
    const userId = ctx.from.id;
    let session = await getSession(userId);
    
    // সেশন না থাকলে একটি ডিফল্ট সেশন তৈরি করে নেওয়া হচ্ছে ক্র্যাশ এড়াতে
    if (!session) {
        session = {
            topic: 'crush',
            music: musicAndTitles['crush'].src,
            title: musicAndTitles['crush'].title
        };
    }

    await saveSession(userId, { 
        state: 'ASK_ANIMATION_TEXTS',
        countdown: minutes,
        topic: session.topic,
        music: session.music,
        title: session.title
    });
    await askAnimationTexts(ctx, true); 
});

async function askAnimationTexts(ctx, edit = false) {
    const userId = ctx.from.id;
    const session = await getSession(userId);
    await saveSession(userId, { state: 'ASK_ANIMATION_TEXTS' });
    const txt = "আপনার ইচ্ছামত কয়েকটি এনিমেশন টেক্সট দিন। এনিমেশন টেক্সট কমা (,) বা ইন্টার দিয়ে দিয়ে আলাদা এনিমেশন দিন। (যেমন হ্যালো, আমার প্রিয়, তোমাকে কিছু বলতে চাই)";
    const kb = Markup.inlineKeyboard([[Markup.button.callback('🔙 ফিরে যান', `topic_${session ? session.topic : 'crush'}`)]]);
    
    if (edit && ctx.callbackQuery) {
        await ctx.editMessageText(txt, kb);
    } else {
        await ctx.reply(txt, kb);
    }
}

async function askLetter(ctx, edit = false) {
    const userId = ctx.from.id;
    await saveSession(userId, { state: 'ASK_LETTER' });
    const txt = "এখন মূল চিঠিটি (Letter) লিখুন যা এনিমেশন শেষ হওয়ার পর দেখা যাবে।";
    const kb = Markup.inlineKeyboard([[Markup.button.callback('🔙 ফিরে যান', 'back_to_animation_prompt')]]);
    
    if (edit && ctx.callbackQuery) {
        await ctx.editMessageText(txt, kb);
    } else {
        await ctx.reply(txt, kb);
    }
}

bot.action('back_to_animation_prompt', async (ctx) => { 
    try { await ctx.answerCbQuery().catch(() => {}); } catch(e){}
    await askAnimationTexts(ctx, true); 
});

bot.on('text', async (ctx) => {
    const userId = ctx.from.id;
    const text = ctx.message.text.trim();
    const session = await getSession(userId);

    if (!session) return;

    if (session.state === 'CONTACTING_ADMIN') {
        const adminMsg = `একজন ইউজার আপনাকে মেসেজ পাঠিয়েছেন।\nName: ${ctx.from.first_name || ''}\nUsername: ${ctx.from.username ? '@' + ctx.from.username : 'নেই'}\nUser ID: ${userId}\n\nমেসেজ:\n${text}`;
        await ctx.telegram.sendMessage(ADMIN_CHAT_ID, adminMsg, Markup.inlineKeyboard([
            [Markup.button.callback('Ban', `adm_ban_${userId}`), Markup.button.callback('Contact', `adm_contact_${userId}`)]
        ]));
        await deleteSession(userId);
        await ctx.reply("আপনার মেসেজটি সফলভাবে এডমিনের কাছে পাঠানো হয়েছে।", mainKeyboard(userId));
        return;
    }

    if (session.state === 'ADMIN_REPLY_INBOX') {
        const targetUser = session.targetUser;
        try {
            await ctx.telegram.sendMessage(targetUser, `এডমিনের পক্ষ থেকে মেসেজ:\n\n${text}`);
            await ctx.reply("মেসেজটি ইউজারের ইনবক্সে পাঠানো হয়েছে।");
        } catch (e) {
            await ctx.reply("ইউজারকে মেসেজ পাঠানো যায়নি।");
        }
        await deleteSession(userId);
        return;
    }

    if (session.state === 'SELECTING_COUNTDOWN') {
        const minutes = parseInt(text, 10);
        if (isNaN(minutes) || minutes < 1 || minutes > 100) {
            await ctx.reply("ভুল ইনপুট! দয়া করে শুধুমাত্র ১ থেকে ১০০ এর মধ্যে সংখ্যা লিখে পাঠান।");
            return;
        }
        await saveSession(userId, { countdown: minutes });
        await askAnimationTexts(ctx, false); 
        return;
    }

    if (session.state === 'ASK_ANIMATION_TEXTS') {
        let list = text.includes('\n') ? text.split('\n') : text.split(',');
        list = list.map(x => x.trim()).filter(x => x.length > 0);

        if (list.length === 0) {
            await ctx.reply("দয়া করে অন্তত একটি এনিমেশন টেক্সট দিন।");
            return;
        }

        await saveSession(userId, { animations: list });
        await askLetter(ctx, false); 
        return;
    }

    if (session.state === 'ASK_LETTER') {
        const updatedSession = await getSession(userId);
        const linkId = Math.random().toString(36).substring(2, 10);

        const newLink = {
            linkId,
            userId: String(userId),
            topic: updatedSession.topic || 'crush',
            music: updatedSession.music || musicAndTitles['crush'].src,
            title: updatedSession.title || musicAndTitles['crush'].title,
            countdown: updatedSession.countdown || 3,
            animations: updatedSession.animations || [],
            letter: text,
            createdAt: Date.now()
        };

        await db.links.insert(newLink);

        const fullUrl = `${SERVER_URL}/letter/${linkId}`;
        await ctx.reply(`নিচে আপনার তৈরি করা লিংক দেয়া হলো। আপনি যাকে পাঠাতে চান নিচের লিংক কপি করে পাঠিয়ে দিন。\n\n${fullUrl}`, mainKeyboard(userId));

        const adminAlert = `নতুন লিংক তৈরি করা হয়েছে।\nName: ${ctx.from.first_name || ''}\nUser ID: ${userId}`;
        await ctx.telegram.sendMessage(ADMIN_CHAT_ID, adminAlert, Markup.inlineKeyboard([[Markup.button.callback('Ban User', `adm_ban_${userId}`)]]));
        await deleteSession(userId);
        return;
    }

    if (session.state === 'ADMIN_ASK_ANNOUNCEMENT') {
        const allUsers = await db.users.find({});
        let count = 0;
        for (const u of allUsers) {
            try { await ctx.telegram.sendMessage(u.userId, text); count++; } catch (e) {}
        }
        await ctx.reply(`অ্যানাউন্সমেন্ট সফলভাবে ${count} জন ইউজারের কাছে পাঠানো হয়েছে।`);
        await deleteSession(userId);
        await sendAdminDashboard(ctx);
        return;
    }

    if (session.state === 'ADMIN_ASK_BAN_UNBAN') {
        const targetId = text;
        const user = await db.users.findOne({ userId: targetId });
        if (!user) {
            await ctx.reply("ইউজার আইডিটি ডেটাবেসে খুঁজে পাওয়া যায়নি।");
            await deleteSession(userId);
            await sendAdminDashboard(ctx);
            return;
        }
        const newBanStatus = !user.banned;
        await db.users.update({ userId: targetId }, { $set: { banned: newBanStatus } });
        await ctx.reply(`${targetId} কে ${newBanStatus ? 'ব্যান করা হলো' : 'আনব্যান করা হলো'}`);
        await deleteSession(userId);
        await sendAdminDashboard(ctx);
    }
});

bot.action('adm_toggle_m', async (ctx) => {
    try { await ctx.answerCbQuery().catch(() => {}); } catch(e){}
    let config = await db.settings.findOne({ key: 'config' });
    if (!config) { config = { key: 'config', maintenance: false }; await db.settings.insert(config); }
    const newStatus = !config.maintenance;
    await db.settings.update({ key: 'config' }, { $set: { maintenance: newStatus } });
    await sendAdminDashboard(ctx, true);
});

bot.action('adm_announce', async (ctx) => {
    try { await ctx.answerCbQuery().catch(() => {}); } catch(e){}
    await saveSession(ctx.from.id, { state: 'ADMIN_ASK_ANNOUNCEMENT' });
    await ctx.editMessageText("অ্যানাউন্সমেন্ট মেসেজটি লিখুন:");
});

bot.action('adm_ban_unban_prompt', async (ctx) => {
    try { await ctx.answerCbQuery().catch(() => {}); } catch(e){}
    await saveSession(ctx.from.id, { state: 'ADMIN_ASK_BAN_UNBAN' });
    await ctx.editMessageText("ব্যান বা আনব্যান করার জন্য ইউজার আইডিটি লিখুন:");
});

bot.action(/^adm_ban_(.+)$/, async (ctx) => {
    try { await ctx.answerCbQuery().catch(() => {}); } catch(e){}
    await db.users.update({ userId: ctx.match[1] }, { $set: { banned: true } });
    await ctx.reply(`${ctx.match[1]} কে ব্যান করা হলো`);
});

bot.action(/^adm_contact_(.+)$/, async (ctx) => {
    try { await ctx.answerCbQuery().catch(() => {}); } catch(e){}
    await saveSession(ctx.from.id, { state: 'ADMIN_REPLY_INBOX', targetUser: ctx.match[1] });
    await ctx.reply(`ইউজার ${ctx.match[1]} এর কাছে রিপ্লাই পাঠানোর জন্য টেক্সট লিখুন:`);
});

bot.action('adm_user_list', async (ctx) => {
    try { await ctx.answerCbQuery().catch(() => {}); } catch(e){}
    const allUsers = await db.users.find({});
    let txt = `মোট ইউজার সংখ্যা: ${allUsers.length}\n\n`;
    const kbRows = [];
    allUsers.slice(0, 10).forEach(u => {
        txt += `• ${u.name} (ID: ${u.userId})\n`;
        kbRows.push([Markup.button.callback(`🚫 Ban ${u.name}`, `adm_ban_${u.userId}`)]);
    });
    kbRows.push([Markup.button.callback('🔙 ফিরে যান', 'adm_back')]);
    await ctx.editMessageText(txt, Markup.inlineKeyboard(kbRows));
});

bot.action('adm_ban_list', async (ctx) => {
    try { await ctx.answerCbQuery().catch(() => {}); } catch(e){}
    const bannedUsers = await db.users.find({ banned: true });
    let txt = `মোট ব্যান সংখ্যা: ${bannedUsers.length}\n\n`;
    const kbRows = [];
    bannedUsers.slice(0, 10).forEach(u => {
        txt += `• ${u.name} (ID: ${u.userId})\n`;
        kbRows.push([Markup.button.callback(`✅ Unban ${u.name}`, `adm_unban_${u.userId}`)]);
    });
    kbRows.push([Markup.button.callback('🔙 ফিরে যান', 'adm_back')]);
    await ctx.editMessageText(txt, Markup.inlineKeyboard(kbRows));
});

bot.action(/^adm_unban_(.+)$/, async (ctx) => {
    try { await ctx.answerCbQuery().catch(() => {}); } catch(e){}
    await db.users.update({ userId: ctx.match[1] }, { $set: { banned: false } });
    await ctx.reply(`${ctx.match[1]} কে আনব্যান করা হলো`);
});

bot.action('adm_back', async (ctx) => { 
    try { await ctx.answerCbQuery().catch(() => {}); } catch(e){}
    await sendAdminDashboard(ctx, true); 
});

// Webhook endpoint (টেলিগ্রাম সরাসরি এখানে মেসেজ পুশ করবে)
app.use(bot.webhookCallback('/telegram-webhook'));

app.post('/api/opened/:linkId', async (req, res) => {
    const link = await db.links.findOne({ linkId: req.params.linkId });
    if (link) { try { await bot.telegram.sendMessage(link.userId, "কেউ একজন আপনার লিংক ওপেন করেছেন।"); } catch (e) {} }
    res.sendStatus(200);
});

app.post('/api/respond/:linkId', async (req, res) => {
    const link = await db.links.findOne({ linkId: req.params.linkId });
    if (link) {
        try {
            await bot.telegram.sendMessage(link.userId, `যাকে লিংক পাঠিয়েছেন তার উত্তর: ${req.body.response}`);
            const user = await db.users.findOne({ userId: link.userId });
            await bot.telegram.sendMessage(ADMIN_CHAT_ID, `একজন ইউজারের রিপ্লাই এসেছে।\nName: ${user ? user.name : 'অজানা'}\nReply: ${req.body.response}`);
        } catch (e) {}
    }
    res.sendStatus(200);
});

app.get('/letter/:linkId', async (req, res) => {
    const link = await db.links.findOne({ linkId: req.params.linkId });
    if (!link) return res.status(404).send("<div style='text-align:center; padding:20px;'><h1>⚠️ Link Expired!</h1></div>");

    const htmlPath = path.join(__dirname, 'public', 'template.html');
    let html = fs.readFileSync(htmlPath, 'utf8');
    const lockTime = link.createdAt + (link.countdown * 60 * 1000);
    const isLocked = lockTime > Date.now() ? "true" : "false";

    html = html.replace('{{TITLE}}', link.title).replace('{{MUSIC_SRC}}', link.music).replace('{{LETTER_TITLE}}', 'আমার হৃদয়ের কথা...').replace('{{LETTER_CONTENT}}', link.letter).replace('{{{ANIMATION_TEXTS}}}', JSON.stringify(link.animations)).replace('{{IS_LOCKED}}', isLocked).replace('{{LOCK_TIME}}', lockTime).replace('{{LINK_ID}}', req.params.linkId);
    res.send(html);
});

app.get('/ping', (req, res) => res.send('pong'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    console.log(`Server listening on port ${PORT}`);
    try {
        await bot.telegram.setWebhook(`${SERVER_URL}/telegram-webhook`);
        console.log('Webhook successfully registered!');
    } catch (e) {
        console.error('Error setting webhook:', e);
    }
    
    // Self-pinging mechanism
    setInterval(() => {
        https.get(`${SERVER_URL}/ping`, () => console.log('Keep-alive ping sent')).on('error', () => {});
    }, 4 * 60 * 1000); 
});
