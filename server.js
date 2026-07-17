const express = require('express');
const path = require('path');
const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');
const https = require('https');

const app = express();
app.use(express.json());

// আপলোড করা ছবিগুলো স্ট্যাটিক্যালি সার্ভ করার জন্য এক্সপ্রেস কনফিগারেশন
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
const SERVER_URL = "https://love-bb7p.onrender.com";
const DB_FILE = path.join(__dirname, 'db.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// আপলোড ফোল্ডার না থাকলে তৈরি করে নেবে
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const GITHUB_MUSIC_BASE_URL = "https://raw.githubusercontent.com/lovelatter/Love/main";

const AUTOMATIC_MUSIC_MAPPING = {
    love: `${GITHUB_MUSIC_BASE_URL}/love.mp3`,
    birthday: `${GITHUB_MUSIC_BASE_URL}/bd.mp3`,
    sorry: `${GITHUB_MUSIC_BASE_URL}/sorry.mp3`,
    eid: `${GITHUB_MUSIC_BASE_URL}/eid.mp3`
};

const CATEGORY_CONFIGS = {
    love: { title: "আমার মনের কিছু কথা", emojis: ["❤️", "💖", "💕"], question: "Do you love me? 🥺", buttons: ["Yes", "No"] },
    birthday: { title: "Happy Birthday", emojis: ["🎈", "🎉", "🎊"], question: "Are you happy? 😊", buttons: ["Yes", "No"] },
    sorry: { title: "I'm Sorry", emojis: ["😭", "😞", "😥"], question: "Do you forgive me? 🥺", buttons: ["Yes", "No"] },
    eid: { title: "Eid Mubarak", emojis: ["🤝", "🎇", "🫂"], question: "EID Mubarak 🌙", buttons: ["EID Mubarak"] }
};

let db = {
    linkDatabase: {},
    userSessions: {},
    totalLinksCreated: 0,
    isMaintenanceMode: false,
    bannedUsers: [],
    registeredUsers: [],
    usernameMap: {}
};

// ডাটাবেজ লোড ও ফাইল সেটাপ
try {
    if (fs.existsSync(DB_FILE)) {
        db = { ...db, ...JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) };
    } else {
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    }
} catch (e) {
    console.error("Database initialization failed. Resetting...", e);
}

const saveDB = () => {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    } catch (e) {
        console.error("Database save error:", e);
    }
};

const bot = new Telegraf(TELEGRAM_TOKEN);

const locale = {
    welcome: (name) => `হ্যালো ${name}। বটের পক্ষ থেকে স্বাগতম।`,
    btn_make: "🚀 লিঙ্ক তৈরি করুন", btn_feedback: "📝 মতামত", btn_help: "❓ সাহায্য", btn_back: "🔙 মেইন মেনু",
    choose_cat: "✨ আপনি কোন ক্যাটাগরির লিঙ্ক করতে চান?",
    cat_love: "❤️ প্রেমের চিঠি (Love)", cat_birthday: "🎂 জন্মদিনের শুভেচ্ছা (Birthday)", cat_sorry: "🥺 দুঃখ প্রকাশ (Sorry)", cat_eid: "🌙 ঈদ মোবারক (Eid)",
    prompt_countdown_ask: "⏰ টাইম কাউন্টডাউন সেট করুন।\n\n👉 নিচের বাটনগুলো চেপে যেকোনো একটি সময় বেছে নিন।",
    btn_no_countdown: "❌ No Countdown",
    prompt_image_ask: "📸 আপনি কি কোনো ছবি যুক্ত করতে চান?\n\nতাহলে ছবিটি এখানে পাঠান অথবা নিচে Skip বাটন চাপুন।",
    btn_skip_image: "⏭️ Skip করুন",
    help_text: `❓ বট ব্যবহারের সঠিক নিয়ম (Help Guide):\n\n1️⃣ প্রথমে 🚀 লিঙ্ক তৈরি করুন বাটনে ক্লিক করুন。\n2️⃣ আপনার পছন্দের ক্যাটাগরি (Love, Birthday, etc.) সিলেক্ট করুন।\n3️⃣ লিঙ্কটি কতক্ষণ পর আনলক হবে তার জন্য একটি টাইম কাউন্টডাউন সিলেক্ট করুন।\n4️⃣ বটের ইচ্ছে অনুযায়ী একটি ছবি আপলোড করুন অথবা Skip করুন।\n5️⃣ বটের নির্দেশনা অনুযায়ী 😊 অ্যানিমেশন টেক্সট এবং খামের ভেতরের মূল চিঠিটি লিখে পাঠান।\n6️⃣ সবশেষে বট আপনাকে একটি ইউনিক লিঙ্ক জেনারেট করে দেবে যা আপনি শেয়ার করতে পারবেন!`,
    feedback_prompt: "📝 মতামত ও রিপোর্ট:\n\nঅ্যাডমিনের কাছে কোনো রিপোর্ট, নতুন আপডেটের আইডিয়া বা অন্য কোনো কিছু বলার থাকলে আপনার মেসেজটি নিচে লিখে পাঠিয়ে দিন:",
    feedback_short: "❌ মেসেজটি একটু বিস্তারিত লিখুন (কমপক্ষে ৫টি অক্ষর)।",
    feedback_success: "✅ আপনার মেসেজটি অ্যাডমিনের কাছে সফলভাবে পাঠানো হয়েছে। ধন্যবাদ!",
    invalid_cmd: (cmd) => `❌ ভুল ইনপুট বা আদেশ: \`${cmd}\` নম্বর বা কমান্ডটি গ্রহণযোগ্য নয়। নিচে সঠিক সাহায্য গাইডটি দেওয়া হলো:`,
    maint_msg: "🚧 বটের কাজ চলছে (Under Maintenance)! খুব শীঘ্রই আমরা ফিরে আসছি।",
    session_started: () => `✨ অ্যানিমেশন মেসেজ লিখুন।\n\n💡 লেখার নিয়ম:\n• প্রতি লাইনের পর কীবোর্ডের Enter চেপে নতুন লাইনে লিখুন অথবা প্রতিটি লাইনের মাঝে কমা ( , ) ব্যবহার করুন। যেমন: হ্যালো, প্রিয়, কেমন আছো।`,
    input_anim_success: (count) => `✅ চমৎকার! আপনি ${count} লাইনের অ্যানিমেশন যোগ করেছেন。\n\n💌 এবার খামের ভেতরের মূল চিঠি বা উইশ মেসেজটি লিখে পাঠান।`,
    general_error: "⚠️ দুঃখিত, একটি অভ্যন্তরীণ ত্রুটি ঘটেছে। অনুগ্রহ করে আবার চেষ্টা করুন।"
};

// মিডলওয়্যার ফিল্টার
bot.use(async (ctx, next) => {
    const userId = ctx.chat?.id;
    if (!userId) return;

    if (!db.registeredUsers.includes(userId)) db.registeredUsers.push(userId);
    if (ctx.from?.username) db.usernameMap[ctx.from.username.toLowerCase()] = userId;
    saveDB();

    if (Number(userId) === Number(ADMIN_CHAT_ID)) return next();
    if (db.bannedUsers.includes(userId)) return;
    if (db.isMaintenanceMode) return ctx.reply(locale.maint_msg).catch(() => {});

    return next();
});

// মেইন মেনু জেনারেটর
const sendMainMenu = (ctx, isEdit = false) => {
    const fullName = `${ctx.from?.first_name || ""} ${ctx.from?.last_name || ""}`.trim() || "ব্যবহারকারী";
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback(locale.btn_make, 'menu_makelink')],
        [Markup.button.callback(locale.btn_feedback, 'menu_feedback'), Markup.button.callback(locale.btn_help, 'menu_help')]
    ]);
    
    if (isEdit) return ctx.editMessageText(locale.welcome(fullName), { reply_markup: keyboard.reply_markup, parse_mode: 'Markdown' }).catch(() => {});
    return ctx.reply(locale.welcome(fullName), { reply_markup: keyboard.reply_markup, parse_mode: 'Markdown' }).catch(() => {});
};

bot.command('start', (ctx) => { 
    delete db.userSessions[ctx.chat.id];
    saveDB();
    sendMainMenu(ctx, false); 
});

// লিঙ্ক মেকিং লজিক শুরু
bot.action('menu_makelink', (ctx) => {
    ctx.answerCbQuery();
    ctx.editMessageText(locale.choose_cat, Markup.inlineKeyboard([
        [Markup.button.callback(locale.cat_love, 'make_love')],
        [Markup.button.callback(locale.cat_birthday, 'make_birthday')],
        [Markup.button.callback(locale.cat_sorry, 'make_sorry')],
        [Markup.button.callback(locale.cat_eid, 'make_eid')],
        [Markup.button.callback(locale.btn_back, 'go_to_main_menu')]
    ]));
});

bot.action(/^make_/, (ctx) => {
    ctx.answerCbQuery();
    const cat = ctx.match.input.replace('make_', '');
    db.userSessions[ctx.chat.id] = { 
        type: cat, 
        name: `${ctx.from.first_name || ""} ${ctx.from.last_name || ""}`.trim() || "User",
        username: ctx.from.username ? `@${ctx.from.username}` : "None",
        music: AUTOMATIC_MUSIC_MAPPING[cat] || "",
        imageUrl: null,
        step: 'AWAITING_COUNTDOWN_SELECTION'
    };
    saveDB();
    showCountdownPrompt(ctx);
});

function showCountdownPrompt(ctx, isEdit = true) {
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback(locale.btn_no_countdown, 'timer_no')],
        [Markup.button.callback('🕒 ৩ মিনিট', 'set_time_3'), Markup.button.callback('🕒 ৫ মিনিট', 'set_time_5')],
        [Markup.button.callback('🕒 ১০ মিনিট', 'set_time_10')],
        [Markup.button.callback("🔙 পেছনে যান", 'menu_makelink')]
    ]);
    if (isEdit) {
        ctx.editMessageText(locale.prompt_countdown_ask, { reply_markup: keyboard.reply_markup, parse_mode: 'Markdown' }).catch(() => {});
    } else {
        ctx.reply(locale.prompt_countdown_ask, { reply_markup: keyboard.reply_markup, parse_mode: 'Markdown' }).catch(() => {});
    }
}

bot.action('timer_no', (ctx) => { 
    ctx.answerCbQuery(); 
    if (!db.userSessions[ctx.chat.id]) return sendMainMenu(ctx, true);
    db.userSessions[ctx.chat.id].pendingMinutes = null; 
    saveDB();
    showImageUploadPrompt(ctx); 
});

bot.action(/^set_time_/, (ctx) => {
    ctx.answerCbQuery();
    const userId = ctx.chat.id;
    if (!db.userSessions[userId]) return sendMainMenu(ctx, true);
    db.userSessions[userId].pendingMinutes = parseInt(ctx.match.input.replace('set_time_', ''), 10);
    saveDB();
    showImageUploadPrompt(ctx);
});

// ছবি আপলোড করার প্রম্পট
function showImageUploadPrompt(ctx, isEdit = true) {
    const userId = ctx.chat.id;
    if (!db.userSessions[userId]) return sendMainMenu(ctx, true);
    db.userSessions[userId].step = 'AWAITING_IMAGE_UPLOAD';
    saveDB();
    
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback(locale.btn_skip_image, 'skip_image_upload')],
        [Markup.button.callback("🔙 পেছনে যান", 'back_to_countdown')]
    ]);

    if (isEdit) {
        ctx.editMessageText(locale.prompt_image_ask, { reply_markup: keyboard.reply_markup }).catch(() => {
            ctx.reply(locale.prompt_image_ask, keyboard).catch(() => {});
        });
    } else {
        ctx.reply(locale.prompt_image_ask, keyboard).catch(() => {});
    }
}

// ব্যাক বাটনের জন্য অ্যাকশন হ্যান্ডলার
bot.action('back_to_countdown', (ctx) => {
    ctx.answerCbQuery();
    const userId = ctx.chat.id;
    if (!db.userSessions[userId]) return sendMainMenu(ctx, true);
    db.userSessions[userId].step = 'AWAITING_COUNTDOWN_SELECTION';
    saveDB();
    showCountdownPrompt(ctx, true);
});

bot.action('skip_image_upload', (ctx) => {
    ctx.answerCbQuery();
    const userId = ctx.chat.id;
    if (!db.userSessions[userId]) return sendMainMenu(ctx, true);
    db.userSessions[userId].imageUrl = null;
    showAnimationIntro(ctx);
});

function showAnimationIntro(ctx, isEdit = true) {
    const userId = ctx.chat.id;
    if (!db.userSessions[userId]) return sendMainMenu(ctx, true);
    db.userSessions[userId].step = 'AWAITING_ANIMATION_TEXT';
    saveDB();
    
    const text = locale.session_started();
    const keyboard = Markup.inlineKeyboard([[Markup.button.callback("🔙 পেছনে যান", 'back_to_image_upload')]]);
    
    if (isEdit) {
        ctx.editMessageText(text, { reply_markup: keyboard.reply_markup, parse_mode: 'Markdown' }).catch(() => {
            ctx.reply(text, { reply_markup: keyboard.reply_markup, parse_mode: 'Markdown' }).catch(() => {});
        });
    } else {
        ctx.reply(text, { reply_markup: keyboard.reply_markup, parse_mode: 'Markdown' }).catch(() => {});
    }
}

bot.action('back_to_image_upload', (ctx) => {
    ctx.answerCbQuery();
    showImageUploadPrompt(ctx, true);
});

bot.action('menu_feedback', (ctx) => { ctx.answerCbQuery(); db.userSessions[ctx.chat.id] = { step: 'AWAITING_USER_FEEDBACK' }; saveDB(); ctx.reply(locale.feedback_prompt); });
bot.action('menu_help', (ctx) => { ctx.answerCbQuery(); ctx.reply(locale.help_text, Markup.inlineKeyboard([[Markup.button.callback(locale.btn_back, 'go_to_main_menu')]]), { parse_mode: 'Markdown' }); });

bot.action(/^delete_link_(.+)$/, (ctx) => {
    const linkId = ctx.match[1];
    const data = db.linkDatabase[linkId];
    if (!data) return ctx.answerCbQuery("⚠️ এই লিঙ্কটি ইতিমধ্যে রিমুভ করা হয়েছে!", { show_alert: true });
    if (Number(data.userId) !== Number(ctx.chat.id)) return ctx.answerCbQuery("❌ পারমিশন নেই।", { show_alert: true });
    
    ctx.answerCbQuery("✅ লিঙ্কটি সফলভাবে ডিলিট করা হয়েছে।", { show_alert: true });
    if (data.imagePath) {
        const fullImgPath = path.join(__dirname, data.imagePath);
        if (fs.existsSync(fullImgPath)) fs.unlinkSync(fullImgPath);
    }
    delete db.linkDatabase[linkId];
    saveDB();
    ctx.editMessageText("❌ আপনার এই লিঙ্কটি চিরতরে বন্ধ এবং রিমুভ করে দেওয়া হয়েছে।");
    sendMainMenu(ctx, false);
});

bot.action('go_to_main_menu', (ctx) => { ctx.answerCbQuery(); sendMainMenu(ctx, true); });

// ফটো/ছবি হ্যান্ডলার মিডলওয়্যার
bot.on('photo', async (ctx) => {
    const userId = ctx.chat.id;
    const session = db.userSessions[userId];

    if (session?.step === 'AWAITING_IMAGE_UPLOAD') {
        try {
            const photoArray = ctx.message.photo;
            const fileId = photoArray[photoArray.length - 1].file_id;
            
            const fileUrlObj = await bot.telegram.getFileLink(fileId);
            const fileUrl = fileUrlObj.href;

            const filename = `img_${Date.now()}_${Math.random().toString(36).substring(2, 5)}.jpg`;
            const localPath = path.join(UPLOADS_DIR, filename);

            const fileStream = fs.createWriteStream(localPath);
            https.get(fileUrl, (response) => {
                response.pipe(fileStream);
                fileStream.on('finish', () => {
                    fileStream.close();
                    if(db.userSessions[userId]) {
                        db.userSessions[userId].imageUrl = `/uploads/${filename}`;
                        saveDB();
                        ctx.reply("📸 ছবি সফলভাবে আপলোড এবং সেভ করা হয়েছে।");
                        showAnimationIntro(ctx, false);
                    }
                });
            }).on('error', (err) => {
                console.error("Image download error:", err);
                ctx.reply("⚠️ ছবি আপলোড করতে সমস্যা হয়েছে, আবার চেষ্টা করুন বা Skip করুন।");
            });

        } catch (error) {
            console.error("Photo process error:", error);
            ctx.reply("⚠️ ইমেজ প্রসেস করতে ব্যর্থ হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।");
        }
    } else if (session) {
        // যদি অন্য কোনো ধাপে ছবি পাঠানো হয় যা প্রত্যাশিত নয়
        ctx.reply("⚠️ এই ধাপে কোনো ছবি প্রয়োজন নেই। অনুগ্রহ করে বটের নির্দেশনাগুলো অনুসরণ করুন।");
    }
});

// টেক্সট মেসেজ রিসিভার এবং বুদ্ধিমান ইনপুট ভ্যালিডেশন
bot.on('text', async (ctx) => {
    const userId = ctx.chat.id;
    const session = db.userSessions[userId];
    const text = ctx.message.text.trim();

    if (!session?.step) {
        ctx.reply(locale.invalid_cmd(text), { parse_mode: 'Markdown' }).catch(() => {});
        return ctx.reply(locale.help_text, Markup.inlineKeyboard([[Markup.button.callback(locale.btn_back, 'go_to_main_menu')]]), { parse_mode: 'Markdown' }).catch(() => {});
    }

    // ১. টাইম কাউন্টডাউন ধাপে ভুল ইনপুট হ্যান্ডলিং
    if (session.step === 'AWAITING_COUNTDOWN_SELECTION') {
        return ctx.reply("❌ ভুল ইনপুট! অনুগ্রহ করে নিচে দেওয়া বাটনগুলো চেপে মিনিট চয়েস করুন। কীবোর্ডে কিছু টাইপ করলে তা কাজ করবে না।", 
            Markup.inlineKeyboard([
                [Markup.button.callback(locale.btn_no_countdown, 'timer_no')],
                [Markup.button.callback('🕒 ৩ মিনিট', 'set_time_3'), Markup.button.callback('🕒 ৫ মিনিট', 'set_time_5')],
                [Markup.button.callback('🕒 ১০ মিনিট', 'set_time_10')],
                [Markup.button.callback("🔙 পেছনে যান", 'menu_makelink')]
            ])
        );
    }

    // ২. ইমেজ আপলোড ধাপে টেক্সট ইনপুট দিলে হ্যান্ডলিং
    if (session.step === 'AWAITING_IMAGE_UPLOAD') {
        return ctx.reply("❌ ভুল ইনপুট! এই ধাপে আপনাকে একটি ছবি আপলোড করতে হবে। যদি ছবি দিতে না চান, তবে নিচের বাটনটি চেপে Skip করুন।", 
            Markup.inlineKeyboard([
                [Markup.button.callback(locale.btn_skip_image, 'skip_image_upload')],
                [Markup.button.callback("🔙 পেছনে যান", 'back_to_countdown')]
            ])
        );
    }

    // ৩. অ্যানিমেশন টেক্সট ধাপে ভুল ইনপুট হ্যান্ডলিং
    if (session.step === 'AWAITING_ANIMATION_TEXT') {
        const lines = text.split(/[\n,，]+/).map(l => l.trim()).filter(l => l.length > 0);
        if (!lines.length || text.length < 2) {
            return ctx.reply("❌ ভুল অ্যানিমেশন ফরম্যাট! প্রতিটি লাইনের মাঝে কমা ( , ) ব্যবহার করুন অথবা কীবোর্ডের Enter চেপে নিচে নতুন লাইনে লিখুন।\n\n💡 উদাহরণ: হ্যালো, প্রিয়, কেমন আছো।\n👉 অনুগ্রহ করে আবার চেষ্টা করুন:");
        }
        
        db.userSessions[userId].animations = lines;
        db.userSessions[userId].step = 'AWAITING_LETTER_TEXT';
        saveDB();
        return ctx.reply(locale.input_anim_success(lines.length));
    }

    // ৪. চিঠি লেখার ধাপ (এখানে কোনো রেস্ট্রিকশন নেই, ব্যবহারকারী যা লিখবে হুবহু তাই থাকবে)
    if (session.step === 'AWAITING_LETTER_TEXT') {
        return processFinalLinkCreation(ctx, text);
    }

    if (session.step === 'AWAITING_USER_FEEDBACK') {
        if (text.length < 5) return ctx.reply(locale.feedback_short);
        const fullName = `${ctx.from?.first_name || ""} ${ctx.from?.last_name || ""}`.trim() || "User";
        const userName = ctx.from?.username ? `@${ctx.from.username}` : "None";
        
        bot.telegram.sendMessage(ADMIN_CHAT_ID, `📝 Feedback\nName: ${fullName}\nID: ${userId}\nUsername: ${userName}\n\n${text}`).catch(() => {});
        delete db.userSessions[userId];
        saveDB();
        return ctx.reply(locale.feedback_success, Markup.inlineKeyboard([[Markup.button.callback(locale.btn_back, 'go_to_main_menu')]]));
    }
});

function processFinalLinkCreation(ctx, letterText) {
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
        answer: null, image: dbImageUrl, imagePath: session.imageUrl || null
    };
    
    ctx.reply(`আপনার لینک তৈরি করা হয়েছে।\n\nলিংক: \`${finalGeneratedUrl}\``, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[Markup.button.callback("❌ Link Off", `delete_link_${uniqueId}`)]])
    }).catch(() => {});

    // অ্যাডমিনকে নোটিফিকেশন পাঠানো ({ reply_markup } আকারে বাগ ফিক্স সহ)
    const adminKeyboard = Markup.inlineKeyboard([[Markup.button.callback("👀 Check Answer", `view_ans_${uniqueId}`)]]);
    bot.telegram.sendMessage(ADMIN_CHAT_ID, `নতুন লিংক তৈরি করা হয়েছে।\nName: ${session.name}\nID: ${userId}\nCategory: ${session.type.toUpperCase()}\nImage Included: ${dbImageUrl ? "Yes ✅" : "No ❌"}`, { reply_markup: adminKeyboard.reply_markup }).catch(() => {});

    delete db.userSessions[userId];
    saveDB();
}

// REST API এন্ডপয়েন্টস
app.post('/api/get-content', async (req, res) => {
    try {
        const data = db.linkDatabase[req.body.id];
        if (!data) return res.json({ success: false });

        bot.telegram.sendMessage(data.userId, "কেউ আপনার লিংক ওপেন করেছে!").catch(() => {});

        if (data.countdown && new Date(data.countdown) > new Date()) {
            return res.json({ success: true, isLocked: true, countdownTime: data.countdown });
        }

        const config = CATEGORY_CONFIGS[data.type] || CATEGORY_CONFIGS['love'];
        return res.json({ 
            success: true, isLocked: false, title: config.title, music: data.music, 
            animations: data.animations, letter: data.letter, emojis: config.emojis, 
            question: config.question, buttons: config.buttons, image: data.image || null 
        });
    } catch (err) { res.json({ success: false }); }
});

app.post('/api/submit-answer', async (req, res) => {
    try {
        const { id, answer } = req.body;
        const data = db.linkDatabase[id];
        if (!data) return res.json({ success: false });

        data.answer = answer;
        saveDB();

        const config = CATEGORY_CONFIGS[data.type] || CATEGORY_CONFIGS['love'];
        const userKeyboard = Markup.inlineKeyboard([[Markup.button.callback("❌ Link Off", `delete_link_${id}`)]]);
        bot.telegram.sendMessage(data.userId, `আপনার তৈরি করা লিংক থেকে রিপ্লাই এসেছে।\nQuestion: ${config.question}\nAns: ${answer}`, { reply_markup: userKeyboard.reply_markup }).catch(() => {});

        return res.json({ success: true });
    } catch (err) { res.json({ success: false }); }
});

app.get('/love/:id', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    bot.launch().catch(err => console.error("Bot launch failure:", err));
    console.log(`Smart Server successfully running on port ${PORT}`);
});
