const FormData = require('form-data');
const https = require('https');

function uploadToCatbox(fileUrl, fileExtension) {
    return new Promise((resolve, reject) => {
        https.get(fileUrl, (response) => {
            if (response.statusCode !== 200) {
                return resolve(null);
            }

            const form = new FormData();
            form.append('reqtype', 'fileupload');
            // Catbox এর মূল এপিআই-তে কোনো 'time' প্যারামিটার লাগে না
            form.append('fileToUpload', response, `file_${Date.now()}.${fileExtension}`);

            const requestOptions = {
                method: 'POST',
                host: 'catbox.moe', // সঠিক হোস্ট ডোমেইন
                path: '/user/api.php',   // সঠিক এপিআই পাথ
                headers: form.getHeaders()
            };

            const req = https.request(requestOptions, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    // সফল হলে সরাসরি ক্যাটবক্সের ফাইল লিংক রিটার্ন করবে
                    if (res.statusCode === 200 && data.startsWith('http')) {
                        resolve(data.trim()); 
                    } else {
                        console.error('Catbox Response Error:', data);
                        resolve(null);
                    }
                });
            });

            req.on('error', (error) => {
                console.error('Catbox Upload Error:', error);
                resolve(null);
            });

            form.pipe(req);
        }).on('error', (error) => {
            console.error('File Download Error:', error);
            resolve(null);
        });
    });
}

module.exports = { uploadToCatbox };
