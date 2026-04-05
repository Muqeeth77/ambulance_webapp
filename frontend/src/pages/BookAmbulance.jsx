import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import useLocation from "../hooks/useLocation";
import bookingService from "../services/bookingService";
import MapView from "../components/MapView";
import Loader from "../components/Loader";
import toast from "react-hot-toast";

const AMBULANCE_TYPES = [
  { value: "basic", label: "Basic Life Support" },
  { value: "advanced", label: "Advanced Life Support" },
  { value: "icu", label: "ICU Ambulance" },
  { value: "neonatal", label: "Neonatal" },
];

const EMERGENCY_TYPES = [
  "General",
  "Heart Attack",
  "Accident",
  "Stroke",
  "Pregnancy",
  "Other",
];

const styles = {
  page: {
    padding: "20px",
  },
  card: {
    background: "#fff",
    padding: "20px",
    borderRadius: "16px",
    boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
    marginBottom: "20px",
    border: "1px solid #e2e8f0",
  },
  input: {
    width: "100%",
    padding: "12px 14px",
    marginBottom: "12px",
    borderRadius: "10px",
    border: "1px solid #cbd5e1",
    fontSize: "15px",
  },
  typeWrap: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    marginBottom: "14px",
  },
  typeButton: {
    padding: "10px 14px",
    borderRadius: "10px",
    background: "#fff",
    cursor: "pointer",
  },
  submit: {
    width: "100%",
    padding: "14px",
    background: "#dc2626",
    color: "#fff",
    border: "none",
    borderRadius: "12px",
    fontWeight: 700,
    fontSize: "15px",
    cursor: "pointer",
  },
  assignedCard: {
    background: "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)",
    border: "1px solid #34d399",
    borderRadius: "16px",
    padding: "16px 18px",
    marginBottom: "16px",
    boxShadow: "0 10px 24px rgba(16, 185, 129, 0.12)",
  },
  assignedLabel: {
    fontSize: "12px",
    fontWeight: 800,
    color: "#047857",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  assignedTitle: {
    marginTop: "6px",
    fontSize: "24px",
    fontWeight: 800,
    color: "#064e3b",
  },
  assignedText: {
    marginTop: "4px",
    color: "#065f46",
    fontSize: "14px",
  },
};

const fallbackAmbulances = (location) => [
  {
    _id: "AMB-1",
    vehicleNumber: "TS09AB1001",
    driver: { name: "Driver 1" },
    location: { coordinates: [location.lng + 0.002, location.lat + 0.002] },
  },
  {
    _id: "AMB-2",
    vehicleNumber: "TS09AB1002",
    driver: { name: "Driver 2" },
    location: { coordinates: [location.lng - 0.002, location.lat - 0.001] },
  },
  {
    _id: "AMB-3",
    vehicleNumber: "TS09AB1003",
    driver: { name: "Driver 3" },
    location: { coordinates: [location.lng + 0.001, location.lat - 0.002] },
  },
];

const BookAmbulance = () => {
  const navigate = useNavigate();
  const { location, loading: locLoading, getLocation } = useLocation();

  const [form, setForm] = useState({
    ambulanceType: "basic",
    patientName: "",
    patientAge: "",
    emergencyType: "General",
  });

  const [submitting, setSubmitting] = useState(false);
  const [nearbyAmbulances, setNearbyAmbulances] = useState([]);
  const [assignedAmbulance, setAssignedAmbulance] = useState(null);
  const selectedAmbulanceType = useMemo(
    () => AMBULANCE_TYPES.find((type) => type.value === form.ambulanceType),
    [form.ambulanceType]
  );

  const handleSubmit = async () => {
    if (!form.patientName) {
      toast.error("Enter patient name");
      return;
    }

    if (!location) {
      toast.error("Getting location...");
      getLocation();
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        pickupLocation: {
          type: "Point",
          coordinates: [location.lng, location.lat],
        },
        ambulanceType: form.ambulanceType,
        patientName: form.patientName,
        patientAge: form.patientAge,
        emergencyType: form.emergencyType,
      };

      const res = await bookingService.create(payload);
      const demoAmbulances = res.allAmbulances || fallbackAmbulances(location);
      const nearestAmbulance = res.assignedAmbulance || demoAmbulances[0] || null;

      setNearbyAmbulances(demoAmbulances);
      setAssignedAmbulance(nearestAmbulance);

      toast.success("Nearest ambulance assigned.");

      window.setTimeout(() => {
        navigate(`/track/${res.booking._id}`);
      }, 1500);
    } catch (err) {
      toast.error("Booking failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (locLoading) return <Loader text="Getting location..." />;

  return (
    <div className="page">
      <div className="hero-panel hero-panel--booking">
        <div className="hero-panel-content">
          <div>
            <div className="eyebrow">Emergency Request</div>
            <h1 className="hero-title">Book an ambulance in seconds</h1>
            <p className="hero-copy">
              Confirm patient details, choose the right ambulance type, and let the
              system assign the nearest response unit.
            </p>
          </div>
          <div className="hero-metric-card">
            <span>Selected Service</span>
            <strong>{selectedAmbulanceType?.label || "Basic Life Support"}</strong>
            <small>{location ? "Pickup is linked to your live location." : "Waiting for location permission."}</small>
          </div>
        </div>
      </div>

      <div className="booking-layout">
        <div className="booking-panel">
          <div style={styles.card}>
            <input
              type="text"
              placeholder="Patient Name"
              value={form.patientName}
              onChange={(e) => setForm({ ...form, patientName: e.target.value })}
              style={styles.input}
            />

            <input
              type="number"
              placeholder="Patient Age"
              value={form.patientAge}
              onChange={(e) => setForm({ ...form, patientAge: e.target.value })}
              style={styles.input}
            />

            <select
              value={form.emergencyType}
              onChange={(e) => setForm({ ...form, emergencyType: e.target.value })}
              style={styles.input}
            >
              {EMERGENCY_TYPES.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>

            <div style={styles.typeWrap}>
              {AMBULANCE_TYPES.map((type) => (
                <button
                  key={type.value}
                  onClick={() => setForm({ ...form, ambulanceType: type.value })}
                  style={{
                    ...styles.typeButton,
                    border:
                      form.ambulanceType === type.value
                        ? "2px solid #dc2626"
                        : "1px solid #cbd5e1",
                    color: form.ambulanceType === type.value ? "#b91c1c" : "#334155",
                    fontWeight: form.ambulanceType === type.value ? 700 : 500,
                  }}
                >
                  {type.label}
                </button>
              ))}
            </div>

            <button onClick={handleSubmit} disabled={submitting} style={styles.submit}>
              {submitting ? "Booking..." : "Confirm Booking"}
            </button>
          </div>

          {assignedAmbulance && (
            <div style={styles.assignedCard}>
              <div style={styles.assignedLabel}>Nearest Ambulance Assigned</div>
              <div style={styles.assignedTitle}>{assignedAmbulance._id}</div>
              <div style={styles.assignedText}>
                Driver: {assignedAmbulance.driver?.name || "Driver"}
              </div>
              <div style={styles.assignedText}>
                Vehicle: {assignedAmbulance.vehicleNumber || "Demo ambulance"}
              </div>
            </div>
          )}
        </div>

        <div className="booking-panel">
          <h3>Nearby Ambulances ({nearbyAmbulances.length})</h3>

          {location && (
            <MapView
              center={{ lat: location.lat, lng: location.lng }}
              userLocation={location}
              ambulances={nearbyAmbulances}
              height="350px"
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default BookAmbulance;
