import React, { useEffect, useRef, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMapEvents } from "react-leaflet";
import L from "leaflet";
import toast from "react-hot-toast";
import useSocket from "../hooks/useSocket";
import useSocketEvent from "../hooks/useSocketEvent";
import useLocation from "../hooks/useLocation";
import useAuth from "../hooks/useAuth";
import useInAppCall from "../hooks/useInAppCall";
import bookingService from "../services/bookingService";
import { getRoadRoute } from "../services/routingService";
import "leaflet/dist/leaflet.css";

const LIVE_ARRIVAL_THRESHOLD_METERS = 35;
const LIVE_STOP_THRESHOLD_METERS = 8;

const getDistanceInMeters = (start, end) => {
  if (!start || !end) return Number.POSITIVE_INFINITY;

  const toRadians = (value) => (value * Math.PI) / 180;
  const earthRadius = 6371000;
  const latDiff = toRadians(end[0] - start[0]);
  const lngDiff = toRadians(end[1] - start[1]);
  const a =
    Math.sin(latDiff / 2) * Math.sin(latDiff / 2) +
    Math.cos(toRadians(start[0])) *
      Math.cos(toRadians(end[0])) *
      Math.sin(lngDiff / 2) *
      Math.sin(lngDiff / 2);

  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
});

const ambulanceIcon = new L.DivIcon({
  html: "<div style='font-size:28px;'>&#128657;</div>",
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

const pickupIcon = new L.DivIcon({
  html: "<div style='font-size:24px;'>&#128205;</div>",
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

const destinationIcon = new L.DivIcon({
  html: "<div style='font-size:24px;'>&#127973;</div>",
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

const styles = {
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "18px",
    marginBottom: "18px",
  },
  card: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "16px",
    padding: "18px",
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08)",
  },
  title: {
    margin: 0,
    fontSize: "18px",
    fontWeight: 700,
    color: "#1e293b",
  },
  subtitle: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: "14px",
    lineHeight: 1.5,
  },
  row: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px 18px",
    marginTop: "14px",
    color: "#334155",
    fontSize: "14px",
  },
  buttonRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    marginTop: "16px",
  },
  primaryButton: {
    padding: "12px 16px",
    borderRadius: "12px",
    background: "#dc2626",
    color: "#ffffff",
    fontWeight: 700,
    border: "none",
    cursor: "pointer",
  },
  secondaryButton: {
    padding: "12px 16px",
    borderRadius: "12px",
    background: "#eff6ff",
    color: "#1d4ed8",
    fontWeight: 700,
    border: "1px solid #bfdbfe",
    cursor: "pointer",
  },
  emergencyButton: {
    padding: "12px 16px",
    borderRadius: "12px",
    background: "#b91c1c",
    color: "#ffffff",
    fontWeight: 700,
    border: "none",
    cursor: "pointer",
  },
  darkButton: {
    padding: "12px 16px",
    borderRadius: "12px",
    background: "#0f172a",
    color: "#ffffff",
    fontWeight: 700,
    border: "none",
    cursor: "pointer",
  },
  statusChip: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: "999px",
    background: "#fee2e2",
    color: "#b91c1c",
    fontSize: "12px",
    fontWeight: 700,
    marginTop: "12px",
  },
  helper: {
    marginTop: "10px",
    padding: "12px 14px",
    borderRadius: "12px",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    color: "#475569",
    fontSize: "14px",
  },
  waitingCard: {
    background: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)",
    border: "1px solid #93c5fd",
    borderRadius: "16px",
    padding: "18px",
    color: "#1d4ed8",
  },
  successBanner: {
    marginTop: "16px",
    padding: "14px 16px",
    borderRadius: "14px",
    background: "linear-gradient(135deg, #f0fff4 0%, #c6f6d5 100%)",
    border: "1px solid #68d391",
    color: "#22543d",
    fontWeight: 700,
  },
  completionBanner: {
    marginTop: "16px",
    padding: "14px 16px",
    borderRadius: "14px",
    background: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)",
    border: "1px solid #93c5fd",
    color: "#1d4ed8",
    fontWeight: 700,
  },
  callCard: {
    marginTop: "16px",
    padding: "16px",
    borderRadius: "14px",
    background: "linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)",
    border: "1px solid #fdba74",
    color: "#9a3412",
  },
};

const formatPoint = (point) => {
  if (!point) return "Not selected";
  return `${point[0].toFixed(6)}, ${point[1].toFixed(6)}`;
};

const PlanningMapClickHandler = ({ activeSelection, onPick }) => {
  useMapEvents({
    click(event) {
      onPick([event.latlng.lat, event.latlng.lng], activeSelection);
    },
  });

  return null;
};

const DriverDashboard = () => {
  const { socket } = useSocket();
  const { user } = useAuth();
  const { location: currentLocation, watchLocation } = useLocation();
  const [incomingBooking, setIncomingBooking] = useState(null);
  const [activeTrip, setActiveTrip] = useState(null);
  const [route, setRoute] = useState([]);
  const [mapPosition, setMapPosition] = useState(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  const [isStartingManualTrip, setIsStartingManualTrip] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [policeNotifications, setPoliceNotifications] = useState([]);
  const [tripCompletedMessage, setTripCompletedMessage] = useState("");
  const [selectionMode, setSelectionMode] = useState("start");
  const [manualStart, setManualStart] = useState(null);
  const [manualDestination, setManualDestination] = useState(null);
  const [useLiveTrackingForManualTrip, setUseLiveTrackingForManualTrip] = useState(false);

  const routeIndexRef = useRef(0);
  const arrivalTimeoutRef = useRef(null);
  const completionMessageTimeoutRef = useRef(null);
  const stopAlertTimeoutRef = useRef(null);
  const liveStopAlertTimeoutRef = useRef(null);
  const policeNotificationIdRef = useRef(0);
  const tripLifecycleRef = useRef({ arrived: false, completed: false });
  const activeTripRef = useRef(null);
  const isPausedRef = useRef(false);
  const stopWatchingLocationRef = useRef(null);
  const lastLiveMovementPointRef = useRef(null);
  const {
    callStatus,
    incomingCall,
    activeCall,
    remoteAudioRef,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
  } = useInAppCall({
    socket,
    role: "driver",
    displayName: user?.name || "Driver",
  });

  useEffect(() => {
    activeTripRef.current = activeTrip;
  }, [activeTrip]);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    if (currentLocation && !manualStart) {
      setManualStart([currentLocation.lat, currentLocation.lng]);
    }

    if (currentLocation && !mapPosition && !activeTrip) {
      setMapPosition([currentLocation.lat, currentLocation.lng]);
    }
  }, [currentLocation, manualStart, mapPosition, activeTrip]);

  const clearCompletionMessage = () => {
    if (completionMessageTimeoutRef.current) {
      window.clearTimeout(completionMessageTimeoutRef.current);
      completionMessageTimeoutRef.current = null;
    }
    setTripCompletedMessage("");
  };

  const showCompletionMessage = (message) => {
    clearCompletionMessage();
    setTripCompletedMessage(message);
    completionMessageTimeoutRef.current = window.setTimeout(() => {
      setTripCompletedMessage("");
    }, 10000);
  };

  const resetTripState = (mode) => {
    if (callStatus !== "idle") {
      endCall({ silent: true });
    }

    setActiveTrip(null);
    setRoute([]);
    setMapPosition(currentLocation ? [currentLocation.lat, currentLocation.lng] : null);
    setIsPaused(false);
    tripLifecycleRef.current = { arrived: false, completed: false };
    setPoliceNotifications([]);
    setSelectionMode("start");

    if (mode && mode.startsWith("manual")) {
      setManualStart(null);
      setManualDestination(null);
      setUseLiveTrackingForManualTrip(false);
    }

    if (arrivalTimeoutRef.current) {
      window.clearTimeout(arrivalTimeoutRef.current);
      arrivalTimeoutRef.current = null;
    }

    if (stopAlertTimeoutRef.current) {
      window.clearTimeout(stopAlertTimeoutRef.current);
      stopAlertTimeoutRef.current = null;
    }

    if (liveStopAlertTimeoutRef.current) {
      window.clearTimeout(liveStopAlertTimeoutRef.current);
      liveStopAlertTimeoutRef.current = null;
    }

    if (stopWatchingLocationRef.current) {
      stopWatchingLocationRef.current();
      stopWatchingLocationRef.current = null;
    }

    lastLiveMovementPointRef.current = null;
  };

  useSocketEvent("booking_created", (data) => {
    if (!data?.assignedAmbulance || !data?.booking) return;
    const assignedDriverId = data.assignedAmbulance.driver?._id;
    const currentDriverId = user?.id;

    if (assignedDriverId && currentDriverId && String(assignedDriverId) !== String(currentDriverId)) {
      return;
    }

    setIncomingBooking({
      booking: data.booking,
      assignedAmbulance: data.assignedAmbulance,
      allAmbulances: data.allAmbulances || [],
    });
  });

  useSocketEvent("booking_updated", (data) => {
    if (!incomingBooking || !data?.bookingId) return;

    if (
      String(data.bookingId) === String(incomingBooking.booking._id) &&
      data.status &&
      data.status !== "pending"
    ) {
      setIncomingBooking(null);
    }
  });

  useSocketEvent("booking_cancelled", (data) => {
    if (!data?.bookingId) return;

    if (incomingBooking && String(data.bookingId) === String(incomingBooking.booking._id)) {
      setIncomingBooking(null);
    }

    const currentTrip = activeTripRef.current;
    if (
      currentTrip?.mode === "booking" &&
      currentTrip.booking?._id &&
      String(data.bookingId) === String(currentTrip.booking._id)
    ) {
      toast("Booking cancelled by user. Trip stopped.");
      showCompletionMessage("Booking was cancelled. Returning to idle state.");
      resetTripState(currentTrip.mode);
    }
  });

  useSocketEvent("police_acknowledged", (data) => {
    if (!activeTrip || data.id !== activeTrip.id) return;

    const notificationId = policeNotificationIdRef.current++;
    setPoliceNotifications((prev) => [
      {
        id: notificationId,
        title: "Police is responding!",
        text: "Nearby police have acknowledged the emergency and are on the way.",
      },
      ...prev,
    ]);

    window.setTimeout(() => {
      setPoliceNotifications((prev) =>
        prev.filter((notification) => notification.id !== notificationId)
      );
    }, 5000);
  });

  const completeBookingTrip = async (trip) => {
    if (tripLifecycleRef.current.completed) return;
    tripLifecycleRef.current.completed = true;

    try {
      await bookingService.updateStatus(trip.booking._id, "completed");
      socket?.emit("ambulance_trip_completed", { id: trip.id, bookingId: trip.booking._id });
      toast.success("Trip completed and saved to history.");
      showCompletionMessage("Trip has completed.");
    } catch (error) {
      toast.error("Could not complete trip.");
    } finally {
      resetTripState(trip.mode);
    }
  };

  const completeManualTrip = (trip) => {
    if (tripLifecycleRef.current.completed) return;
    tripLifecycleRef.current.completed = true;

    socket?.emit("ambulance_trip_completed", { id: trip.id });
    toast.success("Demo trip completed.");
    showCompletionMessage("Trip has completed.");
    resetTripState(trip.mode);
  };

  const handleTripArrived = async (trip) => {
    if (tripLifecycleRef.current.arrived) return;
    tripLifecycleRef.current.arrived = true;

    if (trip.mode === "booking") {
      try {
        await bookingService.updateStatus(trip.booking._id, "arrived");
        toast.success("Driver arrived at pickup location.");
      } catch (error) {
        toast.error("Could not update arrival status.");
      }

      arrivalTimeoutRef.current = window.setTimeout(() => {
        completeBookingTrip(trip);
      }, 5000);
      return;
    }

    completeManualTrip(trip);
  };

  useEffect(() => {
    if (!socket || !activeTrip || activeTrip.mode === "manual-live" || route.length === 0 || isPaused) return;

    const interval = window.setInterval(() => {
      routeIndexRef.current += 1;

      if (routeIndexRef.current >= route.length) {
        handleTripArrived(activeTrip);
        window.clearInterval(interval);
        return;
      }

      const [lat, lng] = route[routeIndexRef.current];
      setMapPosition([lat, lng]);

      const payload = {
        id: activeTrip.id,
        lat,
        lng,
      };

      if (activeTrip.booking?._id) {
        payload.bookingId = activeTrip.booking._id;
      }

      socket.emit("ambulance_location_update", payload);
    }, 1000);

    return () => window.clearInterval(interval);
  }, [socket, activeTrip, route, isPaused]);

  useEffect(() => {
    if (!socket || !activeTrip || activeTrip.mode !== "manual-live") return;

    if (!stopWatchingLocationRef.current) {
      stopWatchingLocationRef.current = watchLocation();
    }

    if (!currentLocation || isPaused) return;

    const livePoint = [currentLocation.lat, currentLocation.lng];
    const lastLivePoint = lastLiveMovementPointRef.current;
    const hasMovedEnough =
      !lastLivePoint ||
      getDistanceInMeters(lastLivePoint, livePoint) >= LIVE_STOP_THRESHOLD_METERS;

    if (hasMovedEnough) {
      lastLiveMovementPointRef.current = livePoint;
      scheduleLiveStoppedAlert(activeTrip.id);
    }

    setMapPosition(livePoint);

    socket.emit("ambulance_location_update", {
      id: activeTrip.id,
      lat: livePoint[0],
      lng: livePoint[1],
    });

    if (getDistanceInMeters(livePoint, activeTrip.destinationCoords) <= LIVE_ARRIVAL_THRESHOLD_METERS) {
      handleTripArrived(activeTrip);
    }
  }, [socket, activeTrip, currentLocation, isPaused, watchLocation]);

  const beginTrip = async ({ mode, id, driverName, vehicleNumber, startCoords, destinationCoords, booking, assignedAmbulance }) => {
    routeIndexRef.current = 0;
    setIsPaused(false);
    tripLifecycleRef.current = { arrived: false, completed: false };
    clearCompletionMessage();
    setRoute([]);
    setMapPosition(startCoords);

    if (mode !== "manual-live") {
      const roadRoute = await getRoadRoute(startCoords, destinationCoords);
      setRoute(roadRoute);
      setMapPosition(roadRoute[0] || startCoords);
    } else {
      lastLiveMovementPointRef.current = startCoords;
      scheduleLiveStoppedAlert(id);
    }

    setActiveTrip({
      mode,
      id,
      driverName,
      vehicleNumber,
      startCoords,
      destinationCoords,
      booking: booking || null,
      assignedAmbulance: assignedAmbulance || null,
    });
    setPoliceNotifications([]);
  };

  const handleAcceptBooking = async () => {
    if (!incomingBooking || !socket || activeTrip) return;

    setIsAccepting(true);

    try {
      const pickupCoords = [
        incomingBooking.booking.pickupLocation.coordinates[1],
        incomingBooking.booking.pickupLocation.coordinates[0],
      ];
      const ambulanceCoords = [
        incomingBooking.assignedAmbulance.location.coordinates[1],
        incomingBooking.assignedAmbulance.location.coordinates[0],
      ];

      const demoAssignment = {
        ambulanceId: incomingBooking.assignedAmbulance._id,
        driverName: incomingBooking.assignedAmbulance.driver.name,
        vehicleNumber: incomingBooking.assignedAmbulance.vehicleNumber,
        location: incomingBooking.assignedAmbulance.location,
      };

      await bookingService.accept(incomingBooking.booking._id, { demoAssignment });
      await bookingService.updateStatus(incomingBooking.booking._id, "en_route");

      socket.emit("ambulance_request", {
        id: incomingBooking.assignedAmbulance._id,
        pickupCoords: ambulanceCoords,
        hospitalCoords: pickupCoords,
        bookingId: incomingBooking.booking._id,
      });

      await beginTrip({
        mode: "booking",
        id: incomingBooking.assignedAmbulance._id,
        driverName: incomingBooking.assignedAmbulance.driver.name,
        vehicleNumber: incomingBooking.assignedAmbulance.vehicleNumber,
        startCoords: ambulanceCoords,
        destinationCoords: pickupCoords,
        booking: incomingBooking.booking,
        assignedAmbulance: incomingBooking.assignedAmbulance,
      });

      setIncomingBooking(null);
      toast.success("Booking accepted. Heading to pickup.");
    } catch (error) {
      toast.error("Could not accept booking.");
    } finally {
      setIsAccepting(false);
    }
  };

  const handleDeclineBooking = async () => {
    if (!incomingBooking || activeTrip) return;

    setIsDeclining(true);

    try {
      await bookingService.decline(incomingBooking.booking._id, {
        ambulanceId: incomingBooking.assignedAmbulance._id,
      });
      setIncomingBooking(null);
      toast.success("Request cancelled. Searching for another nearby ambulance...");
    } catch (error) {
      toast.error("Could not cancel this request.");
    } finally {
      setIsDeclining(false);
    }
  };

  const handleMapPick = (point, mode) => {
    if (mode === "start") {
      setManualStart(point);
      setUseLiveTrackingForManualTrip(false);
      setSelectionMode("destination");
      toast.success("Start selected. Now choose the destination.");
      return;
    }

    setManualDestination(point);
    toast.success("Destination selected. You can now start the demo trip.");
  };

  const handleUseCurrentLocationAsStart = () => {
    if (!currentLocation) {
      toast.error("Current location not available yet.");
      return;
    }

    setManualStart([currentLocation.lat, currentLocation.lng]);
    setMapPosition([currentLocation.lat, currentLocation.lng]);
    setUseLiveTrackingForManualTrip(true);
    setSelectionMode("destination");
    toast.success("Live location selected as trip start.");
  };

  const handleStartManualTrip = async () => {
    if (!socket) return;
    if (activeTrip) {
      toast.error("Finish the current trip before starting another one.");
      return;
    }
    if (!manualStart || !manualDestination) {
      toast.error("Select both start and destination on the map.");
      return;
    }

    setIsStartingManualTrip(true);

    try {
      const ambulanceId = "AMB-1";
      const tripMode = useLiveTrackingForManualTrip ? "manual-live" : "manual";
      const tripStart = useLiveTrackingForManualTrip && currentLocation
        ? [currentLocation.lat, currentLocation.lng]
        : manualStart;

      socket.emit("ambulance_request", {
        id: ambulanceId,
        pickupCoords: tripStart,
        hospitalCoords: manualDestination,
      });

      await beginTrip({
        mode: tripMode,
        id: ambulanceId,
        driverName: "Demo Driver",
        vehicleNumber: "TS09DEMO1",
        startCoords: tripStart,
        destinationCoords: manualDestination,
      });

      toast.success(
        tripMode === "manual-live"
          ? "Live trip started. Ambulance will now follow your real movement."
          : "Demo trip started."
      );
    } catch (error) {
      toast.error("Could not start demo trip.");
    } finally {
      setIsStartingManualTrip(false);
    }
  };

  const handleEmergency = () => {
    if (!activeTrip || !socket) return;
    socket.emit("ambulance_emergency", { id: activeTrip.id });
    toast.success("Emergency alert sent to police.");
  };

  const scheduleStoppedAlert = (tripId) => {
    if (stopAlertTimeoutRef.current) {
      window.clearTimeout(stopAlertTimeoutRef.current);
    }

    stopAlertTimeoutRef.current = window.setTimeout(() => {
      const currentTrip = activeTripRef.current;
      if (!currentTrip || !socket || !isPausedRef.current || currentTrip.id !== tripId) return;

      socket.emit("ambulance_emergency", { id: tripId });
      toast.error("Ambulance is still stopped. Alert sent to police.");
      scheduleStoppedAlert(tripId);
    }, 30000);
  };

  const scheduleLiveStoppedAlert = (tripId) => {
    if (liveStopAlertTimeoutRef.current) {
      window.clearTimeout(liveStopAlertTimeoutRef.current);
    }

    liveStopAlertTimeoutRef.current = window.setTimeout(() => {
      const currentTrip = activeTripRef.current;
      if (
        !currentTrip ||
        !socket ||
        currentTrip.mode !== "manual-live" ||
        currentTrip.id !== tripId ||
        isPausedRef.current
      ) {
        return;
      }

      socket.emit("ambulance_emergency", { id: tripId });
      toast.error("Ambulance has not moved for 30 seconds. Alert sent to police.");
      scheduleLiveStoppedAlert(tripId);
    }, 30000);
  };

  const handleToggleStop = () => {
    if (!activeTrip) return;

    if (isPaused) {
      setIsPaused(false);
      if (stopAlertTimeoutRef.current) {
        window.clearTimeout(stopAlertTimeoutRef.current);
        stopAlertTimeoutRef.current = null;
      }
      if (activeTrip.mode === "manual-live") {
        lastLiveMovementPointRef.current = currentLocation
          ? [currentLocation.lat, currentLocation.lng]
          : lastLiveMovementPointRef.current;
        scheduleLiveStoppedAlert(activeTrip.id);
      }
      toast.success("Ambulance resumed.");
      return;
    }

    setIsPaused(true);
    toast.success("Ambulance stopped.");
    if (activeTrip.mode === "manual-live") {
      if (liveStopAlertTimeoutRef.current) {
        window.clearTimeout(liveStopAlertTimeoutRef.current);
        liveStopAlertTimeoutRef.current = null;
      }
      return;
    }

    scheduleStoppedAlert(activeTrip.id);
  };

  const handleEndTrip = async () => {
    if (!activeTrip) return;

    if (activeTrip.mode === "booking") {
      try {
        await bookingService.updateStatus(activeTrip.booking._id, "completed");
        socket?.emit("ambulance_trip_completed", { id: activeTrip.id, bookingId: activeTrip.booking._id });
        toast.success("Trip ended.");
        showCompletionMessage("Trip has completed.");
      } catch (error) {
        toast.error("Could not end trip.");
      } finally {
        resetTripState(activeTrip.mode);
      }
      return;
    }

    socket?.emit("ambulance_trip_completed", { id: activeTrip.id });
    toast.success("Demo trip ended.");
    showCompletionMessage("Trip has completed.");
    resetTripState(activeTrip.mode);
  };

  useEffect(() => {
    return () => {
      if (arrivalTimeoutRef.current) {
        window.clearTimeout(arrivalTimeoutRef.current);
      }
      if (completionMessageTimeoutRef.current) {
        window.clearTimeout(completionMessageTimeoutRef.current);
      }
      if (stopAlertTimeoutRef.current) {
        window.clearTimeout(stopAlertTimeoutRef.current);
      }
      if (liveStopAlertTimeoutRef.current) {
        window.clearTimeout(liveStopAlertTimeoutRef.current);
      }
    };
  }, []);

  const planningCenter = mapPosition || manualStart || (currentLocation ? [currentLocation.lat, currentLocation.lng] : [17.385, 78.486]);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Driver Dashboard</h1>
          <p className="text-muted">Accept live bookings or launch a manual demo trip for police tracking.</p>
        </div>
      </div>

      <div style={styles.grid}>
        <div style={styles.card}>
          <p style={styles.title}>Manual Demo Trip</p>
          <p style={styles.subtitle}>
            Click the map to set a start point and destination, or use your current location to start a real GPS trip that police can watch live.
          </p>
          <div style={styles.row}>
            <span>Start: {formatPoint(manualStart)}</span>
            <span>Destination: {formatPoint(manualDestination)}</span>
          </div>
          <div style={styles.buttonRow}>
            <button style={styles.secondaryButton} onClick={() => setSelectionMode("start")}>
              Pick Start
            </button>
            <button style={styles.secondaryButton} onClick={() => setSelectionMode("destination")}>
              Pick Destination
            </button>
            <button style={styles.secondaryButton} onClick={handleUseCurrentLocationAsStart}>
              Use Current As Start
            </button>
          </div>
          <div style={styles.helper}>
            Map click mode: <strong>{selectionMode === "start" ? "Selecting start" : "Selecting destination"}</strong>
          </div>
          <div style={styles.helper}>
            Trip mode: <strong>{useLiveTrackingForManualTrip ? "Live GPS from current location" : "Demo route simulation"}</strong>
          </div>
          <div style={styles.buttonRow}>
            <button
              style={styles.primaryButton}
              onClick={handleStartManualTrip}
              disabled={isStartingManualTrip || !!activeTrip}
            >
              {isStartingManualTrip ? "Starting..." : "Start Demo Trip"}
            </button>
          </div>
        </div>

        {incomingBooking && (
          <div style={styles.card}>
            <p style={styles.title}>New Booking Request</p>
            <p style={styles.subtitle}>
              Nearest ambulance assigned: {incomingBooking.assignedAmbulance._id} ({incomingBooking.assignedAmbulance.vehicleNumber})
            </p>
            <div style={styles.row}>
              <span>Patient: {incomingBooking.booking.patientName}</span>
              <span>Emergency: {incomingBooking.booking.emergencyType}</span>
              <span>Type: {incomingBooking.booking.ambulanceType}</span>
            </div>
            <div style={styles.statusChip}>Pending driver acceptance</div>
            <div style={styles.buttonRow}>
              <button
                style={styles.primaryButton}
                onClick={handleAcceptBooking}
                disabled={isAccepting || isDeclining || !!activeTrip}
              >
                {isAccepting ? "Accepting..." : "Accept And Dispatch"}
              </button>
              <button
                style={styles.darkButton}
                onClick={handleDeclineBooking}
                disabled={isAccepting || isDeclining || !!activeTrip}
              >
                {isDeclining ? "Reassigning..." : "Cancel Request"}
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={styles.card}>
        <p style={styles.title}>{activeTrip ? "Active Trip Map" : "Trip Planning Map"}</p>
        <p style={styles.subtitle}>
          {activeTrip
            ? `${activeTrip.id} is moving on road routes${activeTrip.mode === "booking" ? " to the booking pickup point" : " to the selected destination"}.`
            : "Choose your points on the map or wait for the next booking request."}
        </p>
        {activeTrip && (
          <div style={styles.helper}>
            Status: <strong>{isPaused ? "Stopped" : "Moving"}</strong>
          </div>
        )}

        <MapContainer
          center={planningCenter}
          zoom={15}
          style={{ height: "420px", width: "100%", borderRadius: "16px", overflow: "hidden", marginTop: "16px" }}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

          {!activeTrip && (
            <PlanningMapClickHandler activeSelection={selectionMode} onPick={handleMapPick} />
          )}

          {activeTrip && mapPosition && (
            <Marker position={mapPosition} icon={ambulanceIcon}>
              <Popup>{activeTrip.id}</Popup>
            </Marker>
          )}

          {((activeTrip && activeTrip.startCoords) || (!activeTrip && manualStart)) && (
            <Marker position={activeTrip ? activeTrip.startCoords : manualStart} icon={pickupIcon}>
              <Popup>{activeTrip ? "Trip start" : "Selected start"}</Popup>
            </Marker>
          )}

          {((activeTrip && activeTrip.destinationCoords) || (!activeTrip && manualDestination)) && (
            <Marker position={activeTrip ? activeTrip.destinationCoords : manualDestination} icon={destinationIcon}>
              <Popup>{activeTrip?.mode === "booking" ? "Booking pickup" : "Selected destination"}</Popup>
            </Marker>
          )}
        </MapContainer>

        {activeTrip && (
          <div style={styles.buttonRow}>
            <button style={styles.secondaryButton} onClick={handleToggleStop}>
              {isPaused ? "Resume" : "Stop"}
            </button>
            <button
              style={styles.secondaryButton}
              onClick={() => startCall("police")}
              disabled={callStatus === "outgoing" || callStatus === "connecting" || callStatus === "in_call"}
            >
              {callStatus === "outgoing" || callStatus === "connecting" ? "Calling Police..." : callStatus === "in_call" ? "Police Connected" : "Call Police"}
            </button>
            <button style={styles.emergencyButton} onClick={handleEmergency}>
              Emergency
            </button>
            <button style={styles.darkButton} onClick={handleEndTrip}>
              End Trip
            </button>
          </div>
        )}

        {!activeTrip && !incomingBooking && (
          <div style={styles.waitingCard}>
            Waiting for a new booking request. Manual demo trips are also available any time from the controls above.
          </div>
        )}

        {tripCompletedMessage && (
          <div style={styles.completionBanner}>{tripCompletedMessage}</div>
        )}

        {(incomingCall || callStatus === "outgoing" || callStatus === "connecting" || callStatus === "in_call") && (
          <div style={styles.callCard}>
            {incomingCall && (
              <>
                <div><strong>Incoming Call</strong></div>
                <div style={{ marginTop: "6px" }}>
                  {incomingCall.fromName || incomingCall.fromRole} is calling.
                </div>
                <div style={styles.buttonRow}>
                  <button style={styles.primaryButton} onClick={acceptCall}>
                    Accept Call
                  </button>
                  <button style={styles.darkButton} onClick={rejectCall}>
                    Reject
                  </button>
                </div>
              </>
            )}

            {!incomingCall && callStatus !== "idle" && (
              <>
                <div><strong>Police Call</strong></div>
                <div style={{ marginTop: "6px" }}>
                  {callStatus === "outgoing" && "Ringing police dashboard..."}
                  {callStatus === "connecting" && "Connecting audio..."}
                  {callStatus === "in_call" && `Connected with ${activeCall?.otherName || "police"}.`}
                </div>
                <div style={styles.buttonRow}>
                  <button style={styles.darkButton} onClick={() => endCall()}>
                    End Call
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {policeNotifications.map((notification) => (
          <div key={notification.id} style={styles.successBanner}>
            {notification.title} {notification.text}
          </div>
        ))}
        <audio ref={remoteAudioRef} autoPlay />
      </div>
    </div>
  );
};

export default DriverDashboard;
