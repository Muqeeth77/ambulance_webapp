const NodeGeocoder = require("node-geocoder");
const logger = require("./logger");

const getGeocoder = () => {
  return NodeGeocoder({
    provider: process.env.GEOCODER_PROVIDER || "openstreetmap",
    apiKey: process.env.GEOCODER_API_KEY,
    formatter: null,
  });
};

/**
 * Convert an address string to coordinates
 * @returns {{ lat: number, lng: number, formattedAddress: string } | null}
 */
const geocodeAddress = async (address) => {
  try {
    const geocoder = getGeocoder();
    const results = await geocoder.geocode(address);
    if (!results || results.length === 0) return null;

    const { latitude, longitude, formattedAddress } = results[0];
    return { lat: latitude, lng: longitude, formattedAddress };
  } catch (err) {
    logger.error("Geocoding error:", err.message);
    return null;
  }
};

/**
 * Convert coordinates to a human-readable address
 * @returns {string | null}
 */
const reverseGeocode = async (lat, lng) => {
  try {
    const geocoder = getGeocoder();
    const results = await geocoder.reverse({ lat, lon: lng });
    if (!results || results.length === 0) return null;
    return results[0].formattedAddress || null;
  } catch (err) {
    logger.error("Reverse geocoding error:", err.message);
    return null;
  }
};

/**
 * Calculate straight-line distance between two lat/lng points (Haversine)
 * @returns {number} distance in kilometers
 */
const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(2));
};

module.exports = { geocodeAddress, reverseGeocode, calculateDistance };