const { getFirebaseAdmin } = require("../config/firebase");
const logger = require("./logger");

/**
 * Send a push notification to a single FCM token
 */
const sendPushNotification = async ({ token, title, body, data = {} }) => {
  if (!token) return null;

  try {
    const admin = getFirebaseAdmin();
    const message = {
      token,
      notification: { title, body },
      data: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
      ),
      android: {
        priority: "high",
        notification: { sound: "default", clickAction: "FLUTTER_NOTIFICATION_CLICK" },
      },
      apns: {
        payload: { aps: { sound: "default", badge: 1 } },
      },
    };

    const response = await admin.messaging().send(message);
    logger.info(`Push notification sent: ${response}`);
    return response;
  } catch (err) {
    logger.warn(`Push notification failed: ${err.message}`);
    return null;
  }
};

/**
 * Send push notification to a user object (if they have FCM token)
 */
const sendNotificationToUser = async (user, title, body, data = {}) => {
  if (!user?.fcmToken) return null;
  return sendPushNotification({ token: user.fcmToken, title, body, data });
};

/**
 * Send notification to multiple tokens (multicast)
 */
const sendMulticastNotification = async ({ tokens, title, body, data = {} }) => {
  if (!tokens || tokens.length === 0) return null;

  try {
    const admin = getFirebaseAdmin();
    const message = {
      tokens,
      notification: { title, body },
      data: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
      ),
      android: { priority: "high" },
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    logger.info(
      `Multicast sent: ${response.successCount} success, ${response.failureCount} failures`
    );
    return response;
  } catch (err) {
    logger.warn(`Multicast notification failed: ${err.message}`);
    return null;
  }
};

module.exports = {
  sendPushNotification,
  sendNotificationToUser,
  sendMulticastNotification,
};