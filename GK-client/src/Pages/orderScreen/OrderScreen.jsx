import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import LocationMap from "../../components/LocationMap/LocationMap";
import {
  DEFAULT_CENTER,
  RESTAURANT_LOCATION,
  ORDER_PREFERENCES,
} from "../../constants/restaurant";
import {
  readCartFromStorage,
  writeCartToStorage,
} from "../../utils/cartStorage";
import "./OrderScreen.css";
import {
  getReliableLocation,
  LOW_ACCURACY_THRESHOLD_M,
} from "../../utils/geolocation";
// TODO: replace with your real backend path
const ORDER_API_ENDPOINT =
  "https://gk-kitchen.onrender.com/api/orders/place-order";

// Razorpay endpoints — match the routes mounted at app.use("/api/payment", ...)
const PAYMENT_CREATE_ORDER_ENDPOINT =
  "https://gk-kitchen.onrender.com/api/payment/create-order";
const PAYMENT_VERIFY_ENDPOINT =
  "https://gk-kitchen.onrender.com/api/payment/verify";

// Fallback only used if MenuPage didn't pass a radius down (shouldn't happen
// in normal flow — MenuPage always computes this from restaurant config).
const DEFAULT_DELIVERY_RADIUS_KM = 10;

// TEMP SWITCH — set to `true` to bring the delivery-radius restriction back.
// While `false`, customers can order (and pay) from any distance; the
// "you're outside our delivery area" notice and the button-disabling both
// stop firing. Nothing else about the checkout flow changes.
const DELIVERY_RADIUS_ENFORCED = false;

// ---------------------------------------------------------------------------
// Security / integrity helpers
//
// These are client-side guardrails. They make it much harder to accidentally
// (or deliberately) submit a broken, tampered, or duplicated order — but the
// backend must still be the final authority (recompute price server-side,
// enforce the idempotency key, verify the token, etc). Nothing here replaces
// server-side validation.
// ---------------------------------------------------------------------------

// Generates a unique token to tag a single "order attempt". Sent as an
// Idempotency-Key header + in the payload so that if the same request is
// retried (flaky network, user double-tapping, a response that got lost),
// the backend can recognize it as the same attempt and avoid creating a
// duplicate order.
const generateIdempotencyKey = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `ord_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

// Validates an Indian mobile number regardless of how it was typed
// (with/without +91, spaces, dashes, etc).
const isValidPhone = (rawPhone) => {
  const digits = String(rawPhone || "").replace(/\D/g, "");
  const last10 = digits.slice(-10);
  return /^[6-9]\d{9}$/.test(last10);
};

// Strips characters that have no business being in a free-text notes field
// and caps the length so one field can't blow up the payload.
const sanitizeInstructions = (text) =>
  String(text || "")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, 500);

// Rejects locations that are missing, non-numeric, "null island" (0,0 — the
// classic sign of an unset/garbage coordinate), or outside valid lat/lng
// ranges.
const isValidLocation = (loc) => {
  if (!loc) return false;
  const lat = Number(loc.lat);
  const lng = Number(loc.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat === 0 && lng === 0) return false;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  return true;
};

// Best-effort, non-cryptographic check of a JWT's exp claim. This is purely
// a UX nicety (avoid submitting with a token we already know is dead) — the
// server still verifies the signature and expiry for real.
const isTokenExpired = (token) => {
  try {
    const payloadB64 = token.split(".")[1];
    const normalized = payloadB64.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(normalized));
    if (!payload.exp) return false;
    return Date.now() >= payload.exp * 1000;
  } catch {
    return false; // if we can't decode it, let the server be the judge
  }
};

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

// Turns "Chicken Kabab (8pc)" into a stable id like "chicken-kabab-8pc" so we
// can dedupe/select addons without relying on a hardcoded id from the DB.
const slugify = (name) =>
  String(name || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

// ---------------------------------------------------------------------------
// Razorpay Checkout script loader
//
// Loaded lazily (only when the customer actually picks "Pay Online"), and
// cached so repeated attempts don't inject the script tag more than once.
// If it fails to load, the promise resets so a later retry can try again
// (e.g. the first attempt happened while offline).
// ---------------------------------------------------------------------------
let razorpayScriptPromise = null;
const loadRazorpayScript = () => {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  if (razorpayScriptPromise) return razorpayScriptPromise;

  razorpayScriptPromise = new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => {
      razorpayScriptPromise = null; // allow a retry on the next attempt
      resolve(false);
    };
    document.body.appendChild(script);
  });

  return razorpayScriptPromise;
};

const Spinner = () => (
  <svg className="order-spinner" viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="9.5" strokeWidth="2.5" />
  </svg>
);

const EARTH_RADIUS_KM = 6371;
const getHaversineKm = (lat1, lon1, lat2, lon2) => {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};
const OrderScreen = ({
  item,
  onClose,
  initialCart = [],
  initialScreen = "item",
  menuItems = [],
  // --- Passed down from MenuPage — already computed there from restaurant
  // config + the customer's browser location, so we just use them here
  // instead of re-fetching or recalculating anything. ---
  deliveryFee = 0,
  gstPercent = 0,
  distanceKm = null,
  deliveryRadiusKm = DEFAULT_DELIVERY_RADIUS_KM,
}) => {
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [screen, setScreen] = useState(initialScreen);
  const [checkoutStep, setCheckoutStep] = useState("review"); // "review" or "delivery"

  const [quantity, setQuantity] = useState(1);
  const [cart, setCart] = useState(() => readCartFromStorage(initialCart));
  const [paymentMethod, setPaymentMethod] = useState("cod"); // "cod" | "online"
  const [preferences, setPreferences] = useState([]);
  const [instructions, setInstructions] = useState("");
  const [location, setLocation] = useState(null);
  const [locating, setLocating] = useState(false);
  const [status, setStatus] = useState("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [orderId, setOrderId] = useState(null);
  const [showAddonsModal, setShowAddonsModal] = useState(false);
  const [addonSelections, setAddonSelections] = useState([]);
  const [customerPhone, setCustomerPhone] = useState("");
  const [savedPhone, setSavedPhone] = useState("");
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [phoneError, setPhoneError] = useState("");
  const [pastOrders, setPastOrders] = useState([]);
  const [locationError, setLocationError] = useState("");

  // --- Duplicate-submission / integrity guards ---------------------------
  // submitLockRef is a *synchronous* lock. React state updates (like
  // status === "submitting") are batched and only take effect on the next
  // render, so two clicks that land in the same tick (e.g. a fast double
  // tap, or a stuck UI thread) can both slip past a state-based disabled
  // check and fire two network requests. A plain ref has no such delay.
  const submitLockRef = useRef(false);
  const idempotencyKeyRef = useRef(null);
  const idempotencySignatureRef = useRef(null);
  const abortControllerRef = useRef(null);

  const activeCart = cart.length ? cart : [{ ...item, quantity }];
  const cartCount = useMemo(
    () => activeCart.reduce((count, cartItem) => count + cartItem.quantity, 0),
    [activeCart],
  );

  // Union of addons across every item currently in the cart, deduped by
  // slugified name. Each menu item's `addons` jsonb column looks like:
  // [{ "name": "White Rice (Half)", "price": 39, "img": "..." }, ...]
  // `img` is optional — if a particular addon doesn't have one, we fall
  // back to a small icon in the UI instead of leaving a broken/blank image.
  console.log(
    "activeCart with addons:",
    JSON.stringify(
      activeCart.map((c) => ({ name: c.name, addons: c.addons })),
      null,
      2,
    ),
  );
  // Union of addons across every item currently in the cart, deduped by
  // slugified name. Falls back to the live menuItems list if a cart item was
  // persisted before `addons` existed on its shape (see cartStorage staleness).
  const availableAddons = useMemo(() => {
    const map = new Map();
    activeCart.forEach((cartItem) => {
      const freshMatch = menuItems.find((m) => m.name === cartItem.name);
      const rawAddons =
        cartItem.addons && cartItem.addons.length
          ? cartItem.addons
          : freshMatch?.addons || [];

      rawAddons.forEach((addon) => {
        const id = slugify(addon.name);
        if (!id || map.has(id)) return;
        const rawType = (addon.type || addon.veg_type || "").toLowerCase();
        map.set(id, {
          id,
          name: addon.name,
          price: Number(addon.price) || 0,
          img: addon.img || addon.image || null,
          // "veg" | "nonveg" | null (unknown — badge omitted, not guessed)
          type:
            rawType === "veg" || addon.veg === true
              ? "veg"
              : rawType === "nonveg" || addon.veg === false
                ? "nonveg"
                : null,
        });
      });
    });
    return Array.from(map.values());
  }, [activeCart, menuItems]);

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

  // GST is a percentage passed down from the restaurant's config, so we
  // recompute the ₹ amount locally whenever add-ons change the subtotal —
  // no extra API call needed, `gstPercent` alone is enough.
  const gstAmount = useMemo(() => {
    const amount = (subtotalWithAddons * gstPercent) / 100;
    return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0;
  }, [subtotalWithAddons, gstPercent]);

  // Delivery fee is distance-based and doesn't change with add-ons, so we
  // just use the value MenuPage already computed and passed in.
  const total = subtotalWithAddons + deliveryFee + gstAmount;

  const selectedPreview = activeCart[0] || item;
  const availableMenuItems = menuItems;

  // True once we know the customer is farther than the delivery radius.
  // `distanceKm` is null until MenuPage resolves the browser location, so
  // this stays false (not blocked) until we actually know better.
  // Real-time distance from the ACTUAL selected delivery pin, not the
  // customer's one-time page-load location. This is what must gate
  // placing the order — `distanceKm` (prop) is only used for the fee
  // estimate shown before a pin is even chosen.
  const selectedDistanceKm = useMemo(() => {
    if (!location) return null;
    return getHaversineKm(
      RESTAURANT_LOCATION[0],
      RESTAURANT_LOCATION[1],
      location.lat,
      location.lng,
    );
  }, [location]);

  const effectiveDistanceKm = selectedDistanceKm ?? distanceKm;

  const outOfDeliveryZone =
    DELIVERY_RADIUS_ENFORCED &&
    effectiveDistanceKm !== null &&
    effectiveDistanceKm > deliveryRadiusKm;

  // If addons that were previously selected are no longer part of the
  // active cart (e.g. the item that offered them was removed), drop them so
  // the bill and payload never carry a "ghost" addon.
  useEffect(() => {
    setAddonSelections((current) =>
      current.filter((selected) =>
        availableAddons.some((available) => available.id === selected.id),
      ),
    );
  }, [availableAddons]);

  // A fingerprint of "what this order currently is". Used to decide whether
  // a retry should reuse the existing idempotency key (same order, network
  // hiccup) or mint a new one (the user actually changed the order).
  const getCartSignature = () =>
    JSON.stringify({
      items: activeCart.map((c) => `${c.name}:${c.quantity}:${c.price}`),
      addons: addonSelections.map((a) => a.id).sort(),
      phone: customerPhone.trim(),
      paymentMethod,
    });

  // Cross-checks every cart line against the trusted price list (the `item`
  // prop and `menuItems`, both sourced from the server/menu config — not
  // from localStorage). Catches a cart that's been hand-edited in
  // localStorage, gone stale after a menu/price change, or corrupted.
  const validateCartIntegrity = (cartToCheck) => {
    const trustedPrices = new Map();
    if (item) trustedPrices.set(item.name, item.price);
    menuItems.forEach((m) => trustedPrices.set(m.name, m.price));

    for (const cartItem of cartToCheck) {
      const trustedPrice = trustedPrices.get(cartItem.name);
      if (trustedPrice === undefined) {
        return {
          valid: false,
          reason: `"${cartItem.name}" isn't on the current menu. Please remove it and try again.`,
        };
      }
      if (Number(cartItem.price) !== Number(trustedPrice)) {
        return {
          valid: false,
          reason:
            "Prices have changed since you added this item. Please refresh and try again.",
        };
      }
      if (
        !Number.isInteger(cartItem.quantity) ||
        cartItem.quantity < 1 ||
        cartItem.quantity > 20
      ) {
        return {
          valid: false,
          reason: `"${cartItem.name}" has an invalid quantity.`,
        };
      }
    }

    const totalItems = cartToCheck.reduce((sum, c) => sum + c.quantity, 0);
    if (totalItems > 50) {
      return {
        valid: false,
        reason:
          "That's a lot of food — please keep orders to 50 items or fewer at a time.",
      };
    }
    return { valid: true };
  };

  // Slide the sheet up on mount instead of popping in.
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    const t = setTimeout(() => setInitializing(false), 550);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, []);

  // Warn before an accidental tab close/refresh mid-submit — leaving during
  // the request is exactly how "did it actually place?" duplicate orders
  // happen.
  useEffect(() => {
    const warnOnUnload = (e) => {
      if (status === "submitting") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warnOnUnload);
    return () => window.removeEventListener("beforeunload", warnOnUnload);
  }, [status]);

  // Abort any in-flight order request if the component unmounts.
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
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

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    let isMounted = true;

    const loadCustomerData = async () => {
      try {
        const [meRes, ordersRes] = await Promise.all([
          fetch("https://gk-kitchen.onrender.com/api/auth/me", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch("https://gk-kitchen.onrender.com/api/orders/my-orders", {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (meRes.ok) {
          const meData = await meRes.json();
          if (meData.token) localStorage.setItem("token", meData.token);
          const phone = meData.user?.phone || "";
          if (isMounted && phone) {
            setSavedPhone(phone);
            setCustomerPhone(phone);
          }
        }

        if (ordersRes.ok) {
          const ordersData = await ordersRes.json();
          if (isMounted) setPastOrders(ordersData.orders || []);
        }
      } catch (error) {
        console.warn("Unable to load customer order data:", error);
      }
    };

    loadCustomerData();

    return () => {
      isMounted = false;
    };
  }, []);

  // Preload the Razorpay checkout script as soon as the customer reaches
  // the payment step, so picking "Pay Online" doesn't have to wait on it.
  useEffect(() => {
    if (checkoutStep === "delivery") {
      loadRazorpayScript();
    }
  }, [checkoutStep]);

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

  const handleUseCurrentLocation = async () => {
    setLocating(true);
    try {
      const { lat, lng, accuracy } = await getReliableLocation();
      const address = await getAddressFromCoords(lat, lng);
      updateLocation({ lat, lng, address });
      setLocationError(
        accuracy > LOW_ACCURACY_THRESHOLD_M
          ? `Location may be inaccurate (±${Math.round(accuracy)}m). Please check the pin on the map below.`
          : "",
      );
    } catch (err) {
      setLocationError(err.message);
    } finally {
      setLocating(false);
    }
  };

  const handleContinueToDelivery = () => {
    setCheckoutStep("delivery");
  };

  const handleBackToReview = () => {
    setCheckoutStep("review");
  };

  // ---------------------------------------------------------------------
  // Final order submission — shared by both COD and online payment. Takes
  // whatever payment-specific fields apply (paymentStatus, and for online
  // orders the Razorpay identifiers) and does the idempotent POST to the
  // actual food-order endpoint.
  // ---------------------------------------------------------------------
  const submitOrder = async (extraPaymentFields, trimmedPhone) => {
    const token = localStorage.getItem("token");

    // Idempotency key: reuse it if this is a retry of the *same* order
    // (nothing material changed), mint a new one if the order actually
    // changed. The backend should treat repeat requests with the same
    // key as one order, no matter how many times the network makes us
    // resend it.
    const signature = getCartSignature();
    if (
      idempotencySignatureRef.current !== signature ||
      !idempotencyKeyRef.current
    ) {
      idempotencyKeyRef.current = generateIdempotencyKey();
      idempotencySignatureRef.current = signature;
    }

    const storedUser = JSON.parse(localStorage.getItem("user") || "null") || {};

    const payload = {
      idempotencyKey: idempotencyKeyRef.current,
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
        deliveryFee,
        gstPercent,
        gstAmount,
        distanceKm,
        total,
      },
      addons: addonSelections,
      paymentMethod,
      ...extraPaymentFields,
      phone_number: trimmedPhone,
      preferences,
      instructions: sanitizeInstructions(instructions),
      location,
    };

    // Bound the request with a timeout so a hung connection can never
    // leave the UI (or the user) stuck indefinitely.
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch(ORDER_API_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKeyRef.current,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      let data = {};
      try {
        data = await res.json();
      } catch {
        // Non-JSON body — fall through to the status-based error below.
      }

      if (!res.ok) {
        throw new Error(data.message || `Order request failed (${res.status})`);
      }

      setOrderId(data.data?.id || data.orderId || data.id || "—");
      setStatus("success");
      writeCartToStorage([]); // order placed — clear the persisted cart
      // Intentionally leave submitLockRef.current === true: the order is
      // placed and this screen is done, so there's nothing left to retry.
    } catch (error) {
      const timedOut = error.name === "AbortError";
      const message = timedOut
        ? "The request timed out. If the order actually went through, it'll appear under Past orders — please check there before retrying."
        : error.message || "Couldn't place the order. Please try again.";

      // If this was an online order, payment already succeeded on
      // Razorpay's side — throw so the caller can surface a "contact
      // support" message instead of a generic "try again", and keep the
      // submit lock engaged so the customer can't accidentally pay twice.
      if (extraPaymentFields?.paymentMethod === "online") {
        throw new Error(message);
      }

      setErrorMessage(message);
      setStatus("error");
      // Release the lock so the user can retry. The idempotency key is left
      // untouched, so a retry of the same order is safe to dedupe
      // server-side even if the earlier attempt actually landed.
      submitLockRef.current = false;
    } finally {
      clearTimeout(timeoutId);
      abortControllerRef.current = null;
    }
  };

  // Verifies the Razorpay payment signature server-side, then — only once
  // verified — places the actual food order tagged as paid.
  const verifyAndPlaceOrder = async (razorpayResponse, trimmedPhone) => {
    const token = localStorage.getItem("token");

    const verifyRes = await fetch(PAYMENT_VERIFY_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        razorpay_order_id: razorpayResponse.razorpay_order_id,
        razorpay_payment_id: razorpayResponse.razorpay_payment_id,
        razorpay_signature: razorpayResponse.razorpay_signature,
        amount: Number(total.toFixed(2)),
        phone_number: trimmedPhone,
      }),
    });

    const verifyData = await verifyRes.json().catch(() => ({}));
    if (!verifyRes.ok || !verifyData?.success) {
      throw new Error(
        verifyData?.message ||
          "Payment verification failed. Please contact support before retrying.",
      );
    }

    await submitOrder(
      {
        paymentMethod: "online",
        paymentStatus: "paid",
        razorpayOrderId: razorpayResponse.razorpay_order_id,
        razorpayPaymentId: razorpayResponse.razorpay_payment_id,
      },
      trimmedPhone,
    );
  };

  // Kicks off the Razorpay Checkout flow: create a payment order on the
  // backend, open the modal, and on success verify + place the order.
  const startOnlinePayment = async (trimmedPhone) => {
    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error(
          "Couldn't load the payment gateway. Please check your connection and try again.",
        );
      }

      const token = localStorage.getItem("token");
      const orderRes = await fetch(PAYMENT_CREATE_ORDER_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          amount: Number(total.toFixed(2)),
          currency: "INR",
          notes: { phone: trimmedPhone },
        }),
      });

      const orderData = await orderRes.json().catch(() => ({}));
      if (!orderRes.ok || !orderData?.data?.id) {
        throw new Error(
          orderData?.message || "Couldn't start the payment. Please try again.",
        );
      }

      const razorpayOrder = orderData.data;
      if (!razorpayOrder.key_id) {
        // The create-order endpoint needs to include the Razorpay key_id
        // in its response for Checkout to open — see paymentController.js.
        throw new Error(
          "Payment gateway isn't configured correctly. Please try Cash on Delivery, or contact us.",
        );
      }

      await new Promise((resolve, reject) => {
        const rzp = new window.Razorpay({
          key: razorpayOrder.key_id,
          amount: razorpayOrder.amount,
          currency: razorpayOrder.currency,
          name: "GK Kitchen",
          description: `Order for ${cartCount} item${cartCount === 1 ? "" : "s"}`,
          order_id: razorpayOrder.id,
          prefill: { contact: trimmedPhone },
          theme: { color: "#e2574c" },
          handler: async (response) => {
            try {
              await verifyAndPlaceOrder(response, trimmedPhone);
              resolve();
            } catch (err) {
              // By the time this handler fires, Razorpay has already taken
              // the payment — never suggest retrying the payment itself.
              const supportError = new Error(
                `We received your payment (ID: ${response.razorpay_payment_id}) but couldn't confirm the order automatically. Please contact us with this payment ID — do not pay again.`,
              );
              supportError.paymentSucceeded = true;
              reject(supportError);
            }
          },
          modal: {
            ondismiss: () => {
              reject(new Error("__PAYMENT_CANCELLED__"));
            },
          },
        });

        rzp.on("payment.failed", (response) => {
          reject(
            new Error(
              response?.error?.description ||
                "Payment failed. Please try again.",
            ),
          );
        });

        rzp.open();
      });
    } catch (error) {
      if (error?.message === "__PAYMENT_CANCELLED__") {
        // No charge was made — just unlock and let them try again.
        setStatus("idle");
        setErrorMessage("");
        submitLockRef.current = false;
        return;
      }

      setErrorMessage(
        error.message || "Couldn't complete the payment. Please try again.",
      );
      setStatus("error");
      // If the payment already succeeded, keep the lock engaged — there's
      // nothing safe left to retry from here, only support can help.
      submitLockRef.current = error?.paymentSucceeded ? true : false;
    }
  };

  const handlePlaceOrder = async () => {
    // 1. Synchronous re-entrancy guard — closes the race a state-only check
    //    can't close (see comment on submitLockRef above).
    if (submitLockRef.current) return;

    if (!location) return;

    if (outOfDeliveryZone) return;

    // 2. Fail fast if we're offline — no point burning a request/timeout.
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setErrorMessage(
        "You appear to be offline. Please check your connection and try again.",
      );
      setStatus("error");
      return;
    }

    // 3. Auth checks.
    const token = localStorage.getItem("token");
    if (!token) {
      setErrorMessage("Please login before placing your order.");
      setStatus("error");
      return;
    }
    if (isTokenExpired(token)) {
      setErrorMessage("Your session has expired. Please login again.");
      setStatus("error");
      return;
    }

    // 4. Phone validation — always re-validated at submit time, even if it
    //    was pre-filled from the account, since the field is editable.
    const trimmedPhone = customerPhone.trim();
    if (!trimmedPhone) {
      setPhoneError("Please enter a phone number for this order.");
      return;
    }
    if (!isValidPhone(trimmedPhone)) {
      setPhoneError("Please enter a valid 10-digit mobile number.");
      return;
    }

    // 5. Location sanity check (not null/garbage/out-of-range).

    if (!isValidLocation(location)) {
      setErrorMessage("Please select a valid delivery location on the map.");
      setStatus("error");
      return;
    }

    // Re-check the ACTUAL selected pin against the delivery radius — never
    // trust a distance computed before the pin was chosen.
    const finalDistanceKm = getHaversineKm(
      RESTAURANT_LOCATION[0],
      RESTAURANT_LOCATION[1],
      location.lat,
      location.lng,
    );
    if (DELIVERY_RADIUS_ENFORCED && finalDistanceKm > deliveryRadiusKm) {
      setErrorMessage(
        `Sorry, this delivery point is about ${finalDistanceKm.toFixed(1)} km away, outside our ${deliveryRadiusKm} km delivery area.`,
      );
      setStatus("error");
      return;
    }

    // 6. Cart can't be empty, and every line must match the trusted menu
    //    data (guards against a tampered/stale localStorage cart).
    if (activeCart.length === 0) {
      setErrorMessage("Your cart is empty.");
      setStatus("error");
      return;
    }
    const integrity = validateCartIntegrity(activeCart);
    if (!integrity.valid) {
      setErrorMessage(integrity.reason);
      setStatus("error");
      return;
    }

    // 7. Total sanity check.
    if (!Number.isFinite(total) || total <= 0) {
      setErrorMessage(
        "Something looks off with your order total. Please refresh and try again.",
      );
      setStatus("error");
      return;
    }

    // Everything checked out — lock immediately, before any await, so a
    // second click landing in the same tick is a no-op.
    submitLockRef.current = true;
    setStatus("submitting");
    setPhoneError("");
    setErrorMessage("");

    // 8. Branch on payment method. COD goes straight to placing the order;
    //    online payment has to clear Razorpay first, and only places the
    //    order once the payment is verified.
    if (paymentMethod === "online") {
      await startOnlinePayment(trimmedPhone);
    } else {
      await submitOrder({ paymentStatus: "pending" }, trimmedPhone);
    }
  };

  // Reused across every "Bill details" block so the split always reads
  // identically no matter which stage it's shown on.
  const renderBillDetails = (itemsLabel, itemsTotal) => (
    <div className="order-block">
      <p className="order-block-label">Bill details</p>
      <div className="order-price-row">
        <span>{itemsLabel}</span>
        <span>₹{itemsTotal}</span>
      </div>
      {addonsSubtotal > 0 && (
        <div className="order-price-row">
          <span>Add-ons</span>
          <span>₹{addonsSubtotal}</span>
        </div>
      )}
      <div className="order-price-row">
        <span>
          Delivery fee
          {effectiveDistanceKm !== null
            ? ` (${effectiveDistanceKm.toFixed(1)} km)`
            : ""}
        </span>
        <span>
          ₹{deliveryFee.toFixed ? deliveryFee.toFixed(2) : deliveryFee}
        </span>
      </div>
      <div className="order-price-row">
        <span>GST{gstPercent ? ` (${gstPercent}%)` : ""}</span>
        <span>₹{gstAmount.toFixed(2)}</span>
      </div>
      <div className="order-price-row order-price-row--total">
        <span>To pay</span>
        <span>₹{total.toFixed ? total.toFixed(2) : total}</span>
      </div>
    </div>
  );

  // Shown wherever the customer could take an ordering action, once we know
  // they're outside the delivery radius.
  const renderOutOfZoneNotice = () =>
    outOfDeliveryZone && (
      <div className="order-block">
        <p className="order-error-text">
          
          sorry, you're about {effectiveDistanceKm.toFixed(1)} km away and we
          currently only deliver within {deliveryRadiusKm} km. We're not
          available at your location yet.
        </p>
      </div>
    );

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

      {renderBillDetails(`Item total × ${quantity}`, subtotal)}

      {renderOutOfZoneNotice()}
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
          {availableAddons.length > 0 && (
            <button
              type="button"
              className="order-secondary-btn"
              onClick={() => setShowAddonsModal(true)}
            >
              Add add-ons
            </button>
          )}
        </div>

        {addonSelections.length > 0 ? (
          <div className="order-addon-list">
            {addonSelections.map((addon) => (
              <span key={addon.id} className="order-addon-pill">
                <span className="order-addon-pill-media">
                  {addon.img ? (
                    <img
                      src={addon.img}
                      alt=""
                      className="order-addon-pill-icon"
                    />
                  ) : (
                    <span
                      className="order-addon-pill-icon-fallback"
                      aria-hidden="true"
                    >
                      🍽️
                    </span>
                  )}
                  {addon.type && (
                    <span
                      className={`order-veg-dot order-veg-dot--${addon.type}`}
                      title={addon.type === "veg" ? "Veg" : "Non-Veg"}
                    />
                  )}
                </span>
                <span className="order-addon-pill-text">
                  {addon.name}{" "}
                  <span className="order-addon-pill-price">₹{addon.price}</span>
                </span>
                <button
                  type="button"
                  className="order-addon-pill-remove"
                  aria-label={`Remove ${addon.name}`}
                  onClick={() => toggleAddon(addon)}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="order-addon-empty">
            {availableAddons.length > 0
              ? "No add-ons selected yet."
              : "No add-ons available for the items in your cart."}
          </p>
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
              {availableAddons.length === 0 ? (
                <p className="order-addon-empty">
                  No add-ons available for the items in your cart.
                </p>
              ) : (
                availableAddons.map((addon) => {
                  const selected = addonSelections.some(
                    (selection) => selection.id === addon.id,
                  );
                  return (
                    <div
                      className={`order-addon-option ${selected ? "order-addon-option--selected" : ""}`}
                      key={addon.id}
                      onClick={() => toggleAddon(addon)}
                    >
                      <div className="order-addon-option-icon">
                        {addon.img ? (
                          <img
                            src={addon.img}
                            alt={addon.name}
                            className="order-addon-icon-img"
                          />
                        ) : (
                          <span
                            className="order-addon-icon-fallback"
                            aria-hidden="true"
                          >
                            🍽️
                          </span>
                        )}
                        {addon.type && (
                          <span
                            className={`order-veg-dot order-veg-dot--${addon.type} order-veg-dot--corner`}
                            title={addon.type === "veg" ? "Veg" : "Non-Veg"}
                          />
                        )}
                      </div>

                      <div className="order-addon-option-copy">
                        <strong>{addon.name}</strong>
                        <span className="order-addon-option-price">
                          ₹{addon.price}
                        </span>
                      </div>

                      <button
                        type="button"
                        className={`order-addon-option-btn ${selected ? "order-addon-option-btn--active" : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleAddon(addon);
                        }}
                      >
                        {selected ? "Added" : "Add"}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      <div className="order-divider" />

      {renderBillDetails(`Item total × ${cartCount}`, subtotal)}

      {renderOutOfZoneNotice()}
    </>
  );

  // STEP 2 of checkout: delivery location, instructions, preferences, payment.
  const renderCheckoutDeliveryStage = () => (
    <>
      {renderOutOfZoneNotice()}

      <div className="order-block">
        <p className="order-block-label">Phone number</p>

        {savedPhone && !isEditingPhone ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <span className="order-saved-phone">
              {customerPhone || savedPhone}
            </span>
            <button
              type="button"
              className="order-secondary-btn"
              onClick={() => setIsEditingPhone(true)}
            >
              Change
            </button>
          </div>
        ) : (
          <>
            <input
              className="order-input"
              inputMode="tel"
              maxLength={15}
              value={customerPhone}
              onChange={(e) => {
                // Allow only digits, spaces, dashes, and a leading +.
                setCustomerPhone(e.target.value.replace(/[^\d+\s-]/g, ""));
                setPhoneError("");
              }}
              placeholder="Enter your phone number"
              autoFocus={isEditingPhone}
            />
            {savedPhone && (
              <button
                type="button"
                className="order-secondary-btn"
                style={{ marginTop: 8 }}
                onClick={() => {
                  setCustomerPhone(savedPhone);
                  setIsEditingPhone(false);
                  setPhoneError("");
                }}
              >
                Use saved number
              </button>
            )}
          </>
        )}

        {phoneError && <p className="order-error-text">{phoneError}</p>}
      </div>

      <div className="order-divider" />

      <div className="order-block">
        <p className="order-block-label">Deliver to</p>
        {locationError && (
          <p className="order-error-text">{locationError}</p>
        )}{" "}
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
          selectedLocation={location}
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
          maxLength={500}
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
          className={`order-payment-row ${paymentMethod === "online" ? "order-payment-row--active" : ""}`}
          onClick={() => setPaymentMethod("online")}
        >
          <span
            className="order-radio"
            data-checked={paymentMethod === "online"}
          />
          <span className="order-payment-label">Pay Online</span>
          <span className="order-payment-sub">
            UPI, cards &amp; netbanking · secured by Razorpay
          </span>
        </button>
      </div>

      {status === "error" && (
        <p className="order-error-text">
          {errorMessage || "Couldn't place the order. Please try again."}
        </p>
      )}

      {pastOrders.length > 0 && (
        <>
          <div className="order-divider" />
          <div className="order-block">
            <p className="order-block-label">Past orders</p>
            <div className="order-past-list">
              {pastOrders.slice(0, 3).map((pastOrder) => (
                <div className="order-past-row" key={pastOrder.id}>
                  <span>Order #{pastOrder.id}</span>
                  <strong>₹{pastOrder.total_price}</strong>
                  <small>{pastOrder.status || "Pending"}</small>
                </div>
              ))}
            </div>
          </div>
        </>
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
            <p className=" order-result-text">
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
                      <span className="order-footer-total-value">
                        ₹{total.toFixed ? total.toFixed(2) : total}
                      </span>
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
                      disabled={outOfDeliveryZone}
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
                      <span className="order-footer-total-value">
                        ₹{total.toFixed ? total.toFixed(2) : total}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="order-cta"
                      onClick={handleCheckoutFromSelection}
                      disabled={cartCount === 0 || outOfDeliveryZone}
                    >
                      Checkout cart
                    </button>
                  </>
                ) : checkoutStep === "review" ? (
                  <>
                    <div className="order-footer-total">
                      <span className="order-footer-total-label">Total</span>
                      <span className="order-footer-total-value">
                        ₹{total.toFixed ? total.toFixed(2) : total}
                      </span>
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
                      disabled={cartCount === 0 || outOfDeliveryZone}
                    >
                      Continue
                    </button>
                  </>
                ) : (
                  <>
                    <div className="order-footer-total">
                      <span className="order-footer-total-label">Total</span>
                      <span className="order-footer-total-value">
                        ₹{total.toFixed ? total.toFixed(2) : total}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="order-secondary-cta"
                      onClick={handleBackToReview}
                      disabled={status === "submitting"}
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      className="order-cta"
                      onClick={handlePlaceOrder}
                      disabled={
                        !location ||
                        !customerPhone.trim() ||
                        status === "submitting" ||
                        outOfDeliveryZone
                      }
                    >
                      {status === "submitting" ? (
                        <Spinner />
                      ) : paymentMethod === "online" ? (
                        "Pay & Place Order"
                      ) : (
                        "Place Order"
                      )}
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