import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FaCheck,
  FaMapMarkerAlt,
  FaMotorcycle,
  FaPhoneAlt,
  FaRedo,
  FaTimes,
  FaLock,
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

// Client-side login throttling. This is a UX speed bump, NOT real security —
// it just stops accidental rapid retries from hammering the API. The actual
// gate against random people creating rider accounts has to live on the
// backend: it must reject /auth/rider-login for unknown emails unless the
// access_code sent below matches a code issued by the restaurant admin, and
// should rate-limit failed attempts per IP/email server-side too.
const LOGIN_LOCKOUT_AFTER = 4;
const LOGIN_LOCKOUT_MS = 45_000;

const RiderDashboard = () => {
  const [needsLogin, setNeedsLogin] = useState(!localStorage.getItem("token"));
  const [loginForm, setLoginForm] = useState({
    email: "",
    password: "",
    name: "",
    accessCode: "",
  });
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(null);
  const [lockRemaining, setLockRemaining] = useState(0);
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

  // Tick the lockout countdown so the button re-enables itself without a
  // page refresh.
  useEffect(() => {
    if (!lockedUntil) return undefined;
    const interval = setInterval(() => {
      const remaining = Math.max(0, lockedUntil - Date.now());
      setLockRemaining(remaining);
      if (remaining <= 0) {
        setLockedUntil(null);
        setLoginAttempts(0);
      }
    }, 250);
    return () => clearInterval(interval);
  }, [lockedUntil]);

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
    const token = localStorage.getItem("token");
    if (!token) return undefined;

    const source = new EventSource(
      `https://gk-kitchen.onrender.com/api/orders/events?token=${encodeURIComponent(token)}`,
    );
    const refreshOrders = () => fetchOrders({ silent: true });

    source.addEventListener("order-created", refreshOrders);
    source.addEventListener("order-picked", refreshOrders);
    source.addEventListener("order-updated", refreshOrders);

    return () => source.close();
  }, [needsLogin]);

  const login = async (event) => {
    event.preventDefault();
    if (lockedUntil && lockedUntil > Date.now()) return;

    const email = loginForm.email.trim().toLowerCase();
    const password = loginForm.password;
    const accessCode = loginForm.accessCode.trim();

    if (!email || !password || !accessCode) {
      showToast("Email, password, and access code are all required", "error");
      return;
    }
    if (password.length < 8) {
      showToast("Password must be at least 8 characters", "error");
      return;
    }

    setLoading(true);
    try {
      const response = await API.post("/auth/rider-login", {
        email,
        password,
        name: loginForm.name.trim(),
        access_code: accessCode,
      });
      localStorage.setItem("token", response.data.token);
      showToast(response.data.message || "Rider login successful");
      setNeedsLogin(false);
      setLoginAttempts(0);
      await fetchOrders();
    } catch (error) {
      const attempts = loginAttempts + 1;
      setLoginAttempts(attempts);
      if (attempts >= LOGIN_LOCKOUT_AFTER) {
        setLockedUntil(Date.now() + LOGIN_LOCKOUT_MS);
      }
      showToast(
        error.response?.data?.message ||
          "Unable to login. Check your email, password, and access code.",
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  const updateOrder = async (order, action) => {
    const label =
      action === "pick" ? "Picking order..." : "Marking delivered...";
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
    const isLocked = Boolean(lockedUntil && lockedUntil > Date.now());
    return (
      <div className="admin-app admin-login-screen rider-app">
        <form className="admin-login-card rider-login-card" onSubmit={login}>
          <div className="admin-brand admin-login-brand">
            <span>
              <FaMotorcycle />
            </span>
            <strong>Rider Login</strong>
          </div>
          <p className="rider-login-notice">
            <FaLock aria-hidden="true" />
            Rider accounts are issued by the restaurant. You'll need the access
            code your admin gave you — this login isn't open to self-signup.
          </p>
          <label>
            Name
            <input
              value={loginForm.name}
              onChange={(event) =>
                setLoginForm({ ...loginForm, name: event.target.value })
              }
              autoComplete="name"
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
              autoComplete="email"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              required
              minLength={8}
              value={loginForm.password}
              onChange={(event) =>
                setLoginForm({ ...loginForm, password: event.target.value })
              }
              autoComplete="current-password"
            />
          </label>
          <label>
            Access code
            <input
              required
              value={loginForm.accessCode}
              onChange={(event) =>
                setLoginForm({ ...loginForm, accessCode: event.target.value })
              }
              placeholder="Given to you by the restaurant"
              autoComplete="off"
            />
          </label>
          <button
            className="admin-primary"
            type="submit"
            disabled={loading || isLocked}
          >
            {isLocked
              ? `Try again in ${Math.ceil(lockRemaining / 1000)}s`
              : loading
                ? "Checking..."
                : "Login as rider"}
          </button>
          {isLocked && (
            <p className="rider-login-lock-note">
              Too many failed attempts. Locked briefly to protect this account.
            </p>
          )}
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
            className="rider-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="rider-modal-header">
              <div>
                <p>{dateTime(selectedOrder.created_at)}</p>
                <h2>Order #{selectedOrder.id}</h2>
              </div>
              <div className="rider-modal-header-right">
                <span className={statusClass(selectedOrder.status)}>
                  {selectedOrder.status || "Pending"}
                </span>
                <button
                  type="button"
                  className="rider-modal-close"
                  onClick={() => setSelectedOrder(null)}
                  aria-label="Close"
                >
                  <FaTimes />
                </button>
              </div>
            </div>

            <div className="rider-modal-body">
              <RiderOrderDetail order={selectedOrder} />
            </div>

            {/* Sticky footer — always visible over the map/details, on
                every screen size, so the call/navigate/pick/delivered
                buttons can never get scrolled out of reach. */}
            <div className="rider-modal-footer">
              <RiderOrderActions
                order={selectedOrder}
                onUpdate={updateOrder}
                actionOrderId={actionOrderId}
              />
            </div>
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

// Call / navigate / pick / deliver — rendered once, in the sticky footer,
// shared by both the "not yet picked" and "on the way" states so the
// control set never jumps around depending on order status.
const RiderOrderActions = ({ order, onUpdate, actionOrderId }) => {
  const actionBusy = actionOrderId === order.id;
  const hasCoordinates = order.delivery_lat && order.delivery_lng;
  const mapsUrl = hasCoordinates
    ? `https://www.google.com/maps/dir/?api=1&destination=${order.delivery_lat},${order.delivery_lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        order.location || "",
      )}`;

  return (
    <div className="rider-actions-row">
      {order.phone_number && (
        <a
          className="rider-action-btn rider-action-btn--ghost"
          href={`tel:${order.phone_number}`}
        >
          <FaPhoneAlt /> Call
        </a>
      )}
      <a
        className="rider-action-btn rider-action-btn--ghost"
        href={mapsUrl}
        target="_blank"
        rel="noreferrer"
      >
        <FaMapMarkerAlt /> Navigate
      </a>
      {!order.rider_id && (
        <button
          type="button"
          className="rider-action-btn rider-action-btn--primary"
          onClick={() => onUpdate(order, "pick")}
          disabled={actionBusy}
        >
          <FaMotorcycle /> {actionBusy ? "Picking..." : "Pick order"}
        </button>
      )}
      {order.rider_id && order.status !== "Delivered" && (
        <button
          type="button"
          className="rider-action-btn rider-action-btn--success"
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
      {order.rider_id && order.status === "Delivered" && (
        <span className="rider-action-done">✅ Delivered</span>
      )}
    </div>
  );
};

// One consistent layout for every order: a full-bleed map right at the top
// (edge to edge, no wrapping padding), then a scrollable content column
// below it. Buttons live in the sticky footer outside this component, so
// they're never at risk of ending up hidden underneath the map.
const RiderOrderDetail = ({ order }) => {
  const items = parseItems(order.items);
  const hasCoordinates = order.delivery_lat && order.delivery_lng;
  const picked = Boolean(order.rider_id);

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

  return (
    <>
      <div className="rider-map-shell">
        {hasCoordinates ? (
          <DeliveryRouteMap
            destination={{ lat: order.delivery_lat, lng: order.delivery_lng }}
            useCurrentLocation={picked}
            originLabel={picked ? "Rider" : "Restaurant"}
            destinationLabel="Customer"
            height="100%"
          />
        ) : (
          <div className="admin-empty rider-map-empty">
            <strong>Map location unavailable</strong>
            <p>Use the saved address and call the customer before delivery.</p>
          </div>
        )}
      </div>

      <div className="rider-detail-content">
        {picked && (
          <p className="rider-map-help">
            Blue marker is your phone's current location, red marker is the
            customer. If GPS accuracy looks off, use the Navigate button for
            Google Maps turn-by-turn instead.
          </p>
        )}

        <div className="admin-detail-grid rider-detail-grid">
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

        <h3>Items</h3>
        <div className="admin-list">
          {items.map((item, index) => {
            const name =
              item.name || item.menu_name || item.item_name || "Item";
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
      </div>
    </>
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
