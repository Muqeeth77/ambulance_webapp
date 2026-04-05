const Hospital = require("../models/Hospital");
const { createError } = require("../middleware/errorHandler");
const logger = require("../utils/logger");

// @desc    Create hospital
// @route   POST /api/v1/hospitals
// @access  Private (admin)
const createHospital = async (req, res, next) => {
  try {
    const hospital = await Hospital.create({ ...req.body, admin: req.user._id });
    logger.info(`Hospital created: ${hospital.name}`);
    res.status(201).json({ success: true, hospital });
  } catch (err) {
    next(err);
  }
};

// @desc    Get all hospitals
// @route   GET /api/v1/hospitals
// @access  Public
const getHospitals = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [hospitals, total] = await Promise.all([
      Hospital.find({ isActive: true }).skip(skip).limit(parseInt(limit)).sort({ name: 1 }),
      Hospital.countDocuments({ isActive: true }),
    ]);
    res.status(200).json({ success: true, total, hospitals });
  } catch (err) {
    next(err);
  }
};

// @desc    Get nearby hospitals
// @route   GET /api/v1/hospitals/nearby
// @access  Public
const getNearbyHospitals = async (req, res, next) => {
  try {
    const { lng, lat, maxDistance = 20000 } = req.query;
    if (!lng || !lat) return next(createError("Coordinates required.", 400));

    const hospitals = await Hospital.find({
      isActive: true,
      location: {
        $near: {
          $geometry: { type: "Point", coordinates: [parseFloat(lng), parseFloat(lat)] },
          $maxDistance: parseInt(maxDistance),
        },
      },
    }).limit(10);

    res.status(200).json({ success: true, count: hospitals.length, hospitals });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single hospital
// @route   GET /api/v1/hospitals/:id
// @access  Public
const getHospital = async (req, res, next) => {
  try {
    const hospital = await Hospital.findById(req.params.id).populate("ambulances");
    if (!hospital) return next(createError("Hospital not found.", 404));
    res.status(200).json({ success: true, hospital });
  } catch (err) {
    next(err);
  }
};

// @desc    Update hospital
// @route   PUT /api/v1/hospitals/:id
// @access  Private (admin/hospital admin)
const updateHospital = async (req, res, next) => {
  try {
    const hospital = await Hospital.findByIdAndUpdate(req.params.id, req.body, {
      new: true, runValidators: true,
    });
    if (!hospital) return next(createError("Hospital not found.", 404));
    res.status(200).json({ success: true, hospital });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete hospital
// @route   DELETE /api/v1/hospitals/:id
// @access  Private (admin)
const deleteHospital = async (req, res, next) => {
  try {
    const hospital = await Hospital.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!hospital) return next(createError("Hospital not found.", 404));
    res.status(200).json({ success: true, message: "Hospital deactivated." });
  } catch (err) {
    next(err);
  }
};

module.exports = { createHospital, getHospitals, getNearbyHospitals, getHospital, updateHospital, deleteHospital };