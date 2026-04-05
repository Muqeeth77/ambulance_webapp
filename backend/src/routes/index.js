const express = require("express");
const router = express.Router();

const authRoutes = require("./authRoutes");
const bookingRoutes = require("./bookingRoutes");
const ambulanceRoutes = require("./ambulanceRoutes");
const hospitalRoutes = require("./hospitalRoutes");

router.use("/auth", authRoutes);
router.use("/bookings", bookingRoutes);
router.use("/ambulances", ambulanceRoutes);
router.use("/hospitals", hospitalRoutes);

module.exports = router;