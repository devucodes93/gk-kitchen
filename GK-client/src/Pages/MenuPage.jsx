import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { FaHistory, FaRedo, FaShoppingCart, FaUtensils } from "react-icons/fa";

import API from "../api/api";
import { Navbar } from "../components";
import DeliveryRouteMap from "../components/DeliveryRouteMap";
import OrderScreen from "./orderScreen/OrderScreen";
import { CATEGORY_LABELS, MENU_CATEGORIES } from "../constants/restaurant";
import { readCartFromStorage, writeCartToStorage } from "../utils/cartStorage";

import "./MenuPage.css";

const readCart = (stateCart) => readCartFromStorage(stateCart);

const MENU_CACHE_KEY = "gk-menu-cache";
const MENU_CACHE_TTL = 1000 * 60 * 15; // 15 minutes

const readMenuCache = () => {
  try {
    const cached = JSON.parse(localStorage.getItem(MENU_CACHE_KEY) || "null");
    if (
      cached &&
      Array.isArray(cached.data) &&
      Date.now() - cached.timestamp < MENU_CACHE_TTL
    ) {
      return cached.data;
    }
  } catch {
    // ignore parse error
  }
  return null;
};

const writeMenuCache = (data) => {
  try {
    localStorage.setItem(
      MENU_CACHE_KEY,
      JSON.stringify({ timestamp: Date.now(), data }),
    );
  } catch {
    // ignore storage errors
  }
};

const parseOrderItems = (items) => {
  if (Array.isArray(items)) return items;
  try {
    const parsed = JSON.parse(items || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

// Transform backend API response to frontend format
const transformMenuItem = (backendItem) => {
  // Map category names to our format
  const categoryMap = {
    "Main Course": "curries",
    Biryani: "biryani",
    Tandoori: "tandoori",
    "Tandoori & Tikka": "tandoori",
    Starters: "indo-chinese",
    "Indo-Chinese": "indo-chinese",
  };

  // Map type to lowercase
  const typeMap = {
    Veg: "veg",
    NonVeg: "nonveg",
    veg: "veg",
    nonveg: "nonveg",
  };

  const mappedCategory =
    categoryMap[backendItem.category] ||
    backendItem.category?.toLowerCase() ||
    "curries";
  const mappedType = typeMap[backendItem.menu_type] || "veg";

  // Normalize availability: backend may send `is_available`, `is_availble` (typo), or `available`.
  const available = (() => {
    if (Object.prototype.hasOwnProperty.call(backendItem, "is_available")) {
      return backendItem.is_available !== false;
    }
    if (Object.prototype.hasOwnProperty.call(backendItem, "is_availble")) {
      return backendItem.is_availble !== false;
    }
    if (Object.prototype.hasOwnProperty.call(backendItem, "available")) {
      return backendItem.available !== false;
    }
    return true;
  })();

  return {
    id: backendItem.menu_id,
    name: backendItem.menu_name,
    price: Number.isFinite(Number(backendItem.price))
      ? parseFloat(backendItem.price)
      : 0,
    category: mappedCategory,
    type: mappedType,
    img: backendItem.image_url || backendItem.image || "",
    available,
    desc: backendItem.description || backendItem.menu_name || "",
  };
};

const MenuPage = () => {
  const location = useLocation();
  const [cart, setCart] = useState(() => readCart(location.state?.cart));
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [menuItems, setMenuItems] = useState([]);
  const [menuLoading, setMenuLoading] = useState(true);
  const [menuError, setMenuError] = useState(null);
  const [activeTab, setActiveTab] = useState("menu");
  const [pastOrders, setPastOrders] = useState([]);
  const [pastOrdersLoading, setPastOrdersLoading] = useState(false);
  const [pastOrdersLoaded, setPastOrdersLoaded] = useState(false);
  const [trackingOrder, setTrackingOrder] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [acceptingOrders, setAcceptingOrders] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(() =>
    Boolean(localStorage.getItem("token")),
  );
  const [loginNotice, setLoginNotice] = useState("");

  useEffect(() => {
    writeCartToStorage(cart);
  }, [cart]);

  useEffect(() => {
    let isMounted = true;
    const cachedMenu = readMenuCache();

    if (cachedMenu) {
      setMenuItems(cachedMenu);
      setMenuLoading(false);
    }

    const fetchMenu = async () => {
      try {
        const response = await API.get("/menu");
        const payload = Array.isArray(response.data)
          ? response.data
          : response.data?.items || [];

        if (!isMounted) return;

        const transformed = payload.map(transformMenuItem);
        setMenuItems(transformed);
        writeMenuCache(transformed);
      } catch (error) {
        if (!isMounted) return;
        setMenuError("Unable to load live menu. Please try again later.");
        if (!cachedMenu) {
          setMenuItems([]);
        }
      } finally {
        if (!isMounted) return;
        setMenuLoading(false);
      }
    };

    fetchMenu();

    const fetchRestaurantStatus = async () => {
      try {
        const response = await API.get("/restaurant");
        if (isMounted) {
          setAcceptingOrders(response.data?.data?.is_accepting_orders !== false);
        }
      } catch {
        if (isMounted) setAcceptingOrders(true);
      }
    };

    fetchRestaurantStatus();
    const statusIntervalId = setInterval(fetchRestaurantStatus, 15000);

    return () => {
      isMounted = false;
      clearInterval(statusIntervalId);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const fetchPastOrders = async () => {
      const token = localStorage.getItem("token");
      setIsLoggedIn(Boolean(token));

      if (!token) {
        if (isMounted) {
          setPastOrders([]);
          setPastOrdersLoaded(true);
          setPastOrdersLoading(false);
        }
        return;
      }

      if (!pastOrdersLoaded) setPastOrdersLoading(true);
      try {
        const response = await API.get("/orders/my-orders");
        if (isMounted) {
          setPastOrders(response.data.orders || []);
          setPastOrdersLoaded(true);
        }
      } catch {
        if (isMounted) {
          setPastOrders([]);
          setPastOrdersLoaded(true);
        }
      } finally {
        if (isMounted) setPastOrdersLoading(false);
      }
    };

    fetchPastOrders();
    const ordersIntervalId = setInterval(fetchPastOrders, 8000);

    return () => {
      isMounted = false;
      clearInterval(ordersIntervalId);
    };
  }, [pastOrdersLoaded]);

  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart],
  );
  const cartCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart],
  );

  const categoryFilter = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("category");
  }, [location.search]);

  const groupedMenu = useMemo(
    () =>
      MENU_CATEGORIES.map((category) => ({
        category,
        label: CATEGORY_LABELS[category] || category,
        items: menuItems.filter((menuItem) => menuItem.category === category),
      }))
        .filter((group) => group.items.length)
        .filter((group) =>
          categoryFilter ? group.category === categoryFilter : true,
        ),
    [menuItems, categoryFilter],
  );

  const activeOrder = useMemo(
    () =>
      pastOrders.find(
        (order) =>
          !["Delivered", "Cancelled"].includes(order.status || "Pending"),
      ),
    [pastOrders],
  );

  const activeOrderMessage = useMemo(() => {
    if (!activeOrder) return "";
    const status = activeOrder.status || "Pending";
    if (status === "Pending") return "Thanks for ordering. We have received it and will start soon.";
    if (status === "Preparing") return "Your food is being prepared with care.";
    if (status === "Ready") return "Your order is ready and waiting for dispatch.";
    if (status === "Out for Delivery") return "Your order is on the way. Please keep your phone nearby.";
    return "We are taking care of your order.";
  }, [activeOrder]);

  useEffect(() => {
    if (!trackingOrder) return;
    const latestOrder = pastOrders.find((order) => order.id === trackingOrder.id);
    if (latestOrder) setTrackingOrder(latestOrder);
  }, [pastOrders, trackingOrder]);

  const addItem = (menuItem) => {
    if (!isLoggedIn) {
      setLoginNotice(
        "Please login from the navbar before ordering. Then your order history and tracking stay saved.",
      );
      return;
    }
    if (!acceptingOrders) return;
    setLoginNotice("");
    setCart((currentCart) => {
      const existing = currentCart.find((item) => item.name === menuItem.name);
      if (!existing) {
        return [...currentCart, { ...menuItem, quantity: 1 }];
      }

      return currentCart.map((item) =>
        item.name === menuItem.name
          ? { ...item, quantity: item.quantity + 1 }
          : item,
      );
    });
  };

  const decreaseItem = (menuItem) => {
    setCart((currentCart) =>
      currentCart
        .map((item) =>
          item.name === menuItem.name
            ? { ...item, quantity: item.quantity - 1 }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  };

  const handleCheckout = () => {
    if (!isLoggedIn) {
      setLoginNotice("Please login from the navbar before checkout.");
      return;
    }
    if (!acceptingOrders) return;
    if (!cart.length) return;
    setLoginNotice("");
    setCheckoutOpen(true);
  };

  const repeatOrder = (order) => {
    const repeatedItems = parseOrderItems(order.items)
      .map((orderItem) => {
        const matchingMenuItem = menuItems.find(
          (menuItem) =>
            menuItem.name === orderItem.name ||
            menuItem.name === orderItem.menu_name,
        );

        if (!matchingMenuItem) return null;

        return {
          ...matchingMenuItem,
          quantity: orderItem.quantity || 1,
        };
      })
      .filter(Boolean);

    if (!repeatedItems.length) return;

    if (!isLoggedIn) {
      setLoginNotice("Please login before repeating an order.");
      return;
    }

    setCart(repeatedItems);
    setActiveTab("menu");
    setCheckoutOpen(true);
  };

  const closeCheckout = () => setCheckoutOpen(false);

  return (
    <div className="menu-page">
      <Navbar />

      <main className="menu-page-shell">
        <section className="menu-page-hero">
          <div className="menu-page-hero-copy">
            <p className="menu-page-kicker">OUR MENU</p>
            <h1 className="menu-page-title">Choose your dishes</h1>
          </div>
        </section>

        <section className="menu-page-layout">
          {isLoggedIn && (
            <div className="menu-page-tabs">
              <button
                type="button"
                className={activeTab === "menu" ? "active" : ""}
                onClick={() => setActiveTab("menu")}
              >
                <FaUtensils /> Menu
              </button>
              <button
                type="button"
                className={activeTab === "orders" ? "active" : ""}
                onClick={() => setActiveTab("orders")}
              >
                <FaHistory /> Past orders
              </button>
            </div>
          )}

          <div className="menu-page-page-metadata">
            {!acceptingOrders && (
              <div className="menu-page-offline-banner">
                <strong>Delivery is currently not available.</strong>
                <span>Please visit our place, or check back later for online ordering.</span>
              </div>
            )}
            {menuLoading && (
              <div className="menu-page-status">Loading menu…</div>
            )}
            {!isLoggedIn && (
              <div className="menu-page-login-banner">
                <strong>Login is required to order online.</strong>
                <span>
                  Use the Login button in the navbar, then your active order and
                  past orders will stay saved safely.
                </span>
              </div>
            )}
            {loginNotice && (
              <div className="menu-page-status menu-page-status--error">
                {loginNotice}
              </div>
            )}
            {!menuLoading && menuError && (
              <div className="menu-page-status menu-page-status--error">
                {menuError}
              </div>
            )}
            {!menuLoading && !menuItems.length && (
              <div className="menu-page-status menu-page-status--empty">
                No items available right now. Please check back soon.
              </div>
            )}
          </div>

          {activeTab === "orders" ? (
            <section className="menu-page-orders-panel">
              {pastOrdersLoading && <div className="menu-page-status">Loading past orders...</div>}
              {pastOrdersLoaded && !pastOrdersLoading && !pastOrders.length && (
                <div className="menu-page-status menu-page-status--empty">
                  No past orders yet.
                </div>
              )}
              <div className="menu-page-orders-list">
                {pastOrders.map((order) => {
                  const orderItems = parseOrderItems(order.items);
                  return (
                    <article className="menu-page-order-card" key={order.id}>
                      <div className="menu-page-order-card-top">
                        <div>
                          <h3>Order #{order.id}</h3>
                          <p>{new Date(order.created_at).toLocaleString()}</p>
                        </div>
                        <span>{order.status || "Pending"}</span>
                      </div>
                      <div className="menu-page-order-items">
                        {orderItems.map((orderItem, index) => (
                          <span key={`${orderItem.name}-${index}`}>
                            {orderItem.quantity || 1} x {orderItem.name || orderItem.menu_name || "Item"}
                            {orderItem.price ? ` - ₹${orderItem.price}` : ""}
                            {orderItem.item_type === "addon" ? " add-on" : ""}
                          </span>
                        ))}
                      </div>
                      <div className="menu-page-order-footer">
                        <strong>₹{order.total_price}</strong>
                        <button type="button" onClick={() => repeatOrder(order)}>
                          <FaRedo /> Repeat
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ) : (
          <div className="menu-page-sections">
            {groupedMenu.map((group) => (
              <section
                className={`menu-page-category menu-page-category--${group.category}`}
                key={group.category}
              >
                <div className="menu-page-category-inner">
                  <div className="menu-page-category-header">
                    <div>
                      <p className="menu-page-kicker">{group.label}</p>
                      <h2 className="menu-page-category-title">
                        {group.label}
                      </h2>
                    </div>
                    <span className="menu-page-category-count">
                      {group.items.length} dishes
                    </span>
                  </div>

                  <div className="menu-page-grid">
                    {group.items.map((menuItem) => {
                      const quantity =
                        cart.find((item) => item.name === menuItem.name)
                          ?.quantity || 0;
                      const unavailable = menuItem.available === false;
                      const orderingDisabled =
                        unavailable || !acceptingOrders || !isLoggedIn;

                      return (
                        <article
                          className={`menu-page-card ${
                            unavailable ? "menu-page-card--unavailable" : ""
                          }`}
                          key={menuItem.name}
                        >
                          <img
                            className="menu-page-card-img"
                            src={menuItem.img}
                            alt={menuItem.name}
                          />
                          {unavailable && (
                            <div className="menu-page-card-overlay">
                              <span className="menu-page-card-overlay-text">
                                Not available
                              </span>
                            </div>
                          )}
                          <div className="menu-page-card-content">
                            <div className="menu-page-card-top">
                              <span
                                className={`menu-page-badge ${menuItem.type}`}
                              >
                                {menuItem.type === "veg" ? "Veg" : "Non-Veg"}
                              </span>
                              <span className="menu-page-price">
                                ₹{menuItem.price}
                              </span>
                            </div>
                            <h3 className="menu-page-card-title">
                              {menuItem.name}
                            </h3>
                            <p className="menu-page-card-text">
                              {menuItem.desc}
                            </p>
                            <div className="menu-page-card-actions">
                              {quantity > 0 ? (
                                <>
                                  <button
                                    type="button"
                                    className="menu-page-qty-btn"
                                    onClick={() => decreaseItem(menuItem)}
                                  >
                                    −
                                  </button>
                                  <span className="menu-page-qty-count">
                                    {quantity}
                                  </span>
                                  <button
                                    type="button"
                                    className="menu-page-qty-btn"
                                    onClick={() => addItem(menuItem)}
                                    disabled={orderingDisabled}
                                  >
                                    +
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  className="menu-page-add-btn"
                                  onClick={() => addItem(menuItem)}
                                  disabled={orderingDisabled}
                                >
                                  {!acceptingOrders
                                    ? "Delivery closed"
                                    : !isLoggedIn
                                      ? "Login to order"
                                    : unavailable
                                      ? "Unavailable"
                                      : "Add to cart"}
                                </button>
                              )}
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              </section>
            ))}
          </div>
          )}
        </section>

        <button
          type="button"
          className={`menu-page-cart-fab ${
            activeOrder ? "menu-page-cart-fab--with-tracker" : ""
          }`}
          onClick={handleCheckout}
          disabled={!cart.length || !acceptingOrders || !isLoggedIn}
        >
          <span className="menu-page-cart-fab-icon">
            <FaShoppingCart />
          </span>
          <span className="menu-page-cart-fab-copy">
            <strong>
              {cartCount} item{cartCount === 1 ? "" : "s"}
            </strong>
            <span>
              {!isLoggedIn
                ? "Login to checkout"
                : acceptingOrders
                  ? "Checkout"
                  : "Delivery closed"}
            </span>
          </span>
          <span className="menu-page-cart-fab-total">₹{subtotal}</span>
        </button>
      </main>

      {checkoutOpen && (
        <OrderScreen
          item={cart[0]}
          initialCart={cart}
          initialScreen="checkout"
          onClose={closeCheckout}
          menuItems={menuItems}
        />
      )}

      {activeOrder && !checkoutOpen && (
        <div className="menu-page-track-bar">
          <div>
            <strong>Order #{activeOrder.id}</strong>
            <span>{activeOrder.status || "Pending"} · {activeOrderMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setRouteInfo(null);
              setTrackingOrder(activeOrder);
            }}
          >
            Track
          </button>
        </div>
      )}

      {trackingOrder && (
        <div
          className="menu-page-track-modal-backdrop"
          onClick={() => setTrackingOrder(null)}
        >
          <div
            className="menu-page-track-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="menu-page-track-close"
              onClick={() => setTrackingOrder(null)}
            >
              Close
            </button>
            <p className="menu-page-kicker">ORDER TRACKING</p>
            <h2>Order #{trackingOrder.id}</h2>
            <div className="menu-page-track-status">
              <strong>{trackingOrder.status || "Pending"}</strong>
              <span>{activeOrderMessage}</span>
            </div>
            {trackingOrder.delivery_lat && trackingOrder.delivery_lng ? (
              <DeliveryRouteMap
                destination={{
                  lat: trackingOrder.delivery_lat,
                  lng: trackingOrder.delivery_lng,
                }}
                originLabel="Kitchen"
                destinationLabel="You"
                height={320}
                onRouteInfo={setRouteInfo}
              />
            ) : (
              <div className="menu-page-status menu-page-status--empty">
                Map location is not available for this order.
              </div>
            )}
            <p className="menu-page-track-note">
              {routeInfo
                ? `Estimated travel time is about ${routeInfo.durationMinutes} minutes once the order leaves the kitchen.`
                : "We will update the order status as the restaurant prepares and dispatches it."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MenuPage;
