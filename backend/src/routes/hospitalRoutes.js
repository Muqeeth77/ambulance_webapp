const express = require("express");
const router = express.Router();
const {
  createHospital,
  getHospitals,
  getNearbyHospitals,
  getHospital,
  updateHospital,
  deleteHospital,
} = require("../controllers/hospitalController");
const { protect, authorize } = require("../middleware/auth");
const { ROLES } = require("../config/constants");

// Public routes
router.get("/", getHospitals);
router.get("/nearby", getNearbyHospitals);
router.get("/:id", getHospital);

// Protected routes
router.use(protect);
router.post("/", authorize(ROLES.ADMIN), createHospital);
router.put("/:id", authorize(ROLES.ADMIN, ROLES.HOSPITAL), updateHospital);
router.delete("/:id", authorize(ROLES.ADMIN), deleteHospital);

module.exports = router;