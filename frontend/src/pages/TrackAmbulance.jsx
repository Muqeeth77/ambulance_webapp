import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import useSocketEvent from "../hooks/useSocketEvent";
import bookingService from "../services/bookingService";
import MapView from "../components/MapView";
import StatusBadge from "../components/StatusBadge";
import Loader from "../components/Loader";

const STATUS_STEPS = ["pending", "accepted", "en_route", "arrived", "completed"];

const TrackAmbulance = () => {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const completionTimeoutRef = useRef(null);

  const [booking, setBooking] = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [completionNoticeVisible, setCompletionNoticeVisible] = useState(false);

  const scheduleCompletionExit = useCallback(() => {
    if (completionTimeoutRef.current) {
      window.clearTimeout(completionTimeoutRef.current);
    }

    setCompletionNoticeVisible(true);
    completionTimeoutRef.current = window.setTimeout(() => {
      setCompletionNoticeVisible(false);
      navigate("/history");
    }, 5000);
  }, [navigate]);

  const fetchBooking = useCallback(async () => {
    try {
      const res = await bookingService.getById(bookingId);
      setBooking(res.booking);

      if (res.booking?.status === "completed") {
        setDriverLocation(null);
        scheduleCompletionExit();
      }
    } catch (error) {
      toast.error("Failed to load booking.");
    } finally {
      setLoading(false);
    }
  }, [bookingId, scheduleCompletionExit]);

  useEffect(() => {
    fetchBooking();
  }, [fetchBooking]);

  useEffect(() => {
    return () => {
      if (completionTimeoutRef.current) {
        window.clearTimeout(completionTimeoutRef.current);
      }
    };
  }, []);

  useSocketEvent("booking_updated", (data) => {
    if (String(data.bookingId) !== String(bookingId)) return;

    if (data.status === "arrived") {
      toast.success("Driver arrived at your location.");
    }

    if (data.status === "completed") {
      toast.success("Trip completed and saved to history.");
      setDriverLocation(null);
      scheduleCompletionExit();
    }

    setBooking((prev) => {
      if (!prev) return data.booking || prev;

      return data.booking
        ? data.booking
        : {
            ...prev,
            status: data.status,
            statusHistory: [...(prev.statusHistory || []), { status: data.status }],
          };
    });
  });

  useSocketEvent("booking_cancelled", (data) => {
    if (String(data.bookingId) !== String(bookingId)) return;

    toast.error("This booking was cancelled.");
    setDriverLocation(null);
    setBooking((prev) => (prev ? { ...prev, status: "cancelled" } : prev));
  });

  useSocketEvent("ambulance_location_update", (data) => {
    if (String(data.bookingId) !== String(bookingId)) return;

    setDriverLocation({
      lat: data.lat,
      lng: data.lng,
    });
  });

  const handleCancel = async () => {
    if (!window.confirm("Are you sure you want to cancel this booking?")) return;

    setCancelling(true);
    try {
      await bookingService.cancel(bookingId, "Cancelled by user");
      toast.success("Booking cancelled.");
      fetchBooking();
    } catch (error) {
      toast.error("Could not cancel booking.");
    } finally {
      setCancelling(false);
    }
  };

  if (loading) return <Loader text="Loading booking details..." />;

  if (!booking) {
    return (
      <div className="page">
        <div className="empty-state">
          <span>Ride unavailable</span>
          <p>Booking not found.</p>
          <button className="btn btn-primary" onClick={() => navigate("/dashboard")}>
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const currentStepIndex = STATUS_STEPS.indexOf(booking.status);
  const isCancellable = ["pending", "accepted", "en_route"].includes(booking.status);
  const isCompleted = booking.status === "completed";
  const isCancelled = booking.status === "cancelled";

  const pickupCoords = {
    lat: booking.pickupLocation.coordinates[1],
    lng: booking.pickupLocation.coordinates[0],
  };

  const fallbackAmbulanceLocation = booking.demoAssignment?.location?.coordinates
    ? {
        lat: booking.demoAssignment.location.coordinates[1],
        lng: booking.demoAssignment.location.coordinates[0],
      }
    : {
        lat: booking.pickupLocation.coordinates[1] + 0.002,
        lng: booking.pickupLocation.coordinates[0] + 0.002,
      };

  const ambulanceLocation = driverLocation || fallbackAmbulanceLocation;
  const driverName = booking.ambulance?.driver?.name || booking.demoAssignment?.driverName || "Assigning...";
  const driverVehicle = booking.ambulance?.vehicleNumber || booking.demoAssignment?.vehicleNumber || "-";
  const ambulanceId = booking.demoAssignment?.ambulanceId || booking.ambulance?._id || "Assigning...";

  return (
    <div className="page">
      <div className="hero-panel hero-panel--tracking">
        <div className="hero-panel-content">
          <div>
            <div className="eyebrow">Live Tracking</div>
            <h1 className="hero-title">Track your emergency vehicle</h1>
            <p className="hero-copy">
              Follow the ambulance route, watch status changes in real time, and stay
              informed throughout the entire response.
            </p>
          </div>
          <div className="hero-metric-card">
            <span>Current Status</span>
            <strong>{booking.status.replace("_", " ")}</strong>
            <small>{driverName === "Assigning..." ? "Dispatcher is assigning a vehicle." : `Driver: ${driverName}`}</small>
          </div>
        </div>
      </div>

      <div className="page-header">
        <button className="btn btn-ghost" onClick={() => navigate("/dashboard")}>
          Back to Dashboard
        </button>
        <h1>Track Booking</h1>
        <StatusBadge status={booking.status} />
      </div>

      {!isCancelled && !isCompleted && (
        <div className="progress-track">
          {STATUS_STEPS.map((step, index) => (
            <div
              key={step}
              className={`progress-step ${index <= currentStepIndex ? "progress-step--done" : ""} ${
                index === currentStepIndex ? "progress-step--active" : ""
              }`}
            >
              <div className="progress-dot" />
              <span className="progress-label">{step}</span>
            </div>
          ))}
        </div>
      )}

      <div className="map-section">
        <MapView
          center={isCompleted || isCancelled ? pickupCoords : ambulanceLocation}
          userLocation={pickupCoords}
          autoCenter={!isCompleted && !isCancelled}
          ambulances={
            isCompleted || isCancelled
              ? []
              : [
                  {
                    _id: ambulanceId,
                    vehicleNumber: driverVehicle,
                    driver: { name: driverName },
                    location: {
                      coordinates: [ambulanceLocation.lng, ambulanceLocation.lat],
                    },
                  },
                ]
          }
          height="320px"
        />
      </div>

      <div className="detail-card">
        <h2>Booking Details</h2>
        <div className="detail-grid">
          <div>
            <span>Patient</span>
            <strong>{booking.patientName}</strong>
          </div>
          <div>
            <span>Driver</span>
            <strong>{driverName}</strong>
          </div>
          <div>
            <span>Vehicle</span>
            <strong>{driverVehicle}</strong>
          </div>
          <div>
            <span>Ambulance</span>
            <strong>{ambulanceId}</strong>
          </div>
        </div>
      </div>

      {booking.status === "arrived" && (
        <div className="alert-banner alert-banner--success">
          Driver arrived at your location. This trip will close automatically.
        </div>
      )}

      {completionNoticeVisible && (
        <div className="alert-banner alert-banner--success">
          Trip completed. Redirecting to booking history.
        </div>
      )}

      {isCancellable && (
        <button className="btn btn-danger" onClick={handleCancel} disabled={cancelling}>
          Cancel Booking
        </button>
      )}
    </div>
  );
};

export default TrackAmbulance;
