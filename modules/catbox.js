const FormData = require('form-data');
const axios = require('axios');

async function uploadToCatbox(fileUrl, fileExtension) {
    try {
        const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
        
        if (response.status !== 200) {
            return null;
        }

        const form = new FormData();
        form.append('reqtype', 'fileupload');
        
        form.append('fileToUpload', Buffer.from(response.data), {
            filename: `file_${Date.now()}.${fileExtension}`
        });

        const uploadResponse = await axios.post('https://catbox.moe/user/api.php', form, {
            headers: {
                ...form.getHeaders()
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });

        if (uploadResponse.status === 200 && typeof uploadResponse.data === 'string' && uploadResponse.data.startsWith('http')) {
            return uploadResponse.data.trim();
        } else {
            console.error('Catbox Response Error:', uploadResponse.data);
            return null;
        }

    } catch (error) {
        console.error('Catbox Upload Error:', error.message);
        return null;
    }
}

module.exports = { uploadToCatbox };
