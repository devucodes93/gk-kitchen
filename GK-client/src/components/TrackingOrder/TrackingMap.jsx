import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import RoutingMachine from "./RoutingMachine";

// ... your icon code remains unchanged

export default function TrackingMap() {
  const restaurant = [15.1392, 76.921];
  const customer = [15.1445, 76.9265];

  // Rider will move (for demo)
  const [rider, setRider] = useState([15.1415, 76.923]);

  //MOVING BIKE OBJECT
  //   useEffect(() => {
  //     const interval = setInterval(() => {
  //       setRider(([lat, lng]) => [
  //         lat + 0.00008,
  //         lng + 0.00006,
  //       ]);
  //     }, 2000);

  //     return () => clearInterval(interval);
  //   }, []);
  const restaurantIcon = new L.DivIcon({
    html: `
    <div style="
      width:48px;
      height:48px;
      border-radius:50%;
      background:#ffffff;
      display:flex;
      align-items:center;
      justify-content:center;
      font-size:26px;
      box-shadow:0 5px 15px rgba(0,0,0,.35);
    ">
      🍔
    </div>
  `,
    className: "",
    iconSize: [48, 48],
  });

  const riderIcon = new L.DivIcon({
    html: `
    <div style="
      width:48px;
      height:48px;
      border-radius:50%;
      background:#ff6b00;
      display:flex;
      align-items:center;
      justify-content:center;
      font-size:26px;
      color:white;
      box-shadow:0 8px 20px rgba(255,107,0,.45);
    ">
      🛵
    </div>
  `,
    className: "",
    iconSize: [48, 48],
  });

  const customerIcon = new L.DivIcon({
    html: `
    <div style="
      width:48px;
      height:48px;
      border-radius:50%;
      background:#16a34a;
      display:flex;
      align-items:center;
      justify-content:center;
      font-size:26px;
      color:white;
      box-shadow:0 8px 20px rgba(22,163,74,.4);
    ">
      🏠
    </div>
  `,
    className: "",
    iconSize: [48, 48],
  });

  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        position: "relative",
      }}
    >
      <MapContainer
        center={customer}
        zoom={15}
        style={{
          height: "100%",
          width: "100%",
        }}
      >
        <TileLayer
          attribution="© OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Route */}
        <RoutingMachine restaurant={restaurant} customer={customer} />

        {/* Restaurant */}
        <Marker position={restaurant} icon={restaurantIcon}>
          <Popup>
            <strong>Burger House</strong>
            <br />
            Preparing your order 🍔
          </Popup>
        </Marker>

        {/* Rider */}
        <Marker position={rider} icon={riderIcon}>
          <Popup>
            <strong>Rahul</strong>
            <br />
            Out for Delivery 🛵
          </Popup>
        </Marker>

        {/* Customer */}
        <Marker position={customer} icon={customerIcon}>
          <Popup>
            <strong>Your Location</strong>
          </Popup>
        </Marker>
      </MapContainer>

      {/* Floating Card */}
      <div
        style={{
          position: "absolute",
          top: 20,
          left: 20,
          zIndex: 1000,
          background: "#181818",
          color: "#fff",
          padding: "18px",
          borderRadius: "18px",
          width: "240px",
          boxShadow: "0 10px 30px rgba(0,0,0,.35)",
        }}
      >
        <h2
          style={{
            margin: 0,
            color: "#ff6b00",
          }}
        >
          🛵 Track Order
        </h2>

        <p>📦 Out for Delivery</p>

        <p>⏱ ETA : 12 mins</p>

        <p>📍 Distance : 2.8 km</p>
      </div>
    </div>
  );
}
