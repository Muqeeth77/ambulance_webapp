module.exports = {
  ROLES: {
    USER: "user",
    DRIVER: "driver",
    ADMIN: "admin",
    HOSPITAL: "hospital",
    POLICE: "police",
  },

  BOOKING_STATUS: {
    PENDING: "pending",
    ACCEPTED: "accepted",
    EN_ROUTE: "en_route",
    ARRIVED: "arrived",
    COMPLETED: "completed",
    CANCELLED: "cancelled",
  },

  AMBULANCE_STATUS: {
    AVAILABLE: "available",
    BUSY: "busy",
    OFFLINE: "offline",
    MAINTENANCE: "maintenance",
  },

  AMBULANCE_TYPE: {
    BASIC: "basic",
    ADVANCED: "advanced",
    ICU: "icu",
    NEONATAL: "neonatal",
  },

  SOCKET_EVENTS: {
    // Client → Server
    JOIN_ROOM: "join_room",
    LEAVE_ROOM: "leave_room",
    UPDATE_LOCATION: "update_location",
    BOOKING_REQUEST: "booking_request",
    CANCEL_BOOKING: "cancel_booking",
    ACCEPT_BOOKING: "accept_booking",
    DRIVER_ARRIVED: "driver_arrived",
    TRIP_COMPLETE: "trip_complete",

    // Server → Client
    BOOKING_CREATED: "booking_created",
    BOOKING_UPDATED: "booking_updated",
    BOOKING_CANCELLED: "booking_cancelled",
    DRIVER_LOCATION: "driver_location",
    NEW_BOOKING_ALERT: "new_booking_alert",
    ERROR: "socket_error",
    NOTIFICATION: "notification",
  },

  TOKEN_EXPIRY: "7d",
  BCRYPT_ROUNDS: 12,
  MAX_DISTANCE_KM: 50,
};