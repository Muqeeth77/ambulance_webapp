import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/global.css";
import { Toaster } from "react-hot-toast";
import "leaflet/dist/leaflet.css";

const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <React.StrictMode>
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: {
          borderRadius: "10px",
          fontFamily: "Inter, sans-serif",
          fontSize: "14px",
        },
        success: { iconTheme: { primary: "#38a169", secondary: "#fff" } },
        error: { iconTheme: { primary: "#e53e3e", secondary: "#fff" } },
      }}
    />
    <App />
  </React.StrictMode>
);