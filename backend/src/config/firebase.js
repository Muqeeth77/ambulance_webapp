const admin = require("firebase-admin");
const logger = require("../utils/logger");

let firebaseApp;

const initFirebase = () => {
  if (firebaseApp) return firebaseApp;

  try {
    const serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY
        ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
        : undefined,
    };

    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    logger.info("✅ Firebase Admin initialized");
    return firebaseApp;
  } catch (err) {
    logger.error("Firebase initialization failed:", err.message);
    throw err;
  }
};

const getFirebaseAdmin = () => {
  if (!firebaseApp) initFirebase();
  return admin;
};

module.exports = { initFirebase, getFirebaseAdmin };