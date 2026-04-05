import api from "../config/api";

const bookingService = {
  /**
   * Create a new booking
   */
  create: async (data) => {
    const res = await api.post("/bookings", data);
    return res.data;
  },

  /**
   * Get all bookings (paginated)
   */
  getAll: async ({ status, page = 1, limit = 10 } = {}) => {
    const params = { page, limit };
    if (status) params.status = status;
    const res = await api.get("/bookings", { params });
    return res.data;
  },

  /**
   * Get single booking by ID
   */
  getById: async (id) => {
    const res = await api.get(`/bookings/${id}`);
    return res.data;
  },

  /**
   * Accept a booking (driver)
   */
  accept: async (id, data = {}) => {
    const res = await api.patch(`/bookings/${id}/accept`, data);
    return res.data;
  },

  /**
   * Decline a booking and trigger reassignment
   */
  decline: async (id, data = {}) => {
    const res = await api.patch(`/bookings/${id}/decline`, data);
    return res.data;
  },

  /**
   * Update booking status (driver/admin)
   */
  updateStatus: async (id, status) => {
    const res = await api.patch(`/bookings/${id}/status`, { status });
    return res.data;
  },

  /**
   * Cancel a booking
   */
  cancel: async (id, reason = "") => {
    const res = await api.patch(`/bookings/${id}/cancel`, { reason });
    return res.data;
  },

  /**
   * Rate a completed booking
   */
  rate: async (id, rating, feedback = "") => {
    const res = await api.post(`/bookings/${id}/rate`, { rating, feedback });
    return res.data;
  },
};

export default bookingService;
