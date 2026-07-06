import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FaShoppingCart } from "react-icons/fa";

import { Navbar } from "../components";
import { allMenuItems } from "../constants/menu";
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

const MenuPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [cart, setCart] = useState(() => readCart(location.state?.cart));

  useEffect(() => {
    localStorage.setItem("gk-cart", JSON.stringify(cart));
  }, [cart]);

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
        items: allMenuItems.filter(
          (menuItem) => menuItem.category === category,
        ),
      })).filter((group) => group.items.length),
    [],
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
    navigate("/checkout", { state: { cart } });
  };

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

                      return (
                        <article className="menu-page-card" key={menuItem.name}>
                          <img
                            className="menu-page-card-img"
                            src={menuItem.img}
                            alt={menuItem.name}
                          />
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
                                  >
                                    +
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  className="menu-page-add-btn"
                                  onClick={() => addItem(menuItem)}
                                >
                                  Add to cart
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
    </div>
  );
};

export default MenuPage;
