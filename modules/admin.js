https.get(`https://ipapi.co/${ip}/json/`, (apiRes) => {
    let body = "";
    apiRes.on('data', chunk => body += chunk);
    apiRes.on('end', () => {
        console.log("IP API Response:", body);
        try {
            const ipData = JSON.parse(body);
            if (!ipData.error) {
                visitorObj.country = ipData.country_name || "Unknown";
                visitorObj.city = ipData.city || "Unknown";
                visitorObj.isp = ipData.org || "Unknown";
            }
        } catch (e) {}
        if (!data.visitors) data.visitors = [];
        data.visitors.push(visitorObj);
        saveDB();
    });
}).on('error', (err) => {
    console.log("IP API Error:", err);
    if (!data.visitors) data.visitors = [];
    data.visitors.push(visitorObj);
    saveDB();
});
