const Ambulance = require("../models/Ambulance");
const User = require("../models/User");
const { AMBULANCE_STATUS, ROLES } = require("../config/constants");
const { createError } = require("../middleware/errorHandler");
const logger = require("../utils/logger");

// @desc    Register a new ambulance
// @route   POST /api/v1/ambulances
// @access  Private (admin/hospital)
const createAmbulance = async (req, res, next) => {
  try {
    const { vehicleNumber, type, driverId, hospitalId, equipment, capacity, contactNumber, registrationExpiry } = req.body;

    const driver = await User.findById(driverId);
    if (!driver || driver.role !== ROLES.DRIVER) {
      return next(createError("Invalid driver ID or user is not a driver.", 400));
    }

    const existing = await Ambulance.findOne({ driver: driverId });
    if (existing) {
      return next(createError("This driver already has an ambulance assigned.", 409));
    }

    const ambulance = await Ambulance.create({
      vehicleNumber,
      type,
      driver: driverId,
      hospital: hospitalId || null,
      equipment,
      capacity,
      contactNumber,
      registrationExpiry,
    });

    await ambulance.populate("driver", "name phone email");

    logger.info(`Ambulance created: ${ambulance.vehicleNumber}`);
    res.status(201).json({ success: true, ambulance });
  } catch (err) {
    next(err);
  }
};

// @desc    Get all ambulances
// @route   GET /api/v1/ambulances
// @access  Private (admin)
const getAmbulances = async (req, res, next) => {
  try {
    const { status, type, page = 1, limit = 10 } = req.query;
    const filter = { isActive: true };
    if (status) filter.status = status;
    if (type) filter.type = type;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [ambulances, total] = await Promise.all([
      Ambulance.find(filter)
        .populate("driver", "name phone email")
        .populate("hospital", "name address")
        .skip(skip)
        .limit(parseInt(limit))
        .sort({ createdAt: -1 }),
      Ambulance.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      ambulances,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single ambulance
// @route   GET /api/v1/ambulances/:id
// @access  Private
const getAmbulance = async (req, res, next) => {
  try {
    const ambulance = await Ambulance.findById(req.params.id)
      .populate("driver", "name phone email")
      .populate("hospital", "name address phone");

    if (!ambulance) return next(createError("Ambulance not found.", 404));
    res.status(200).json({ success: true, ambulance });
  } catch (err) {
    next(err);
  }
};

// @desc    Get nearby available ambulances
// @route   GET /api/v1/ambulances/nearby
// @access  Private
const getNearbyAmbulances = async (req, res, next) => {
  try {
    const { lng, lat, maxDistance = 10000, type } = req.query;

    if (!lng || !lat) {
      return next(createError("Longitude and latitude are required.", 400));
    }

    const filter = {
      status: AMBULANCE_STATUS.AVAILABLE,
      isActive: true,
      location: {
        $near: {
          $geometry: { type: "Point", coordinates: [parseFloat(lng), parseFloat(lat)] },
          $maxDistance: parseInt(maxDistance),
        },
      },
    };
    if (type) filter.type = type;

    const ambulances = await Ambulance.find(filter)
      .populate("driver", "name phone")
      .limit(10);

    res.status(200).json({ success: true, count: ambulances.length, ambulances });
  } catch (err) {
    next(err);
  }
};

// @desc    Update ambulance status
// @route   PATCH /api/v1/ambulances/:id/status
// @access  Private (driver/admin)
const updateStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    const ambulance = await Ambulance.findById(req.params.id);
    if (!ambulance) return next(createError("Ambulance not found.", 404));

    // Driver can only update their own
    if (
      req.user.role === ROLES.DRIVER &&
      ambulance.driver.toString() !== req.user._id.toString()
    ) {
      return next(createError("Not authorized.", 403));
    }

    ambulance.status = status;
    ambulance.lastActive = new Date();
    await ambulance.save();

    res.status(200).json({ success: true, message: "Status updated.", ambulance });
  } catch (err) {
    next(err);
  }
};

// @desc    Update ambulance details
// @route   PUT /api/v1/ambulances/:id
// @access  Private (admin)
const updateAmbulance = async (req, res, next) => {
  try {
    const ambulance = await Ambulance.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate("driver", "name phone email");

    if (!ambulance) return next(createError("Ambulance not found.", 404));

    res.status(200).json({ success: true, ambulance });
  } catch (err) {
    next(err);
  }
};

// @desc    Soft delete ambulance
// @route   DELETE /api/v1/ambulances/:id
// @access  Private (admin)
const deleteAmbulance = async (req, res, next) => {
  try {
    const ambulance = await Ambulance.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!ambulance) return next(createError("Ambulance not found.", 404));
    res.status(200).json({ success: true, message: "Ambulance deactivated." });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createAmbulance,
  getAmbulances,
  getAmbulance,
  getNearbyAmbulances,
  updateStatus,
  updateAmbulance,
  deleteAmbulance,
};