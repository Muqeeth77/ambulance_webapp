import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import bookingService from "../services/bookingService";
import BookingCard from "../components/BookingCard";
import Loader from "../components/Loader";
import toast from "react-hot-toast";
import useSocketEvent from "../hooks/useSocketEvent";

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "accepted", label: "Accepted" },
  { value: "en_route", label: "En Route" },
  { value: "arrived", label: "Arrived" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const BookingHistory = () => {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const LIMIT = 8;

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    try {
      const data = await bookingService.getAll({
        status: filter || undefined,
        page,
        limit: LIMIT,
      });
      setBookings(data.bookings || []);
      setTotalPages(data.pages || 1);
      setTotal(data.total || 0);
    } catch (err) {
      toast.error("Failed to load bookings.");
    } finally {
      setLoading(false);
    }
  }, [filter, page]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  // 🔥 booking created
  useSocketEvent("booking_created", () => {
    fetchBookings();
  });

  // 🔥 NEW: booking updated (IMPORTANT)
  useSocketEvent("booking_updated", () => {
    fetchBookings();
  });

  // Reset page when filter changes
  useEffect(() => {
    setPage(1);
  }, [filter]);

  return (
    <div className="page">
      <div className="hero-panel hero-panel--history">
        <div className="hero-panel-content">
          <div>
            <div className="eyebrow">Ride Archive</div>
            <h1 className="hero-title">Booking history at a glance</h1>
            <p className="hero-copy">
              Review every request, inspect status changes, and jump back into live
              tracking whenever the situation needs more context.
            </p>
          </div>
          <div className="hero-metric-card">
            <span>Total Bookings</span>
            <strong>{total}</strong>
            <small>Filter quickly by lifecycle stage and revisit any emergency trip.</small>
          </div>
        </div>
      </div>

      <div className="page-header">
        <div>
          <h1>Booking History</h1>
          <p className="text-muted">{total} total bookings</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => navigate("/book")}
        >
          + New Booking
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="filter-tabs">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            className={`filter-tab ${filter === f.value ? "filter-tab--active" : ""}`}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <Loader text="Loading bookings..." />
      ) : bookings.length === 0 ? (
        <div className="empty-state">
          <span>🗒️</span>
          <p>No bookings found{filter ? ` with status "${filter}"` : ""}.</p>
          <button
            className="btn btn-primary"
            onClick={() => navigate("/book")}
          >
            Book an Ambulance
          </button>
        </div>
      ) : (
        <>
          <div className="bookings-list">
            {bookings.map((booking) => (
              <BookingCard
                key={booking._id}
                booking={booking}
                onTrack={() => navigate(`/track/${booking._id}`)}
                onRefresh={fetchBookings}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pagination">
              <button
                className="btn btn-outline btn-sm"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                ← Prev
              </button>
              <span className="pagination-info">
                Page {page} of {totalPages}
              </span>
              <button
                className="btn btn-outline btn-sm"
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default BookingHistory;
