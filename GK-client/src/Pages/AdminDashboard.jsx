import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  FaBars,
  FaBoxOpen,
  FaChartLine,
  FaCog,
  FaEdit,
  FaGift,
  FaMoon,
  FaPlus,
  FaMapMarkerAlt,
  FaPhoneAlt,
  FaSearch,
  FaSignOutAlt,
  FaTrash,
  FaUsers,
  FaUtensils,
} from "react-icons/fa";
import API from "../api/api";
// Adjust this import path to wherever LocationMap actually lives in your project.
import LocationMap from "../components/LocationMap/LocationMap";
import "./AdminDashboard.css";

// The full, ordered lifecycle a normal (non-cancelled) order moves through.
// The UI only ever shows the ONE next action in this list — never a free
// jump-to-any-status control — so there's no way to get confused about
// what "next" means.
const STATUS_FLOW = [
  "Pending",
  "Preparing",
  "Ready",
  "Out for Delivery",
  "Delivered",
];
const ORDER_STATUSES = [...STATUS_FLOW, "Cancelled"];
const PAGE_SIZE = 8;

const emptyMenuForm = {
  menu_type: "Veg",
  menu_name: "",
  price: "",
  category: "",
  image_url: "",
  description: "",
  is_available: true,
  original_price: "",
  discounted_price: "",
  is_discounted: false,
};

const emptyOfferForm = {
  title: "",
  description: "",
  discount_type: "percent",
  discount_value: "",
  enabled: true,
};

const currency = (value) => `Rs. ${Number(value || 0).toLocaleString("en-IN")}`;
const dateTime = (value) =>
  value ? new Date(value).toLocaleString() : "Not available";
const statusClass = (status = "Pending") =>
  `admin-status admin-status--${status.toLowerCase().replaceAll(" ", "-")}`;

const unwrap = (response, key = "data") =>
  response.data?.[key] || response.data || [];

const parseItems = (items) => {
  if (Array.isArray(items)) return items;
  try {
    const parsed = JSON.parse(items || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

// Order objects can arrive from several different endpoints (dashboard
// summary, orders list, SSE push, single-order fetch) that don't all carry
// the same fields. Anything that identifies a customer's phone number goes
// through here so "Phone: Not available" only shows when it's genuinely
// missing from the backend, not because the frontend guessed the wrong key.
const getOrderPhone = (order = {}) =>
  order.phone_number ||
  order.phone ||
  order.customer_phone ||
  order.contact_number ||
  order.customerPhone ||
  "";

// The next status in the normal flow, or null if the order is already at
// the end of the line (Delivered) or was cancelled.
const nextStatus = (status) => {
  const index = STATUS_FLOW.indexOf(status || "Pending");
  if (index === -1 || index === STATUS_FLOW.length - 1) return null;
  return STATUS_FLOW[index + 1];
};

// A summary order (from /admin/dashboard or /orders) is missing the fields
// only the single-order endpoint returns. Use this to decide whether we
// need to go fetch the rest before opening the details drawer.
const isSummaryOrder = (order = {}) =>
  order.items === undefined ||
  order.location === undefined ||
  getOrderPhone(order) === "";

const normalizeMenu = (item = {}) => ({
  ...emptyMenuForm,
  ...item,
  id: item.menu_id,
  menu_name: item.menu_name || "",
  price: item.price || "",
  category: item.category || "",
  image_url: item.image_url || "",
  description: item.description || "",
  is_available: item.is_available !== false,
  original_price: item.original_price || item.price || "",
  discounted_price: item.discounted_price || "",
  is_discounted: item.is_discounted === true,
});

const upsertNewestOrder = (orders, nextOrder) => {
  const existing = orders.some((order) => order.id === nextOrder.id);
  const nextOrders = existing
    ? orders.map((order) => (order.id === nextOrder.id ? nextOrder : order))
    : [nextOrder, ...orders];

  return nextOrders.sort(
    (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0),
  );
};

const AdminDashboard = () => {
  const [activeView, setActiveView] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [detailOrder, setDetailOrder] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [customerDetail, setCustomerDetail] = useState(null);
  const [needsAdminLogin, setNeedsAdminLogin] = useState(
    !localStorage.getItem("adminToken"),
  );
  const [adminLoginForm, setAdminLoginForm] = useState({
    email: "",
    password: "",
  });
  const [busyOrderId, setBusyOrderId] = useState(null);

  const [dashboard, setDashboard] = useState({});
  const [menuItems, setMenuItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [offers, setOffers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [restaurant, setRestaurant] = useState({});
  const [profile, setProfile] = useState({
    name: "",
    phone: "",
    picture: "",
    currentPassword: "",
    newPassword: "",
  });

  const [menuForm, setMenuForm] = useState(emptyMenuForm);
  const [editingMenuId, setEditingMenuId] = useState(null);
  const [offerForm, setOfferForm] = useState(emptyOfferForm);
  const [editingOfferId, setEditingOfferId] = useState(null);
  const [categoryForm, setCategoryForm] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState(null);

  const [menuSearch, setMenuSearch] = useState("");
  const [menuCategory, setMenuCategory] = useState("all");
  const [orderSearch, setOrderSearch] = useState("");
  const [orderStatus, setOrderStatus] = useState("all");
  const [menuPage, setMenuPage] = useState(1);
  const [orderPage, setOrderPage] = useState(1);
  const [customerPage, setCustomerPage] = useState(1);

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: FaChartLine },
    { id: "menu", label: "Menu", icon: FaUtensils },
    { id: "orders", label: "Orders", icon: FaBoxOpen },
    { id: "offers", label: "Offers", icon: FaGift },
    { id: "customers", label: "Customers", icon: FaUsers },
    { id: "categories", label: "Categories", icon: FaBars },
    { id: "settings", label: "Settings", icon: FaCog },
    { id: "profile", label: "Profile", icon: FaUsers },
  ];

  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3200);
  }, []);

  const runAction = async (loadingMessage, action, successMessage) => {
    setToast({ message: loadingMessage, type: "loading" });
    try {
      const result = await action();
      showToast(successMessage);
      return result;
    } catch (error) {
      showToast(error.response?.data?.message || "Action failed", "error");
      throw error;
    }
  };

  const playOrderAlert = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const audioContext = new AudioContext();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(780, audioContext.currentTime);
      gain.gain.setValueAtTime(0.001, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.18,
        audioContext.currentTime + 0.02,
      );
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        audioContext.currentTime + 0.35,
      );
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.36);
    } catch {
      // Some browsers block sound until the page has user interaction.
    }
  };

  const notifyNewOrder = (order) => {
    showToast(`New order #${order.id} from ${order.customer_name || "Guest"}`);
    playOrderAlert();

    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") {
      new Notification("New restaurant order", {
        body: `Order #${order.id} - ${currency(order.total_price)}`,
      });
    } else if (Notification.permission === "default") {
      Notification.requestPermission();
    }
  };
  const loadedRef = useRef(new Set());

  const setAdminTokenForRequest = () => {
    const adminToken = localStorage.getItem("adminToken");
    if (adminToken) localStorage.setItem("token", adminToken);
    return adminToken;
  };

  const fetchDashboard = async () => {
    setAdminTokenForRequest();
    setDashboard((await API.get("/admin/dashboard")).data?.data || {});
  };
  const fetchMenu = async () => {
    const res = await API.get("/menu");
    setMenuItems((Array.isArray(res.data) ? res.data : []).map(normalizeMenu));
  };
  const fetchOrders = async () => {
    setAdminTokenForRequest();
    const list = unwrap(await API.get("/orders"));
    setOrders(list);
    return list;
  };
  const fetchOffers = async () => {
    setAdminTokenForRequest();
    setOffers(unwrap(await API.get("/admin/offers")));
  };
  const fetchCustomers = async () => {
    setAdminTokenForRequest();
    setCustomers(unwrap(await API.get("/admin/customers")));
  };
  const fetchCategories = async () => {
    setAdminTokenForRequest();
    setCategories(unwrap(await API.get("/admin/categories")));
  };
  const fetchRestaurant = async () => {
    setAdminTokenForRequest();
    setRestaurant((await API.get("/admin/restaurant")).data?.data || {});
  };
  const fetchMe = async () => {
    setAdminTokenForRequest();
    const response = await API.get("/auth/me");
    setProfile((current) => ({
      ...current,
      ...(response.data?.user || {}),
    }));
  };

  const VIEW_FETCHERS = {
    dashboard: [fetchDashboard],
    menu: [fetchCategories, fetchMenu],
    orders: [fetchOrders],
    offers: [fetchOffers],
    customers: [fetchCustomers],
    categories: [fetchCategories],
    settings: [fetchRestaurant],
    profile: [fetchMe],
  };

  // Runs each fetcher for a view ONE AFTER ANOTHER (not in parallel via
  // Promise.all) and, thanks to loadedRef, only the first time a tab is
  // opened in this session — switching back to a tab you've already visited
  // does not re-hit the API at all.
  const loadView = useCallback(
    async (view, { force = false } = {}) => {
      if (!force && loadedRef.current.has(view)) return;
      setAdminTokenForRequest();
      setLoading(true);
      try {
        for (const fn of VIEW_FETCHERS[view] || []) {
          await fn(); // sequential on purpose — one request completes before the next starts
        }
        loadedRef.current.add(view);
      } catch (err) {
        if ([401, 403].includes(err.response?.status)) setNeedsAdminLogin(true);
        else
          showToast(
            err.response?.data?.message || "Unable to load data",
            "error",
          );
      } finally {
        setLoading(false);
      }
    },
<<<<<<< HEAD
    [showToast], // add any other outer-scope values it reads: setAdminTokenForRequest, setLoading, setNeedsAdminLogin, VIEW_FETCHERS
  );// include loadView now
=======
    [showToast],
  );
>>>>>>> c6d7accacef009fe61131b1b49121700d1506a36

  // initial + tab-change load (only fetches if that tab hasn't loaded yet)
  useEffect(() => {
    if (needsAdminLogin) return;
    loadView(activeView);
  }, [activeView, needsAdminLogin, loadView]);

  // Live order updates over SSE. This connects ONCE per login session — it
  // does not depend on activeView, so switching tabs never reopens the
  // connection or fires extra requests.
  useEffect(() => {
    if (needsAdminLogin) return undefined;
    const adminToken = localStorage.getItem("adminToken");
    if (!adminToken) return undefined;

    const source = new EventSource(
      `https://gk-kitchen.onrender.com/api/orders/events?token=${encodeURIComponent(adminToken)}`,
    );

    const handleOrderEvent = (event) => {
      const order = JSON.parse(event.data || "{}").order;
      if (!order) return;

      setOrders((current) => {
        if (!loadedRef.current.has("orders")) return current;
        return upsertNewestOrder(current, order);
      });
      // Only replace the open drawer's order if the pushed payload actually
      // has the full detail fields — otherwise a slim SSE payload could
      // blow away the full order we already fetched for the drawer.
      setDetailOrder((current) => {
        if (current?.id !== order.id) return current;
        return isSummaryOrder(order) ? { ...current, ...order } : order;
      });

      if (event.type === "order-created") notifyNewOrder(order);
      setDashboard((current) => {
        if (!loadedRef.current.has("dashboard")) return current;
        const recentOrders = upsertNewestOrder(
          current.recentOrders || [],
          order,
        ).slice(0, 8);

        if (event.type !== "order-created") {
          return { ...current, recentOrders };
        }

        return {
          ...current,
          totalOrders: Number(current.totalOrders || 0) + 1,
          pendingOrders:
            (order.status || "Pending") === "Pending"
              ? Number(current.pendingOrders || 0) + 1
              : current.pendingOrders || 0,
          totalRevenue:
            Number(current.totalRevenue || 0) + Number(order.total_price || 0),
          todaysRevenue:
            String(order.created_at || "").slice(0, 10) ===
            new Date().toISOString().slice(0, 10)
              ? Number(current.todaysRevenue || 0) +
                Number(order.total_price || 0)
              : current.todaysRevenue || 0,
          recentOrders,
        };
      });
    };

    source.addEventListener("order-created", handleOrderEvent);
    source.addEventListener("order-updated", handleOrderEvent);
    source.addEventListener("order-picked", handleOrderEvent);

    return () => source.close();
  }, [needsAdminLogin]);

  const filteredMenu = useMemo(() => {
    return menuItems.filter((item) => {
      const matchesSearch = item.menu_name
        .toLowerCase()
        .includes(menuSearch.toLowerCase());
      const matchesCategory =
        menuCategory === "all" || item.category === menuCategory;
      return matchesSearch && matchesCategory;
    });
  }, [menuItems, menuSearch, menuCategory]);

  const filteredOrders = useMemo(() => {
    return orders
      .filter((order) => {
        const haystack =
          `${order.id} ${order.customer_name || ""}`.toLowerCase();
        const matchesSearch = haystack.includes(orderSearch.toLowerCase());
        const currentStatus = order.status || "Pending";
        const matchesStatus =
          orderStatus === "all" || currentStatus === orderStatus;
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        const aDone = (a.status || "Pending") === "Delivered";
        const bDone = (b.status || "Pending") === "Delivered";
        if (aDone !== bDone) return aDone ? 1 : -1;
        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      });
  }, [orders, orderSearch, orderStatus]);

  useEffect(() => {
    setOrderPage(1);
  }, [orderSearch, orderStatus]);

  useEffect(() => {
    setMenuPage(1);
  }, [menuSearch, menuCategory]);

  const page = (items, currentPage) =>
    items.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleImage = async (event, setter) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const cloudName = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET;

    // Show preview immediately
    const preview = URL.createObjectURL(file);

    setter((prev) => ({
      ...prev,
      image_url: preview,
      _imageFile: file,
    }));

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", uploadPreset);

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        {
          method: "POST",
          body: formData,
        },
      );

      const data = await response.json();

      setter((prev) => ({
        ...prev,
        image_url: data.secure_url,
        _imageFile: null,
      }));
    } catch (err) {
      console.error(err);
    }
  };

  const saveMenu = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const {
        menu_type,
        menu_name,
        price,
        category,
        image_url,
        description,
        is_available,
        original_price,
        discounted_price,
        is_discounted,
        _imageFile,
      } = menuForm;

      const payload = {
        menu_type,
        menu_name,
        price: Number(price || 0),
        category,
        image_url,
        description,
        is_available,
        original_price: Number(original_price || price || 0),
        discounted_price: discounted_price ? Number(discounted_price) : null,
        is_discounted,
      };

      if (_imageFile) {
        const cloudName = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME;
        const uploadPreset = process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET;
        if (!cloudName || !uploadPreset) {
          throw new Error(
            "Cloudinary not configured. Please configure Cloudinary before saving.",
          );
        }
        const formData = new FormData();
        formData.append("file", _imageFile);
        formData.append("upload_preset", uploadPreset);
        setToast({ message: "Uploading image...", type: "loading" });
        const res = await fetch(
          `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
          { method: "POST", body: formData },
        );
        const data = await res.json();
        if (data && (data.secure_url || data.url)) {
          payload.image_url = data.secure_url || data.url;
        } else {
          throw new Error(data?.error?.message || "Upload failed");
        }
      }
      setToast({
        message: editingMenuId ? "Saving menu item..." : "Adding menu item...",
        type: "loading",
      });
      if (editingMenuId) {
        const response = await API.put(`/menu/${editingMenuId}`, payload);
        setMenuItems((current) =>
          current.map((item) =>
            item.menu_id === editingMenuId
              ? normalizeMenu(response.data.data)
              : item,
          ),
        );
        showToast("Menu item updated");
      } else {
        const response = await API.post("/menu", payload);
        setMenuItems((current) => [
          normalizeMenu(response.data.data),
          ...current,
        ]);
        showToast("Menu item added");
      }
      setMenuForm(emptyMenuForm);
      setEditingMenuId(null);
    } catch (error) {
      showToast(
        error.response?.data?.message || "Unable to save menu item",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  const editMenu = (item) => {
    setMenuForm(normalizeMenu(item));
    setEditingMenuId(item.menu_id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteMenu = (id) =>
    setConfirmAction({
      title: "Delete menu item?",
      message: "This removes the item from the customer menu.",
      onConfirm: async () => {
        await runAction(
          "Deleting menu item...",
          async () => {
            await API.delete(`/menu/${id}`);
            setMenuItems((current) =>
              current.filter((item) => item.menu_id !== id),
            );
          },
          "Menu item deleted",
        );
      },
    });

  const updateMenuStatus = async (item) => {
    await runAction(
      "Updating availability...",
      async () => {
        const response = await API.patch(`/menu/${item.menu_id}/status`, {
          is_available: !item.is_available,
        });
        setMenuItems((current) =>
          current.map((menuItem) =>
            menuItem.menu_id === item.menu_id
              ? normalizeMenu(response.data.data)
              : menuItem,
          ),
        );
      },
      "Availability updated",
    );
  };

  const updateOrderStatus = async (order, status) => {
    const applyStatus = async () => {
      setBusyOrderId(order.id);
      const response = await API.patch(`/orders/${order.id}/status`, {
        status,
      });
      setOrders((current) =>
        current.map((existingOrder) =>
          existingOrder.id === order.id ? response.data.data : existingOrder,
        ),
      );
      setDetailOrder((current) =>
        current?.id === order.id
          ? { ...current, ...response.data.data }
          : current,
      );
      setBusyOrderId(null);
      return response;
    };

    if (status === "Cancelled") {
      setConfirmAction({
        title: "Cancel this order?",
        message: "The order status will be changed to Cancelled.",
        onConfirm: async () => {
          try {
            await runAction(
              "Cancelling order...",
              applyStatus,
              "Order cancelled",
            );
          } finally {
            setBusyOrderId(null);
          }
        },
      });
      return;
    }

    try {
      await runAction(
        "Updating order status...",
        applyStatus,
        "Order status updated",
      );
    } finally {
      setBusyOrderId(null);
    }
  };

  const saveOffer = async (event) => {
    event.preventDefault();
    const payload = {
      ...offerForm,
      discount_value: Number(offerForm.discount_value || 0),
    };
    setToast({ message: "Saving offer...", type: "loading" });
    if (editingOfferId) {
      const response = await API.put(
        `/admin/offers/${editingOfferId}`,
        payload,
      );
      setOffers((current) =>
        current.map((offer) =>
          offer.id === editingOfferId ? response.data.data : offer,
        ),
      );
      showToast("Offer updated");
    } else {
      const response = await API.post("/admin/offers", payload);
      setOffers((current) => [response.data.data, ...current]);
      showToast("Offer created");
    }
    setOfferForm(emptyOfferForm);
    setEditingOfferId(null);
  };

  const deleteOffer = (id) =>
    setConfirmAction({
      title: "Delete offer?",
      message: "This offer will no longer be available.",
      onConfirm: async () => {
        await runAction(
          "Deleting offer...",
          async () => {
            await API.delete(`/admin/offers/${id}`);
            setOffers((current) => current.filter((offer) => offer.id !== id));
          },
          "Offer deleted",
        );
      },
    });

  const saveCategory = async (event) => {
    event.preventDefault();
    if (!categoryForm.trim()) return;
    setToast({ message: "Saving category...", type: "loading" });
    if (editingCategoryId) {
      const response = await API.put(`/admin/categories/${editingCategoryId}`, {
        name: categoryForm.trim(),
      });
      setCategories((current) =>
        current.map((category) =>
          category.id === editingCategoryId ? response.data.data : category,
        ),
      );
      showToast("Category updated");
    } else {
      const response = await API.post("/admin/categories", {
        name: categoryForm.trim(),
      });
      setCategories((current) =>
        [...current, response.data.data].sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      );
      showToast("Category created");
    }
    setCategoryForm("");
    setEditingCategoryId(null);
  };

  const deleteCategory = (id) =>
    setConfirmAction({
      title: "Delete category?",
      message: "Menu items will keep their current category text.",
      onConfirm: async () => {
        await runAction(
          "Deleting category...",
          async () => {
            await API.delete(`/admin/categories/${id}`);
            setCategories((current) =>
              current.filter((category) => category.id !== id),
            );
          },
          "Category deleted",
        );
      },
    });

  const saveRestaurant = async (event) => {
    event.preventDefault();
    await runAction(
      "Saving restaurant settings...",
      async () => {
        const response = await API.put("/admin/restaurant", restaurant);
        setRestaurant(response.data.data || restaurant);
      },
      "Restaurant settings updated",
    );
  };

  const toggleOrdering = async () => {
    await runAction(
      restaurant.is_accepting_orders === false
        ? "Opening online orders..."
        : "Pausing online orders...",
      async () => {
        let currentRestaurant = restaurant;
        if (!currentRestaurant.id) {
          const restaurantResponse = await API.get("/admin/restaurant");
          currentRestaurant = restaurantResponse.data?.data || {};
        }
        const response = await API.put("/admin/restaurant", {
          ...currentRestaurant,
          is_accepting_orders: currentRestaurant.is_accepting_orders === false,
        });
        setRestaurant(response.data.data || currentRestaurant);
      },
      restaurant.is_accepting_orders === false
        ? "Online ordering is open"
        : "Online ordering is paused",
    );
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    await API.patch("/admin/profile", profile);
    showToast("Profile updated");
    setProfile((current) => ({
      ...current,
      currentPassword: "",
      newPassword: "",
    }));
  };

  const logout = () => {
    localStorage.removeItem("adminToken");
    localStorage.removeItem("token");
    setNeedsAdminLogin(true);
  };
  const handleAdminLogin = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await API.post("/auth/admin-login", adminLoginForm);
      localStorage.setItem("adminToken", response.data.token);
      localStorage.setItem("token", response.data.token);
      showToast(response.data.message || "Admin login successful");
      setNeedsAdminLogin(false);
      loadedRef.current.clear(); // force a fresh load for the session
      await loadView("dashboard", { force: true });
    } catch (error) {
      showToast(
        error.response?.data?.message || "Unable to login as admin",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  // Opens the order details drawer. If the order we already have in state
  // is a slim summary (from the dashboard/orders list), fetch the single
  // full order first so items/location/phone are populated. Orders that
  // already carry full detail (e.g. a fresh SSE push) skip the network
  // call entirely.
  const openOrderDetails = async (order) => {
    setDetailOrder(order);
    if (!isSummaryOrder(order)) return;

    setDetailLoading(true);
    try {
      setAdminTokenForRequest();
      const response = await API.get(`/orders/${order.id}`);
      const full = response.data?.data || response.data;
      if (full) setDetailOrder((current) => ({ ...current, ...full }));
    } catch (error) {
      showToast(
        error.response?.data?.message || "Couldn't load full order details",
        "error",
      );
    } finally {
      setDetailLoading(false);
    }
  };

  const renderPagination = (total, currentPage, setCurrentPage) => {
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    return (
      <div className="admin-pagination">
        <button
          type="button"
          disabled={currentPage === 1}
          onClick={() => setCurrentPage(currentPage - 1)}
        >
          Previous
        </button>
        <span>
          Page {currentPage} of {totalPages}
        </span>
        <button
          type="button"
          disabled={currentPage === totalPages}
          onClick={() => setCurrentPage(currentPage + 1)}
        >
          Next
        </button>
      </div>
    );
  };

  const statCards = [
    ["Total Revenue", currency(dashboard.totalRevenue), FaChartLine],
    ["Today's Revenue", currency(dashboard.todaysRevenue), FaChartLine],
    ["Total Orders", dashboard.totalOrders || 0, FaBoxOpen],
    ["Pending Orders", dashboard.pendingOrders || 0, FaBoxOpen],
    ["Completed Orders", dashboard.completedOrders || 0, FaBoxOpen],
    ["Cancelled Orders", dashboard.cancelledOrders || 0, FaBoxOpen],
    ["Total Customers", dashboard.totalCustomers || 0, FaUsers],
    ["Menu Items", dashboard.totalMenuItems || 0, FaUtensils],
  ];

  const renderDashboard = () => (
    <>
      <section className="admin-stats-grid">
        {statCards.map(([label, value, Icon]) => (
          <article className="admin-stat-card" key={label}>
            <span className="admin-icon-box">
              <Icon />
            </span>
            <p>{label}</p>
            <strong>{value}</strong>
          </article>
        ))}
      </section>

      <section className="admin-panel">
        <div className="admin-panel-header">
          <h2>Recent orders</h2>
          <button type="button" onClick={() => setActiveView("orders")}>
            View all
          </button>
        </div>
        {dashboard.recentOrders?.length ? (
          renderOrdersTable(dashboard.recentOrders, false)
        ) : (
          <EmptyState label="No recent orders yet" />
        )}
      </section>
    </>
  );

  const renderMenu = () => (
    <div className="admin-two-column">
      <form className="admin-panel admin-form" onSubmit={saveMenu}>
        <h2>{editingMenuId ? "Edit menu item" : "Add menu item"}</h2>
        <div className="admin-image-preview">
          {menuForm.image_url ? (
            <img src={menuForm.image_url} alt="Menu preview" />
          ) : (
            <span>No image</span>
          )}
        </div>
        <input type="file" onChange={(e) => handleImage(e, setMenuForm)} />
        <label>
          Name
          <input
            value={menuForm.menu_name}
            onChange={(e) =>
              setMenuForm({ ...menuForm, menu_name: e.target.value })
            }
            required
          />
        </label>
        <label>
          Category
          <input
            list="category-options"
            value={menuForm.category}
            onChange={(e) =>
              setMenuForm({ ...menuForm, category: e.target.value })
            }
            required
          />
        </label>
        <datalist id="category-options">
          {categories.map((category) => (
            <option value={category.name} key={category.id} />
          ))}
        </datalist>
        <div className="admin-form-grid">
          <label>
            Type
            <select
              value={menuForm.menu_type}
              onChange={(e) =>
                setMenuForm({ ...menuForm, menu_type: e.target.value })
              }
            >
              <option>Veg</option>
              <option>NonVeg</option>
            </select>
          </label>
          <label>
            Price
            <input
              type="number"
              value={menuForm.price}
              onChange={(e) =>
                setMenuForm({ ...menuForm, price: e.target.value })
              }
              required
            />
          </label>
        </div>
        <div className="admin-form-grid">
          <label>
            Original price
            <input
              type="number"
              value={menuForm.original_price}
              onChange={(e) =>
                setMenuForm({ ...menuForm, original_price: e.target.value })
              }
            />
          </label>
          <label>
            Discounted price
            <input
              type="number"
              value={menuForm.discounted_price}
              onChange={(e) =>
                setMenuForm({ ...menuForm, discounted_price: e.target.value })
              }
            />
          </label>
        </div>
        <label>
          Description
          <textarea
            rows="4"
            value={menuForm.description}
            onChange={(e) =>
              setMenuForm({ ...menuForm, description: e.target.value })
            }
          />
        </label>
        <label className="admin-check">
          <input
            type="checkbox"
            checked={menuForm.is_available}
            onChange={(e) =>
              setMenuForm({ ...menuForm, is_available: e.target.checked })
            }
          />{" "}
          Available
        </label>
        <label className="admin-check">
          <input
            type="checkbox"
            checked={menuForm.is_discounted}
            onChange={(e) =>
              setMenuForm({ ...menuForm, is_discounted: e.target.checked })
            }
          />{" "}
          Discounted
        </label>
        <button className="admin-primary" type="submit" disabled={saving}>
          <FaPlus /> {editingMenuId ? "Save item" : "Add item"}
        </button>
      </form>

      <section className="admin-panel">
        <Toolbar
          search={menuSearch}
          setSearch={setMenuSearch}
          placeholder="Search menu items"
        />
        <select
          className="admin-filter"
          value={menuCategory}
          onChange={(e) => setMenuCategory(e.target.value)}
        >
          <option value="all">All categories</option>
          {Array.from(
            new Set([
              ...categories.map((c) => c.name),
              ...menuItems.map((m) => m.category).filter(Boolean),
            ]),
          ).map((category) => (
            <option value={category} key={category}>
              {category}
            </option>
          ))}
        </select>
        <div className="admin-menu-list">
          {page(filteredMenu, menuPage).map((item) => (
            <article className="admin-menu-item" key={item.menu_id}>
              <img
                src={item.image_url || "https://placehold.co/120x90?text=Menu"}
                alt={item.menu_name}
              />
              <div>
                <h3>{item.menu_name}</h3>
                <p>
                  {item.category || "Uncategorized"} · {item.menu_type}
                </p>
                <strong>{currency(item.price)}</strong>
              </div>
              <div className="admin-row-actions">
                <button type="button" onClick={() => updateMenuStatus(item)}>
                  {item.is_available ? "In stock" : "Out"}
                </button>
                <button
                  type="button"
                  aria-label="Edit"
                  onClick={() => editMenu(item)}
                >
                  <FaEdit />
                </button>
                <button
                  type="button"
                  aria-label="Delete"
                  onClick={() => deleteMenu(item.menu_id)}
                >
                  <FaTrash />
                </button>
              </div>
            </article>
          ))}
          {loadedRef.current.has("menu") && !filteredMenu.length && (
            <EmptyState label="No menu items found" />
          )}
        </div>
        {renderPagination(filteredMenu.length, menuPage, setMenuPage)}
      </section>
    </div>
  );

  // Status column now shows plain text, not a free jump-to-any-status
  // dropdown — the only place status can be advanced is the details
  // drawer's single "next step" button, so there's one unambiguous path.
  const renderOrdersTable = (items, showDetails = true) => (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Order</th>
            <th>Customer</th>
            <th>Total</th>
            <th>Status</th>
            <th>Date</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((order) => (
            <tr key={order.id}>
              <td>#{order.id}</td>
              <td>{order.customer_name || "Guest"}</td>
              <td>{currency(order.total_price)}</td>
              <td>
                <span className={statusClass(order.status)}>
                  {order.status || "Pending"}
                </span>
              </td>
              <td>{dateTime(order.created_at)}</td>
              <td>
                {showDetails && (
                  <button type="button" onClick={() => openOrderDetails(order)}>
                    Details
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderOrders = () => (
    <section className="admin-panel">
      <div className="admin-tools">
        <Toolbar
          search={orderSearch}
          setSearch={setOrderSearch}
          placeholder="Search by order ID or customer"
        />
        <select
          value={orderStatus}
          onChange={(e) => setOrderStatus(e.target.value)}
        >
          <option value="all">All statuses</option>
          {ORDER_STATUSES.map((status) => (
            <option key={status}>{status}</option>
          ))}
        </select>
      </div>
      {filteredOrders.length ? (
        renderOrdersTable(page(filteredOrders, orderPage))
      ) : (
        <EmptyState label="No orders found" />
      )}
      {renderPagination(filteredOrders.length, orderPage, setOrderPage)}
    </section>
  );

  const renderOffers = () => (
    <div className="admin-two-column">
      <form className="admin-panel admin-form" onSubmit={saveOffer}>
        <h2>{editingOfferId ? "Edit offer" : "Create offer"}</h2>
        <label>
          Title
          <input
            value={offerForm.title}
            onChange={(e) =>
              setOfferForm({ ...offerForm, title: e.target.value })
            }
            required
          />
        </label>
        <label>
          Description
          <textarea
            rows="4"
            value={offerForm.description}
            onChange={(e) =>
              setOfferForm({ ...offerForm, description: e.target.value })
            }
          />
        </label>
        <div className="admin-form-grid">
          <label>
            Type
            <select
              value={offerForm.discount_type}
              onChange={(e) =>
                setOfferForm({ ...offerForm, discount_type: e.target.value })
              }
            >
              <option value="percent">Percent</option>
              <option value="amount">Amount</option>
            </select>
          </label>
          <label>
            Value
            <input
              type="number"
              value={offerForm.discount_value}
              onChange={(e) =>
                setOfferForm({ ...offerForm, discount_value: e.target.value })
              }
            />
          </label>
        </div>
        <label className="admin-check">
          <input
            type="checkbox"
            checked={offerForm.enabled}
            onChange={(e) =>
              setOfferForm({ ...offerForm, enabled: e.target.checked })
            }
          />{" "}
          Enabled
        </label>
        <button className="admin-primary" type="submit">
          <FaGift /> Save offer
        </button>
      </form>
      <section className="admin-panel admin-list">
        {offers.map((offer) => (
          <article className="admin-list-row" key={offer.id}>
            <div>
              <h3>{offer.title}</h3>
              <p>
                {offer.discount_value}
                {offer.discount_type === "percent" ? "%" : " Rs."} off ·{" "}
                {offer.enabled ? "Enabled" : "Disabled"}
              </p>
            </div>
            <div className="admin-row-actions">
              <button
                type="button"
                onClick={() => {
                  setOfferForm(offer);
                  setEditingOfferId(offer.id);
                }}
              >
                <FaEdit />
              </button>
              <button type="button" onClick={() => deleteOffer(offer.id)}>
                <FaTrash />
              </button>
            </div>
          </article>
        ))}
        {loadedRef.current.has("offers") && !offers.length && (
          <EmptyState label="No offers created" />
        )}
      </section>
    </div>
  );

  const renderCustomers = () => (
    <section className="admin-panel">
      <div className="admin-list">
        {page(customers, customerPage).map((customer) => (
          <article className="admin-list-row" key={customer.id}>
            <div>
              <h3>{customer.name || "Customer"}</h3>
              <p>
                {customer.email} · {customer.phone || "No phone"}
              </p>
            </div>
            <div>
              <strong>{customer.order_count || 0} orders</strong>
              <p>{currency(customer.total_spent)}</p>
            </div>
            <button
              type="button"
              onClick={async () => {
                setAdminTokenForRequest();
                setCustomerDetail(
                  unwrap(await API.get(`/admin/customers/${customer.id}`)),
                );
              }}
            >
              History
            </button>
          </article>
        ))}
        {loadedRef.current.has("customers") && !customers.length && (
          <EmptyState label="No customers found" />
        )}
      </div>
      {renderPagination(customers.length, customerPage, setCustomerPage)}
    </section>
  );

  const renderCategories = () => (
    <section className="admin-panel admin-narrow">
      <form className="admin-inline-form" onSubmit={saveCategory}>
        <input
          placeholder="Category name"
          value={categoryForm}
          onChange={(e) => setCategoryForm(e.target.value)}
        />
        <button className="admin-primary" type="submit">
          {editingCategoryId ? "Save" : "Add"}
        </button>
      </form>
      <div className="admin-list">
        {categories.map((category) => (
          <article className="admin-list-row" key={category.id}>
            <h3>{category.name}</h3>
            <div className="admin-row-actions">
              <button
                type="button"
                onClick={() => {
                  setCategoryForm(category.name);
                  setEditingCategoryId(category.id);
                }}
              >
                <FaEdit />
              </button>
              <button type="button" onClick={() => deleteCategory(category.id)}>
                <FaTrash />
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );

  const renderSettings = () => (
    <form
      className="admin-panel admin-form admin-wide-form"
      onSubmit={saveRestaurant}
    >
      <h2>Restaurant settings</h2>
      <div className="admin-form-grid">
        <label>
          Name
          <input
            value={restaurant.name || ""}
            onChange={(e) =>
              setRestaurant({ ...restaurant, name: e.target.value })
            }
          />
        </label>
        <label>
          Contact number
          <input
            value={restaurant.contact_number || ""}
            onChange={(e) =>
              setRestaurant({ ...restaurant, contact_number: e.target.value })
            }
          />
        </label>
      </div>
      <label>
        Address
        <textarea
          rows="3"
          value={restaurant.address || ""}
          onChange={(e) =>
            setRestaurant({ ...restaurant, address: e.target.value })
          }
        />
      </label>
      <div className="admin-form-grid">
        <label>
          Delivery charges
          <input
            type="number"
            value={restaurant.delivery_charge || ""}
            onChange={(e) =>
              setRestaurant({ ...restaurant, delivery_charge: e.target.value })
            }
          />
        </label>
        <label>
          Opening time
          <input
            value={restaurant.opening_time || ""}
            onChange={(e) =>
              setRestaurant({ ...restaurant, opening_time: e.target.value })
            }
          />
        </label>
        <label>
          Closing time
          <input
            value={restaurant.closing_time || ""}
            onChange={(e) =>
              setRestaurant({ ...restaurant, closing_time: e.target.value })
            }
          />
        </label>
      </div>
      <div className="admin-form-grid">
        <label>
          Logo
          <input
            type="file"
            accept="image/*"
            onChange={(e) =>
              handleImage(e, (url) =>
                setRestaurant({ ...restaurant, logo_url: url }),
              )
            }
          />
        </label>
        <label>
          Banner
          <input
            type="file"
            accept="image/*"
            onChange={(e) =>
              handleImage(e, (url) =>
                setRestaurant({ ...restaurant, banner_url: url }),
              )
            }
          />
        </label>
      </div>
      <div className="admin-form-grid">
        <label>
          GST (%)
          <input
            type="number"
            min="0"
            step="0.1"
            value={restaurant.gst || ""}
            onChange={(e) =>
              setRestaurant({
                ...restaurant,
                gst: Number(e.target.value),
              })
            }
          />
        </label>

        <label>
          Delivery Radius (KM)
          <input
            type="number"
            min="0"
            step="0.5"
            value={restaurant.deliveryRadiusKm || ""}
            onChange={(e) =>
              setRestaurant({
                ...restaurant,
                deliveryRadiusKm: Number(e.target.value),
              })
            }
          />
        </label>
      </div>
      <div className="admin-preview-strip">
        {restaurant.logo_url && (
          <img src={restaurant.logo_url} alt="Logo preview" />
        )}
        {restaurant.banner_url && (
          <img src={restaurant.banner_url} alt="Banner preview" />
        )}
      </div>
      <button className="admin-primary" type="submit">
        Save settings
      </button>
    </form>
  );

  const renderProfile = () => (
    <form
      className="admin-panel admin-form admin-narrow"
      onSubmit={saveProfile}
    >
      <h2>Admin profile</h2>
      <div className="admin-image-preview admin-avatar-preview">
        {profile.picture ? (
          <img src={profile.picture} alt="Profile preview" />
        ) : (
          <span>No photo</span>
        )}
      </div>
      <input
        type="file"
        accept="image/*"
        onChange={(e) =>
          handleImage(e, (url) => setProfile({ ...profile, picture: url }))
        }
      />
      <label>
        Name
        <input
          value={profile.name || ""}
          onChange={(e) => setProfile({ ...profile, name: e.target.value })}
        />
      </label>
      <label>
        Phone
        <input
          value={profile.phone || ""}
          onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
        />
      </label>
      <label>
        Current password
        <input
          type="password"
          value={profile.currentPassword}
          onChange={(e) =>
            setProfile({ ...profile, currentPassword: e.target.value })
          }
        />
      </label>
      <label>
        New password
        <input
          type="password"
          value={profile.newPassword}
          onChange={(e) =>
            setProfile({ ...profile, newPassword: e.target.value })
          }
        />
      </label>
      <button className="admin-primary" type="submit">
        Update profile
      </button>
    </form>
  );

  const renderActiveView = () => {
    if (loading || !loadedRef.current.has(activeView)) return <LoadingGrid />;
    return {
      dashboard: renderDashboard(),
      menu: renderMenu(),
      orders: renderOrders(),
      offers: renderOffers(),
      customers: renderCustomers(),
      categories: renderCategories(),
      settings: renderSettings(),
      profile: renderProfile(),
    }[activeView];
  };

  if (needsAdminLogin) {
    return (
      <div
        className={`admin-app admin-login-screen ${darkMode ? "admin-app--dark" : ""}`}
      >
        <form className="admin-login-card" onSubmit={handleAdminLogin}>
          <div className="admin-brand admin-login-brand">
            <span>GK</span>
            <strong>Admin Login</strong>
          </div>
          <p>
            Use your admin email and password. If no admin exists yet, this
            first login creates one automatically.
          </p>
          <label>
            Admin ID
            <input
              value={adminLoginForm.email}
              onChange={(e) =>
                setAdminLoginForm({ ...adminLoginForm, email: e.target.value })
              }
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={adminLoginForm.password}
              onChange={(e) =>
                setAdminLoginForm({
                  ...adminLoginForm,
                  password: e.target.value,
                })
              }
              required
            />
          </label>
          <button className="admin-primary" type="submit" disabled={saving}>
            {saving ? "Checking..." : "Login to dashboard"}
          </button>
          <button
            type="button"
            className="admin-icon-button"
            onClick={() => setDarkMode(!darkMode)}
          >
            <FaMoon />
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
    <div className={`admin-app ${darkMode ? "admin-app--dark" : ""}`}>
      <aside
        className={`admin-sidebar ${sidebarOpen ? "admin-sidebar--open" : ""}`}
      >
        <div className="admin-brand">
          <span>GK</span>
          <strong>Control Panel</strong>
        </div>
        <nav>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                type="button"
                className={activeView === item.id ? "active" : ""}
                key={item.id}
                onClick={() => {
                  setActiveView(item.id);
                  setSidebarOpen(false);
                }}
              >
                <Icon /> {item.label}
              </button>
            );
          })}
        </nav>
        <button type="button" className="admin-logout" onClick={logout}>
          <FaSignOutAlt /> Logout
        </button>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <button
            type="button"
            className="admin-icon-button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <FaBars />
          </button>
          <div>
            <p>Restaurant admin</p>
            <h1>{navItems.find((item) => item.id === activeView)?.label}</h1>
          </div>
          <button
            type="button"
            className={`admin-live-toggle ${
              restaurant.is_accepting_orders === false ? "offline" : "online"
            }`}
            onClick={toggleOrdering}
          >
            <span />
            {restaurant.is_accepting_orders === false ? "Offline" : "Online"}
          </button>
          <button
            type="button"
            className="admin-icon-button"
            onClick={() => setDarkMode(!darkMode)}
          >
            <FaMoon />
          </button>
        </header>
        {renderActiveView()}
      </main>

      {toast && (
        <div className={`admin-toast admin-toast--${toast.type}`}>
          {toast.message}
        </div>
      )}
      {confirmAction && (
        <div className="admin-modal-backdrop">
          <div className="admin-confirm">
            <h2>{confirmAction.title}</h2>
            <p>{confirmAction.message}</p>
            <div>
              <button type="button" onClick={() => setConfirmAction(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="admin-danger"
                onClick={async () => {
                  await confirmAction.onConfirm();
                  setConfirmAction(null);
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
      {detailOrder && (
        <OrderDetails
          order={detailOrder}
          onClose={() => setDetailOrder(null)}
          onStatusChange={updateOrderStatus}
          busy={busyOrderId === detailOrder.id}
          loadingDetails={detailLoading}
        />
      )}
      {customerDetail && (
        <CustomerDetails
          customer={customerDetail}
          onClose={() => setCustomerDetail(null)}
        />
      )}
    </div>
  );
};

const Toolbar = ({ search, setSearch, placeholder }) => (
  <div className="admin-search">
    <FaSearch />
    <input
      value={search}
      placeholder={placeholder}
      onChange={(e) => setSearch(e.target.value)}
    />
  </div>
);

const EmptyState = ({ label }) => (
  <div className="admin-empty">
    <strong>{label}</strong>
    <p>Refresh or change filters to see more results.</p>
  </div>
);

const LoadingGrid = () => (
  <div className="admin-loading-grid">
    {Array.from({ length: 8 }).map((_, index) => (
      <span key={index} />
    ))}
  </div>
);

// One dot per stage of STATUS_FLOW. Stages before the current one are
// "done", the current one is highlighted, everything after is greyed out —
// so the admin can see exactly where the order is at a glance, with zero
// ambiguity about what happens next.
const StatusStepper = ({ status }) => {
  const isCancelled = status === "Cancelled";
  const currentIndex = STATUS_FLOW.indexOf(status || "Pending");

  return (
    <div className="admin-status-stepper">
      {STATUS_FLOW.map((step, index) => {
        const state = isCancelled
          ? "cancelled"
          : index < currentIndex
            ? "done"
            : index === currentIndex
              ? "current"
              : "upcoming";
        return (
          <div className={`admin-step admin-step--${state}`} key={step}>
            <span className="admin-step-dot" />
            <span className="admin-step-label">{step}</span>
          </div>
        );
      })}
    </div>
  );
};

const OrderDetails = ({
  order,
  onClose,
  onStatusChange,
  busy,
  loadingDetails,
}) => {
  const items = parseItems(order.items);
  const phone = getOrderPhone(order);
  const hasCoordinates = order.delivery_lat && order.delivery_lng;
  const mapsUrl = hasCoordinates
    ? `https://www.google.com/maps/dir/?api=1&destination=${order.delivery_lat},${order.delivery_lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        order.location || "",
      )}`;

  const status = order.status || "Pending";
  const isCancelled = status === "Cancelled";
  const next = nextStatus(status);

  return (
    <div className="admin-modal-backdrop">
      <div className="admin-drawer">
        <button type="button" className="admin-close" onClick={onClose}>
          Close
        </button>
        <h2>Order #{order.id}</h2>

        <StatusStepper status={status} />

        <div className="admin-detail-grid">
          <p>
            <span>Total amount</span>
            {currency(order.total_price)}
          </p>
          <p>
            <span>Payment</span>
            {order.payment_method || "Cash on Delivery"}
          </p>
          <p>
            <span>Status</span>
            {status}
          </p>
          <p>
            <span>Date</span>
            {dateTime(order.created_at)}
          </p>
          <p>
            <span>Customer</span>
            {order.customer_name || "Guest"}
          </p>
          <p>
            <span>Phone</span>
            {phone || "Not available"}
          </p>
        </div>

        <p className="admin-address">
          <span>Delivery address</span>
          {loadingDetails ? "Loading..." : order.location || "Not available"}
        </p>

        {(order.order_instructions || order.order_preferences) && (
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
        )}

        <div className="admin-delivery-actions">
          {phone && (
            <a href={`tel:${phone}`}>
              <FaPhoneAlt /> Call customer
            </a>
          )}
          <a href={mapsUrl} target="_blank" rel="noreferrer">
            <FaMapMarkerAlt /> Open navigation
          </a>
        </div>

        {/* Exactly one actionable control at a time: the single next step,
            a cancel option while that's still valid, or a plain completion
            note once there is nothing left to do. Never more than one
            status button visible together. */}
        {isCancelled ? (
          <p className="admin-cancelled-note">This order was cancelled.</p>
        ) : next ? (
          <div className="admin-status-actions">
            <button
              type="button"
              className="admin-primary"
              onClick={() => onStatusChange(order, next)}
              disabled={busy}
            >
              {busy ? "Saving..." : `Mark as ${next}`}
            </button>
            {status !== "Out for Delivery" && (
              <button
                type="button"
                className="admin-danger"
                onClick={() => onStatusChange(order, "Cancelled")}
                disabled={busy}
              >
                Cancel order
              </button>
            )}
          </div>
        ) : (
          <p className="admin-delivered-note">
            ✅ Delivered — no further action needed.
          </p>
        )}

        {hasCoordinates ? (
          <LocationMap
            readOnly
            height={220}
            defaultLocation={[
              Number(order.delivery_lat),
              Number(order.delivery_lng),
            ]}
          />
        ) : (
          <p className="admin-muted">
            No pinned location saved for this order — use the address above.
          </p>
        )}

        <h3
          style={{
            marginTop: "30px",
          }}
        >
          Ordered items
        </h3>
        <div className="admin-list">
          {loadingDetails && !items.length ? (
            <p className="admin-muted">Loading items...</p>
          ) : (
            items.map((item, index) => {
              const name =
                item.name || item.menu_name || item.item_name || "Item";
              const quantity = Number(item.quantity || item.qty || 1);
              const price = Number(item.price || item.unit_price || 0);
              return (
                <article className="admin-list-row" key={`${name}-${index}`}>
                  <div>
                    <h3>{name}</h3>
                    <p>
                      Quantity: {quantity} · Unit: {currency(price)}
                      {item.item_type === "addon" ? " · Add-on" : ""}
                    </p>
                  </div>
                  <strong>{currency(price * quantity)}</strong>
                </article>
              );
            })
          )}
          {!loadingDetails && !items.length && (
            <EmptyState label="No item details saved" />
          )}
        </div>
      </div>
    </div>
  );
};

const CustomerDetails = ({ customer, onClose }) => (
  <div className="admin-modal-backdrop">
    <div className="admin-drawer">
      <button type="button" className="admin-close" onClick={onClose}>
        Close
      </button>
      <h2>{customer.name || "Customer"}</h2>
      <p className="admin-muted">
        {customer.email} · {customer.phone || "No phone"}
      </p>
      <h3>Order history</h3>
      <div className="admin-list">
        {(customer.orders || []).map((order) => (
          <article className="admin-list-row" key={order.id}>
            <div>
              <h3>Order #{order.id}</h3>
              <p>
                {dateTime(order.created_at)} · {order.status || "Pending"}
              </p>
            </div>
            <strong>{currency(order.total_price)}</strong>
          </article>
        ))}
        {!customer.orders?.length && <EmptyState label="No order history" />}
      </div>
    </div>
  </div>
);

export default AdminDashboard;
