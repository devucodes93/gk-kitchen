const CART_STORAGE_KEY = "gk-cart";

export const normalizeCartItem = (item) => {
  if (!item || typeof item !== "object") return null;

  const quantity = Number.isFinite(Number(item.quantity))
    ? Math.max(1, Number(item.quantity))
    : 1;

  return {
    id: item.id || item.menu_id || item.name || null,
    name: item.name || "",
    price: Number.isFinite(Number(item.price)) ? Number(item.price) : 0,
    category: item.category || "",
    type: item.type || "veg",
    img: item.img || "",
    desc: item.desc || "",
    available: item.available !== false,
    quantity,
  };
};

export const normalizeCart = (cart) => {
  if (!Array.isArray(cart)) return [];
  return cart
    .map(normalizeCartItem)
    .filter(Boolean)
    .filter((item) => item.name);
};

export const readCartFromStorage = (fallbackCart = []) => {
  if (Array.isArray(fallbackCart) && fallbackCart.length) {
    return normalizeCart(fallbackCart);
  }

  try {
    const stored = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || "[]");
    return normalizeCart(stored);
  } catch {
    return [];
  }
};

export const writeCartToStorage = (cart) => {
  const normalized = normalizeCart(cart).slice(0, 50);

  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(normalized));
    return true;
  } catch (error) {
    try {
      localStorage.removeItem(CART_STORAGE_KEY);
    } catch {
      // ignore cleanup errors
    }
    console.warn("Unable to persist cart to localStorage:", error);
    return false;
  }
};
