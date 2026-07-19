const database = require("./firebase");

const defaultDB = {
    linkDatabase: {},
    userSessions: {},
    totalLinksCreated: 0,
    isMaintenanceMode: false,
    bannedUsers: [],
    registeredUsers: [],
    usernameMap: {}
};

let db = JSON.parse(JSON.stringify(defaultDB));

async function loadDB() {
    const snapshot = await database.ref("database").get();

    if (snapshot.exists()) {
        db = {
            ...defaultDB,
            ...snapshot.val()
        };
    } else {
        db = JSON.parse(JSON.stringify(defaultDB));
        await saveDB();
    }

    return db;
}

async function saveDB() {
    await database.ref("database").set(db);
}

function getDB() {
    return db;
}

function setDB(newDB) {
    db = newDB;
}

module.exports = {
    loadDB,
    saveDB,
    getDB,
    setDB
};
