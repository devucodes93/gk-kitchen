import { useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import {
  RESTAURANT_LOCATION,
  DEMO_DELIVERY_LOCATION,
} from "../../constants/restaurant";
import "leaflet/dist/leaflet.css";
import {
  getReliableLocation,
  LOW_ACCURACY_THRESHOLD_M,
} from "../../utils/geolocation";
const RESTAURANT_NAME = "Gautam Kitchen";

async function getAddressFromCoords(lat, lng) {
  // BigDataCloud's client-side reverse geocode endpoint is built for direct
  // browser calls (no key, reliable CORS) — try it first.
  try {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`;
    const res = await fetch(url);
    const data = await res.json();
    const parts = [data.locality, data.city, data.principalSubdivision].filter(
      Boolean,
    );
    if (parts.length) return parts.join(", ");
  } catch (err) {
    console.warn("BigDataCloud reverse geocode failed, trying Nominatim:", err);
  }

  // Fallback: Nominatim (can be flaky/rate-limited directly from a browser).
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.display_name) return data.display_name;
  } catch (err) {
    console.error("Nominatim reverse geocode also failed:", err);
  }

  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

function getDistanceKm([lat1, lon1], [lat2, lon2]) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function formatDistance(km) {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

// Real road route (not a straight line) between two [lat, lng] points, via
// OSRM's public routing API. Returns Leaflet-ready [lat, lng] pairs plus the
// actual road distance. Public demo server — fine for prototyping, swap for
// your own OSRM/Mapbox/Google Directions endpoint in production.
async function getRoadRoute([userLat, userLng], [destLat, destLng]) {
  const url = `https://router.project-osrm.org/route/v1/driving/${userLng},${userLat};${destLng},${destLat}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  const data = await res.json();
  const route = data.routes?.[0];
  if (!route) throw new Error("No route found");
  return {
    coords: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
    distanceKm: route.distance / 1000,
  };
}

// Lets the person tap/click anywhere on the map to drop their own pin,
// instead of only ever trusting the browser's geolocation.
function ClickToSelect({ onSelect }) {
  useMapEvents({
    click(e) {
      onSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// Fits the map so the WHOLE route — user, restaurant, and every bend the
// road takes between them — is visible together.
// Only the FIRST fit animates (flyToBounds); every subsequent fit (e.g. once
// the real road route arrives a moment later) snaps instantly with
// fitBounds so it doesn't fight the animation already in flight and cause
// the map to jump/shake.
function FitRoute({ user, restaurant, routeCoords }) {
  const map = useMap();
  const hasFitRef = useRef(false);

  useEffect(() => {
    if (!user) return;
    const points = routeCoords?.length ? routeCoords : [user, restaurant];
    const bounds = L.latLngBounds(points);

    if (!hasFitRef.current) {
      hasFitRef.current = true;
      map.flyToBounds(bounds, {
        padding: [56, 56],
        maxZoom: 16,
        duration: 1.1,
      });
    } else {
      map.fitBounds(bounds, { padding: [56, 56], maxZoom: 16, animate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.[0], user?.[1], routeCoords, map]);

  return null;
}

// Leaflet doesn't redraw correctly if its container is resized (browser
// zoom, window resize) without being told to — this keeps it in sync so
// only the map itself resizes, nothing shifts or tears. It also forces a
// single sync right after mount in case the map was created while its
// parent was still animating/fading in.
function MapResizeSync() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    const syncSize = () => map.invalidateSize();

    syncSize();
    const raf = requestAnimationFrame(syncSize);

    const resizeObserver = new ResizeObserver(syncSize);
    resizeObserver.observe(container);
    window.addEventListener("resize", syncSize);

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      window.removeEventListener("resize", syncSize);
    };
  }, [map]);
  return null;
}

// Custom floating +/- buttons, styled to match the rest of the UI instead
// of Leaflet's default square control.
function ZoomControls() {
  const map = useMap();
  return (
    <div
      style={{
        position: "absolute",
        top: 14,
        right: 14,
        zIndex: 5,
        display: "flex",
        flexDirection: "column",
        borderRadius: 14,
        overflow: "hidden",
        background: "rgba(23,19,16,0.85)",
        backdropFilter: "blur(6px)",
      }}
    >
      <button
        type="button"
        onClick={() => map.zoomIn()}
        aria-label="Zoom in"
        style={zoomBtnStyle}
      >
        +
      </button>
      <div style={{ height: 1, background: "rgba(255,255,255,0.15)" }} />
      <button
        type="button"
        onClick={() => map.zoomOut()}
        aria-label="Zoom out"
        style={zoomBtnStyle}
      >
        −
      </button>
    </div>
  );
}

const zoomBtnStyle = {
  width: 36,
  height: 36,
  border: "none",
  background: "transparent",
  color: "#fff",
  fontSize: 18,
  fontWeight: 700,
  cursor: "pointer",
  display: "grid",
  placeItems: "center",
  lineHeight: 1,
};

export default function LocationMap({
  onLocationSelect,
  selectedLocation,
  defaultLocation = null,
  restaurantLocation = RESTAURANT_LOCATION,
  height = 300, // px fallback — always applied inline so a missing parent height can't hide the map
}) {
  const [userLocation, setUserLocation] = useState(
    selectedLocation
      ? [selectedLocation.lat, selectedLocation.lng]
      : defaultLocation,
  );
  const [locationError, setLocationError] = useState("");
  const [userAddress, setUserAddress] = useState("");
  const [isGeolocating, setIsGeolocating] = useState(!defaultLocation);
  const [isResolvingTap, setIsResolvingTap] = useState(false);
  const [routeCoords, setRouteCoords] = useState(null); // actual road path, [[lat,lng], ...]
  const [routeDistanceKm, setRouteDistanceKm] = useState(null);
  useEffect(() => {
    if (!selectedLocation) return;

    setUserLocation([selectedLocation.lat, selectedLocation.lng]);
  }, [selectedLocation]);
  function ChangeView({ center }) {
    const map = useMap();

    useEffect(() => {
      map.flyTo(center, map.getZoom(), {
        animate: true,
      });
    }, [center, map]);

    return null;
  }
  // Reports the selected point back to the parent in the shape it expects:
  // { lat, lng, address }. (Previously this sent userLat/userLng/userAddress,
  // which didn't match what OrderScreen reads, so selections were silently
  // dropped and it fell back to a default location.)
  const reportLocation = (lat, lng, address) => {
    onLocationSelect?.({ lat, lng, address });
  };

  useEffect(() => {
    if (defaultLocation) return;
    setIsGeolocating(true);
    getReliableLocation()
      .then(async ({ lat, lng, accuracy }) => {
        setUserLocation([lat, lng]);
        const userAddr = await getAddressFromCoords(lat, lng);
        setUserAddress(userAddr);
        reportLocation(lat, lng, userAddr);
        if (accuracy > LOW_ACCURACY_THRESHOLD_M) {
          setLocationError(
            `Location may be inaccurate (±${Math.round(accuracy)}m). Please check the pin and tap the map to correct it if needed.`,
          );
        } else {
          setLocationError("");
        }
      })
      .catch((err) => {
        setLocationError(err.message);
        setUserLocation(null); // don't silently drop the pin on the restaurant
        setUserAddress("");
      })
      .finally(() => setIsGeolocating(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultLocation]);

  // Called when the person taps/clicks the map to drop their own pin.
  const handleMapClick = async (lat, lng) => {
    setUserLocation([lat, lng]);
    setIsGeolocating(false);
    setIsResolvingTap(true);
    const address = await getAddressFromCoords(lat, lng);
    setUserAddress(address);
    setIsResolvingTap(false);
    reportLocation(lat, lng, address);
  };

  const handleUseCurrentLocation = async () => {
    setIsGeolocating(true);

    // Clear the old manually selected pin
    setUserLocation(null);
    setRouteCoords(null);
    setRouteDistanceKm(null);

    try {
      const { lat, lng, accuracy } = await getReliableLocation();

      const newLocation = [lat, lng];
      setUserLocation(newLocation);

      const address = await getAddressFromCoords(lat, lng);
      setUserAddress(address);

      reportLocation(lat, lng, address);

      setLocationError(
        accuracy > LOW_ACCURACY_THRESHOLD_M
          ? `Location may be inaccurate (±${Math.round(accuracy)}m).`
          : "",
      );
    } finally {
      setIsGeolocating(false);
    }
  };
  useEffect(() => {
    if (!userLocation) return;
    let cancelled = false;

    getRoadRoute(userLocation, restaurantLocation)
      .then(({ coords, distanceKm }) => {
        if (cancelled) return;
        setRouteCoords(coords);
        setRouteDistanceKm(distanceKm);
      })
      .catch((err) => {
        console.error(
          "Road route fetch failed, falling back to straight line:",
          err,
        );
        if (!cancelled) {
          setRouteCoords(null);
          setRouteDistanceKm(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [userLocation, restaurantLocation]);

  const userIcon = useMemo(
    () =>
      new L.DivIcon({
        html: `
          <div style="display:flex;flex-direction:column;align-items:center;transform:translateY(-4px);">
            <span style="background:#171310;color:#fff;font-size:10px;font-weight:700;padding:2px 7px;border-radius:6px;white-space:nowrap;margin-bottom:4px;">You</span>
            <div style="width:16px;height:16px;border-radius:50%;background:#2563ff;box-shadow:0 0 0 6px rgba(37,99,255,0.25);"></div>
          </div>
        `,
        className: "",
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      }),
    [],
  );

  const restaurantIcon = useMemo(
    () =>
      new L.DivIcon({
        html: `
          <div style="display:flex;flex-direction:column;align-items:center;transform:translateY(-6px);">
            <span style="background:#171310;color:#fff;font-size:10px;font-weight:700;padding:2px 7px;border-radius:6px;white-space:nowrap;margin-bottom:4px;">${RESTAURANT_NAME}</span>
            <div style="font-size:22px;">🍽️</div>
          </div>
        `,
        className: "",
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      }),
    [],
  );

  const mapCenter =
    userLocation || DEMO_DELIVERY_LOCATION || restaurantLocation;

  const straightDistanceKm = useMemo(
    () =>
      userLocation ? getDistanceKm(userLocation, restaurantLocation) : null,
    [userLocation, restaurantLocation],
  );
  const distanceKm = routeDistanceKm ?? straightDistanceKm;

  return (
    <div
      className="location-map-root"
      style={{
        position: "relative",
        width: "100%",
        height,
      }}
    >
      {isGeolocating && (
        <div
          className="location-map-loading"
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(255,255,255,0.9)",
            fontSize: 13,
            color: "#666",
          }}
        >
          Finding you…
        </div>
      )}

      <MapContainer
        center={mapCenter}
        zoom={14}
        zoomControl={false}
        attributionControl={false}
        scrollWheelZoom
        touchZoom
        doubleClickZoom
        dragging
        className="location-map-canvas"
        style={{ width: "100%", height: "100%" }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        {userLocation && (
          <Polyline
            positions={
              routeCoords?.length
                ? routeCoords
                : [userLocation, restaurantLocation]
            }
            pathOptions={{
              color: "#e63946",
              weight: 4,
              opacity: 0.85,
              lineCap: "round",
            }}
          />
        )}

        <Marker position={restaurantLocation} icon={restaurantIcon} />
        {userLocation && <Marker position={userLocation} icon={userIcon} />}

        <ClickToSelect onSelect={handleMapClick} />
        <FitRoute
          user={userLocation}
          restaurant={restaurantLocation}
          routeCoords={routeCoords}
        />
        <MapResizeSync />
        <ZoomControls />
      </MapContainer>

      {distanceKm !== null && (
        <p
          style={{
            margin: "8px 2px 0",
            fontSize: 13,
            color: "#6b6258",
            fontWeight: 500,
          }}
        >
          {isResolvingTap
            ? "Locating address…"
            : `${formatDistance(distanceKm)} ${
                routeCoords?.length ? "by road" : "away"
              }${userAddress ? ` · ${userAddress.split(",")[0]}` : ""}`}
        </p>
      )}
      {locationError && (
        <p
          style={{
            position: "absolute",
            bottom: 54,
            left: 14,
            right: 14,
            zIndex: 1000, // was 5 — Leaflet's panes go up to ~700
            fontSize: 12,
            fontWeight: 600,
            color: "#fff",
            background: "rgba(214,60,60,0.92)",
            padding: "6px 10px",
            borderRadius: 8,
            margin: 0,
          }}
        >
          {locationError} Tap anywhere on the map to set it manually.
        </p>
      )}
      <button
        type="button"
        onClick={handleUseCurrentLocation}
        disabled={isGeolocating}
        style={{
          position: "absolute",
          bottom: 14,
          left: 14,
          zIndex: 5,
          border: "none",
          borderRadius: 999,
          padding: "8px 14px",
          fontSize: 12,
          fontWeight: 700,
          color: "#fff",
          background: "rgba(23,19,16,0.85)",
          backdropFilter: "blur(6px)",
          cursor: isGeolocating ? "default" : "pointer",
          opacity: isGeolocating ? 0.6 : 1,
        }}
      >
        Use current location
      </button>
    </div>
  );
}
