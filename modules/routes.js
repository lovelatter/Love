const path = require('path');
const https = require('https');
const { Markup } = require('telegraf');
const { parseUserAgent } = require('./visitor');
const { CATEGORY_CONFIGS } = require('./category');

function setupRoutes(app, db, saveDB, bot) {
    app.post('/api/get-content', async (req, res) => {
        try {
            const linkId = req.body.id;
            const data = db.linkDatabase[linkId];
            if (!data) return res.json({ success: false });
            
            const sentMsg = await bot.telegram.sendMessage(data.userId, "কেউ আপনার লিংক ওপেন করেছে!").catch(() => null);
            if (sentMsg) {
                if (!data.openMessageIds) data.openMessageIds = {};
                data.openMessageIds[req.ip || 'default'] = sentMsg.message_id;
                await saveDB();
            }
            
            let rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || "";
            let ip = rawIp.split(',')[0].trim();
            if (ip.includes('::ffff:')) ip = ip.replace('::ffff:', '');
            
            const userAgent = req.headers['user-agent'] || "";
            const { os, browser } = parseUserAgent(userAgent);
            const currentTimeString = new Date().toLocaleString("en-US", { timeZone: "Asia/Dhaka" });
            
            let visitorObj = {
                time: currentTimeString, ip: ip, country: "Unknown", city: "Unknown", isp: "Unknown", os: os, browser: browser
            };
            
            if (ip && ip !== "127.0.0.1" && ip !== "::1") {
                https.get(`https://ip-api.com/json/${ip}`, (apiRes) => {
                    let body = "";
                    apiRes.on('data', chunk => body += chunk);
                    apiRes.on('end', () => {
                        try {
                            const ipData = JSON.parse(body);
                            if (ipData.status === "success") {
                                visitorObj.country = ipData.country || "Unknown";
                                visitorObj.city = ipData.city || "Unknown";
                                visitorObj.isp = ipData.isp || "Unknown";
                            }
                        } catch (e) {}
                        if (!data.visitors) data.visitors = [];
                        data.visitors.push(visitorObj);
                        saveDB();
                    });
                }).on('error', () => {
                    if (!data.visitors) data.visitors = [];
                    data.visitors.push(visitorObj);
                    saveDB();
                });
            } else {
                if (!data.visitors) data.visitors = [];
                data.visitors.push(visitorObj);
                await saveDB();
            }
            
            if (data.countdown && new Date(data.countdown) > new Date()) {
                return res.json({ success: true, isLocked: true, countdownTime: data.countdown });
            }
            
            const config = CATEGORY_CONFIGS[data.type] || CATEGORY_CONFIGS['love'];
            return res.json({ 
                success: true, isLocked: false, title: data.title || config.title, music: data.music, 
                animations: data.animations, letter: data.letter, emojis: config.emojis, 
                question: data.question || config.question, buttons: data.buttons || config.buttons, image: data.image || null, theme: data.theme || 'classic'
            });
        } catch (err) { 
            res.json({ success: false }); 
        }
    });

    app.post('/api/open-envelope', async (req, res) => {
        try {
            const { id } = req.body;
            const data = db.linkDatabase[id];
            if (!data) return res.json({ success: false });

            await bot.telegram.sendMessage(data.userId, "খাম খোলা হয়েছে!").catch(() => {});
            return res.json({ success: true });
        } catch (err) {
            res.json({ success: false });
        }
    });

    app.post('/api/submit-answer', async (req, res) => {
        try {
            const { id, answer, message } = req.body;
            const data = db.linkDatabase[id];
            if (!data) return res.json({ success: false });
            
            data.answer = answer;
            if (message) {
                data.visitorMessage = message;
            }
            
            if (message && data.lastReplyMessageId) {
                await bot.telegram.deleteMessage(data.userId, data.lastReplyMessageId).catch(() => {});
                data.lastReplyMessageId = null;
            }
            
            await saveDB();
            
            const config = CATEGORY_CONFIGS[data.type] || CATEGORY_CONFIGS['love'];
            const currentQuestion = data.question || config.question;
            
            let replyText = `আপনার তৈরি করা লিংক থেকে রিপ্লাই এসেছে。\nQuestion: ${currentQuestion}\nAns: ${answer}`;
            if (message) {
                replyText += `\n\nআপনার তৈরি করা লিংক থেকে মেসেজ এসেছে。\nMsg: ${message}`;
            }
            
            const sentReplyMsg = await bot.telegram.sendMessage(
                data.userId, 
                replyText, 
                Markup.inlineKeyboard([[Markup.button.callback("❌ Link Off", `delete_link_${id}`)]])
            ).catch(() => null);

            if (sentReplyMsg && !message) {
                data.lastReplyMessageId = sentReplyMsg.message_id;
                await saveDB();
            }
            
            return res.json({ success: true });
        } catch (err) { 
            res.json({ success: false }); 
        }
    });

    app.get('/love/:id', (req, res) => res.sendFile(path.join(__dirname, '../index.html')));
}

module.exports = { setupRoutes };
