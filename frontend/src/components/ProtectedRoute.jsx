import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import Loader from "./Loader";
import { getDefaultRouteForRole } from "../utils/roleRoutes";

const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();

  // ⏳ WAIT until auth is ready (IMPORTANT FIX)
  if (loading) {
    return <Loader text="Authenticating..." fullScreen />;
  }

  // 🚫 NOT LOGGED IN
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // 🚫 ROLE NOT ALLOWED
  if (allowedRoles.length > 0 && !allowedRoles.includes(user?.role)) {
    return <Navigate to={getDefaultRouteForRole(user?.role)} replace />;
  }

  return children;
};

export default ProtectedRoute;
