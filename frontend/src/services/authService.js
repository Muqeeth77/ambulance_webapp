import api from "../config/api";

const authService = {
  /**
   * Register a new user
   */
  register: async (data) => {
    const res = await api.post("/auth/register", data);
    return res.data;
  },

  /**
   * Login user
   */
  login: async (email, password, fcmToken = null) => {
    const res = await api.post("/auth/login", { email, password, fcmToken });
    return res.data;
  },

  /**
   * Get current logged-in user
   */
  getMe: async () => {
    const res = await api.get("/auth/me");
    return res.data.user;
  },

  /**
   * Update user profile
   */
  updateProfile: async (data) => {
    const res = await api.put("/auth/me", data);
    return res.data.user;
  },

  /**
   * Change password
   */
  changePassword: async (currentPassword, newPassword) => {
    const res = await api.put("/auth/change-password", {
      currentPassword,
      newPassword,
    });
    return res.data;
  },

  /**
   * Logout
   */
  logout: async () => {
    const res = await api.post("/auth/logout");
    return res.data;
  },
};

export default authService;