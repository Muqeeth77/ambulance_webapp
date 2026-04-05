import React from "react";
import StatusBadge from "./StatusBadge";

const TYPE_ICONS = {
  basic: "🚑",
  advanced: "🏥",
  icu: "💊",
  neonatal: "👶",
};

const AmbulanceCard = ({ ambulance, onSelect, selected }) => {
  const icon = TYPE_ICONS[ambulance.type] || "🚑";

  return (
    <div
      className={`ambulance-card ${selected ? "ambulance-card--selected" : ""} ${
        ambulance.status !== "available" ? "ambulance-card--disabled" : ""
      }`}
      onClick={() => ambulance.status === "available" && onSelect && onSelect(ambulance)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) =>
        e.key === "Enter" &&
        ambulance.status === "available" &&
        onSelect &&
        onSelect(ambulance)
      }
    >
      <div className="ambulance-card-header">
        <span className="ambulance-card-icon">{icon}</span>
        <div>
          <p className="ambulance-vehicle">{ambulance.vehicleNumber}</p>
          <p className="ambulance-type">{ambulance.type?.toUpperCase()}</p>
        </div>
        <StatusBadge status={ambulance.status} />
      </div>

      {ambulance.driver && (
        <div className="ambulance-driver">
          <span>👤</span>
          <span>{ambulance.driver.name}</span>
          {ambulance.driver.phone && (
            
              href={`tel:${ambulance.driver.phone}`}
              className="link"
              onClick={(e) => e.stopPropagation()}
            >
              📞
            </a>
          )}
        </div>
      )}

      {ambulance.equipment?.length > 0 && (
        <div className="ambulance-equipment">
          {ambulance.equipment.slice(0, 3).map((eq) => (
            <span key={eq} className="equipment-tag">
              {eq}
            </span>
          ))}
          {ambulance.equipment.length > 3 && (
            <span className="equipment-tag">+{ambulance.equipment.length - 3}</span>
          )}
        </div>
      )}

      {selected && (
        <div className="selected-indicator">✓ Selected</div>
      )}
    </div>
  );
};

export default AmbulanceCard;