import api from "../config/api";

const ambulanceService = {
  /**
   * Get nearby ambulances
   */
  getNearby: async ({ lat, lng, maxDistance = 10000, type } = {}) => {
    const params = { lat, lng, maxDistance };
    if (type) params.type = type;
    const res = await api.get("/ambulances/nearby", { params });
    return res.data.ambulances;
  },

  /**
   * Get all ambulances (admin)
   */
  getAll: async ({ status, type, page = 1, limit = 10 } = {}) => {
    const params = { page, limit };
    if (status) params.status = status;
    if (type) params.type = type;
    const res = await api.get("/ambulances", { params });
    return res.data;
  },

  /**
   * Get single ambulance
   */
  getById: async (id) => {
    const res = await api.get(`/ambulances/${id}`);
    return res.data.ambulance;
  },

  /**
   * Create ambulance (admin)
   */
  create: async (data) => {
    const res = await api.post("/ambulances", data);
    return res.data.ambulance;
  },

  /**
   * Update ambulance (admin)
   */
  update: async (id, data) => {
    const res = await api.put(`/ambulances/${id}`, data);
    return res.data.ambulance;
  },

  /**
   * Update ambulance status (driver/admin)
   */
  updateStatus: async (id, status) => {
    const res = await api.patch(`/ambulances/${id}/status`, { status });
    return res.data.ambulance;
  },

  /**
   * Delete ambulance (admin)
   */
  delete: async (id) => {
    const res = await api.delete(`/ambulances/${id}`);
    return res.data;
  },

  /**
   * Get nearby hospitals
   */
  getNearbyHospitals: async ({ lat, lng, maxDistance = 20000 } = {}) => {
    const res = await api.get("/hospitals/nearby", {
      params: { lat, lng, maxDistance },
    });
    return res.data.hospitals;
  },
};

export default ambulanceService;