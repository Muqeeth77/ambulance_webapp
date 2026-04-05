import React, { createContext, useState, useEffect, useCallback } from "react";
import api from "../config/api";
import { requestFCMToken, onForegroundMessage } from "../firebase";
import toast from "react-hot-toast";

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(
    JSON.parse(sessionStorage.getItem("user")) || null
  );
  const [token, setToken] = useState(sessionStorage.getItem("token") || null);
  const [loading, setLoading] = useState(true);

  // ✅ ALWAYS attach token to axios
  useEffect(() => {
    if (token) {
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    } else {
      delete api.defaults.headers.common["Authorization"];
    }
  }, [token]);

  // ✅ Restore session safely
  useEffect(() => {
    const restore = async () => {
      const savedToken = sessionStorage.getItem("token");
      const savedUser = sessionStorage.getItem("user");

      if (!savedToken || !savedUser) {
        setLoading(false);
        return;
      }

      try {
        setUser(JSON.parse(savedUser));
        setToken(savedToken);

        // OPTIONAL: verify token silently
        await api.get("/auth/me");
      } catch (err) {
        console.log("Auth restore failed:", err?.response?.status);

        // ❌ DO NOT immediately logout on failure
        // just keep local session (important fix)
      } finally {
        setLoading(false);
      }
    };

    restore();
  }, []);

  // 🔔 Notifications
  useEffect(() => {
    const unsubscribe = onForegroundMessage(({ title, body }) => {
      toast(`🔔 ${title}: ${body}`, { duration: 6000 });
    });
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, []);

  const login = useCallback(async (email, password) => {
    let fcmToken = null;
    try {
      fcmToken = await requestFCMToken();
    } catch (_) {}

    const res = await api.post("/auth/login", { email, password, fcmToken });

    const { token: newToken, user: loggedInUser } = res.data;

    sessionStorage.setItem("token", newToken);
    sessionStorage.setItem("user", JSON.stringify(loggedInUser));

    setToken(newToken);
    setUser(loggedInUser);

    return loggedInUser;
  }, []);

  const register = useCallback(async (formData) => {
    let fcmToken = null;
    try {
      fcmToken = await requestFCMToken();
    } catch (_) {}

    const res = await api.post("/auth/register", {
      ...formData,
      fcmToken,
    });

    const { token: newToken, user: newUser } = res.data;

    sessionStorage.setItem("token", newToken);
    sessionStorage.setItem("user", JSON.stringify(newUser));

    setToken(newToken);
    setUser(newUser);

    return newUser;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch (_) {}

    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");

    setToken(null);
    setUser(null);

    toast.success("Logged out successfully.");
  }, []);

  const updateUser = useCallback((updatedFields) => {
    setUser((prev) => {
      const updated = { ...prev, ...updatedFields };
      sessionStorage.setItem("user", JSON.stringify(updated));
      return updated;
    });
  }, []);

  const isAuthenticated = !!token && !!user;

  const hasRole = useCallback(
    (...roles) => {
      if (!user) return false;
      return roles.includes(user.role);
    },
    [user]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAuthenticated,
        login,
        register,
        logout,
        updateUser,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};