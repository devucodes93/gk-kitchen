import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FaCheck,
  FaMapMarkerAlt,
  FaMotorcycle,
  FaPhoneAlt,
  FaRedo,
} from "react-icons/fa";
import API from "../api/api";
import DeliveryRouteMap from "../components/DeliveryRouteMap";
import "./AdminDashboard.css";
import "./RiderDashboard.css";

const parseItems = (items) => {
  if (Array.isArray(items)) return items;
  try {
    const parsed = JSON.parse(items || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const currency = (value) => `Rs. ${Number(value || 0).toLocaleString("en-IN")}`;
const dateTime = (value) =>
  value ? new Date(value).toLocaleString() : "Not available";
const statusClass = (status = "Pending") =>
  `admin-status admin-status--${status.toLowerCase().replaceAll(" ", "-")}`;

const RiderDashboard = () => {
  const [needsLogin, setNeedsLogin] = useState(!localStorage.getItem("token"));
  const [loginForm, setLoginForm] = useState({
    email: "",
    password: "",
    name: "",
  });
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [actionOrderId, setActionOrderId] = useState(null);
  const fetchBusy = useRef(false);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2800);
  };

  const sortedOrders = useMemo(
    () =>
      orders.slice().sort((a, b) => {
        const aDone = (a.status || "Pending") === "Delivered";
        const bDone = (b.status || "Pending") === "Delivered";
        if (aDone !== bDone) return aDone ? 1 : -1;

        const aMine = Boolean(a.rider_id);
        const bMine = Boolean(b.rider_id);
        if (aMine !== bMine) return aMine ? -1 : 1;

        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      }),
    [orders],
  );

  const fetchOrders = async ({ silent = false } = {}) => {
    if (fetchBusy.current) return;
    fetchBusy.current = true;
    if (!silent) {
      setLoading(true);
      setInitialLoading(true);
    }

    try {
      const response = await API.get("/rider/orders");
      const latestOrders = response.data.data || [];
      setOrders(latestOrders);
      setSelectedOrder((current) =>
        current
          ? latestOrders.find((order) => order.id === current.id) || current
          : current,
      );
      setNeedsLogin(false);
    } catch (error) {
      if ([401, 403].includes(error.response?.status)) setNeedsLogin(true);
      if (!silent) {
        showToast(
          error.response?.data?.message || "Unable to load rider orders",
          "error",
        );
      }
    } finally {
      fetchBusy.current = false;
      if (!silent) {
        setLoading(false);
        setInitialLoading(false);
      }
    }
  };

  useEffect(() => {
    if (needsLogin) return undefined;

    fetchOrders();
    const intervalId = setInterval(() => fetchOrders({ silent: true }), 12000);
    return () => clearInterval(intervalId);
  }, [needsLogin]);

  const login = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await API.post("/auth/rider-login", loginForm);
      localStorage.setItem("token", response.data.token);
      showToast(response.data.message || "Rider login successful");
      setNeedsLogin(false);
      await fetchOrders();
    } catch (error) {
      showToast(error.response?.data?.message || "Unable to login", "error");
    } finally {
      setLoading(false);
    }
  };

  const updateOrder = async (order, action) => {
    const label = action === "pick" ? "Picking order..." : "Marking delivered...";
    setToast({ message: label, type: "loading" });
    setActionOrderId(order.id);

    try {
      const response = await API.patch(`/rider/orders/${order.id}/${action}`);
      setOrders((current) => {
        const exists = current.some((item) => item.id === order.id);
        if (!exists) return [response.data.data, ...current];
        return current.map((item) =>
          item.id === order.id ? response.data.data : item,
        );
      });
      setSelectedOrder(response.data.data);
      showToast(action === "pick" ? "Order picked" : "Order delivered");
    } catch (error) {
      showToast(
        error.response?.data?.message || "Unable to update order",
        "error",
      );
      if (action === "pick") fetchOrders({ silent: true });
    } finally {
      setActionOrderId(null);
    }
  };

  if (needsLogin) {
    return (
      <div className="admin-app admin-login-screen rider-app">
        <form className="admin-login-card" onSubmit={login}>
          <div className="admin-brand admin-login-brand">
            <span>
              <FaMotorcycle />
            </span>
            <strong>Rider Login</strong>
          </div>
          <p>
            Login as a rider. If this rider email is new, the account is
            created automatically.
          </p>
          <label>
            Name
            <input
              value={loginForm.name}
              onChange={(event) =>
                setLoginForm({ ...loginForm, name: event.target.value })
              }
            />
          </label>
          <label>
            Email
            <input
              type="email"
              required
              value={loginForm.email}
              onChange={(event) =>
                setLoginForm({ ...loginForm, email: event.target.value })
              }
            />
          </label>
          <label>
            Password
            <input
              type="password"
              required
              value={loginForm.password}
              onChange={(event) =>
                setLoginForm({ ...loginForm, password: event.target.value })
              }
            />
          </label>
          <button className="admin-primary" type="submit" disabled={loading}>
            {loading ? "Checking..." : "Login as rider"}
          </button>
        </form>
        {toast && (
          <div className={`admin-toast admin-toast--${toast.type}`}>
            {toast.message}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rider-app">
      <header className="rider-topbar">
        <div>
          <p>Delivery console</p>
          <h1>Rider Orders</h1>
        </div>
        <button type="button" onClick={() => fetchOrders()} disabled={loading}>
          <FaRedo /> {loading ? "Refreshing..." : "Refresh"}
        </button>
      </header>

      <main className="rider-layout rider-layout--list-only">
        <section className="rider-orders">
          {initialLoading && !sortedOrders.length ? (
            <RiderSkeleton />
          ) : (
            <>
              {sortedOrders.map((order) => (
                <article
                  className={`rider-order-card ${
                    selectedOrder?.id === order.id ? "active" : ""
                  }`}
                  key={order.id}
                  onClick={() => setSelectedOrder(order)}
                >
                  <div>
                    <strong>Order #{order.id}</strong>
                    <p>
                      {order.customer_name || "Customer"} -{" "}
                      {currency(order.total_price)}
                    </p>
                  </div>
                  <span className={statusClass(order.status)}>
                    {order.status || "Pending"}
                  </span>
                </article>
              ))}
              {!initialLoading && !sortedOrders.length && (
                <div className="admin-empty">
                  <strong>No orders assigned</strong>
                  <p>New restaurant orders will appear here automatically.</p>
                </div>
              )}
            </>
          )}
        </section>
      </main>

      {selectedOrder && (
        <div
          className="rider-modal-backdrop"
          onClick={() => setSelectedOrder(null)}
        >
          <div
            className={`rider-modal ${
              selectedOrder.rider_id ? "rider-modal--picked" : ""
            }`}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="rider-modal-close"
              onClick={() => setSelectedOrder(null)}
            >
              Close
            </button>
            <RiderOrderDetail
              order={selectedOrder}
              onUpdate={updateOrder}
              actionOrderId={actionOrderId}
            />
          </div>
        </div>
      )}

      {toast && (
        <div className={`admin-toast admin-toast--${toast.type}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
};

const RiderOrderDetail = ({ order, onUpdate, actionOrderId }) => {
  const items = parseItems(order.items);
  const actionBusy = actionOrderId === order.id;
  const hasCoordinates = order.delivery_lat && order.delivery_lng;
  const picked = Boolean(order.rider_id);
  const mapsUrl = hasCoordinates
    ? `https://www.google.com/maps/dir/?api=1&destination=${order.delivery_lat},${order.delivery_lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        order.location || "",
      )}`;

  const actions = (
    <div className="admin-delivery-actions">
      {order.phone_number && (
        <a href={`tel:${order.phone_number}`}>
          <FaPhoneAlt /> Call
        </a>
      )}
      <a href={mapsUrl} target="_blank" rel="noreferrer">
        <FaMapMarkerAlt /> Navigate
      </a>
      {!order.rider_id && (
        <button
          type="button"
          onClick={() => onUpdate(order, "pick")}
          disabled={actionBusy}
        >
          <FaMotorcycle /> {actionBusy ? "Picking..." : "Pick order"}
        </button>
      )}
      {order.rider_id && order.status !== "Delivered" && (
        <button
          type="button"
          className="admin-delivered-btn"
          onClick={() => {
            const confirmed = window.confirm(
              "Are you sure this order has been delivered to the customer?",
            );
            if (confirmed) onUpdate(order, "delivered");
          }}
          disabled={actionBusy}
        >
          <FaCheck /> {actionBusy ? "Saving..." : "Delivered"}
        </button>
      )}
    </div>
  );

  const notes = (order.order_instructions || order.order_preferences) && (
    <div className="admin-order-notes">
      {order.order_instructions && (
        <p>
          <span>Instructions</span>
          {order.order_instructions}
        </p>
      )}
      {order.order_preferences && (
        <p>
          <span>Preferences</span>
          {parseItems(order.order_preferences).join(", ") || "None"}
        </p>
      )}
    </div>
  );

  const itemsList = (
    <>
      <h3>Items</h3>
      <div className="admin-list">
        {items.map((item, index) => {
          const name = item.name || item.menu_name || item.item_name || "Item";
          const quantity = Number(item.quantity || item.qty || 1);
          const price = Number(item.price || item.unit_price || 0);
          return (
            <article className="admin-list-row" key={`${name}-${index}`}>
              <div>
                <h3>{name}</h3>
                <p>
                  Quantity: {quantity} - Unit: {currency(price)}
                  {item.item_type === "addon" ? " - Add-on" : ""}
                </p>
              </div>
              <strong>{currency(price * quantity)}</strong>
            </article>
          );
        })}
      </div>
    </>
  );

  if (picked) {
    return (
      <div className="rider-detail-card rider-detail-card--active-trip">
        <div className="rider-trip-map-shell">
          {hasCoordinates ? (
            <DeliveryRouteMap
              destination={{ lat: order.delivery_lat, lng: order.delivery_lng }}
              useCurrentLocation
              originLabel="Rider"
              destinationLabel="Customer"
              height="min(66vh, 620px)"
            />
          ) : (
            <div className="admin-empty">
              <strong>Map location unavailable</strong>
              <p>Use the saved address and call the customer before delivery.</p>
            </div>
          )}

          <div className="rider-trip-summary">
            <div className="rider-detail-head">
              <div>
                <p>{dateTime(order.created_at)}</p>
                <h2>Order #{order.id}</h2>
              </div>
              <span className={statusClass(order.status)}>
                {order.status || "Pending"}
              </span>
            </div>

            <div className="rider-trip-mini-grid">
              <p>
                <span>Customer</span>
                {order.customer_name || "Customer"}
              </p>
              <p>
                <span>Phone</span>
                {order.phone_number || "Not available"}
              </p>
              <p>
                <span>Total</span>
                {currency(order.total_price)}
              </p>
            </div>

            {actions}
          </div>
        </div>

        <p className="rider-map-help">
          The blue marker is your phone location and the red marker is the
          customer location. If GPS accuracy is low, use Google Maps navigation
          from the button above.
        </p>

        <p className="admin-address">
          <span>Delivery address</span>
          {order.location || "Not available"}
        </p>

        {notes}
        {itemsList}
      </div>
    );
  }

  return (
    <div className="rider-detail-card">
      <div className="rider-detail-head">
        <div>
          <p>{dateTime(order.created_at)}</p>
          <h2>Order #{order.id}</h2>
        </div>
        <span className={statusClass(order.status)}>
          {order.status || "Pending"}
        </span>
      </div>

      <div className="admin-detail-grid">
        <p>
          <span>Customer</span>
          {order.customer_name || "Customer"}
        </p>
        <p>
          <span>Phone</span>
          {order.phone_number || "Not available"}
        </p>
        <p>
          <span>Total</span>
          {currency(order.total_price)}
        </p>
        <p>
          <span>Payment</span>
          {order.payment_method || "Cash on Delivery"}
        </p>
      </div>

      <p className="admin-address">
        <span>Delivery address</span>
        {order.location || "Not available"}
      </p>

      {notes}
      {actions}

      {hasCoordinates && (
        <DeliveryRouteMap
          destination={{ lat: order.delivery_lat, lng: order.delivery_lng }}
          useCurrentLocation
          originLabel="Rider"
          destinationLabel="Customer"
          height={340}
        />
      )}

      {itemsList}
    </div>
  );
};

const RiderSkeleton = () => (
  <div className="rider-skeleton-list" aria-hidden="true">
    {Array.from({ length: 5 }).map((_, index) => (
      <div className="rider-skeleton-card" key={index}>
        <span />
        <span />
      </div>
    ))}
  </div>
);

export default RiderDashboard;
