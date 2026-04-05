import React from "react";

const STATUS_CONFIG = {
  pending: { label: "Pending", color: "#d69e2e", bg: "#fefcbf", icon: "⏳" },
  accepted: { label: "Accepted", color: "#2b6cb0", bg: "#bee3f8", icon: "✅" },
  en_route: { label: "En Route", color: "#c05621", bg: "#feebc8", icon: "🚑" },
  arrived: { label: "Arrived", color: "#276749", bg: "#c6f6d5", icon: "📍" },
  completed: { label: "Completed", color: "#22543d", bg: "#9ae6b4", icon: "🎉" },
  cancelled: { label: "Cancelled", color: "#742a2a", bg: "#fed7d7", icon: "❌" },
  available: { label: "Available", color: "#276749", bg: "#c6f6d5", icon: "🟢" },
  busy: { label: "Busy", color: "#742a2a", bg: "#fed7d7", icon: "🔴" },
  offline: { label: "Offline", color: "#4a5568", bg: "#e2e8f0", icon: "⚫" },
  maintenance: { label: "Maintenance", color: "#744210", bg: "#fefcbf", icon: "🔧" },
};

const StatusBadge = ({ status, size = "md" }) => {
  const config = STATUS_CONFIG[status] || {
    label: status,
    color: "#4a5568",
    bg: "#e2e8f0",
    icon: "•",
  };

  return (
    <span
      className={`status-badge status-badge--${size}`}
      style={{ color: config.color, backgroundColor: config.bg }}
    >
      <span className="status-icon">{config.icon}</span>
      {config.label}
    </span>
  );
};

export default StatusBadge;