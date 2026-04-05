import React, { useEffect } from "react";
import useSocket from "../hooks/useSocket";

const DriverSimulator = () => {
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;

    const id = "AMB-" + Math.floor(Math.random() * 1000);

    // 🚑 Send request once
    socket.emit("ambulance_request", {
      id,
      pickup: "City Center",
    });

    let lat = 17.385;
    let lng = 78.486;

    const interval = setInterval(() => {
      lat += Math.random() * 0.001;
      lng += Math.random() * 0.001;

      socket.emit("ambulance_location_update", {
        id,
        lat,
        lng,
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [socket]);

  return <h2>🚑 Driver Simulation Running...</h2>;
};

export default DriverSimulator;
