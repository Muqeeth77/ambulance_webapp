import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import useAuth from "../hooks/useAuth";
import useSocket from "../hooks/useSocket";
import useSocketEvent from "../hooks/useSocketEvent";
import bookingService from "../services/bookingService";
import Loader from "../components/Loader";
import StatusBadge from "../components/StatusBadge";

const Dashboard = () => {
  const { user, hasRole } = useAuth();
  const { connected } = useSocket();
  const navigate = useNavigate();

  const [recentBookings, setRecentBookings] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    completed: 0,
    cancelled: 0,
  });
  const [loading, setLoading] = useState(true);
  const [newAlert, setNewAlert] = useState(null);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);

    try {
      const data = await bookingService.getAll({ page: 1, limit: 50 });
      const bookings = data.bookings || [];

      setRecentBookings(bookings.slice(0, 6));
      setStats({
        total: bookings.length,
        pending: bookings.filter((booking) => booking.status === "pending").length,
        completed: bookings.filter((booking) => booking.status === "completed").length,
        cancelled: bookings.filter((booking) => booking.status === "cancelled").length,
      });
    } catch (error) {
      toast.error("Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  useSocketEvent("booking_created", fetchDashboardData);
  useSocketEvent("booking_updated", fetchDashboardData);
  useSocketEvent("booking_cancelled", fetchDashboardData);

  useSocketEvent("new_booking_alert", (data) => {
    if (hasRole("driver")) {
      setNewAlert(data);
      toast("New booking request nearby.", { duration: 8000 });
    }
  });

  const handleAcceptAlert = async () => {
    if (!newAlert?.bookingId) return;

    try {
      toast.success("Booking accepted!");
      setNewAlert(null);
      fetchDashboardData();
    } catch (error) {
      toast.error("Could not accept booking.");
    }
  };

  if (loading) return <Loader text="Loading dashboard..." />;

  return (
    <div className="page">
      <div className="hero-panel">
        <div className="hero-panel-content">
          <div>
            <div className="eyebrow">Emergency Operations</div>
            <h1 className="hero-title">Welcome back, {user?.name}</h1>
            <p className="hero-copy">
              {hasRole("admin")
                ? "Keep the emergency network visible with cleaner command surfaces and quick visual insight."
                : hasRole("driver")
                ? "Stay ready for live requests, active routes, and instant emergency actions."
                : "Manage ambulance requests, track your activity, and move through urgent actions with confidence."}
            </p>
          </div>
          <div className="hero-panel-side">
            <div className="connection-badge connection-badge--hero">
              <span className={`dot ${connected ? "dot--green" : "dot--red"}`} />
              {connected ? "Systems Live" : "Offline"}
            </div>
          </div>
        </div>
      </div>

      <div className="page-header">
        <div>
          <h1>Overview</h1>
          <p className="text-muted">
            {hasRole("admin")
              ? "Admin Dashboard"
              : hasRole("driver")
              ? "Driver Dashboard"
              : "Your emergency services hub"}
          </p>
        </div>
      </div>

      {newAlert && hasRole("driver") && (
        <div className="alert-banner alert-banner--emergency">
          <div>
            <strong>New Booking Alert</strong>
            <p>
              {newAlert.emergencyType} - {newAlert.patientName}
            </p>
          </div>
          <div className="alert-actions">
            <button className="btn btn-success" onClick={handleAcceptAlert}>
              Accept
            </button>
            <button className="btn btn-ghost" onClick={() => setNewAlert(null)}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="stats-grid">
        {[
          { label: "Total Bookings", value: stats.total, icon: "📋", color: "blue" },
          { label: "Pending", value: stats.pending, icon: "⏳", color: "yellow" },
          { label: "Completed", value: stats.completed, icon: "✅", color: "green" },
          { label: "Cancelled", value: stats.cancelled, icon: "❌", color: "red" },
        ].map((stat) => (
          <div key={stat.label} className={`stat-card stat-card--${stat.color}`}>
            <span className="stat-icon">{stat.icon}</span>
            <div>
              <p className="stat-value">{stat.value}</p>
              <p className="stat-label">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="quick-actions">
        {hasRole("user") && (
          <button className="btn btn-primary btn-large" onClick={() => navigate("/book")}>
            🚑 Book Ambulance
          </button>
        )}
        <button className="btn btn-outline" onClick={() => navigate("/history")}>
          📋 View All Bookings
        </button>
      </div>

      <section className="section">
        <h2 className="section-title">Recent Bookings</h2>

        <div className="bookings-list">
          {recentBookings.length === 0 ? (
            <div className="empty-state">
              <p>No bookings yet.</p>
            </div>
          ) : (
            recentBookings.map((booking) => (
              <div
                key={booking._id}
                className="booking-card booking-card--summary"
              >
                <div>
                  <p>
                    <strong>👤 {booking.patientName}</strong>
                  </p>
                  <p>- Age: {booking.patientAge ?? "-"}</p>
                  <p>🚨 Emergency: {booking.emergencyType || "General"}</p>
                </div>

                <StatusBadge status={booking.status} />
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
