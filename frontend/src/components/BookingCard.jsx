import React, { useState } from "react";
import StatusBadge from "./StatusBadge";
import bookingService from "../services/bookingService";
import toast from "react-hot-toast";

const BookingCard = ({ booking, onTrack, onRefresh }) => {
  const [cancelling, setCancelling] = useState(false);

  const isCancellable = ["pending", "accepted"].includes(booking.status);
  const isTrackable = ["accepted", "en_route", "arrived"].includes(booking.status);
  const isCompleted = booking.status === "completed";

  const handleCancel = async (e) => {
    e.stopPropagation();
    if (!window.confirm("Cancel this booking?")) return;
    setCancelling(true);
    try {
      await bookingService.cancel(booking._id, "Cancelled by user");
      toast.success("Booking cancelled.");
      if (onRefresh) onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not cancel.");
    } finally {
      setCancelling(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div
      className={`booking-card ${isTrackable ? "booking-card--active" : ""}`}
      onClick={onTrack}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onTrack && onTrack()}
    >
      {/* Header */}
      <div className="booking-card-header">
        <div className="booking-card-id">
          <span className="booking-icon">🚑</span>
          <span>#{booking._id?.slice(-8).toUpperCase()}</span>
        </div>
        <StatusBadge status={booking.status} />
      </div>

      {/* Body */}
      <div className="booking-card-body">
        <div className="booking-info-row">
          <span className="info-label">Patient</span>
          <span className="info-value">{booking.patientName}</span>
        </div>
        <div className="booking-info-row">
          <span className="info-label">Emergency</span>
          <span className="info-value">{booking.emergencyType || "General"}</span>
        </div>
        <div className="booking-info-row">
          <span className="info-label">Type</span>
          <span className="info-value info-badge">
            {booking.ambulanceType?.toUpperCase()}
          </span>
        </div>
        {booking.ambulance?.driver && (
          <div className="booking-info-row">
            <span className="info-label">Driver</span>
            <span className="info-value">
              {booking.ambulance.driver.name}
            </span>
          </div>
        )}
        <div className="booking-info-row">
          <span className="info-label">Created</span>
          <span className="info-value">{formatDate(booking.createdAt)}</span>
        </div>
        {isCompleted && booking.rating && (
          <div className="booking-info-row">
            <span className="info-label">Rating</span>
            <span className="info-value">
              {"★".repeat(booking.rating)}{"☆".repeat(5 - booking.rating)}
            </span>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="booking-card-footer" onClick={(e) => e.stopPropagation()}>
        {isTrackable && (
          <button className="btn btn-primary btn-sm" onClick={onTrack}>
            📍 Track Live
          </button>
        )}
        {isCompleted && !booking.rating && (
          <button className="btn btn-outline btn-sm" onClick={onTrack}>
            ⭐ Rate Trip
          </button>
        )}
        {isCancellable && (
          <button
            className="btn btn-danger btn-sm btn-outline"
            onClick={handleCancel}
            disabled={cancelling}
          >
            {cancelling ? <span className="spinner spinner--sm" /> : "Cancel"}
          </button>
        )}
      </div>
    </div>
  );
};

export default BookingCard;