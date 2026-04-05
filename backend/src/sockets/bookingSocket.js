const Booking = require("../models/Booking");
const Ambulance = require("../models/Ambulance");
const { BOOKING_STATUS, AMBULANCE_STATUS, SOCKET_EVENTS } = require("../config/constants");
const logger = require("../utils/logger");

const registerBookingSocket = (io, socket) => {
  const user = socket.user;

  // User requests a new booking via socket (real-time path)
  socket.on(SOCKET_EVENTS.BOOKING_REQUEST, async (data) => {
    try {
      const { pickupLocation, ambulanceType, patientName, emergencyType, notes } = data;

      if (
        !pickupLocation?.coordinates ||
        pickupLocation.coordinates.length !== 2
      ) {
        return socket.emit(SOCKET_EVENTS.ERROR, {
          message: "Invalid pickup location.",
        });
      }

      const booking = await Booking.create({
        user: user._id,
        pickupLocation,
        ambulanceType: ambulanceType || "basic",
        patientName: patientName || user.name,
        emergencyType: emergencyType || "General",
        notes,
        statusHistory: [{ status: BOOKING_STATUS.PENDING, changedBy: user._id }],
      });

      await booking.populate("user", "name phone");

      // Confirm to requesting user
      socket.emit(SOCKET_EVENTS.BOOKING_CREATED, {
        bookingId: booking._id,
        status: booking.status,
        createdAt: booking.createdAt,
      });

      // Broadcast to all drivers
      io.to("drivers_room").emit(SOCKET_EVENTS.NEW_BOOKING_ALERT, {
        bookingId: booking._id,
        pickupLocation: booking.pickupLocation,
        ambulanceType: booking.ambulanceType,
        patientName: booking.patientName,
        emergencyType: booking.emergencyType,
        createdAt: booking.createdAt,
      });

      // Notify admins
      io.to("admin_room").emit(SOCKET_EVENTS.NEW_BOOKING_ALERT, {
        bookingId: booking._id,
        user: { id: user._id, name: user.name },
        emergencyType: booking.emergencyType,
      });

      logger.info(`Socket booking created: ${booking._id} by ${user.name}`);
    } catch (err) {
      logger.error("bookingSocket - BOOKING_REQUEST error:", err.message);
      socket.emit(SOCKET_EVENTS.ERROR, { message: "Failed to create booking." });
    }
  });

  // Driver accepts booking via socket
  socket.on(SOCKET_EVENTS.ACCEPT_BOOKING, async (data) => {
    try {
      if (user.role !== "driver") {
        return socket.emit(SOCKET_EVENTS.ERROR, { message: "Only drivers can accept bookings." });
      }

      const { bookingId } = data;
      const booking = await Booking.findById(bookingId).populate("user");

      if (!booking) {
        return socket.emit(SOCKET_EVENTS.ERROR, { message: "Booking not found." });
      }

      if (booking.status !== BOOKING_STATUS.PENDING) {
        return socket.emit(SOCKET_EVENTS.ERROR, { message: "Booking no longer available." });
      }

      const ambulance = await Ambulance.findOne({
        driver: user._id,
        isActive: true,
        status: AMBULANCE_STATUS.AVAILABLE,
      });

      if (!ambulance) {
        return socket.emit(SOCKET_EVENTS.ERROR, { message: "No available ambulance assigned to you." });
      }

      booking.status = BOOKING_STATUS.ACCEPTED;
      booking.ambulance = ambulance._id;
      booking.acceptedAt = new Date();
      booking.statusHistory.push({ status: BOOKING_STATUS.ACCEPTED, changedBy: user._id });
      await booking.save();

      ambulance.status = AMBULANCE_STATUS.BUSY;
      await ambulance.save();

      await booking.populate({ path: "ambulance", populate: { path: "driver", select: "name phone" } });

      // Notify the booking user
      io.to(`user_${booking.user._id}`).emit(SOCKET_EVENTS.BOOKING_UPDATED, {
        bookingId: booking._id,
        status: booking.status,
        driver: { name: user.name, phone: user.phone },
        ambulance: {
          vehicleNumber: ambulance.vehicleNumber,
          type: ambulance.type,
        },
      });

      socket.emit(SOCKET_EVENTS.BOOKING_UPDATED, {
        bookingId: booking._id,
        status: booking.status,
        message: "Booking accepted successfully.",
      });

      logger.info(`Driver ${user.name} accepted booking ${bookingId}`);
    } catch (err) {
      logger.error("bookingSocket - ACCEPT_BOOKING error:", err.message);
      socket.emit(SOCKET_EVENTS.ERROR, { message: "Failed to accept booking." });
    }
  });

  // Driver marks trip complete
  socket.on(SOCKET_EVENTS.TRIP_COMPLETE, async (data) => {
    try {
      const { bookingId } = data;
      const booking = await Booking.findById(bookingId).populate("user");

      if (!booking) {
        return socket.emit(SOCKET_EVENTS.ERROR, { message: "Booking not found." });
      }

      booking.status = BOOKING_STATUS.COMPLETED;
      booking.completedAt = new Date();
      booking.statusHistory.push({ status: BOOKING_STATUS.COMPLETED, changedBy: user._id });
      await booking.save();

      if (booking.ambulance) {
        await Ambulance.findByIdAndUpdate(booking.ambulance, {
          status: AMBULANCE_STATUS.AVAILABLE,
        });
      }

      io.to(`user_${booking.user._id}`).emit(SOCKET_EVENTS.BOOKING_UPDATED, {
        bookingId: booking._id,
        status: BOOKING_STATUS.COMPLETED,
        message: "Trip completed. Thank you for using our service!",
      });

      socket.emit(SOCKET_EVENTS.BOOKING_UPDATED, {
        bookingId: booking._id,
        status: BOOKING_STATUS.COMPLETED,
      });

      logger.info(`Booking completed: ${bookingId}`);
    } catch (err) {
      logger.error("bookingSocket - TRIP_COMPLETE error:", err.message);
      socket.emit(SOCKET_EVENTS.ERROR, { message: "Failed to complete trip." });
    }
  });

  // Cancel booking via socket
  socket.on(SOCKET_EVENTS.CANCEL_BOOKING, async (data) => {
    try {
      const { bookingId, reason } = data;
      const booking = await Booking.findById(bookingId).populate("user");

      if (!booking) {
        return socket.emit(SOCKET_EVENTS.ERROR, { message: "Booking not found." });
      }

      const cancellable = [BOOKING_STATUS.PENDING, BOOKING_STATUS.ACCEPTED];
      if (!cancellable.includes(booking.status)) {
        return socket.emit(SOCKET_EVENTS.ERROR, { message: "Booking cannot be cancelled." });
      }

      booking.status = BOOKING_STATUS.CANCELLED;
      booking.cancelledAt = new Date();
      booking.cancelReason = reason || "Cancelled";
      booking.statusHistory.push({ status: BOOKING_STATUS.CANCELLED, changedBy: user._id });
      await booking.save();

      if (booking.ambulance) {
        await Ambulance.findByIdAndUpdate(booking.ambulance, {
          status: AMBULANCE_STATUS.AVAILABLE,
        });
      }

      io.to(`user_${booking.user._id}`).emit(SOCKET_EVENTS.BOOKING_CANCELLED, {
        bookingId: booking._id,
        reason: booking.cancelReason,
      });

      socket.emit(SOCKET_EVENTS.BOOKING_CANCELLED, { bookingId: booking._id });

      logger.info(`Booking ${bookingId} cancelled by ${user.name}`);
    } catch (err) {
      logger.error("bookingSocket - CANCEL_BOOKING error:", err.message);
      socket.emit(SOCKET_EVENTS.ERROR, { message: "Failed to cancel booking." });
    }
  });
};

module.exports = { registerBookingSocket };