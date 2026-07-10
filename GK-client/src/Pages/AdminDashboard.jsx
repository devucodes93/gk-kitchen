import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import "./AdminDashboard.css";

const ORDER_STATUSES = [
  "Pending",
  "Preparing",
  "Ready",
  "Out for Delivery",
  "Delivered",
  "Cancelled",
];
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

const AdminDashboard = () => {
  const [activeView, setActiveView] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [detailOrder, setDetailOrder] = useState(null);
  const [customerDetail, setCustomerDetail] = useState(null);
  const [needsAdminLogin, setNeedsAdminLogin] = useState(
    !localStorage.getItem("adminToken"),
  );
  const [adminLoginForm, setAdminLoginForm] = useState({
    email: "",
    password: "",
  });
  const [busyOrderId, setBusyOrderId] = useState(null);
  const knownOrderIds = useRef(new Set());
  const notificationsReady = useRef(false);
  const viewLoadBusyRef = useRef(false);
  const loadedSectionsRef = useRef(new Set());
  const initialDataLoadedRef = useRef(false);

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

  const fetchAll = useCallback(async () => {
    const adminToken = localStorage.getItem("adminToken");
    if (!adminToken) {
      setNeedsAdminLogin(true);
      setLoading(false);
      return;
    }

    localStorage.setItem("token", adminToken);
    setLoading(true);
    try {
      const bootstrapResponse = await API.get("/admin/bootstrap");
      const bootstrapData = bootstrapResponse.data?.data || {};
      setDashboard(bootstrapData.dashboard || {});
      setMenuItems(
        (Array.isArray(bootstrapData.menu) ? bootstrapData.menu : []).map(
          normalizeMenu,
        ),
      );
      const fetchedOrders = Array.isArray(bootstrapData.orders)
        ? bootstrapData.orders
        : [];
      setOrders(fetchedOrders);
      if (!notificationsReady.current) {
        knownOrderIds.current = new Set(
          fetchedOrders.map((order) => String(order.id)),
        );
        notificationsReady.current = true;
      }
      setOffers(Array.isArray(bootstrapData.offers) ? bootstrapData.offers : []);
      setCustomers(
        Array.isArray(bootstrapData.customers) ? bootstrapData.customers : [],
      );
      setCategories(
        Array.isArray(bootstrapData.categories) ? bootstrapData.categories : [],
      );
      setRestaurant(bootstrapData.restaurant || {});

      loadedSectionsRef.current = new Set([
        "dashboard",
        "menu",
        "orders",
        "offers",
        "customers",
        "categories",
        "restaurant",
      ]);

      const meResponse = await API.get("/auth/me");
      setProfile((current) => ({
        ...current,
        ...(meResponse.data?.user || {}),
      }));
      loadedSectionsRef.current.add("profile");
      initialDataLoadedRef.current = true;
      setNeedsAdminLogin(false);
    } catch (error) {
      if ([401, 403].includes(error.response?.status)) {
        setNeedsAdminLogin(true);
      }
      showToast(
        error.response?.data?.message || "Unable to load admin data",
        "error",
      );
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    document.body.classList.add("admin-route");
    document.documentElement.classList.add("admin-route");

    return () => {
      document.body.classList.remove("admin-route");
      document.documentElement.classList.remove("admin-route");
    };
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (needsAdminLogin || !initialDataLoadedRef.current) return undefined;

    const loadActiveViewData = async () => {
      if (viewLoadBusyRef.current) return;
      viewLoadBusyRef.current = true;
      try {
        const adminToken = localStorage.getItem("adminToken");
        if (!adminToken) return;
        localStorage.setItem("token", adminToken);

        const section = activeView;

        if (section === "dashboard") {
          if (!loadedSectionsRef.current.has("dashboard")) {
            const dashboardResponse = await API.get("/admin/dashboard");
            setDashboard(dashboardResponse.data?.data || {});
            loadedSectionsRef.current.add("dashboard");
          }
          if (!loadedSectionsRef.current.has("orders")) {
            const ordersResponse = await API.get("/orders");
            const fetchedOrders = unwrap(ordersResponse);
            setOrders(fetchedOrders);
            loadedSectionsRef.current.add("orders");
          }
          return;
        }

        if (section === "menu" && !loadedSectionsRef.current.has("menu")) {
          const menuResponse = await API.get("/menu");
          setMenuItems(
            (Array.isArray(menuResponse.data) ? menuResponse.data : []).map(
              normalizeMenu,
            ),
          );
          loadedSectionsRef.current.add("menu");
          return;
        }

        if (section === "orders" && !loadedSectionsRef.current.has("orders")) {
          const ordersResponse = await API.get("/orders");
          setOrders(unwrap(ordersResponse));
          loadedSectionsRef.current.add("orders");
          return;
        }

        if (section === "offers" && !loadedSectionsRef.current.has("offers")) {
          const offersResponse = await API.get("/admin/offers");
          setOffers(unwrap(offersResponse));
          loadedSectionsRef.current.add("offers");
          return;
        }

        if (section === "customers" && !loadedSectionsRef.current.has("customers")) {
          const customersResponse = await API.get("/admin/customers");
          setCustomers(unwrap(customersResponse));
          loadedSectionsRef.current.add("customers");
          return;
        }

        if (section === "categories" && !loadedSectionsRef.current.has("categories")) {
          const categoriesResponse = await API.get("/admin/categories");
          setCategories(unwrap(categoriesResponse));
          loadedSectionsRef.current.add("categories");
          return;
        }

        if (section === "settings" && !loadedSectionsRef.current.has("restaurant")) {
          const restaurantResponse = await API.get("/admin/restaurant");
          setRestaurant(restaurantResponse.data?.data || {});
          loadedSectionsRef.current.add("restaurant");
          return;
        }

        if (section === "profile" && !loadedSectionsRef.current.has("profile")) {
          const meResponse = await API.get("/auth/me");
          setProfile((current) => ({
            ...current,
            ...(meResponse.data?.user || {}),
          }));
          loadedSectionsRef.current.add("profile");
        }
      } catch {
        // Keep the current UI state intact if a section load fails.
      } finally {
        viewLoadBusyRef.current = false;
      }
    };

    loadActiveViewData();
    return undefined;
  }, [activeView, needsAdminLogin]);

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

  const page = (items, currentPage) =>
    items.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleImage = (event, setter) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => setter(reader.result);
    reader.readAsDataURL(file);
  };

  const saveMenu = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...menuForm,
        price: Number(menuForm.price || 0),
        original_price: Number(menuForm.original_price || menuForm.price || 0),
        discounted_price: menuForm.discounted_price
          ? Number(menuForm.discounted_price)
          : null,
      };
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
        current?.id === order.id ? response.data.data : current,
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
        const refreshed = await API.get("/admin/restaurant");
        setRestaurant(refreshed.data?.data || response.data.data);
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
        const response = await API.put("/admin/restaurant", {
          ...restaurant,
          is_accepting_orders: restaurant.is_accepting_orders === false,
        });
        const refreshed = await API.get("/admin/restaurant");
        setRestaurant(refreshed.data?.data || response.data.data);
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
      await fetchAll();
    } catch (error) {
      showToast(
        error.response?.data?.message || "Unable to login as admin",
        "error",
      );
    } finally {
      setSaving(false);
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
        {orders.length ? (
          renderOrdersTable(dashboard.recentOrders || orders.slice(0, 8), false)
        ) : (
          <EmptyState label="No orders yet" />
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
        <input
          type="file"
          accept="image/*"
          onChange={(e) =>
            handleImage(e, (url) =>
              setMenuForm({ ...menuForm, image_url: url }),
            )
          }
        />
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
          {!filteredMenu.length && <EmptyState label="No menu items found" />}
        </div>
        {renderPagination(filteredMenu.length, menuPage, setMenuPage)}
      </section>
    </div>
  );

  const renderOrdersTable = (items, showControls = true) => (
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
                {showControls ? (
                  <select
                    className={statusClass(order.status)}
                    value={order.status || "Pending"}
                    onChange={(e) => updateOrderStatus(order, e.target.value)}
                    disabled={busyOrderId === order.id}
                  >
                    {ORDER_STATUSES.map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                ) : (
                  <span className={statusClass(order.status)}>
                    {order.status || "Pending"}
                  </span>
                )}
              </td>
              <td>{dateTime(order.created_at)}</td>
              <td>
                <button type="button" onClick={() => setDetailOrder(order)}>
                  Details
                </button>
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
        {!offers.length && <EmptyState label="No offers created" />}
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
              onClick={async () =>
                setCustomerDetail(
                  unwrap(await API.get(`/admin/customers/${customer.id}`)),
                )
              }
            >
              History
            </button>
          </article>
        ))}
        {!customers.length && <EmptyState label="No customers found" />}
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
    if (loading) return <LoadingGrid />;
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

const OrderDetails = ({ order, onClose, onStatusChange, busy }) => {
  const items = parseItems(order.items);
  const hasCoordinates = order.delivery_lat && order.delivery_lng;
  const mapsUrl = hasCoordinates
    ? `https://www.google.com/maps/dir/?api=1&destination=${order.delivery_lat},${order.delivery_lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        order.location || "",
      )}`;
  const mapEmbedUrl = hasCoordinates
    ? `https://www.openstreetmap.org/export/embed.html?marker=${order.delivery_lat},${order.delivery_lng}&layer=mapnik`
    : "";

  return (
    <div className="admin-modal-backdrop">
      <div className="admin-drawer">
        <button type="button" className="admin-close" onClick={onClose}>
          Close
        </button>
        <h2>Order #{order.id}</h2>
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
            {order.status || "Pending"}
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
            {order.phone_number || "Not available"}
          </p>
        </div>
        <p className="admin-address">
          <span>Delivery address</span>
          {order.location || "Not available"}
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
          {order.phone_number && (
            <a href={`tel:${order.phone_number}`}>
              <FaPhoneAlt /> Call customer
            </a>
          )}
          <a href={mapsUrl} target="_blank" rel="noreferrer">
            <FaMapMarkerAlt /> Open navigation
          </a>
          <button
            type="button"
            onClick={() => onStatusChange(order, "Out for Delivery")}
            disabled={busy || order.status === "Out for Delivery"}
          >
            {busy ? "Saving..." : "Out for Delivery"}
          </button>
          <button
            type="button"
            className="admin-delivered-btn"
            onClick={() => onStatusChange(order, "Delivered")}
            disabled={busy || order.status === "Delivered"}
          >
            {busy ? "Saving..." : "Mark Delivered"}
          </button>
        </div>
        {mapEmbedUrl && (
          <iframe
            className="admin-delivery-map"
            title={`Delivery map for order ${order.id}`}
            src={mapEmbedUrl}
          />
        )}
        <h3>Ordered items</h3>
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
                    Quantity: {quantity} · Unit: {currency(price)}
                    {item.item_type === "addon" ? " · Add-on" : ""}
                  </p>
                </div>
                <strong>{currency(price * quantity)}</strong>
              </article>
            );
          })}
          {!items.length && <EmptyState label="No item details saved" />}
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
