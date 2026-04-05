import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import useSocket from "../hooks/useSocket";
import { getDefaultRouteForRole } from "../utils/roleRoutes";

const Navbar = () => {
  const { user, isAuthenticated, logout, hasRole } = useAuth();

    const { connected } = useSocket();

  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
    setMenuOpen(false);
  };

  const isActive = (path) => location.pathname === path;
  const homeRoute = getDefaultRouteForRole(user?.role);

  if (!isAuthenticated) return null;

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        {/* Brand */}
        <Link to={homeRoute} className="navbar-brand">
          <span className="navbar-logo">🚑</span>
          <span className="navbar-title">AmbulanceApp</span>
        </Link>

        {/* Desktop Nav Links */}
        <div className="navbar-links">
          <Link
            to={homeRoute}
            className={`nav-link ${isActive(homeRoute) ? "nav-link--active" : ""}`}
          >
            Dashboard
          </Link>

          {hasRole("user") && (
            <Link
              to="/book"
              className={`nav-link ${isActive("/book") ? "nav-link--active" : ""}`}
            >
              Book Ambulance
            </Link>
          )}

          {hasRole("user", "admin", "driver") && (
            <Link
              to="/history"
              className={`nav-link ${isActive("/history") ? "nav-link--active" : ""}`}
            >
              History
            </Link>
          )}

          {hasRole("admin") && (
            <Link
              to="/admin"
              className={`nav-link ${isActive("/admin") ? "nav-link--active" : ""}`}
            >
              Admin
            </Link>
          )}
        </div>

        {/* Right section */}
        <div className="navbar-right">
          {/* ✅ Socket status */}
          <div
            className="socket-indicator"
            title={connected ? "Connected" : "Disconnected"}
          >
            <span
              className={`dot ${connected ? "dot--green" : "dot--red"}`}
            />
            <span className="socket-label">
              {connected ? "Live" : "Offline"}
            </span>
          </div>

          {/* User Menu */}
          <div className="user-menu">
            <button
              className="user-menu-btn"
              onClick={() => setMenuOpen((o) => !o)}
            >
              <div className="avatar">
                {user?.name?.charAt(0)?.toUpperCase()}
              </div>
              <span className="user-name">{user?.name}</span>
              <span className="chevron">{menuOpen ? "▲" : "▼"}</span>
            </button>

            {menuOpen && (
              <div className="dropdown">
                <div className="dropdown-header">
                  <p className="dropdown-name">{user?.name}</p>
                  <p className="dropdown-role">{user?.role}</p>
                  <p className="dropdown-email">{user?.email}</p>
                </div>

                <hr className="dropdown-divider" />

                <button
                  className="dropdown-item dropdown-item--danger"
                  onClick={handleLogout}
                >
                  🚪 Sign Out
                </button>
              </div>
            )}
          </div>

          {/* Hamburger */}
          <button
            className="hamburger"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            {menuOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="mobile-menu">
          <Link
            to={homeRoute}
            className="mobile-link"
            onClick={() => setMenuOpen(false)}
          >
            Dashboard
          </Link>

          {hasRole("user") && (
            <Link
              to="/book"
              className="mobile-link"
              onClick={() => setMenuOpen(false)}
            >
              Book Ambulance
            </Link>
          )}

          {hasRole("user", "admin", "driver") && (
            <Link
              to="/history"
              className="mobile-link"
              onClick={() => setMenuOpen(false)}
            >
              History
            </Link>
          )}

          {hasRole("admin") && (
            <Link
              to="/admin"
              className="mobile-link"
              onClick={() => setMenuOpen(false)}
            >
              Admin Panel
            </Link>
          )}

          <button
            className="mobile-link mobile-link--danger"
            onClick={handleLogout}
          >
            Sign Out
          </button>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
