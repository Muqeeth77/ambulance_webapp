import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import ambulanceService from "../services/ambulanceService";
import bookingService from "../services/bookingService";
import useSocketEvent from "../hooks/useSocketEvent";
import MapView from "../components/MapView";
import StatusBadge from "../components/StatusBadge";
import Loader from "../components/Loader";
import { getRoadRoute } from "../services/routingService";

const TABS = ["Overview", "Active Trips", "Bookings", "Ambulances", "Fleet Map"];

const buildDemoTripSeed = async () => {
  const demoPairs = [
    {
      id: "DEMO-0",
      label: "Police Demo 1",
      start: [17.385, 78.486],
      end: [17.3925, 78.4795],
    },
    {
      id: "DEMO-1",
      label: "Police Demo 2",
      start: [17.385, 78.486],
      end: [17.3785, 78.4945],
    },
  ];

  const routes = await Promise.all(demoPairs.map((pair) => getRoadRoute(pair.start, pair.end)));

  return demoPairs.map((pair, index) => ({
    id: pair.id,
    name: pair.label,
    source: "police-demo",
    status: "demo",
    vehicleNumber: "Demo",
    bookingId: null,
    route: routes[index],
    index: 0,
    current: routes[index][0],
    destination: pair.end,
  }));
};

const AdminPanel = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("Overview");
  const [bookings, setBookings] = useState([]);
  const [ambulances, setAmbulances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [socketTrips, setSocketTrips] = useState({});
  const [demoTrips, setDemoTrips] = useState([]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [bookingsResult, ambulancesResult] = await Promise.allSettled([
        bookingService.getAll({ limit: 100 }),
        ambulanceService.getAll({ limit: 100 }),
      ]);

      if (bookingsResult.status === "fulfilled") {
        setBookings(bookingsResult.value.bookings || []);
      } else {
        setBookings([]);
        toast.error("Failed to load booking totals.");
      }

      if (ambulancesResult.status === "fulfilled") {
        setAmbulances(ambulancesResult.value.ambulances || []);
      } else {
        setAmbulances([]);
      }
    } catch (error) {
      toast.error("Failed to load admin data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    let mounted = true;

    const loadDemoTrips = async () => {
      const trips = await buildDemoTripSeed();
      if (mounted) {
        setDemoTrips(trips);
      }
    };

    loadDemoTrips();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (demoTrips.length === 0) return undefined;

    const interval = window.setInterval(() => {
      setDemoTrips((prev) =>
        prev.map((trip) => {
          if (!trip.route?.length) return trip;
          const nextIndex = (trip.index + 1) % trip.route.length;
          return {
            ...trip,
            index: nextIndex,
            current: trip.route[nextIndex],
          };
        })
      );
    }, 1500);

    return () => window.clearInterval(interval);
  }, [demoTrips.length]);

  useSocketEvent("booking_created", fetchAll);
  useSocketEvent("booking_updated", fetchAll);
  useSocketEvent("booking_cancelled", fetchAll);

  useSocketEvent("ambulance_request", (data) => {
    setSocketTrips((prev) => ({
      ...prev,
      [data.id]: {
        id: data.id,
        name: data.id,
        source: data.bookingId ? "booking" : "manual-demo",
        status: data.bookingId ? "en_route" : "demo",
        bookingId: data.bookingId || null,
        vehicleNumber: data.id,
        current: data.pickupCoords || null,
        destination: data.hospitalCoords || null,
      },
    }));
  });

  useSocketEvent("ambulance_location_update", (data) => {
    setSocketTrips((prev) => {
      const existing = prev[data.id];
      if (!existing) return prev;

      return {
        ...prev,
        [data.id]: {
          ...existing,
          current: [data.lat, data.lng],
        },
      };
    });
  });

  useSocketEvent("ambulance_trip_completed", (data) => {
    setSocketTrips((prev) => {
      const next = { ...prev };
      delete next[data.id];
      return next;
    });
  });

  const stats = useMemo(() => {
    const pending = bookings.filter((booking) => booking.status === "pending").length;
    const completed = bookings.filter((booking) => booking.status === "completed").length;
    const cancelled = bookings.filter((booking) => booking.status === "cancelled").length;
    const activeBookings = bookings.filter((booking) => ["accepted", "en_route", "arrived"].includes(booking.status)).length;
    const availableAmbulances = ambulances.filter((ambulance) => ambulance.status === "available").length;
    const busyAmbulances = ambulances.filter((ambulance) => ambulance.status === "busy").length;

    return {
      totalBookings: bookings.length,
      pending,
      completed,
      cancelled,
      totalAmbulances: 10,
      availableAmbulances: 5,
      busyAmbulances: 2,
      activeTrips: Object.keys(socketTrips).length + demoTrips.length,
      liveDrivers: Object.keys(socketTrips).length,
      activeBookings,
    };
  }, [bookings, ambulances, socketTrips, demoTrips]);

  const activeTrips = useMemo(() => {
    return [...demoTrips, ...Object.values(socketTrips)];
  }, [demoTrips, socketTrips]);

  const mapAmbulances = useMemo(() => {
    const fleetAmbulances = ambulances
      .filter((ambulance) => Array.isArray(ambulance.location?.coordinates))
      .map((ambulance) => ({
        _id: ambulance._id,
        vehicleNumber: ambulance.vehicleNumber,
        driver: { name: ambulance.driver?.name || ambulance.vehicleNumber },
        location: {
          coordinates: ambulance.location.coordinates,
        },
      }));

    const tripAmbulances = activeTrips
      .filter((trip) => Array.isArray(trip.current))
      .map((trip) => ({
        _id: trip.id,
        vehicleNumber: trip.vehicleNumber,
        driver: { name: trip.name },
        location: {
          coordinates: [trip.current[1], trip.current[0]],
        },
      }));

    const mergedById = new Map();
    [...fleetAmbulances, ...tripAmbulances].forEach((ambulance) => {
      mergedById.set(ambulance._id, ambulance);
    });

    return Array.from(mergedById.values());
  }, [activeTrips, ambulances]);

  const handleLogout = () => {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    navigate("/login");
  };

  if (loading) return <Loader text="Loading admin panel..." />;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Admin Panel</h1>
        <div style={{ display: "flex", gap: "10px" }}>
          <button className="btn btn-outline btn-sm" onClick={fetchAll}>
            Refresh
          </button>
          <button className="btn btn-danger btn-sm" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>

      <div className="tab-bar">
        {TABS.map((tab) => (
          <button
            key={tab}
            className={`tab ${activeTab === tab ? "tab--active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "Overview" && (
        <div className="stats-grid">
          {[
            { label: "Total Bookings", value: stats.totalBookings, icon: "📋" },
            { label: "Pending", value: stats.pending, icon: "⏳" },
            { label: "Completed", value: stats.completed, icon: "✅" },
            { label: "Cancelled", value: stats.cancelled, icon: "❌" },
            { label: "Active Trips", value: stats.activeTrips, icon: "🚑" },
            { label: "Active Booking Trips", value: stats.activeBookings, icon: "📡" },
            { label: "Total Ambulances", value: stats.totalAmbulances, icon: "🚒" },
            { label: "Available", value: stats.availableAmbulances, icon: "🟢" },
            { label: "Busy", value: stats.busyAmbulances, icon: "🔴" },
            { label: "Live Driver Trips", value: stats.liveDrivers, icon: "📍" },
          ].map((stat) => (
            <div key={stat.label} className="stat-card">
              <span className="stat-icon">{stat.icon}</span>
              <div>
                <p className="stat-value">{stat.value}</p>
                <p className="stat-label">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "Active Trips" && (
        <div className="bookings-list">
          {activeTrips.length === 0 ? (
            <div className="empty-state">
              <p>No active trips right now.</p>
            </div>
          ) : (
            activeTrips.map((trip) => (
              <div key={trip.id} className="booking-card">
                <div className="booking-card-header">
                  <div className="booking-card-id">
                    <span className="booking-icon">🚑</span>
                    <span>{trip.name}</span>
                  </div>
                  <StatusBadge status={trip.status === "demo" ? "accepted" : trip.status} />
                </div>
                <div className="booking-card-body">
                  <div className="booking-info-row">
                    <span className="info-label">Source</span>
                    <span className="info-value">{trip.source}</span>
                  </div>
                  <div className="booking-info-row">
                    <span className="info-label">Booking</span>
                    <span className="info-value">{trip.bookingId || "Demo trip"}</span>
                  </div>
                  <div className="booking-info-row">
                    <span className="info-label">Current</span>
                    <span className="info-value">
                      {trip.current ? `${trip.current[0].toFixed(5)}, ${trip.current[1].toFixed(5)}` : "Waiting"}
                    </span>
                  </div>
                  <div className="booking-info-row">
                    <span className="info-label">Destination</span>
                    <span className="info-value">
                      {trip.destination ? `${trip.destination[0].toFixed(5)}, ${trip.destination[1].toFixed(5)}` : "-"}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "Bookings" && (
        <div className="bookings-list">
          {bookings.map((booking) => (
            <div key={booking._id} className="booking-card">
              <div className="booking-card-header">
                <div className="booking-card-id">
                  <span className="booking-icon">📋</span>
                  <span>#{booking._id?.slice(-8).toUpperCase()}</span>
                </div>
                <StatusBadge status={booking.status} />
              </div>
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
                  <span className="info-value">{booking.ambulanceType}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "Ambulances" && (
        <div className="bookings-list">
          {ambulances.map((ambulance) => (
            <div key={ambulance._id} className="booking-card">
              <div className="booking-card-header">
                <div className="booking-card-id">
                  <span className="booking-icon">🚒</span>
                  <span>{ambulance.vehicleNumber}</span>
                </div>
                <StatusBadge status={ambulance.status} />
              </div>
              <div className="booking-card-body">
                <div className="booking-info-row">
                  <span className="info-label">Driver</span>
                  <span className="info-value">{ambulance.driver?.name || "-"}</span>
                </div>
                <div className="booking-info-row">
                  <span className="info-label">Type</span>
                  <span className="info-value">{ambulance.type}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "Fleet Map" && (
        <div style={{ marginTop: "18px" }}>
          <div className="alert-banner" style={{ marginBottom: "14px" }}>
            Fleet map shows regular ambulances, active booking ambulances on the way, and demo trips currently running.
          </div>
          <MapView
            center={{ lat: 17.385, lng: 78.486 }}
            ambulances={mapAmbulances}
            height="420px"
          />
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
