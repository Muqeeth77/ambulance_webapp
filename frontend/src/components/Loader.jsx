import React from "react";

const Loader = ({ text = "Loading...", fullScreen = false }) => {
  if (fullScreen) {
    return (
      <div className="loader-fullscreen">
        <div className="loader-content">
          <span className="loader-ambulance">🚑</span>
          <div className="loader-spinner" />
          <p className="loader-text">{text}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="loader-inline">
      <div className="loader-spinner" />
      <p className="loader-text">{text}</p>
    </div>
  );
};

export default Loader;