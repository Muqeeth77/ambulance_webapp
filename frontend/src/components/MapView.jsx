import React, { useEffect, useRef } from "react";

const MapView = ({
  center,
  userLocation,
  ambulances = [],
  height = "350px",
  autoCenter = false,
}) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const polylineRef = useRef(null);
  const lastCenterRef = useRef(null);

  useEffect(() => {
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    const loadLeaflet = () => {
      return new Promise((resolve) => {
        if (window.L) {
          resolve(window.L);
          return;
        }

        const script = document.createElement("script");
        script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
        script.onload = () => resolve(window.L);
        script.onerror = () => resolve(null);
        document.body.appendChild(script);
      });
    };

    loadLeaflet().then((L) => {
      if (!L || !mapRef.current) return;

      const lat = center?.lat || 17.385;
      const lng = center?.lng || 78.4867;

      if (!mapInstanceRef.current) {
        mapInstanceRef.current = L.map(mapRef.current).setView([lat, lng], 14);
        lastCenterRef.current = [lat, lng];

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap",
        }).addTo(mapInstanceRef.current);
      }

      const map = mapInstanceRef.current;

      if (autoCenter) {
        const lastCenter = lastCenterRef.current;
        const centerChanged =
          !lastCenter || lastCenter[0] !== lat || lastCenter[1] !== lng;

        if (centerChanged) {
          map.panTo([lat, lng], { animate: true });
          lastCenterRef.current = [lat, lng];
        }
      }

      markersRef.current.forEach((marker) => map.removeLayer(marker));
      markersRef.current = [];

      if (polylineRef.current) {
        map.removeLayer(polylineRef.current);
        polylineRef.current = null;
      }

      if (userLocation) {
        const userIcon = L.divIcon({
          html: `<div style="
            background:#e53e3e;
            width:14px;height:14px;
            border-radius:50%;
            border:3px solid white;
            box-shadow:0 0 6px rgba(0,0,0,0.5);
          "></div>`,
          iconSize: [14, 14],
        });

        const marker = L.marker([userLocation.lat, userLocation.lng], {
          icon: userIcon,
        }).addTo(map);

        markersRef.current.push(marker);
      }

      ambulances.forEach((ambulance) => {
        const [ambLng, ambLat] = ambulance.location.coordinates;

        const ambulanceIcon = L.divIcon({
          html: `<div style="
            font-size:22px;
            background:white;
            padding:4px 6px;
            border-radius:8px;
            border:2px solid red;
            box-shadow:0 2px 6px rgba(0,0,0,0.3);
          ">🚑</div>`,
          iconSize: [40, 30],
          iconAnchor: [20, 15],
        });

        const marker = L.marker([ambLat, ambLng], { icon: ambulanceIcon }).addTo(map);
        markersRef.current.push(marker);

        if (userLocation) {
          polylineRef.current = L.polyline(
            [
              [ambLat, ambLng],
              [userLocation.lat, userLocation.lng],
            ],
            { color: "red", weight: 4 }
          ).addTo(map);
        }
      });
    });
  }, [center, userLocation, ambulances]);

  return (
    <div
      ref={mapRef}
      style={{
        height,
        width: "100%",
        borderRadius: "12px",
        overflow: "hidden",
      }}
    />
  );
};

export default MapView;
