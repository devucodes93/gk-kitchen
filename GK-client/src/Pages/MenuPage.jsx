import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { FaShoppingCart } from "react-icons/fa";

import API from "../api/api";
import { Navbar } from "../components";
import OrderScreen from "./orderScreen/OrderScreen";
import { CATEGORY_LABELS, MENU_CATEGORIES } from "../constants/restaurant";

import "./MenuPage.css";

const readCart = (stateCart) => {
  if (Array.isArray(stateCart) && stateCart.length) return stateCart;

  try {
    const stored = JSON.parse(localStorage.getItem("gk-cart") || "[]");
    return Array.isArray(stored) ? stored : [];
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
    price: Number.isFinite(Number(backendItem.price)) ? parseFloat(backendItem.price) : 0,
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

  useEffect(() => {
    localStorage.setItem("gk-cart", JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    let isMounted = true;

    const fetchMenu = async () => {
      try {
        const response = await API.get("/menu");
        const payload = Array.isArray(response.data)
          ? response.data
          : response.data?.items || [];

        if (!isMounted) return;

        setMenuItems(payload.map(transformMenuItem));
      } catch (error) {
        if (!isMounted) return;
        setMenuError("Unable to load live menu. Please try again later.");
        setMenuItems([]);
      } finally {
        if (!isMounted) return;
        setMenuLoading(false);
      }
    };

    fetchMenu();

    return () => {
      isMounted = false;
    };
  }, []);

  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart],
  );
  const cartCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart],
  );

  const groupedMenu = useMemo(
    () =>
      MENU_CATEGORIES.map((category) => ({
        category,
        label: CATEGORY_LABELS[category] || category,
        items: menuItems.filter((menuItem) => menuItem.category === category),
      })).filter((group) => group.items.length),
    [menuItems],
  );

  const addItem = (menuItem) => {
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
    if (!cart.length) return;
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
          <div className="menu-page-page-metadata">
            {menuLoading && (
              <div className="menu-page-status">Loading menu…</div>
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
                                    disabled={unavailable}
                                  >
                                    +
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  className="menu-page-add-btn"
                                  onClick={() => addItem(menuItem)}
                                  disabled={unavailable}
                                >
                                  {unavailable ? "Unavailable" : "Add to cart"}
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
        </section>

        <button
          type="button"
          className="menu-page-cart-fab"
          onClick={handleCheckout}
          disabled={!cart.length}
        >
          <span className="menu-page-cart-fab-icon">
            <FaShoppingCart />
          </span>
          <span className="menu-page-cart-fab-copy">
            <strong>
              {cartCount} item{cartCount === 1 ? "" : "s"}
            </strong>
            <span>Checkout</span>
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
    </div>
  );
};

export default MenuPage;
