import React, { useState, useEffect, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
} from "react-leaflet";
import useSocketEvent from "../hooks/useSocketEvent";
import useSocket from "../hooks/useSocket";
import useAuth from "../hooks/useAuth";
import useInAppCall from "../hooks/useInAppCall";
import useLocation from "../hooks/useLocation";
import { getRoadRoute } from "../services/routingService";
import L from "leaflet";

// Fix marker icons
delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
  iconUrl:
    "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
});

const ambulanceIcon = new L.DivIcon({
  html: "<div style='font-size:30px;'>&#128657;</div>",
  iconSize: [40, 40],
});

const emergencyIcon = new L.DivIcon({
  html: "<div style='font-size:32px;color:red;'>&#128657;</div>",
  iconSize: [40, 40],
});

const policeIcon = new L.DivIcon({
  html: "<div style='font-size:28px;'>&#128110;</div>",
  iconSize: [40, 40],
});

const destinationIcon = new L.DivIcon({
  html: "<div style='font-size:24px;'>&#127973;</div>",
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

const livePoliceIcon = new L.DivIcon({
  html: "<div style='font-size:28px;'>📍👮</div>",
  iconSize: [44, 44],
  iconAnchor: [22, 22],
});

const policeStyles = {
  alertsSection: {
    marginTop: "20px",
  },
  alertsTitle: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "14px",
    color: "#1a202c",
  },
  alertStack: {
    display: "grid",
    gap: "12px",
  },
  alertCard: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
    padding: "16px 18px",
    borderRadius: "16px",
    background: "linear-gradient(135deg, #fff5f5 0%, #fed7d7 100%)",
    border: "1px solid #fc8181",
    boxShadow: "0 12px 28px rgba(229, 62, 62, 0.14)",
  },
  alertMeta: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  alertIcon: {
    width: "42px",
    height: "42px",
    borderRadius: "12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#c53030",
    color: "#ffffff",
    fontSize: "18px",
    fontWeight: 700,
    flexShrink: 0,
  },
  alertTitle: {
    margin: 0,
    fontSize: "16px",
    fontWeight: 700,
    color: "#742a2a",
  },
  alertText: {
    margin: "2px 0 0",
    fontSize: "13px",
    color: "#9b2c2c",
  },
  ackButton: {
    padding: "10px 16px",
    borderRadius: "999px",
    background: "#c53030",
    color: "#ffffff",
    fontSize: "13px",
    fontWeight: 700,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    boxShadow: "0 8px 20px rgba(197, 48, 48, 0.28)",
  },
  emptyAlerts: {
    padding: "18px",
    borderRadius: "14px",
    background: "#f7fafc",
    border: "1px dashed #cbd5e0",
    color: "#718096",
  },
  callCard: {
    marginBottom: "16px",
    padding: "16px 18px",
    borderRadius: "16px",
    background: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)",
    border: "1px solid #93c5fd",
    color: "#1d4ed8",
  },
};

const PoliceDashboard = () => {
  const { user } = useAuth();
  const { location: livePoliceLocation, watchLocation } = useLocation();
  const [realAmbulances, setRealAmbulances] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [demoAmbulances, setDemoAmbulances] = useState([]);

  const policePosition = [17.385, 78.486];
  const livePolicePosition = livePoliceLocation
    ? [livePoliceLocation.lat, livePoliceLocation.lng]
    : null;
  const { socket } = useSocket();

  const audioRef = useRef(null);
  const isUnlockedRef = useRef(false);
  const alertIdRef = useRef(0);
  const alertCountRef = useRef({});
  const alertTimeoutsRef = useRef({});
  const {
    callStatus,
    incomingCall,
    activeCall,
    remoteAudioRef,
    acceptCall,
    rejectCall,
    endCall,
  } = useInAppCall({
    socket,
    role: "police",
    displayName: user?.name || "Police",
  });

  const removeAlert = (alertId) => {
    if (alertTimeoutsRef.current[alertId]) {
      window.clearTimeout(alertTimeoutsRef.current[alertId]);
      delete alertTimeoutsRef.current[alertId];
    }
    setAlerts((prev) => prev.filter((alert) => alert.id !== alertId));
  };

  const scheduleAlertRemoval = (alertId) => {
    if (alertTimeoutsRef.current[alertId]) return;

    alertTimeoutsRef.current[alertId] = window.setTimeout(() => {
      removeAlert(alertId);
    }, 10000);
  };

  useEffect(() => {
    if (!socket) return;

    const handleConnect = () => {
      console.log("Connected:", socket.id);
    };

    socket.on("connect", handleConnect);

    return () => {
      socket.off("connect", handleConnect);
    };
  }, [socket]);

  useEffect(() => {
    const stopWatching = watchLocation();
    return () => {
      if (typeof stopWatching === "function") {
        stopWatching();
      }
    };
  }, [watchLocation]);

  useEffect(() => {
    audioRef.current = new Audio(
      "https://actions.google.com/sounds/v1/alarms/beep_short.ogg"
    );

    const unlockAudio = () => {
      audioRef.current
        ?.play()
        .then(() => {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
          isUnlockedRef.current = true;
        })
        .catch(() => {});
    };

    window.addEventListener("click", unlockAudio, { once: true });
    return () => window.removeEventListener("click", unlockAudio);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadDemoRoutes = async () => {
      const demoPairs = [
        [
          [17.385, 78.486],
          [17.3925, 78.4795],
        ],
        [
          [17.385, 78.486],
          [17.3785, 78.4945],
        ],
      ];

      const routes = await Promise.all(
        demoPairs.map(([start, end]) => getRoadRoute(start, end))
      );

      if (!isMounted) return;

      setDemoAmbulances(
        routes.map((route, index) => ({
          id: "DEMO-" + index,
          route,
          index: 0,
        }))
      );
    };

    loadDemoRoutes();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!socket) return;

    const interval = setInterval(() => {
      setDemoAmbulances((prev) =>
        prev.map((ambulance) => {
          const newIndex = (ambulance.index + 1) % ambulance.route.length;

          socket.emit("ambulance_location_update", {
            id: ambulance.id,
            lat: ambulance.route[newIndex][0],
            lng: ambulance.route[newIndex][1],
          });

          return { ...ambulance, index: newIndex };
        })
      );
    }, 1500);

    return () => clearInterval(interval);
  }, [socket]);

  useSocketEvent("ambulance_request", (data) => {
    setRealAmbulances((prev) => {
      const nextAmbulance = {
        id: data.id,
        route: [data.pickupCoords],
        emergency: false,
        pickupCoords: data.pickupCoords,
        destinationCoords: data.hospitalCoords,
      };

      const remaining = prev.filter((ambulance) => ambulance.id !== data.id);
      return [nextAmbulance, ...remaining];
    });
  });

  useSocketEvent("ambulance_location_update", (data) => {
    setRealAmbulances((prev) =>
      prev.map((ambulance) =>
        ambulance.id === data.id
          ? { ...ambulance, route: [...ambulance.route, [data.lat, data.lng]] }
          : ambulance
      )
    );
  });

  useSocketEvent("ambulance_trip_completed", (data) => {
    setRealAmbulances((prev) =>
      prev.filter((ambulance) => ambulance.id !== data.id)
    );
  });

  useSocketEvent("ambulance_emergency", (data) => {
    setRealAmbulances((prev) =>
      prev.map((ambulance) =>
        ambulance.id === data.id
          ? { ...ambulance, emergency: true }
          : ambulance
      )
    );

    const nextCount = (alertCountRef.current[data.id] || 0) + 1;
    const alertId = alertIdRef.current++;

    alertCountRef.current[data.id] = nextCount;

    setAlerts((prev) => {
      prev.forEach((alert) => {
        scheduleAlertRemoval(alert.id);
      });

      return [
        {
          ...data,
          id: alertId,
          ambulanceId: data.id,
          displayId: nextCount > 1 ? `${data.id} (${nextCount})` : data.id,
        },
        ...prev,
      ];
    });

    if (audioRef.current && isUnlockedRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
  });

  return (
    <div style={{ padding: "20px" }}>
      <h1>Police Dashboard</h1>

      {(incomingCall || callStatus === "connecting" || callStatus === "in_call") && (
        <div style={policeStyles.callCard}>
          {incomingCall && (
            <>
              <div><strong>Incoming Driver Call</strong></div>
              <div style={{ marginTop: "6px" }}>
                {incomingCall.fromName || incomingCall.fromRole} is calling police support.
              </div>
              <div style={{ display: "flex", gap: "10px", marginTop: "14px" }}>
                <button style={policeStyles.ackButton} onClick={acceptCall}>
                  Accept
                </button>
                <button style={policeStyles.ackButton} onClick={rejectCall}>
                  Reject
                </button>
              </div>
            </>
          )}

          {!incomingCall && (
            <>
              <div><strong>Driver Call Active</strong></div>
              <div style={{ marginTop: "6px" }}>
                {callStatus === "connecting"
                  ? "Connecting audio..."
                  : `Connected with ${activeCall?.otherName || "driver"}.`}
              </div>
              <div style={{ display: "flex", gap: "10px", marginTop: "14px" }}>
                <button style={policeStyles.ackButton} onClick={() => endCall()}>
                  End Call
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <MapContainer
        center={livePolicePosition || policePosition}
        zoom={13}
        style={{ height: "500px", width: "100%" }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        <Marker position={policePosition} icon={policeIcon}>
          <Popup>Demo Police</Popup>
        </Marker>

        {livePolicePosition && (
          <Marker position={livePolicePosition} icon={livePoliceIcon}>
            <Popup>{user?.name ? `${user.name} (Live Police)` : "Live Police"}</Popup>
          </Marker>
        )}

        {demoAmbulances.map((ambulance, index) => (
          <Marker
            key={index}
            position={ambulance.route[ambulance.index]}
            icon={ambulanceIcon}
          />
        ))}

        {realAmbulances.map((ambulance) => {
          const lastPosition = ambulance.route[ambulance.route.length - 1];
          return (
            <React.Fragment key={ambulance.id}>
              <Marker
                position={lastPosition}
                icon={ambulance.emergency ? emergencyIcon : ambulanceIcon}
              >
                <Popup>{ambulance.id}</Popup>
              </Marker>

              {ambulance.destinationCoords && (
                <Marker
                  position={ambulance.destinationCoords}
                  icon={destinationIcon}
                >
                  <Popup>{`Destination for ${ambulance.id}`}</Popup>
                </Marker>
              )}
            </React.Fragment>
          );
        })}

        {realAmbulances.map((ambulance) => (
          <Polyline key={ambulance.id} positions={ambulance.route} />
        ))}
      </MapContainer>

      <div style={policeStyles.alertsSection}>
        <h2 style={policeStyles.alertsTitle}>Alert Center</h2>

        {alerts.length === 0 ? (
          <div style={policeStyles.emptyAlerts}>
            No active emergency acknowledgements right now.
          </div>
        ) : (
          <div style={policeStyles.alertStack}>
            {alerts.map((alert, index) => (
              <div key={alert.id} style={policeStyles.alertCard}>
                <div style={policeStyles.alertMeta}>
                  <div style={policeStyles.alertIcon}>!</div>
                  <div>
                    <p style={policeStyles.alertTitle}>{alert.displayId}</p>
                    <p style={policeStyles.alertText}>
                      Emergency request received. Confirm police response for this ambulance.
                    </p>
                  </div>
                </div>

                <button
                  style={policeStyles.ackButton}
                  onClick={() => {
                    removeAlert(alert.id);
                    socket?.emit("police_acknowledged", { id: alert.ambulanceId });
                  }}
                >
                  ACK Now
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <audio ref={remoteAudioRef} autoPlay />
    </div>
  );
};

export default PoliceDashboard;

