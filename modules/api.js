const { db, saveDB, parseUserAgent } = require('./utils');
const { CATEGORY_CONFIGS } = require('./config');
const https = require('https');

const handleGetContent = (req, bot) => {
    return new Promise((resolve) => {
        const linkId = req.body.id;
        const data = db.linkDatabase[linkId];
        if (!data) return resolve({ success: false });
        
        // Tracking logic here
        if (data.countdown && new Date(data.countdown) > new Date()) {
            return resolve({ success: true, isLocked: true, countdownTime: data.countdown });
        }
        const config = CATEGORY_CONFIGS[data.type] || CATEGORY_CONFIGS['love'];
        resolve({ 
            success: true, isLocked: false, title: config.title, music: data.music, 
            animations: data.animations, letter: data.letter, emojis: config.emojis, 
            question: config.question, buttons: config.buttons, image: data.image || null 
        });
    });
};

module.exports = { handleGetContent };
