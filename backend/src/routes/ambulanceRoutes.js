const express = require("express");
const router = express.Router();
const {
  createAmbulance,
  getAmbulances,
  getAmbulance,
  getNearbyAmbulances,
  updateStatus,
  updateAmbulance,
  deleteAmbulance,
} = require("../controllers/ambulanceController");
const { protect, authorize } = require("../middleware/auth");
const { ROLES } = require("../config/constants");

router.use(protect);

router.get("/nearby", getNearbyAmbulances);
router.post("/", authorize(ROLES.ADMIN, ROLES.HOSPITAL), createAmbulance);
router.get("/", authorize(ROLES.ADMIN, ROLES.HOSPITAL), getAmbulances);
router.get("/:id", getAmbulance);
router.patch(
  "/:id/status",
  authorize(ROLES.DRIVER, ROLES.ADMIN),
  updateStatus
);
router.put("/:id", authorize(ROLES.ADMIN), updateAmbulance);
router.delete("/:id", authorize(ROLES.ADMIN), deleteAmbulance);

module.exports = router;