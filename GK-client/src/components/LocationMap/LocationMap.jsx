import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import L from "leaflet";
import {
  RESTAURANT_LOCATION,
  DEMO_DELIVERY_LOCATION,
} from "../../constants/restaurant";
import "leaflet/dist/leaflet.css";

// Get address name from coordinates using Nominatim API
async function getAddressFromCoords(lat, lng) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;

    console.log("Fetching:", url);

    const res = await fetch(url);

    console.log("Status:", res.status);

    const data = await res.json();

    console.log(data);

    return data.display_name || "Unknown location";
  } catch (err) {
    console.error("Reverse geocode failed:", err);
    return "Unable to fetch address";
  }
}

export default function LocationMap({
  onLocationSelect,
  defaultLocation = null,
  restaurantLocation = RESTAURANT_LOCATION,
}) {
  const [userLocation, setUserLocation] = useState(defaultLocation);
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [isGeolocating, setIsGeolocating] = useState(!defaultLocation);

  // Fetch delivery location address name on mount
  useEffect(() => {
    const fetchDeliveryAddress = async () => {
      const address = await getAddressFromCoords(
        DEMO_DELIVERY_LOCATION[0],
        DEMO_DELIVERY_LOCATION[1],
      );
      setDeliveryAddress(address);
    };
    fetchDeliveryAddress();
  }, []);

  // Get user's actual current location on mount
  useEffect(() => {
    if (!defaultLocation && navigator.geolocation) {
      setIsGeolocating(true);
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          const location = [latitude, longitude];
          setUserLocation(location);

          // Get address name and pass to parent with delivery location
          const userAddress = await getAddressFromCoords(latitude, longitude);

          setUserLocation([latitude, longitude]);

          if (onLocationSelect) {
            onLocationSelect({
              userLat: latitude,
              userLng: longitude,

              userAddress,

              restaurantLat: restaurantLocation[0],
              restaurantLng: restaurantLocation[1],

              restaurantAddress: "Gautam Kitchen",
            });
          }
          setIsGeolocating(false);
        },
        (error) => {
          // Fallback to restaurant location if geolocation fails
          console.warn("Geolocation error:", error);
          setUserLocation(restaurantLocation);
          setIsGeolocating(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        },
      );
    }
  }, [defaultLocation, restaurantLocation, onLocationSelect, deliveryAddress]);

  // Simple icons without complex popups
  const restaurantIcon = new L.DivIcon({
    html: `<div style="font-size: 28px; width: 32px; text-align: center;">🍔</div>`,
    className: "",
    iconSize: [32, 32],
  });

  const userIcon = new L.DivIcon({
    html: `<div style="font-size: 28px; width: 32px; text-align: center;">📍</div>`,
    className: "",
    iconSize: [32, 32],
  });

  const deliveryIcon = new L.DivIcon({
    html: `<div style="font-size: 28px; width: 32px; text-align: center;"></div>`,
    className: "",
    iconSize: [32, 32],
  });

  const mapCenter =
    userLocation || DEMO_DELIVERY_LOCATION || restaurantLocation;

  return (
    <div
      style={{
        width: "100%",
        position: "relative",
      }}
    >
      {/* Delivery Address Display */}
      {deliveryAddress && (
        <div
          style={{
            padding: "12px 16px",
            background: "#f0f8ff",
            borderBottom: "1px solid #ddd",
            fontSize: "14px",
            fontWeight: "600",
            color: "#333",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span>📍</span>
          <span>Deliver to: {deliveryAddress}</span>
        </div>
      )}

      {/* Map Container */}
      <div
        style={{
          width: "100%",
          height: "350px",
          borderRadius: "12px",
          overflow: "hidden",
          border: "1px solid #ddd",
          position: "relative",
        }}
      >
        {isGeolocating && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(255, 255, 255, 0.95)",
              zIndex: 10,
              fontSize: "14px",
              color: "#666",
            }}
          >
            Getting your location...
          </div>
        )}
        <MapContainer
          center={mapCenter}
          zoom={15}
          style={{
            height: "100%",
            width: "100%",
          }}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

          {/* Restaurant Location */}
          <Marker position={restaurantLocation} icon={restaurantIcon} />

          {/* User Location */}
          {userLocation && <Marker position={userLocation} icon={userIcon} />}

          {/* Demo Delivery Location */}
          <Marker position={DEMO_DELIVERY_LOCATION} icon={deliveryIcon} />
        </MapContainer>
      </div>
    </div>
  );
}
