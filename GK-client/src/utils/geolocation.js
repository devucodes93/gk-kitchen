// Tries a fast GPS fix first. If it fails or times out, retries once with
// relaxed settings (allows Wi-Fi/cell fallback, longer timeout, accepts a
// recent cached fix). This is what fixes "location not fetching" on iOS.
export function getReliableLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject({ message: "This browser can't access location. Please select your location manually on the map." });
      return;
    }

    const attempt = (options, isRetry) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          resolve({ lat: latitude, lng: longitude, accuracy });
        },
        (error) => {
          if (!isRetry) {
            attempt(
              { enableHighAccuracy: false, timeout: 20000, maximumAge: 60000 },
              true,
            );
            return;
          }
          reject({
            message:
              error.code === 1
                ? "Location permission denied. Please enable it in settings, or tap the map to select your location manually."
                : "Couldn't get your location. Please tap the map to select it manually.",
          });
        },
        options,
      );
    };

    attempt({ enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }, false);
  });
}

// A GPS fix worse than this (in meters) is unreliable — this is the
// "50km away" bug: bad Wi-Fi/cell triangulation getting used as if it
// were accurate GPS.
export const LOW_ACCURACY_THRESHOLD_M = 500;