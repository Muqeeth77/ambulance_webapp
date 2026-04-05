const express = require("express");
const router = express.Router();
const { body } = require("express-validator");

const {
  createBooking,
  getBookings,
  getBookingById,
  acceptBooking,
  declineBooking,
  updateBookingStatus,
  cancelBooking,
  rateBooking,
} = require("../controllers/bookingController");

const { protect } = require("../middleware/auth");
const { bookingRateLimiter } = require("../middleware/rateLimiter");

// ================= VALIDATION =================
const createBookingValidation = [
  body("pickupLocation.coordinates")
    .isArray({ min: 2, max: 2 })
    .withMessage("Pickup coordinates [lng, lat] required"),

  body("patientName")
    .trim()
    .notEmpty()
    .withMessage("Patient name is required"),

  body("ambulanceType")
    .optional()
    .isString(),
];

// ================= ROUTES =================
router.use(protect);

// 🚑 CREATE BOOKING
router.post("/", bookingRateLimiter, createBookingValidation, createBooking);
router.get("/", getBookings);
router.patch("/:id/accept", acceptBooking);
router.patch("/:id/decline", declineBooking);
router.patch("/:id/status", updateBookingStatus);
router.patch("/:id/cancel", cancelBooking);
router.post("/:id/rate", rateBooking);

router.get("/:id", getBookingById);

module.exports = router;
