const { validationResult } = require("express-validator");
const Booking = require("../models/Booking");
const Ambulance = require("../models/Ambulance");
const {
  BOOKING_STATUS,
  SOCKET_EVENTS,
  ROLES,
  AMBULANCE_STATUS,
} = require("../config/constants");
const logger = require("../utils/logger");

let io;
const declinedDemoAmbulancesByBooking = new Map();
const ACTIVE_DISPATCH_STATUSES = [
  BOOKING_STATUS.PENDING,
  BOOKING_STATUS.ACCEPTED,
  BOOKING_STATUS.EN_ROUTE,
  BOOKING_STATUS.ARRIVED,
];

const setIO = (socketIO) => {
  io = socketIO;
};

const emitBookingUpdate = async (booking, extra = {}) => {
  const populatedBooking = await Booking.findById(booking._id)
    .populate("user", "name phone")
    .populate({
      path: "ambulance",
      populate: { path: "driver", select: "name phone" },
    });

  io?.emit(SOCKET_EVENTS.BOOKING_UPDATED, {
    bookingId: populatedBooking._id,
    status: populatedBooking.status,
    booking: populatedBooking,
    ...extra,
  });

  return populatedBooking;
};

const buildDemoAmbulances = (pickupLocation) => {
  const userLat = pickupLocation.coordinates[1];
  const userLng = pickupLocation.coordinates[0];

  return [
    {
      _id: "AMB-1",
      vehicleNumber: "TS09AB1001",
      driver: { name: "Driver 1" },
      location: {
        type: "Point",
        coordinates: [userLng + 0.002, userLat + 0.0015],
      },
    },
    {
      _id: "AMB-2",
      vehicleNumber: "TS09AB1002",
      driver: { name: "Driver 2" },
      location: {
        type: "Point",
        coordinates: [userLng - 0.0025, userLat - 0.001],
      },
    },
    {
      _id: "AMB-3",
      vehicleNumber: "TS09AB1003",
      driver: { name: "Driver 3" },
      location: {
        type: "Point",
        coordinates: [userLng + 0.0012, userLat - 0.0022],
      },
    },
  ];
};

const getNearestAmbulance = (pickupLocation, ambulances) => {
  const userLat = pickupLocation.coordinates[1];
  const userLng = pickupLocation.coordinates[0];

  const getDistance = (lat1, lng1, lat2, lng2) =>
    Math.sqrt(Math.pow(lat1 - lat2, 2) + Math.pow(lng1 - lng2, 2));

  return ambulances.reduce(
    (nearest, ambulance) => {
      const lat = ambulance.location.coordinates[1];
      const lng = ambulance.location.coordinates[0];
      const distance = getDistance(userLat, userLng, lat, lng);

      if (distance < nearest.distance) {
        return { ambulance, distance };
      }

      return nearest;
    },
    { ambulance: ambulances[0], distance: Number.POSITIVE_INFINITY }
  ).ambulance;
};

const getNextDemoAmbulance = (pickupLocation, excludedAmbulanceIds = []) => {
  const demoAmbulances = buildDemoAmbulances(pickupLocation);
  const availableAmbulances = demoAmbulances.filter(
    (ambulance) => !excludedAmbulanceIds.includes(ambulance._id)
  );

  if (availableAmbulances.length === 0) {
    return {
      assignedAmbulance: null,
      allAmbulances: demoAmbulances,
    };
  }

  return {
    assignedAmbulance: getNearestAmbulance(pickupLocation, availableAmbulances),
    allAmbulances: demoAmbulances,
  };
};

const getReservedDemoAmbulanceIds = async (excludeBookingId = null) => {
  const filter = {
    status: { $in: ACTIVE_DISPATCH_STATUSES },
    "demoAssignment.ambulanceId": { $ne: null },
  };

  if (excludeBookingId) {
    filter._id = { $ne: excludeBookingId };
  }

  const activeBookings = await Booking.find(filter).select("demoAssignment.ambulanceId");
  return activeBookings
    .map((booking) => booking.demoAssignment?.ambulanceId)
    .filter(Boolean);
};

const getNearestRealAmbulance = async (
  pickupLocation,
  ambulanceType,
  excludedAmbulanceIds = []
) => {
  const [lng, lat] = pickupLocation.coordinates;
  const filter = {
    isActive: true,
    status: AMBULANCE_STATUS.AVAILABLE,
    location: {
      $near: {
        $geometry: { type: "Point", coordinates: [lng, lat] },
        $maxDistance: 100000,
      },
    },
  };

  if (ambulanceType) {
    filter.type = ambulanceType;
  }

  if (excludedAmbulanceIds.length > 0) {
    filter._id = { $nin: excludedAmbulanceIds };
  }

  return Ambulance.findOne(filter).populate("driver", "name phone");
};

const reserveRealAmbulance = async (ambulanceId) => {
  if (!ambulanceId) return null;

  return Ambulance.findByIdAndUpdate(
    ambulanceId,
    {
      status: AMBULANCE_STATUS.BUSY,
      lastActive: new Date(),
    },
    { new: true }
  ).populate("driver", "name phone");
};

const releaseRealAmbulance = async (ambulanceId) => {
  if (!ambulanceId) return null;

  return Ambulance.findByIdAndUpdate(
    ambulanceId,
    {
      status: AMBULANCE_STATUS.AVAILABLE,
      lastActive: new Date(),
    },
    { new: true }
  );
};

const createBooking = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const {
      pickupLocation,
      dropLocation,
      ambulanceType,
      patientName,
      patientAge,
      emergencyType,
      notes,
    } = req.body;

    const booking = await Booking.create({
      user: req.user._id,
      pickupLocation,
      dropLocation,
      ambulanceType,
      patientName,
      patientAge,
      emergencyType,
      notes,
      status: BOOKING_STATUS.PENDING,
      statusHistory: [
        {
          status: BOOKING_STATUS.PENDING,
          changedBy: req.user._id,
        },
      ],
    });

    const isDemo = process.env.DEMO_MODE === "true";
    let demoAmbulances = [];
    let assignedAmbulance = null;

    if (isDemo) {
      const reservedDemoAmbulanceIds = await getReservedDemoAmbulanceIds(booking._id);
      const demoSelection = getNextDemoAmbulance(pickupLocation, reservedDemoAmbulanceIds);
      demoAmbulances = demoSelection.allAmbulances;
      assignedAmbulance = demoSelection.assignedAmbulance;

      if (assignedAmbulance) {
        booking.demoAssignment = {
          ambulanceId: assignedAmbulance._id,
          driverName: assignedAmbulance.driver.name,
          vehicleNumber: assignedAmbulance.vehicleNumber,
          location: assignedAmbulance.location,
        };
        await booking.save();
      }
    } else {
      assignedAmbulance = await getNearestRealAmbulance(pickupLocation, ambulanceType);

      if (assignedAmbulance) {
        booking.ambulance = assignedAmbulance._id;
        await booking.save();
        assignedAmbulance = await reserveRealAmbulance(assignedAmbulance._id);
      }
    }

    const populatedBooking = await Booking.findById(booking._id)
      .populate("user", "name phone")
      .populate({
        path: "ambulance",
        populate: { path: "driver", select: "name phone" },
      });

    io?.emit(SOCKET_EVENTS.BOOKING_CREATED, {
      booking: populatedBooking,
      assignedAmbulance,
      allAmbulances: demoAmbulances,
    });

    logger.info(`Booking created: ${booking._id}`);

    return res.status(201).json({
      success: true,
      message: "Booking created successfully.",
      booking: populatedBooking,
      assignedAmbulance,
      allAmbulances: demoAmbulances,
    });
  } catch (err) {
    next(err);
  }
};

const declineBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id).populate("user", "name phone");

    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    if (booking.status !== BOOKING_STATUS.PENDING) {
      return res.status(400).json({
        success: false,
        message: "Only pending bookings can be reassigned.",
      });
    }

    const { ambulanceId } = req.body || {};
    const declinedRealAmbulanceIds = [];

    if (booking.ambulance) {
      declinedRealAmbulanceIds.push(String(booking.ambulance));
      await releaseRealAmbulance(booking.ambulance);
      booking.ambulance = null;
    }

    if (ambulanceId) {
      const declinedIds = declinedDemoAmbulancesByBooking.get(String(booking._id)) || [];
      if (!declinedIds.includes(ambulanceId)) {
        declinedIds.push(ambulanceId);
      }
      declinedDemoAmbulancesByBooking.set(String(booking._id), declinedIds);
    }

    booking.demoAssignment = {
      ambulanceId: null,
      driverName: null,
      vehicleNumber: null,
      location: null,
    };
    await booking.save();

    const updatedBooking = await emitBookingUpdate(booking, {
      message: "Driver declined. Reassigning a nearby ambulance.",
    });

    const isDemo = process.env.DEMO_MODE === "true";
    if (isDemo) {
      const declinedIds = declinedDemoAmbulancesByBooking.get(String(booking._id)) || [];

      setTimeout(async () => {
        try {
          const freshBooking = await Booking.findById(booking._id).populate("user", "name phone");
          if (!freshBooking || freshBooking.status !== BOOKING_STATUS.PENDING) return;

          const reservedDemoAmbulanceIds = await getReservedDemoAmbulanceIds(freshBooking._id);
          const { assignedAmbulance, allAmbulances } = getNextDemoAmbulance(
            freshBooking.pickupLocation,
            [...new Set([...declinedIds, ...reservedDemoAmbulanceIds])]
          );

          if (!assignedAmbulance) {
            return;
          }

          freshBooking.demoAssignment = {
            ambulanceId: assignedAmbulance._id,
            driverName: assignedAmbulance.driver.name,
            vehicleNumber: assignedAmbulance.vehicleNumber,
            location: assignedAmbulance.location,
          };
          await freshBooking.save();

          io?.emit(SOCKET_EVENTS.BOOKING_CREATED, {
            booking: freshBooking,
            assignedAmbulance,
            allAmbulances,
          });
        } catch (error) {
          logger.error(`Failed to reassign booking ${booking._id}: ${error.message}`);
        }
      }, 4000);
    } else {
      const nextAmbulance = await getNearestRealAmbulance(
        booking.pickupLocation,
        booking.ambulanceType,
        declinedRealAmbulanceIds
      );

      if (nextAmbulance) {
        booking.ambulance = nextAmbulance._id;
        await booking.save();

        const reservedAmbulance = await reserveRealAmbulance(nextAmbulance._id);
        const refreshedBooking = await Booking.findById(booking._id)
          .populate("user", "name phone")
          .populate({
            path: "ambulance",
            populate: { path: "driver", select: "name phone" },
          });

        io?.emit(SOCKET_EVENTS.BOOKING_CREATED, {
          booking: refreshedBooking,
          assignedAmbulance: reservedAmbulance,
          allAmbulances: reservedAmbulance ? [reservedAmbulance] : [],
        });
      }
    }

    res.status(200).json({
      success: true,
      booking: updatedBooking,
      message: "Booking declined. Searching for another ambulance.",
    });
  } catch (err) {
    next(err);
  }
};

const getBookings = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const numericPage = Number(page);
    const numericLimit = Number(limit);
    const filter = {};

    if (status) {
      filter.status = status;
    }

    if (req.user.role !== ROLES.ADMIN) {
      filter.user = req.user._id;
    }

    const [bookings, total] = await Promise.all([
      Booking.find(filter)
        .populate("user", "name phone")
        .populate({
          path: "ambulance",
          populate: { path: "driver", select: "name phone" },
        })
        .sort({ createdAt: -1 })
        .skip((numericPage - 1) * numericLimit)
        .limit(numericLimit),
      Booking.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      bookings,
      total,
      page: numericPage,
      pages: Math.max(1, Math.ceil(total / numericLimit)),
    });
  } catch (err) {
    next(err);
  }
};

const getBookingById = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate("user", "name phone")
      .populate({
        path: "ambulance",
        populate: { path: "driver", select: "name phone" },
      });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    res.status(200).json({
      success: true,
      booking,
    });
  } catch (err) {
    next(err);
  }
};

const acceptBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    if (booking.status !== BOOKING_STATUS.PENDING) {
      return res.status(400).json({
        success: false,
        message: "Booking can no longer be accepted.",
      });
    }

    const { demoAssignment } = req.body || {};

    if (req.user.role === ROLES.DRIVER && booking.ambulance) {
      const assignedAmbulance = await Ambulance.findById(booking.ambulance).select("driver");
      if (
        assignedAmbulance?.driver &&
        assignedAmbulance.driver.toString() !== req.user._id.toString()
      ) {
        return res.status(403).json({
          success: false,
          message: "This booking is assigned to another driver.",
        });
      }
    }

    booking.status = BOOKING_STATUS.ACCEPTED;
    booking.acceptedAt = new Date();
    if (demoAssignment) {
      booking.demoAssignment = demoAssignment;
    }
    booking.statusHistory.push({
      status: BOOKING_STATUS.ACCEPTED,
      changedBy: req.user._id,
    });
    await booking.save();

    if (booking.ambulance) {
      await reserveRealAmbulance(booking.ambulance);
    }

    const populatedBooking = await emitBookingUpdate(booking, {
      message: "Booking accepted successfully.",
    });

    res.status(200).json({
      success: true,
      booking: populatedBooking,
    });
  } catch (err) {
    next(err);
  }
};

const updateBookingStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    booking.status = status;
    booking.statusHistory.push({
      status,
      changedBy: req.user._id,
    });

    if (status === BOOKING_STATUS.ARRIVED) {
      booking.arrivedAt = new Date();
    }

    if (status === BOOKING_STATUS.COMPLETED) {
      booking.completedAt = new Date();
    }

    if (status === BOOKING_STATUS.CANCELLED) {
      booking.cancelledAt = new Date();
      booking.cancelReason = req.body.reason || "Cancelled";
    }

    await booking.save();

    if (
      [BOOKING_STATUS.ACCEPTED, BOOKING_STATUS.EN_ROUTE, BOOKING_STATUS.ARRIVED].includes(status) &&
      booking.ambulance
    ) {
      await reserveRealAmbulance(booking.ambulance);
    }

    const populatedBooking = await emitBookingUpdate(booking, {
      message: `Booking status updated to ${status}.`,
    });

    if ([BOOKING_STATUS.COMPLETED, BOOKING_STATUS.CANCELLED].includes(status) && booking.ambulance) {
      await releaseRealAmbulance(booking.ambulance);
    }

    if (status === BOOKING_STATUS.CANCELLED) {
      io?.emit(SOCKET_EVENTS.BOOKING_CANCELLED, {
        bookingId: populatedBooking._id,
        reason: populatedBooking.cancelReason,
      });
    }

    res.status(200).json({
      success: true,
      booking: populatedBooking,
    });
  } catch (err) {
    next(err);
  }
};

const cancelBooking = async (req, res, next) => {
  req.body.status = BOOKING_STATUS.CANCELLED;
  return updateBookingStatus(req, res, next);
};

const rateBooking = async (req, res, next) => {
  try {
    const { rating, feedback } = req.body;
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    booking.rating = rating;
    booking.feedback = feedback || null;
    await booking.save();

    res.status(200).json({
      success: true,
      booking,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  setIO,
  createBooking,
  getBookings,
  getBookingById,
  acceptBooking,
  declineBooking,
  updateBookingStatus,
  cancelBooking,
  rateBooking,
};
