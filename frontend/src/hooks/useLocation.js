import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";

const DEFAULT_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 0,
};

const useLocation = (options = DEFAULT_OPTIONS) => {
  const [location, setLocation] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const onSuccess = useCallback((pos) => {
    const { latitude, longitude, accuracy, heading, speed } = pos.coords;
    setLocation({
      lat: latitude,
      lng: longitude,
      accuracy,
      heading: heading || 0,
      speed: speed || 0,
      timestamp: pos.timestamp,
    });
    setError(null);
    setLoading(false);
  }, []);

  const onError = useCallback((err) => {
    setError(err.message);
    setLoading(false);
    if (err.code === 1) {
      toast.error("Location access denied. Please enable GPS.");
    } else if (err.code === 2) {
      toast.error("Location unavailable. Check your GPS signal.");
    } else {
      toast.error("Location request timed out.");
    }
  }, []);

  const getLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      toast.error("Geolocation is not supported.");
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(onSuccess, onError, options);
  }, [onSuccess, onError, options]);

  // Watch position — returns stop function
  const watchLocation = useCallback(() => {
    if (!navigator.geolocation) return () => {};
    setLoading(true);
    const watchId = navigator.geolocation.watchPosition(
      onSuccess,
      onError,
      options
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [onSuccess, onError, options]);

  // Auto-get location on mount
  useEffect(() => {
    getLocation();
  }, []);

  return { location, error, loading, getLocation, watchLocation };
};

export default useLocation;