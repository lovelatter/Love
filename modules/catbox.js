const FormData = require('form-data');
const axios = require('axios');

async function uploadToTelegraph(fileUrl, fileExtension) {
    try {
        const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
        
        if (response.status !== 200) {
            return null;
        }

        const form = new FormData();
        form.append('file', Buffer.from(response.data), {
            filename: `file_${Date.now()}.${fileExtension}`
        });

        const uploadResponse = await axios.post('https://telegra.ph/upload', form, {
            headers: {
                ...form.getHeaders()
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });

        if (uploadResponse.status === 200 && Array.isArray(uploadResponse.data) && uploadResponse.data[0] && uploadResponse.data[0].src) {
            return 'https://telegra.ph' + uploadResponse.data[0].src;
        } else {
            console.error('Telegraph Response Error:', uploadResponse.data);
            return null;
        }

    }chas (error) {
        console.error('Telegraph Upload Error:', error.message);
        return null;
    }
}

module.exports = { uploadToTelegraph };
