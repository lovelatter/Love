const FormData = require('form-data');
const https = require('https');

function uploadToTmpfiles(fileUrl, fileExtension) {
    return new Promise((resolve, reject) => {
        https.get(fileUrl, (response) => {
            if (response.statusCode !== 200) {
                return resolve(null);
            }

            const form = new FormData();
            form.append('file', response, `file_${Date.now()}.${fileExtension}`);

            const requestOptions = {
                method: 'POST',
                host: 'tmpfiles.org',
                path: '/api/v1/upload',
                headers: form.getHeaders()
            };

            const req = https.request(requestOptions, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        if (res.statusCode === 200 && json.status === 'success') {
                            // tmpfiles.org এর লিংকটিকে ডাইরেক্ট লিংকে রূপান্তর করা
                            let directUrl = json.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
                            resolve(directUrl);
                        } else {
                            resolve(null);
                        }
                    } catch (e) {
                        resolve(null);
                    }
                });
            });

            req.on('error', (error) => {
                console.error('Tmpfiles Upload Error:', error);
                resolve(null);
            });

            form.pipe(req);
        }).on('error', (error) => {
            console.error('File Download Error:', error);
            resolve(null);
        });
    });
}

module.exports = { uploadToCatbox: uploadToTmpfiles };
