import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import toast from "react-hot-toast";
import { getDefaultRouteForRole } from "../utils/roleRoutes";

const Login = () => {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  useEffect(() => {
    if (user) {
      navigate(getDefaultRouteForRole(user.role), { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.email || !form.password) {
      toast.error("Please fill in all fields.");
      return;
    }

    setLoading(true);

    try {
      const loggedInUser = await login(form.email, form.password);
      toast.success(`Welcome back, ${loggedInUser?.name || "User"}!`);
    } catch (err) {
      console.error("LOGIN ERROR:", err);
      toast.error(err.response?.data?.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-reference-page login-reference-page--ambulance">
      <div className="login-reference-backdrop login-reference-backdrop--dark" />

      <div className="login-reference-panel login-reference-panel--hero">
        <div className="login-reference-copy">
          <div className="login-reference-kicker">AMBULANCE APP</div>
          <h1>WHEN EVERY SECOND COUNTS</h1>
          <p>
            From alert to action in a heartbeat — because every second can save a life.
          </p>
        </div>

        <div className="login-reference-card">
          <form onSubmit={handleSubmit} className="login-reference-form">
            <div className="login-reference-field">
              <input
                id="email"
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="Username"
                autoComplete="email"
                disabled={loading}
                required
              />
              <span className="login-reference-icon">●</span>
            </div>

            <div className="login-reference-field">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="Password"
                autoComplete="current-password"
                disabled={loading}
                required
              />
              <button
                type="button"
                className="login-reference-toggle"
                onClick={() => setShowPassword((p) => !p)}
                tabIndex={-1}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>

            <button
              type="submit"
              className="login-reference-submit"
              disabled={loading}
            >
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>

          <div className="login-reference-links">
            <button type="button" className="login-reference-link">
              Forgot Password?
            </button>
            <Link to="/register" className="login-reference-link">
              Sign Up
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;

