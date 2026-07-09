import { useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import { RESTAURANT_LOCATION } from "../constants/restaurant";
import "leaflet/dist/leaflet.css";
import "./DeliveryRouteMap.css";

const formatDistance = (km) => {
  if (!Number.isFinite(km)) return "Distance unavailable";
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
};

const estimateMinutes = (km) => {
  if (!Number.isFinite(km)) return null;
  return Math.max(5, Math.ceil((km / 22) * 60 + 4));
};

const createIcon = (label, color) =>
  new L.DivIcon({
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;transform:translateY(-4px);">
        <span style="background:#171310;color:#fff;font-size:10px;font-weight:800;padding:2px 7px;border-radius:6px;white-space:nowrap;margin-bottom:4px;">${label}</span>
        <div style="width:16px;height:16px;border-radius:50%;background:${color};box-shadow:0 0 0 6px ${color}33;"></div>
      </div>
    `,
    className: "",
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });

async function getRoadRoute(origin, destination) {
  const [originLat, originLng] = origin;
  const [destLat, destLng] = destination;
  const url = `https://router.project-osrm.org/route/v1/driving/${originLng},${originLat};${destLng},${destLat}?overview=full&geometries=geojson`;
  const response = await fetch(url);
  const data = await response.json();
  const route = data.routes?.[0];
  if (!route) throw new Error("No route found");
  return {
    coords: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
    distanceKm: route.distance / 1000,
    durationMinutes: Math.max(1, Math.ceil(route.duration / 60)),
  };
}

function FitRoute({ points }) {
  const map = useMap();
  const hasFitRef = useRef(false);

  useEffect(() => {
    const safePoints = points.filter(Boolean);
    if (safePoints.length < 2) return;
    const bounds = L.latLngBounds(safePoints);
    map.fitBounds(bounds, {
      padding: [46, 46],
      maxZoom: 16,
      animate: !hasFitRef.current,
    });
    hasFitRef.current = true;
  }, [map, points]);

  return null;
}

function ResizeSync() {
  const map = useMap();
  useEffect(() => {
    const sync = () => map.invalidateSize();
    const raf = requestAnimationFrame(sync);
    const observer = new ResizeObserver(sync);
    observer.observe(map.getContainer());
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [map]);
  return null;
}

const DeliveryRouteMap = ({
  destination,
  origin = RESTAURANT_LOCATION,
  useCurrentLocation = false,
  originLabel = "Start",
  destinationLabel = "Customer",
  height = 300,
  onRouteInfo,
}) => {
  const destinationLatRaw = Array.isArray(destination)
    ? destination[0]
    : destination?.lat;
  const destinationLngRaw = Array.isArray(destination)
    ? destination[1]
    : destination?.lng;
  const originLatRaw = Array.isArray(origin) ? origin[0] : origin?.lat;
  const originLngRaw = Array.isArray(origin) ? origin[1] : origin?.lng;

  const destinationPoint = useMemo(() => {
    const lat = Number(destinationLatRaw);
    const lng = Number(destinationLngRaw);
    return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
  }, [destinationLatRaw, destinationLngRaw]);
  const initialOrigin = useMemo(() => {
    const lat = Number(originLatRaw);
    const lng = Number(originLngRaw);
    return Number.isFinite(lat) && Number.isFinite(lng)
      ? [lat, lng]
      : RESTAURANT_LOCATION;
  }, [originLatRaw, originLngRaw]);
  const [originPoint, setOriginPoint] = useState(initialOrigin);
  const [locating, setLocating] = useState(useCurrentLocation);
  const [route, setRoute] = useState(null);
  const [routeError, setRouteError] = useState("");
  const [accuracyMeters, setAccuracyMeters] = useState(null);
  const [locationError, setLocationError] = useState("");

  useEffect(() => {
    if (!useCurrentLocation || !navigator.geolocation) return undefined;

    setLocating(true);
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setOriginPoint([position.coords.latitude, position.coords.longitude]);
        setAccuracyMeters(position.coords.accuracy || null);
        setLocating(false);
        setLocationError("");
      },
      () => {
        setLocating(false);
        setLocationError("Location permission is needed for rider navigation.");
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [useCurrentLocation]);

  const originLat = originPoint?.[0];
  const originLng = originPoint?.[1];
  const destinationLat = destinationPoint?.[0];
  const destinationLng = destinationPoint?.[1];

  useEffect(() => {
    if (!originPoint || !destinationPoint) return undefined;
    let cancelled = false;

    getRoadRoute(originPoint, destinationPoint)
      .then((nextRoute) => {
        if (cancelled) return;
        setRoute(nextRoute);
        setRouteError("");
        onRouteInfo?.(nextRoute);
      })
      .catch(() => {
        if (cancelled) return;
        const fallbackDistance = L.latLng(originPoint).distanceTo(
          L.latLng(destinationPoint),
        ) / 1000;
        const fallback = {
          coords: [originPoint, destinationPoint],
          distanceKm: fallbackDistance,
          durationMinutes: estimateMinutes(fallbackDistance),
        };
        setRoute(fallback);
        setRouteError("Road route unavailable. Showing best fallback path.");
        onRouteInfo?.(fallback);
      });

    return () => {
      cancelled = true;
    };
  }, [
    originLat,
    originLng,
    destinationLat,
    destinationLng,
    onRouteInfo,
    originPoint,
    destinationPoint,
  ]);

  const originIcon = useMemo(
    () => createIcon(originLabel, useCurrentLocation ? "#2563ff" : "#171310"),
    [originLabel, useCurrentLocation],
  );
  const destinationIcon = useMemo(
    () => createIcon(destinationLabel, "#e63946"),
    [destinationLabel],
  );

  if (!destinationPoint) {
    return (
      <div className="delivery-route-empty" style={{ minHeight: height }}>
        Customer map location is unavailable.
      </div>
    );
  }

  return (
    <div className="delivery-route-map" style={{ height }}>
      {locating && (
        <div className="delivery-route-loading">Finding rider location...</div>
      )}
      <MapContainer
        center={originPoint || destinationPoint}
        zoom={14}
        zoomControl={false}
        attributionControl={false}
        scrollWheelZoom
        touchZoom
        doubleClickZoom
        dragging
        style={{ width: "100%", height: "100%" }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {route?.coords?.length && (
          <Polyline
            positions={route.coords}
            pathOptions={{
              color: "#e63946",
              weight: 4,
              opacity: 0.88,
              lineCap: "round",
            }}
          />
        )}
        {originPoint && <Marker position={originPoint} icon={originIcon} />}
        <Marker position={destinationPoint} icon={destinationIcon} />
        <FitRoute points={route?.coords?.length ? route.coords : [originPoint, destinationPoint]} />
        <ResizeSync />
      </MapContainer>
      {route && (
        <div className="delivery-route-pill">
          {formatDistance(route.distanceKm)} by road · about {route.durationMinutes} min
        </div>
      )}
      {useCurrentLocation && accuracyMeters !== null && (
        <div
          className={`delivery-route-accuracy ${
            accuracyMeters > 80 ? "delivery-route-accuracy--low" : ""
          }`}
        >
          GPS accuracy +/-{Math.round(accuracyMeters)} m
          {accuracyMeters > 80
            ? ". Accuracy looks low. Use Google Maps navigation if the marker feels off."
            : ". Rider marker is using this phone's current location."}
        </div>
      )}
      {(routeError || locationError) && (
        <div className="delivery-route-note">{locationError || routeError}</div>
      )}
    </div>
  );
};

export default DeliveryRouteMap;
