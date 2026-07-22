const fetch = require('node-fetch');

async function generateAIAnimation(category, name = null) {
    let categoryContext = "romantic and loving";
    if (category === 'birthday') categoryContext = "birthday celebration and happy wishes";
    if (category === 'sorry') categoryContext = "apology, regret, and asking for forgiveness";
    if (category === 'eid') categoryContext = "Eid Mubarak and festive greetings";

    let prompt = `Write 5 short ${categoryContext} animation lines in Bengali, each on a new line. Only return the lines, nothing else.`;
    if (name) {
        prompt = `Write 5 short ${categoryContext} animation lines in Bengali, specifically mentioning the name "${name}" in them, each on a new line. Only return the lines, nothing else.`;
    }

    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': 'Bearer gsk_free_public_proxy_fallback' 
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [{ role: 'user', content: prompt }]
            })
        });
        
        // যদি এক্সটার্নাল এপিআইতে কোনো কারণে সমস্যা হয়, আমরা ব্যাকআপ হিসেবে প্রমিজ থ্রো করব
        if (!response.ok) throw new Error("AI failed");

        const data = await response.json();
        const text = data.choices?.[0]?.message?.content || "";
        const lines = text.split('\n').filter(l => l.trim().length > 0).slice(0, 5);
        
        if (lines.length === 0) throw new Error("AI failed");
        return lines;
    } catch (error) {
        // ফেইল করলে সরাসরি আপনার চাওয়ার মেসেজটি দেখাবে
        throw new Error("এআই ফেইল হয়েছে, দয়া করে নিজে থেকে লিখুন।");
    }
}

async function generateAILetter(category, name = null) {
    let categoryContext = "sweet loving letter";
    if (category === 'birthday') categoryContext = "heartfelt birthday wish letter";
    if (category === 'sorry') categoryContext = "sincere apology letter";
    if (category === 'eid') categoryContext = "warm Eid Mubarak greeting letter";

    let prompt = `Write a ${categoryContext} in Bengali within 100 characters. Only return the text.`;
    if (name) {
        prompt = `Write a ${categoryContext} in Bengali within 100 characters, mentioning the name "${name}". Only return the text.`;
    }

    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': 'Bearer gsk_free_public_proxy_fallback' 
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [{ role: 'user', content: prompt }]
            })
        });

        if (!response.ok) throw new Error("AI failed");

        const data = await response.json();
        let text = data.choices?.[0]?.message?.content || "";
        if (!text) throw new Error("AI failed");
        
        if (text.length > 100) text = text.substring(0, 100);
        return text.trim();
    } catch (error) {
        throw new Error("এআই ফেইল হয়েছে, দয়া করে নিজে থেকে লিখুন।");
    }
}

module.exports = { generateAIAnimation, generateAILetter };
