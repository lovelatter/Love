const FormData = require('form-data');
const axios = require('axios');

async function uploadToCatbox(fileUrl, fileExtension) {
    try {
        // ১. প্রথমে টেলিগ্রাম বা অন্য সোর্স থেকে ফাইলটি অ্যারে বাফার (arraybuffer) হিসেবে ডাউনলোড করুন
        const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
        
        if (response.status !== 200) {
            return null;
        }

        const form = new FormData();
        form.append('reqtype', 'fileupload');
        
        // ২. বাফার ডেটা দিয়ে ফর্ম ফাইল যুক্ত করুন
        form.append('fileToUpload', Buffer.from(response.data), {
            filename: `file_${Date.now()}.${fileExtension}`
        });

        // ৩. Axios দিয়ে সরাসরি Catbox এ পোস্ট রিকোয়েস্ট পাঠান
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
