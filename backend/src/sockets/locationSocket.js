const Ambulance = require("../models/Ambulance");
const { SOCKET_EVENTS } = require("../config/constants");
const logger = require("../utils/logger");

const registerLocationSocket = (io, socket) => {
  const user = socket.user;

  // Driver sends live location updates
  socket.on(SOCKET_EVENTS.UPDATE_LOCATION, async (data) => {
    try {
      const { lng, lat, heading, speed, bookingId } = data;

      if (typeof lng !== "number" || typeof lat !== "number") {
        return socket.emit(SOCKET_EVENTS.ERROR, {
          message: "Invalid coordinates. lng and lat must be numbers.",
        });
      }

      // Persist location to DB (only if driver)
      if (user.role === "driver") {
        await Ambulance.findOneAndUpdate(
          { driver: user._id, isActive: true },
          {
            location: { type: "Point", coordinates: [lng, lat] },
            heading: heading || 0,
            speed: speed || 0,
            lastActive: new Date(),
          }
        );
      }

      const locationPayload = {
        driverId: user._id,
        driverName: user.name,
        coordinates: [lng, lat],
        heading: heading || 0,
        speed: speed || 0,
        timestamp: new Date().toISOString(),
      };

      // If tied to a specific booking, emit to that user's room
      if (bookingId) {
        // Find user who made the booking
        const Booking = require("../models/Booking");
        const booking = await Booking.findById(bookingId).select("user");
        if (booking) {
          io.to(`user_${booking.user}`).emit(SOCKET_EVENTS.DRIVER_LOCATION, locationPayload);
        }
      }

      // Also broadcast to admin room for fleet monitoring
      io.to("admin_room").emit(SOCKET_EVENTS.DRIVER_LOCATION, {
        ...locationPayload,
        bookingId,
      });

    } catch (err) {
      logger.error("locationSocket - UPDATE_LOCATION error:", err.message);
      socket.emit(SOCKET_EVENTS.ERROR, { message: "Failed to update location." });
    }
  });

  // Join a specific booking room for location tracking
  socket.on(SOCKET_EVENTS.JOIN_ROOM, (data) => {
    try {
      const { room } = data;
      if (!room) return;

      // Sanitize room name to prevent arbitrary room joining
      const allowedPrefixes = ["booking_", `user_${user._id}`];
      const isAllowed = allowedPrefixes.some((prefix) =>
        room.startsWith(prefix)
      );

      if (isAllowed || user.role === "admin") {
        socket.join(room);
        logger.info(`${user.name} joined room: ${room}`);
        socket.emit("room_joined", { room });
      } else {
        socket.emit(SOCKET_EVENTS.ERROR, { message: "Not authorized to join this room." });
      }
    } catch (err) {
      logger.error("locationSocket - JOIN_ROOM error:", err.message);
    }
  });

  socket.on(SOCKET_EVENTS.LEAVE_ROOM, (data) => {
    try {
      const { room } = data;
      if (room) {
        socket.leave(room);
        logger.info(`${user.name} left room: ${room}`);
      }
    } catch (err) {
      logger.error("locationSocket - LEAVE_ROOM error:", err.message);
    }
  });

  // Driver marks themselves arrived at scene
  socket.on(SOCKET_EVENTS.DRIVER_ARRIVED, async (data) => {
    try {
      const { bookingId } = data;
      if (!bookingId) return;

      const Booking = require("../models/Booking");
      const { BOOKING_STATUS } = require("../config/constants");

      const booking = await Booking.findById(bookingId).populate("user");
      if (!booking) {
        return socket.emit(SOCKET_EVENTS.ERROR, { message: "Booking not found." });
      }

      booking.status = BOOKING_STATUS.ARRIVED;
      booking.arrivedAt = new Date();
      booking.statusHistory.push({ status: BOOKING_STATUS.ARRIVED, changedBy: user._id });
      await booking.save();

      io.to(`user_${booking.user._id}`).emit(SOCKET_EVENTS.BOOKING_UPDATED, {
        bookingId: booking._id,
        status: BOOKING_STATUS.ARRIVED,
        message: "The ambulance has arrived at your location.",
        arrivedAt: booking.arrivedAt,
      });

      socket.emit(SOCKET_EVENTS.BOOKING_UPDATED, {
        bookingId: booking._id,
        status: BOOKING_STATUS.ARRIVED,
      });

      logger.info(`Driver ${user.name} arrived at booking ${bookingId}`);
    } catch (err) {
      logger.error("locationSocket - DRIVER_ARRIVED error:", err.message);
      socket.emit(SOCKET_EVENTS.ERROR, { message: "Failed to mark arrival." });
    }
  });
};

module.exports = { registerLocationSocket };