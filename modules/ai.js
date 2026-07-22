const axios = require('axios');

async function generateAIAnimation(category, name = null) {
    let categoryContext = "romantic and loving";
    if (category === 'birthday') categoryContext = "birthday celebration and happy wishes";
    if (category === 'sorry') categoryContext = "apology, regret, and asking for forgiveness";
    if (category === 'eid') categoryContext = "Eid Mubarak and festive greetings";

    let prompt = `Write 5 short ${categoryContext} animation lines in Bengali, each on a new line. Only return the lines.`;
    if (name) {
        prompt = `Write 5 short ${categoryContext} animation lines in Bengali, mentioning the name "${name}", each on a new line. Only return the lines.`;
    }

    try {
        const response = await axios.post('https://api.airforce.unlimited.net/v1/chat/completions', {
            model: "meta-llama/Llama-3-70B-Instruct",
            messages: [{ role: "user", content: prompt }]
        });

        const text = response.data?.choices?.[0]?.message?.content || "";
        const lines = text.split('\n').filter(l => l.trim().length > 0).slice(0, 5);
        
        if (lines.length === 0) throw new Error("AI failed");
        return lines;
    } catch (error) {
        throw new Error("এআই ফেইল হয়েছে, দয়া করে নিজে থেকে লিখুন।");
    }
}

async function generateAILetter(category, name = null) {
    let categoryContext = "sweet loving letter";
    if (category === 'birthday') categoryContext = "heartfelt birthday wish letter";
    if (category === 'sorry') categoryContext = "sincere apology letter";
    if (category === 'eid') categoryContext = "warm Eid Mubarak greeting letter";

    let prompt = `Write a ${categoryContext} in Bengali within 100 characters.`;
    if (name) {
        prompt = `Write a ${categoryContext} in Bengali within 100 characters, mentioning the name "${name}".`;
    }

    try {
        const response = await axios.post('https://api.airforce.unlimited.net/v1/chat/completions', {
            model: "meta-llama/Llama-3-70B-Instruct",
            messages: [{ role: "user", content: prompt }]
        });

        let text = response.data?.choices?.[0]?.message?.content || "";
        if (!text) throw new Error("AI failed");
        
        if (text.length > 100) text = text.substring(0, 100);
        return text.trim();
    } catch (error) {
        throw new Error("এআই ফেইল হয়েছে, দয়া করে নিজে থেকে লিখুন।");
    }
}

module.exports = { generateAIAnimation, generateAILetter };
