const admin = require("firebase-admin");

if (!admin.apps.length) {
    const config = JSON.parse(process.env.FIREBASE_CONFIG);

    config.private_key = config.private_key.replace(/\\n/g, "\n");

    admin.initializeApp({
        credential: admin.credential.cert(config),
        databaseURL: `https://${config.project_id}-default-rtdb.firebaseio.com`
    });
}

const database = admin.database();

module.exports = database;
