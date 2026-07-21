const FormData = require('form-data');
const axios = require('axios');

async function uploadToCatbox(fileUrl, fileExtension) {
    try {
        const response = await axios.get(fileUrl, { responseType: 'stream' });
        
        const form = new FormData();
        form.append('reqtype', 'fileupload');
        form.append('fileToUpload', response.data, `file_${Date.now()}.${fileExtension}`);

        const uploadRes = await axios.post('https://catbox.moe/user/api.php', form, {
            headers: {
                ...form.getHeaders()
            }
        });

        return uploadRes.data; // Catbox-এর সরাসরি ডাইরেক্ট লিংক রিটার্ন করবে
    } catch (error) {
        console.error('Catbox Upload Error:', error);
        return null;
    }
}

module.exports = { uploadToCatbox };
