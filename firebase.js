// firebase.js
const admin = require("firebase-admin");
const serviceAccount = JSON.parse(process.env.firebasecred);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore(); // ✅ This should be Firestore
module.exports = db;
