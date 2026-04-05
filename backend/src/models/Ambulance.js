const mongoose = require("mongoose");
const { AMBULANCE_STATUS, AMBULANCE_TYPE } = require("../config/constants");

const ambulanceSchema = new mongoose.Schema(
  {
    vehicleNumber: {
      type: String,
      required: [true, "Vehicle number is required"],
      unique: true,
      uppercase: true,
      trim: true,
    },
    type: {
      type: String,
      enum: Object.values(AMBULANCE_TYPE),
      default: AMBULANCE_TYPE.BASIC,
    },
    status: {
      type: String,
      enum: Object.values(AMBULANCE_STATUS),
      default: AMBULANCE_STATUS.OFFLINE,
    },
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Driver is required"],
      unique: true,
    },
    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
      default: null,
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number],
        default: [0, 0],
      },
    },
    heading: {
      type: Number,
      default: 0,
      min: 0,
      max: 360,
    },
    speed: {
      type: Number,
      default: 0,
    },
    equipment: {
      type: [String],
      default: [],
    },
    capacity: {
      type: Number,
      default: 1,
    },
    contactNumber: {
      type: String,
      trim: true,
      default: null,
    },
    registrationExpiry: {
      type: Date,
      default: null,
    },
    lastActive: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

ambulanceSchema.index({ location: "2dsphere" });
ambulanceSchema.index({ status: 1 });
ambulanceSchema.index({ driver: 1 });

const Ambulance = mongoose.model("Ambulance", ambulanceSchema);
module.exports = Ambulance;