const mongoose = require("mongoose");
const { BOOKING_STATUS, AMBULANCE_TYPE } = require("../config/constants");

const locationSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["Point"], default: "Point" },
    coordinates: { type: [Number], required: true },
    address: { type: String, default: null },
  },
  { _id: false }
);

const bookingSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required"],
    },
    ambulance: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ambulance",
      default: null,
    },
    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
      default: null,
    },
    pickupLocation: {
      type: locationSchema,
      required: [true, "Pickup location is required"],
    },
    dropLocation: {
      type: locationSchema,
      default: null,
    },
    ambulanceType: {
      type: String,
      enum: Object.values(AMBULANCE_TYPE),
      default: AMBULANCE_TYPE.BASIC,
    },
    status: {
      type: String,
      enum: Object.values(BOOKING_STATUS),
      default: BOOKING_STATUS.PENDING,
    },
    patientName: {
      type: String,
      required: [true, "Patient name is required"],
      trim: true,
    },
    patientAge: {
      type: Number,
      default: null,
    },
    emergencyType: {
      type: String,
      trim: true,
      default: "General",
    },
    notes: {
      type: String,
      maxlength: [500, "Notes cannot exceed 500 characters"],
      default: null,
    },
    demoAssignment: {
      ambulanceId: { type: String, default: null },
      driverName: { type: String, default: null },
      vehicleNumber: { type: String, default: null },
      location: {
        type: locationSchema,
        default: null,
      },
    },
    otp: {
      type: String,
      default: null,
      select: false,
    },
    estimatedArrival: {
      type: Date,
      default: null,
    },
    acceptedAt: { type: Date, default: null },
    arrivedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    cancelReason: { type: String, default: null },
    distanceKm: { type: Number, default: null },
    fareAmount: { type: Number, default: null },
    rating: { type: Number, min: 1, max: 5, default: null },
    feedback: { type: String, default: null },
    statusHistory: [
      {
        status: String,
        changedAt: { type: Date, default: Date.now },
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

bookingSchema.index({ user: 1, createdAt: -1 });
bookingSchema.index({ ambulance: 1, status: 1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ pickupLocation: "2dsphere" });

const Booking = mongoose.model("Booking", bookingSchema);
module.exports = Booking;
