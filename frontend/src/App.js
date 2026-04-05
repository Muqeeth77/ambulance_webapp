import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import { AuthProvider } from "./context/AuthContext";
import { SocketProvider } from "./context/SocketContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Navbar from "./components/Navbar";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import BookAmbulance from "./pages/BookAmbulance";
import TrackAmbulance from "./pages/TrackAmbulance";
import BookingHistory from "./pages/BookingHistory";
import AdminPanel from "./pages/AdminPanel";
import PoliceDashboard from "./pages/PoliceDashboard";
import DriverSimulator from "./pages/DriverSimulator";
import DriverDashboard from "./pages/DriverDashboard";

const App = () => {
  return (
    <AuthProvider>
      <SocketProvider>
        <Router>
          <Navbar />

          <main className="main-content">
            <Routes>

              {/* 🔥 ALWAYS START HERE */}
              <Route path="/" element={<Navigate to="/login" />} />

              {/* 🌐 PUBLIC ROUTES */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/simulate-driver" element={<DriverSimulator />} />

              {/* 👤 USER DASHBOARD */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute allowedRoles={["user", "admin"]}>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />

              {/* 🚓 POLICE DASHBOARD */}
              <Route
                path="/police-dashboard"
                element={
                  <ProtectedRoute allowedRoles={["police"]}>
                    <PoliceDashboard />
                  </ProtectedRoute>
                }
              />

              {/* 🚑 DRIVER DASHBOARD */}
              <Route
                path="/driver-dashboard"
                element={
                  <ProtectedRoute allowedRoles={["driver"]}>
                    <DriverDashboard />
                  </ProtectedRoute>
                }
              />

              {/* 🛠 ADMIN PANEL */}
              <Route
                path="/admin"
                element={
                  <ProtectedRoute allowedRoles={["admin"]}>
                    <AdminPanel />
                  </ProtectedRoute>
                }
              />

              {/* 🚑 BOOK */}
              <Route
                path="/book"
                element={
                  <ProtectedRoute allowedRoles={["user"]}>
                    <BookAmbulance />
                  </ProtectedRoute>
                }
              />

              {/* 📍 TRACK */}
              <Route
                path="/track/:bookingId"
                element={
                  <ProtectedRoute allowedRoles={["user", "admin"]}>
                    <TrackAmbulance />
                  </ProtectedRoute>
                }
              />

              {/* 📜 HISTORY */}
              <Route
                path="/history"
                element={
                  <ProtectedRoute allowedRoles={["user", "admin", "driver"]}>
                    <BookingHistory />
                  </ProtectedRoute>
                }
              />

              {/* ❌ FALLBACK */}
              <Route path="*" element={<Navigate to="/login" />} />

            </Routes>
          </main>
        </Router>
      </SocketProvider>
    </AuthProvider>
  );
};

export default App;
