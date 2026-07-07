import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import LocationMap from "../../components/LocationMap/LocationMap";
import {
  DELIVERY_FEE,
  TAX_RATE,
  DEFAULT_CENTER,
  RESTAURANT_LOCATION,
  ORDER_PREFERENCES,
} from "../../constants/restaurant";
import {
  readCartFromStorage,
  writeCartToStorage,
} from "../../utils/cartStorage";
import "./OrderScreen.css";

// TODO: replace with your real backend path
const ORDER_API_ENDPOINT = "/api/orders/place";
const ADDON_OPTIONS = [
  {
    id: "raita",
    name: "Raita",
    price: 40,
    desc: "Cool yoghurt side with cucumber and spices.",
  },
  {
    id: "salad",
    name: "Fresh Salad",
    price: 60,
    desc: "Crunchy salad with lemon and herbs.",
  },
  {
    id: "papad",
    name: "Papad",
    price: 25,
    desc: "Crisp roasted papad served hot.",
  },
  {
    id: "soup",
    name: "Tomato Soup",
    price: 70,
    desc: "Warm comforting tomato soup.",
  },
];

// Get address name from coordinates using Nominatim API
async function getAddressFromCoords(lat, lng) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
    );
    const data = await response.json();
    return (
      data.address?.road ||
      data.address?.suburb ||
      data.address?.city ||
      `${lat.toFixed(4)}, ${lng.toFixed(4)}`
    );
  } catch (error) {
    console.warn("Address lookup failed:", error);
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}

const Spinner = () => (
  <svg className="order-spinner" viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="9.5" strokeWidth="2.5" />
  </svg>
);

const OrderScreen = ({
  item,
  onClose,
  initialCart = [],
  initialScreen = "item",
  menuItems = [],
}) => {
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [screen, setScreen] = useState(initialScreen);
  const [checkoutStep, setCheckoutStep] = useState("review"); // "review" or "delivery"

  const [quantity, setQuantity] = useState(1);
  const [cart, setCart] = useState(() => readCartFromStorage(initialCart));
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [preferences, setPreferences] = useState([]);
  const [instructions, setInstructions] = useState("");
  const [location, setLocation] = useState(null);
  const [locating, setLocating] = useState(false);
  const [status, setStatus] = useState("idle");
  const [orderId, setOrderId] = useState(null);
  const [showAddonsModal, setShowAddonsModal] = useState(false);
  const [addonSelections, setAddonSelections] = useState([]);

  const activeCart = cart.length ? cart : [{ ...item, quantity }];
  const cartCount = useMemo(
    () => activeCart.reduce((count, cartItem) => count + cartItem.quantity, 0),
    [activeCart],
  );
  const subtotal = useMemo(
    () =>
      activeCart.reduce(
        (totalAmount, cartItem) =>
          totalAmount + cartItem.price * cartItem.quantity,
        0,
      ),
    [activeCart],
  );
  const addonsSubtotal = useMemo(
    () => addonSelections.reduce((sum, addon) => sum + addon.price, 0),
    [addonSelections],
  );
  const subtotalWithAddons = subtotal + addonsSubtotal;
  const tax = useMemo(
    () => Math.round(subtotalWithAddons * TAX_RATE),
    [subtotalWithAddons],
  );
  const total = subtotalWithAddons + DELIVERY_FEE + tax;
  const selectedPreview = activeCart[0] || item;
  const availableMenuItems = menuItems;

  // Slide the sheet up on mount instead of popping in.
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    const t = setTimeout(() => setInitializing(false), 550);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, []);

  const handleRequestClose = () => {
    setMounted(false);
    setTimeout(onClose, 250); // let the slide-down finish first
  };

  useEffect(() => {
    if (cart.length === 0 && screen !== "item") {
      handleRequestClose();
    }
  }, [cart.length, screen]);

  const seedCartFromCurrentItem = () => {
    setCart([{ ...item, quantity }]);
  };

  useEffect(() => {
    writeCartToStorage(cart);
  }, [cart]);

  const handleSelectMore = () => {
    const nextCart = cart.length ? cart : [{ ...item, quantity }];
    setCart(nextCart);

    if (window.location.pathname !== "/menu") {
      navigate("/menu", { state: { cart: nextCart } });
    }

    onClose();
  };

  const handleCheckoutFromSelection = () => {
    if (!cart.length) seedCartFromCurrentItem();
    setCheckoutStep("review");
    setScreen("checkout");
  };

  const handleAddToCart = (menuItem) => {
    setCart((currentCart) => {
      const existingItem = currentCart.find(
        (cartItem) => cartItem.name === menuItem.name,
      );

      if (!existingItem) {
        return [...currentCart, { ...menuItem, quantity: 1 }];
      }

      return currentCart.map((cartItem) =>
        cartItem.name === menuItem.name
          ? { ...cartItem, quantity: cartItem.quantity + 1 }
          : cartItem,
      );
    });
  };

  const handleDecreaseCartItem = (menuItem) => {
    setCart((currentCart) =>
      currentCart
        .map((cartItem) =>
          cartItem.name === menuItem.name
            ? { ...cartItem, quantity: cartItem.quantity - 1 }
            : cartItem,
        )
        .filter((cartItem) => cartItem.quantity > 0),
    );
  };

  const toggleAddon = (addon) => {
    setAddonSelections((currentSelections) => {
      const alreadyAdded = currentSelections.some(
        (selection) => selection.id === addon.id,
      );
      if (alreadyAdded) {
        return currentSelections.filter(
          (selection) => selection.id !== addon.id,
        );
      }
      return [...currentSelections, addon];
    });
  };

  const updateCartItemQuantity = (menuItem, delta) => {
    if (delta < 0) {
      const currentItem = cart.find(
        (cartItem) => cartItem.name === menuItem.name,
      );
      if (!currentItem) return;
      if (currentItem.quantity <= 1) {
        removeCartItem(menuItem);
        return;
      }
    }

    setCart((currentCart) =>
      currentCart
        .map((cartItem) =>
          cartItem.name === menuItem.name
            ? { ...cartItem, quantity: cartItem.quantity + delta }
            : cartItem,
        )
        .filter((cartItem) => cartItem.quantity > 0),
    );
  };

  const removeCartItem = (menuItem) => {
    setCart((currentCart) =>
      currentCart.filter((cartItem) => cartItem.name !== menuItem.name),
    );
  };

  useEffect(() => {
    window.dispatchEvent(new Event("checkout:open"));
    document.body.classList.add("checkout-open");
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.dispatchEvent(new Event("checkout:close"));
      document.body.classList.remove("checkout-open");
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const updateLocation = (locationData) => {
    const { lat, lng, address } = locationData || {};
    const safeLat = Number.isFinite(Number(lat))
      ? Number(lat)
      : DEFAULT_CENTER[0];
    const safeLng = Number.isFinite(Number(lng))
      ? Number(lng)
      : DEFAULT_CENTER[1];
    const safeAddress =
      address || `${safeLat.toFixed(4)}, ${safeLng.toFixed(4)}`;

    setLocation({
      lat: safeLat,
      lng: safeLng,
      address: safeAddress,
    });
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const address = await getAddressFromCoords(latitude, longitude);
        updateLocation({ lat: latitude, lng: longitude, address });
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const handleContinueToDelivery = () => {
    setCheckoutStep("delivery");
  };

  const handleBackToReview = () => {
    setCheckoutStep("review");
  };

  const handlePlaceOrder = async () => {
    if (!location) return;
    setStatus("submitting");

    const storedUser = JSON.parse(localStorage.getItem("user") || "null") || {};

    const payload = {
      userId: storedUser.id || storedUser.userId || null,
      userInfo: storedUser,
      item: {
        name: activeCart[0]?.name || item.name,
        price: activeCart[0]?.price || item.price,
      },
      cartItems: activeCart,
      quantity: cartCount,
      pricing: {
        unitPrice: activeCart[0]?.price || item.price,
        subtotal,
        addonsSubtotal,
        deliveryFee: DELIVERY_FEE,
        tax,
        total,
      },
      addons: addonSelections,
      paymentMethod,
      preferences,
      instructions: instructions.trim(),
      location,
    };

    try {
      const res = await fetch(ORDER_API_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(storedUser.token
            ? { Authorization: `Bearer ${storedUser.token}` }
            : {}),
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Order request failed");
      const data = await res.json();
      setOrderId(data.orderId || data.id || "—");
      setStatus("success");
    } catch {
      setStatus("error");
    }
  };

  const renderItemStage = () => (
    <>
      <div className="order-item-row">
        <img src={item.img} alt={item.name} className="order-item-thumb" />
        <div className="order-item-info">
          <h3 className="p__opensans order-item-name">{item.name}</h3>
          <span className="order-item-unit-price">₹{item.price} / plate</span>
        </div>
        <div className="order-qty-stepper">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            aria-label="Decrease quantity"
          >
            −
          </button>
          <span>{quantity}</span>
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.min(20, q + 1))}
            aria-label="Increase quantity"
          >
            +
          </button>
        </div>
      </div>

      <div className="order-item-note">
        <span className="order-item-note-label">Want to add more dishes?</span>
        <p className="order-item-note-text">
          Open the full menu, add multiple dishes to the cart, and then check
          out once.
        </p>
      </div>

      <div className="order-divider" />

      <div className="order-block">
        <p className="order-block-label">Bill details</p>
        <div className="order-price-row">
          <span>Item total × {quantity}</span>
          <span>₹{subtotal}</span>
        </div>
        <div className="order-price-row">
          <span>Delivery fee</span>
          <span>₹{DELIVERY_FEE}</span>
        </div>
        <div className="order-price-row">
          <span>Taxes</span>
          <span>₹{tax}</span>
        </div>
        <div className="order-price-row order-price-row--total">
          <span>To pay</span>
          <span>₹{total}</span>
        </div>
      </div>
    </>
  );

  const renderMenuStage = () => (
    <>
      <div className="order-menu-hero">
        <div>
          <p className="order-block-label">All dishes</p>
          <h3 className="order-menu-title">Pick more items for the cart</h3>
        </div>
        <button
          type="button"
          className="order-secondary-btn"
          onClick={() => setScreen("item")}
        >
          Back to item
        </button>
      </div>

      <div className="order-menu-grid">
        {availableMenuItems.map((menuItem) => {
          const cartEntry = cart.find(
            (cartItem) => cartItem.name === menuItem.name,
          );
          const quantityInCart = cartEntry?.quantity || 0;
          const unavailable = menuItem.available === false;

          return (
            <div
              className={`order-menu-card ${
                unavailable ? "order-menu-card--unavailable" : ""
              }`}
              key={menuItem.name}
            >
              <img
                src={menuItem.img}
                alt={menuItem.name}
                className="order-menu-thumb"
              />
              {unavailable && (
                <div className="order-menu-overlay">
                  <span className="order-menu-overlay-text">Not available</span>
                </div>
              )}
              <div className="order-menu-card-content">
                <div className="order-menu-card-top">
                  <span className={`order-menu-badge ${menuItem.type}`}>
                    {menuItem.type === "veg" ? "Veg" : "Non-Veg"}
                  </span>
                  <span className="order-menu-price">₹{menuItem.price}</span>
                </div>
                <h4 className="order-menu-card-title">{menuItem.name}</h4>
                <p className="order-menu-card-text">{menuItem.desc}</p>
                <div className="order-menu-card-actions">
                  {quantityInCart > 0 ? (
                    <>
                      <button
                        type="button"
                        className="order-qty-pill"
                        onClick={() => handleDecreaseCartItem(menuItem)}
                      >
                        −
                      </button>
                      <span className="order-qty-count">{quantityInCart}</span>
                      <button
                        type="button"
                        className="order-qty-pill"
                        onClick={() => handleAddToCart(menuItem)}
                        disabled={unavailable}
                      >
                        +
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="order-add-btn"
                      onClick={() => handleAddToCart(menuItem)}
                      disabled={unavailable}
                    >
                      {unavailable ? "Unavailable" : "Add to cart"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );

  // STEP 1 of checkout: what they picked, price breakdown, and add-ons.
  const renderCheckoutReviewStage = () => (
    <>
      <div className="order-block">
        <p className="order-block-label">Your cart</p>
        <div className="order-cart-summary">
          {activeCart.map((cartItem) => (
            <div className="order-cart-row" key={cartItem.name}>
              <img
                src={cartItem.img}
                alt={cartItem.name}
                className="order-cart-row-thumb"
              />
              <div className="order-cart-row-main">
                <span className="order-cart-row-name">{cartItem.name}</span>
                <span className="order-cart-row-meta">
                  ₹{cartItem.price} each
                </span>
                <div className="order-cart-row-controls">
                  <button
                    type="button"
                    className="order-qty-pill"
                    onClick={() => updateCartItemQuantity(cartItem, -1)}
                  >
                    −
                  </button>
                  <span className="order-qty-count">{cartItem.quantity}</span>
                  <button
                    type="button"
                    className="order-qty-pill"
                    onClick={() => updateCartItemQuantity(cartItem, 1)}
                  >
                    +
                  </button>
                </div>
              </div>
              <span className="order-cart-row-total">
                ₹{cartItem.price * cartItem.quantity}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="order-divider" />

      <div className="order-block">
        <div className="order-addon-header">
          <div>
            <p className="order-block-label">Optional add-ons</p>
            <p className="order-addon-hint">
              Add sides or extras to make your meal complete.
            </p>
          </div>
          <button
            type="button"
            className="order-secondary-btn"
            onClick={() => setShowAddonsModal(true)}
          >
            Add add-ons
          </button>
        </div>

        {addonSelections.length > 0 ? (
          <div className="order-addon-list">
            {addonSelections.map((addon) => (
              <span key={addon.id} className="order-addon-pill">
                {addon.name} · ₹{addon.price}
              </span>
            ))}
          </div>
        ) : (
          <p className="order-addon-empty">No add-ons selected yet.</p>
        )}
      </div>

      {showAddonsModal && (
        <div
          className="order-addon-modal-backdrop"
          onClick={() => setShowAddonsModal(false)}
        >
          <div
            className="order-addon-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="order-addon-modal-header">
              <div>
                <p className="order-block-label">Choose add-ons</p>
                <h3 className="order-addon-modal-title">Optional sides</h3>
              </div>
              <button
                type="button"
                className="order-close-btn"
                onClick={() => setShowAddonsModal(false)}
                aria-label="Close add-ons"
              >
                ✕
              </button>
            </div>

            <div className="order-addon-modal-list">
              {ADDON_OPTIONS.map((addon) => {
                const selected = addonSelections.some(
                  (selection) => selection.id === addon.id,
                );
                return (
                  <div className="order-addon-option" key={addon.id}>
                    <div className="order-addon-option-copy">
                      <strong>{addon.name}</strong>
                      <p>{addon.desc}</p>
                    </div>
                    <div className="order-addon-option-actions">
                      <span>₹{addon.price}</span>
                      <button
                        type="button"
                        className={`order-addon-option-btn ${selected ? "order-addon-option-btn--active" : ""}`}
                        onClick={() => toggleAddon(addon)}
                      >
                        {selected ? "Added" : "Add"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="order-divider" />

      <div className="order-block">
        <p className="order-block-label">Bill details</p>
        <div className="order-price-row">
          <span>Item total × {cartCount}</span>
          <span>₹{subtotal}</span>
        </div>
        {addonsSubtotal > 0 && (
          <div className="order-price-row">
            <span>Add-ons</span>
            <span>₹{addonsSubtotal}</span>
          </div>
        )}
        <div className="order-price-row">
          <span>Delivery fee</span>
          <span>₹{DELIVERY_FEE}</span>
        </div>
        <div className="order-price-row">
          <span>Taxes</span>
          <span>₹{tax}</span>
        </div>
        <div className="order-price-row order-price-row--total">
          <span>To pay</span>
          <span>₹{total}</span>
        </div>
      </div>
    </>
  );

  // STEP 2 of checkout: delivery location, instructions, preferences, payment.
  const renderCheckoutDeliveryStage = () => (
    <>
      <div className="order-block">
        <p className="order-block-label">Deliver to</p>
        <div className="order-location-card">
          <span className="order-location-pin">📍</span>
          <div className="order-location-text">
            {location ? (
              location.address ? (
                <span>{location.address}</span>
              ) : (
                <span className="skeleton skeleton--text" />
              )
            ) : (
              <span className="order-location-placeholder">
                No address selected yet
              </span>
            )}
          </div>
          <div className="order-location-actions">
            <button
              type="button"
              className="order-location-action"
              onClick={handleUseCurrentLocation}
              disabled={locating}
            >
              {locating ? <Spinner /> : "Use current"}
            </button>
          </div>
        </div>

        <div className="order-location-toolbar">
          <span className="order-location-toolbar-label">
            Select location on map
          </span>
          <span className="order-location-toolbar-hint">
            Tap the map to place your drop point.
          </span>
        </div>

        <LocationMap
          onLocationSelect={updateLocation}
          restaurantLocation={RESTAURANT_LOCATION}
        />
        <p className="order-map-hint">Tap to select your delivery location</p>
      </div>

      <div className="order-divider" />

      <div className="order-block">
        <p className="order-block-label">Restaurant instructions</p>
        <textarea
          className="order-textarea"
          rows={4}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="Add notes like extra gravy, no coriander, less oil, or any special request."
        />

        <div
          className="order-chip-group"
          role="group"
          aria-label="Order preferences"
        >
          {ORDER_PREFERENCES.map((option) => {
            const active = preferences.includes(option);
            return (
              <button
                key={option}
                type="button"
                className={`order-chip ${active ? "order-chip--active" : ""}`}
                onClick={() => {
                  setPreferences((current) =>
                    current.includes(option)
                      ? current.filter((item) => item !== option)
                      : [...current, option],
                  );
                }}
              >
                {option}
              </button>
            );
          })}
        </div>
      </div>

      <div className="order-divider" />

      <div className="order-block">
        <p className="order-block-label">Payment method</p>

        <button
          type="button"
          className={`order-payment-row ${paymentMethod === "cod" ? "order-payment-row--active" : ""}`}
          onClick={() => setPaymentMethod("cod")}
        >
          <span
            className="order-radio"
            data-checked={paymentMethod === "cod"}
          />
          <span className="order-payment-label">Cash on Delivery</span>
          <span className="order-payment-sub">Pay when it arrives</span>
        </button>

        <button
          type="button"
          className="order-payment-row order-payment-row--disabled"
          disabled
        >
          <span className="order-radio" />
          <span className="order-payment-label">Online Payment</span>
          <span className="order-payment-tag">Coming soon</span>
        </button>
      </div>

      {status === "error" && (
        <p className="order-error-text">
          Couldn't place the order. Please try again.
        </p>
      )}
    </>
  );

  return (
    <div
      className={`order-overlay ${mounted ? "order-overlay--visible" : ""}`}
      onClick={handleRequestClose}
    >
      <div
        className={`order-sheet ${mounted ? "order-sheet--visible" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="order-drag-handle" />

        {status === "success" ? (
          <div className="order-result">
            <img
              src={selectedPreview.img}
              alt={selectedPreview.name}
              className="order-result-image"
            />
            <div className="order-result-icon order-result-icon--success">
              ✓
            </div>
            <h2 className="headtext__cormorant order-result-title">
              Order placed
            </h2>
            <p className="p__opensans order-result-text">
              Order <strong>#{orderId}</strong> for {cartCount} item
              {cartCount === 1 ? "" : "s"} is confirmed. We'll reach out shortly
              to arrange delivery.
            </p>
            <button
              type="button"
              className="order-cta"
              onClick={handleRequestClose}
            >
              Back to menu
            </button>
          </div>
        ) : (
          <>
            <div className="order-sheet-header">
              <div>
                <p className=" order-eyebrow order-header-title">
                  {screen === "menu"
                    ? "ALL MENU"
                    : screen === "checkout"
                      ? checkoutStep === "review"
                        ? "STEP 1 OF 2"
                        : "STEP 2 OF 2"
                      : "SELECT ITEM"}
                </p>
                <h2 className="order-header-title">
                  {screen === "menu"
                    ? "Build your cart"
                    : screen === "checkout"
                      ? checkoutStep === "review"
                        ? "Review your order"
                        : "Delivery details"
                      : "Choose your dish"}
                </h2>
              </div>
              <button
                type="button"
                className="order-close-btn"
                onClick={handleRequestClose}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="order-sheet-body">
              {initializing ? (
                <OrderSkeleton />
              ) : (
                <>
                  {screen === "menu"
                    ? renderMenuStage()
                    : screen === "checkout"
                      ? checkoutStep === "review"
                        ? renderCheckoutReviewStage()
                        : renderCheckoutDeliveryStage()
                      : renderItemStage()}
                </>
              )}
            </div>

            {!initializing && (
              <div className="order-footer">
                {screen === "item" ? (
                  <>
                    <div className="order-footer-total">
                      <span className="order-footer-total-label">Total</span>
                      <span className="order-footer-total-value">₹{total}</span>
                    </div>
                    <button
                      type="button"
                      className="order-secondary-cta"
                      onClick={handleSelectMore}
                    >
                      Select more
                    </button>
                    <button
                      type="button"
                      className="order-cta"
                      onClick={handleCheckoutFromSelection}
                    >
                      Checkout now
                    </button>
                  </>
                ) : screen === "menu" ? (
                  <>
                    <div className="order-footer-total">
                      <span className="order-footer-total-label">
                        Cart total
                      </span>
                      <span className="order-footer-total-value">₹{total}</span>
                    </div>
                    <button
                      type="button"
                      className="order-cta"
                      onClick={handleCheckoutFromSelection}
                      disabled={cartCount === 0}
                    >
                      Checkout cart
                    </button>
                  </>
                ) : checkoutStep === "review" ? (
                  <>
                    <div className="order-footer-total">
                      <span className="order-footer-total-label">Total</span>
                      <span className="order-footer-total-value">₹{total}</span>
                    </div>
                    <button
                      type="button"
                      className="order-secondary-cta"
                      onClick={handleSelectMore}
                    >
                      Add more items
                    </button>
                    <button
                      type="button"
                      className="order-cta"
                      onClick={handleContinueToDelivery}
                      disabled={cartCount === 0}
                    >
                      Continue
                    </button>
                  </>
                ) : (
                  <>
                    <div className="order-footer-total">
                      <span className="order-footer-total-label">Total</span>
                      <span className="order-footer-total-value">₹{total}</span>
                    </div>
                    <button
                      type="button"
                      className="order-secondary-cta"
                      onClick={handleBackToReview}
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      className="order-cta"
                      onClick={handlePlaceOrder}
                      disabled={!location || status === "submitting"}
                    >
                      {status === "submitting" ? <Spinner /> : "Place Order"}
                    </button>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const OrderSkeleton = () => (
  <div className="order-skeleton-group" aria-hidden="true">
    <div className="order-item-row">
      <div
        className="skeleton"
        style={{ width: 56, height: 56, borderRadius: 12 }}
      />
      <div
        style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}
      >
        <div className="skeleton" style={{ width: "70%", height: 14 }} />
        <div className="skeleton" style={{ width: "35%", height: 12 }} />
      </div>
      <div
        className="skeleton"
        style={{ width: 84, height: 32, borderRadius: 999 }}
      />
    </div>
    <div className="order-divider" />
    {[...Array(4)].map((_, i) => (
      <div
        className="skeleton"
        key={i}
        style={{ width: "100%", height: 14, marginBottom: 10 }}
      />
    ))}
    <div className="order-divider" />
    <div
      className="skeleton"
      style={{ width: "100%", height: 140, borderRadius: 16 }}
    />
  </div>
);

export default OrderScreen;
