const { SOCKET_EVENTS } = require("../config/constants");
const logger = require("../utils/logger");

const registerNotificationSocket = (io, socket) => {
  const user = socket.user;

  // Allow client to subscribe to admin notifications
  socket.on("subscribe_admin_alerts", () => {
    if (user.role === "admin") {
      socket.join("admin_room");
      socket.emit(SOCKET_EVENTS.NOTIFICATION, {
        type: "info",
        message: "Subscribed to admin alerts.",
      });
    } else {
      socket.emit(SOCKET_EVENTS.ERROR, { message: "Unauthorized." });
    }
  });

  // Admin broadcasts a system-wide notification
  socket.on("broadcast_notification", (data) => {
    if (user.role !== "admin") {
      return socket.emit(SOCKET_EVENTS.ERROR, { message: "Only admins can broadcast." });
    }

    const { message, type = "info", targetRoom = null } = data;

    if (!message) {
      return socket.emit(SOCKET_EVENTS.ERROR, { message: "Notification message is required." });
    }

    const payload = {
      type,
      message,
      sentBy: user.name,
      sentAt: new Date().toISOString(),
    };

    if (targetRoom) {
      io.to(targetRoom).emit(SOCKET_EVENTS.NOTIFICATION, payload);
      logger.info(`Admin broadcast to room [${targetRoom}]: ${message}`);
    } else {
      io.emit(SOCKET_EVENTS.NOTIFICATION, payload);
      logger.info(`Admin global broadcast: ${message}`);
    }

    socket.emit("broadcast_sent", { success: true, payload });
  });

  // Ping/pong for connection health check
  socket.on("ping_server", () => {
    socket.emit("pong_server", { timestamp: new Date().toISOString() });
  });

  // User requests notification permission acknowledgment
  socket.on("register_fcm_token", async (data) => {
    try {
      const { fcmToken } = data;
      if (!fcmToken) return;

      const User = require("../models/User");
      await User.findByIdAndUpdate(user._id, { fcmToken });

      socket.emit(SOCKET_EVENTS.NOTIFICATION, {
        type: "success",
        message: "Push notifications enabled.",
      });

      logger.info(`FCM token registered for ${user.name}`);
    } catch (err) {
      logger.error("notificationSocket - register_fcm_token error:", err.message);
    }
  });
};

module.exports = { registerNotificationSocket };