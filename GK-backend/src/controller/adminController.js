const bcrypt = require("bcrypt");
const pool = require("../config/db");
const {
  getDashboardCache,
  setDashboardCache,
  invalidateDashboardCache,
  getResourceCache,
  setResourceCache,
  invalidateResourceCache,
} = require("../utils/dashboardCache");

let adminSchemaReady = false;
let adminSchemaPromise = null;

const runQuery = async (label, query, params = []) => {
  const startedAt = Date.now();
  try {
    const result = await pool.query(query, params);
    console.info(
      `[adminController] ✓ ${label} | rows=${result.rowCount ?? result.rows?.length ?? 0} | ${Date.now() - startedAt}ms`,
    );
    return result;
  } catch (error) {
    console.error(`[adminController] ✖ ${label}`, {
      message: error.message,
      code: error.code,
    });
    const isConnectionError =
      error?.code === "ECONNREFUSED" ||
      error?.code === "ETIMEDOUT" ||
      error?.message?.includes("timeout exceeded") ||
      error?.message?.includes("connect");
    if (isConnectionError)
      throw new Error(`Database connection issue while running ${label}`);
    throw error;
  }
};

const ensureAdminTables = async () => {
  if (adminSchemaReady) return;
  if (adminSchemaPromise) return adminSchemaPromise;

  adminSchemaPromise = (async () => {
    await runQuery(
      "create offers table",
      `CREATE TABLE IF NOT EXISTS offers (
        id SERIAL PRIMARY KEY,
        title VARCHAR(160) NOT NULL,
        description TEXT,
        discount_type VARCHAR(40) DEFAULT 'percent',
        discount_value NUMERIC DEFAULT 0,
        enabled BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
    );

    await runQuery(
      "create restaurant_settings table",
      `CREATE TABLE IF NOT EXISTS restaurant_settings (
        id INTEGER PRIMARY KEY DEFAULT 1,
        name VARCHAR(180) DEFAULT 'Gautam Kitchen',
        logo_url TEXT,
        banner_url TEXT,
        contact_number VARCHAR(40),
        address TEXT,
        delivery_charge NUMERIC DEFAULT 0,
        opening_time VARCHAR(20),
        closing_time VARCHAR(20),
        is_accepting_orders BOOLEAN DEFAULT TRUE,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
    );

    await runQuery(
      "ensure default restaurant settings",
      `INSERT INTO restaurant_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING`,
    );

    await runQuery(
      "create menu_categories table",
      `CREATE TABLE IF NOT EXISTS menu_categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(120) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
    );

    await runQuery(
      "create dashboard indexes",
      `CREATE INDEX IF NOT EXISTS idx_orders_created_at_desc ON orders (created_at DESC);
       CREATE INDEX IF NOT EXISTS idx_orders_status_created_at ON orders (status, created_at DESC);
       CREATE INDEX IF NOT EXISTS idx_orders_user_id_created_at ON orders (user_id, created_at DESC);
       CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);
       CREATE INDEX IF NOT EXISTS idx_menu_category ON menu (category);`,
    );

    adminSchemaReady = true;
  })().finally(() => {
    adminSchemaPromise = null;
  });

  return adminSchemaPromise;
};

const buildDashboardPayload = async () => {
  const [
    revenue,
    todaysRevenue,
    statusCounts,
    customerCount,
    menuCount,
    recentOrders,
  ] = await Promise.all([
    runQuery(
      "total revenue + order count",
      `
        SELECT COALESCE(SUM(total_price), 0)::numeric AS total_revenue, COUNT(*)::int AS total_orders
        FROM orders
      `,
    ),
    runQuery(
      "todays revenue",
      `
        SELECT COALESCE(SUM(total_price), 0)::numeric AS todays_revenue
        FROM orders
        WHERE created_at >= CURRENT_DATE AND created_at < CURRENT_DATE + INTERVAL '1 day'
      `,
    ),
    runQuery(
      "order status counts",
      `
        SELECT COALESCE(status, 'Pending') AS status, COUNT(*)::int AS count
        FROM orders
        GROUP BY COALESCE(status, 'Pending')
      `,
    ),
    runQuery(
      "customer count",
      `
        SELECT COUNT(*)::int AS total_customers FROM users WHERE role IS DISTINCT FROM 'admin'
      `,
    ),
    runQuery(
      "menu item count",
      `
        SELECT COUNT(*)::int AS total_menu_items FROM menu WHERE is_available IS NOT FALSE
      `,
    ),
    runQuery(
      "recent orders",
      `
        SELECT id, customer_name, total_price, status, created_at, payment_method
        FROM orders
        ORDER BY created_at DESC
        LIMIT 8
      `,
    ),
  ]);

  const statusMap = {};
  for (const row of statusCounts.rows)
    statusMap[row.status] = Number(row.count);

  return {
    totalRevenue: Number(revenue.rows[0]?.total_revenue || 0),
    todaysRevenue: Number(todaysRevenue.rows[0]?.todays_revenue || 0),
    totalOrders: Number(revenue.rows[0]?.total_orders || 0),
    pendingOrders: statusMap["Pending"] || 0,
    completedOrders: statusMap["Delivered"] || 0,
    cancelledOrders: statusMap["Cancelled"] || 0,
    totalCustomers: Number(customerCount.rows[0]?.total_customers || 0),
    totalMenuItems: Number(menuCount.rows[0]?.total_menu_items || 0),
    recentOrders: recentOrders.rows,
  };
};

const getDashboard = async (req, res) => {
  try {
    await ensureAdminTables();

    const [stats, recentOrders] = await Promise.all([
      pool.query(`
        SELECT
          COALESCE(SUM(total_price), 0) AS total_revenue,
          COALESCE(SUM(total_price) FILTER (WHERE created_at::date = CURRENT_DATE), 0) AS todays_revenue,
          COUNT(*) AS total_orders,
          COUNT(*) FILTER (WHERE COALESCE(status, 'Pending') = 'Pending') AS pending_orders,
          COUNT(*) FILTER (WHERE COALESCE(status, 'Pending') = 'Delivered') AS completed_orders,
          COUNT(*) FILTER (WHERE COALESCE(status, 'Pending') = 'Cancelled') AS cancelled_orders,
          (SELECT COUNT(*) FROM users) AS total_customers,
          (SELECT COUNT(*) FROM menu) AS total_menu_items
        FROM orders
      `),
      pool.query(`
        SELECT
          id,
          customer_name,
          phone_number,
          location,
          total_price,
          payment_method,
          status,
          created_at
        FROM orders
        ORDER BY id DESC
        LIMIT 8
      `),
    ]);

    const payload = await buildDashboardPayload();
    setDashboardCache(payload);
    res.json({ success: true, data: payload });
  } catch (error) {
    console.error("[adminController] getDashboard failed", error);
    res.status(502).json({
      success: false,
      message: "Unable to load dashboard data right now",
      error: error.message,
    });
  }
};

const getBootstrap = async (req, res) => {
  try {
    await ensureAdminTables();

    const cachedDashboard = getDashboardCache();
    const cachedMenu = getResourceCache("admin:menu");
    const cachedOrders = getResourceCache("admin:orders");
    const cachedOffers = getResourceCache("admin:offers");
    const cachedCustomers = getResourceCache("admin:customers");
    const cachedCategories = getResourceCache("admin:categories");
    const cachedRestaurant = getResourceCache("admin:restaurant");

    const [dashboard, menu, orders, offers, customers, categories, restaurant] =
      await Promise.all([
        cachedDashboard
          ? Promise.resolve(cachedDashboard)
          : buildDashboardPayload().then((payload) => {
              setDashboardCache(payload);
              return payload;
            }),
        cachedMenu
          ? Promise.resolve(cachedMenu)
          : runQuery(
              "bootstrap menu",
              "SELECT * FROM menu ORDER BY menu_id DESC",
            ).then((result) => {
              const menuRows = result.rows;
              setResourceCache("admin:menu", menuRows);
              return menuRows;
            }),
        cachedOrders
          ? Promise.resolve(cachedOrders)
          : runQuery(
              "bootstrap orders",
              "SELECT * FROM orders ORDER BY created_at DESC LIMIT 200",
            ).then((result) => {
              const ordersRows = result.rows;
              setResourceCache("admin:orders", ordersRows);
              return ordersRows;
            }),
        cachedOffers
          ? Promise.resolve(cachedOffers)
          : runQuery(
              "bootstrap offers",
              `
        SELECT id, title, description, discount_type, discount_value, enabled, created_at, updated_at
        FROM offers ORDER BY id DESC
      `,
            ).then((result) => {
              setResourceCache("admin:offers", result.rows);
              return result.rows;
            }),
        cachedCustomers
          ? Promise.resolve(cachedCustomers)
          : runQuery(
              "bootstrap customers",
              `
        SELECT id, name, email, phone, picture FROM users ORDER BY id DESC
      `,
            ).then((usersResult) => {
              return runQuery(
                "bootstrap customer totals",
                `
          SELECT user_id, COUNT(*)::int AS order_count, COALESCE(SUM(total_price), 0)::numeric AS total_spent
          FROM orders
          GROUP BY user_id
        `,
              ).then((totalsResult) => {
                const totalsMap = {};
                for (const row of totalsResult.rows) {
                  totalsMap[row.user_id] = {
                    order_count: row.order_count,
                    total_spent: Number(row.total_spent),
                  };
                }
                const data = usersResult.rows.map((user) => ({
                  ...user,
                  order_count: totalsMap[user.id]?.order_count || 0,
                  total_spent: totalsMap[user.id]?.total_spent || 0,
                }));
                setResourceCache("admin:customers", data);
                return data;
              });
            }),
        cachedCategories
          ? Promise.resolve(cachedCategories)
          : runQuery(
              "bootstrap categories",
              "SELECT id, name, created_at, updated_at FROM menu_categories ORDER BY name ASC",
            ).then((result) => {
              setResourceCache("admin:categories", result.rows);
              return result.rows;
            }),
        cachedRestaurant
          ? Promise.resolve(cachedRestaurant)
          : runQuery(
              "bootstrap restaurant",
              `
        SELECT id, name, logo_url, banner_url, contact_number, address, delivery_charge,
               opening_time, closing_time, is_accepting_orders, updated_at
        FROM restaurant_settings WHERE id=1
      `,
            ).then((result) => {
              const restaurantRow = result.rows[0];
              setResourceCache("admin:restaurant", restaurantRow);
              return restaurantRow;
            }),
      ]);

    res.json({
      success: true,
      data: {
        dashboard,
        menu,
        orders,
        offers,
        customers,
        categories,
        restaurant,
      },
    });
  } catch (error) {
    console.error("[adminController] getBootstrap failed", error);
    res.status(502).json({
      success: false,
      message: "Unable to load admin bootstrap data",
      error: error.message,
    });
  }
};

// ---- Customers: two flat queries merged in JS instead of one JOIN + GROUP BY ----
const getCustomers = async (req, res) => {
  try {
    const cached = getResourceCache("admin:customers");
    if (cached) return res.json({ success: true, data: cached });

    const [users, orderTotals] = await Promise.all([
      runQuery(
        "getCustomers users",
        `
        SELECT id, name, email, phone, picture FROM users ORDER BY id DESC
      `,
      ),
      runQuery(
        "getCustomers order totals",
        `
        SELECT user_id, COUNT(*)::int AS order_count, COALESCE(SUM(total_price), 0)::numeric AS total_spent
        FROM orders
        GROUP BY user_id
      `,
      ),
    ]);

    const totalsMap = {};
    for (const row of orderTotals.rows) {
      totalsMap[row.user_id] = {
        order_count: row.order_count,
        total_spent: Number(row.total_spent),
      };
    }

    const data = users.rows.map((u) => ({
      ...u,
      order_count: totalsMap[u.id]?.order_count || 0,
      total_spent: totalsMap[u.id]?.total_spent || 0,
    }));

    setResourceCache("admin:customers", data);
    res.json({ success: true, data });
  } catch (error) {
    console.error("[adminController] getCustomers failed", error);
    res
      .status(502)
      .json({ success: false, message: "Failed to load customers" });
  }
};

const getCustomer = async (req, res) => {
  try {
    const [customer, orders] = await Promise.all([
      runQuery(
        "getCustomer profile",
        "SELECT id, name, email, phone, picture FROM users WHERE id=$1",
        [req.params.id],
      ),
      runQuery(
        "getCustomer orders",
        `
        SELECT id, customer_name, total_price, status, created_at, payment_method
        FROM orders WHERE user_id=$1 ORDER BY created_at DESC
      `,
        [req.params.id],
      ),
    ]);

    if (!customer.rows.length) {
      return res
        .status(404)
        .json({ success: false, message: "Customer not found" });
    }

    res.json({
      success: true,
      data: { ...customer.rows[0], orders: orders.rows },
    });
  } catch (error) {
    console.error("[adminController] getCustomer failed", error);
    res
      .status(502)
      .json({ success: false, message: "Failed to load customer" });
  }
};

const getOffers = async (req, res) => {
  try {
    await ensureAdminTables();
    const cached = getResourceCache("admin:offers");
    if (cached) return res.json({ success: true, data: cached });

    const result = await runQuery(
      "getOffers",
      `
      SELECT id, title, description, discount_type, discount_value, enabled, created_at, updated_at
      FROM offers ORDER BY id DESC
    `,
    );
    setResourceCache("admin:offers", result.rows);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error("[adminController] getOffers failed", error);
    res.status(502).json({ success: false, message: "Failed to load offers" });
  }
};

const createOffer = async (req, res) => {
  try {
    await ensureAdminTables();
    const {
      title,
      description,
      discount_type,
      discount_value,
      enabled = true,
    } = req.body;
    const result = await runQuery(
      "createOffer",
      `
      INSERT INTO offers (title, description, discount_type, discount_value, enabled)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, title, description, discount_type, discount_value, enabled, created_at, updated_at
    `,
      [title, description, discount_type, discount_value, enabled],
    );
    invalidateResourceCache("admin:offers");
    invalidateDashboardCache();
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error("[adminController] createOffer failed", error);
    res.status(502).json({ success: false, message: "Failed to create offer" });
  }
};

const updateOffer = async (req, res) => {
  try {
    await ensureAdminTables();
    const {
      title,
      description,
      discount_type,
      discount_value,
      enabled = true,
    } = req.body;
    const result = await runQuery(
      "updateOffer",
      `
      UPDATE offers
      SET title=$1, description=$2, discount_type=$3, discount_value=$4, enabled=$5, updated_at=CURRENT_TIMESTAMP
      WHERE id=$6
      RETURNING id, title, description, discount_type, discount_value, enabled, created_at, updated_at
    `,
      [
        title,
        description,
        discount_type,
        discount_value,
        enabled,
        req.params.id,
      ],
    );
    invalidateResourceCache("admin:offers");
    invalidateDashboardCache();
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error("[adminController] updateOffer failed", error);
    res.status(502).json({ success: false, message: "Failed to update offer" });
  }
};

const deleteOffer = async (req, res) => {
  try {
    await ensureAdminTables();
    await runQuery("deleteOffer", "DELETE FROM offers WHERE id=$1", [
      req.params.id,
    ]);
    invalidateResourceCache("admin:offers");
    invalidateDashboardCache();
    res.json({ success: true, message: "Offer deleted successfully" });
  } catch (error) {
    console.error("[adminController] deleteOffer failed", error);
    res.status(502).json({ success: false, message: "Failed to delete offer" });
  }
};

const getRestaurant = async (req, res) => {
  try {
    await ensureAdminTables();
    const cached = getResourceCache("admin:restaurant");
    if (cached) return res.json({ success: true, data: cached });

    const result = await runQuery(
      "getRestaurant",
      `
      SELECT id, name, logo_url, banner_url, contact_number, address, delivery_charge,
             opening_time, closing_time, is_accepting_orders, updated_at
      FROM restaurant_settings WHERE id=1
    `,
    );
    setResourceCache("admin:restaurant", result.rows[0]);
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error("[adminController] getRestaurant failed", error);
    res
      .status(502)
      .json({ success: false, message: "Failed to load restaurant settings" });
  }
};

const updateRestaurant = async (req, res) => {
  try {
    await ensureAdminTables();
    const {
      name,
      logo_url,
      banner_url,
      contact_number,
      address,
      gst_percentage,
      delivery_radius,
      delivery_charge,
      opening_time,
      closing_time,
      is_accepting_orders = true,
    } = req.body;

    const result = await runQuery(
      "updateRestaurant",
      `
      UPDATE restaurant_settings
      SET
        name = $1,
        logo_url = $2,
        banner_url = $3,
        contact_number = $4,
        address = $5,
        delivery_charge = $6,
        opening_time = $7,
        closing_time = $8,
        is_accepting_orders = $9,
        gst = $10,
         "deliveryRadiusKm" = $11,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
      RETURNING
        id,
        name,
        logo_url,
        banner_url,
        contact_number,
        address,
        gst,
        "deliveryRadiusKm",
        delivery_charge,
        opening_time,
        closing_time,
        is_accepting_orders,
        updated_at
      `,
      [
        name,
        logo_url,
        banner_url,
        contact_number,
        address,
        delivery_charge,
        opening_time,
        closing_time,
        is_accepting_orders,
        gst_percentage,
        delivery_radius,
      ],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Restaurant settings not found",
      });
    }

    invalidateResourceCache("admin:restaurant");

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error("[adminController] updateRestaurant failed:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update restaurant settings",
      error: error.message, // Remove in production
    });
  }
};
const getCategories = async (req, res) => {
  try {
    await ensureAdminTables();
    const cached = getResourceCache("admin:categories");
    if (cached) return res.json({ success: true, data: cached });

    const result = await runQuery(
      "getCategories",
      "SELECT id, name, created_at, updated_at FROM menu_categories ORDER BY name ASC",
    );
    setResourceCache("admin:categories", result.rows);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error("[adminController] getCategories failed", error);
    res
      .status(502)
      .json({ success: false, message: "Failed to load categories" });
  }
};

const createCategory = async (req, res) => {
  try {
    await ensureAdminTables();
    const result = await runQuery(
      "createCategory",
      "INSERT INTO menu_categories (name) VALUES ($1) RETURNING id, name, created_at, updated_at",
      [req.body.name],
    );
    invalidateResourceCache("admin:categories");
    invalidateDashboardCache();
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error("[adminController] createCategory failed", error);
    res
      .status(502)
      .json({ success: false, message: "Failed to create category" });
  }
};

const updateCategory = async (req, res) => {
  try {
    await ensureAdminTables();
    const result = await runQuery(
      "updateCategory",
      "UPDATE menu_categories SET name=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2 RETURNING id, name, created_at, updated_at",
      [req.body.name, req.params.id],
    );
    invalidateResourceCache("admin:categories");
    invalidateDashboardCache();
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error("[adminController] updateCategory failed", error);
    res
      .status(502)
      .json({ success: false, message: "Failed to update category" });
  }
};

const deleteCategory = async (req, res) => {
  try {
    await ensureAdminTables();
    await runQuery(
      "deleteCategory",
      "DELETE FROM menu_categories WHERE id=$1",
      [req.params.id],
    );
    invalidateResourceCache("admin:categories");
    invalidateDashboardCache();
    res.json({ success: true, message: "Category deleted successfully" });
  } catch (error) {
    console.error("[adminController] deleteCategory failed", error);
    res
      .status(502)
      .json({ success: false, message: "Failed to delete category" });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { name, phone, picture, currentPassword, newPassword } = req.body;
    // Expect frontend to upload profile images to Cloudinary and provide `picture` as a URL.
    const finalPicture = picture;

    if (newPassword) {
      const user = await runQuery(
        "updateProfile fetch current password",
        "SELECT password FROM users WHERE id=$1",
        [req.user.id],
      );
      const hasPassword = Boolean(user.rows[0]?.password);
      if (hasPassword) {
        const matches = await bcrypt.compare(
          currentPassword || "",
          user.rows[0].password,
        );
        if (!matches) {
          return res
            .status(400)
            .json({ success: false, message: "Current password is incorrect" });
        }
      }
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await runQuery(
        "updateProfile set password",
        "UPDATE users SET password=$1 WHERE id=$2",
        [hashedPassword, req.user.id],
      );
    }

    const result = await runQuery(
      "updateProfile",
      "UPDATE users SET name=$1, phone=$2, picture=$3 WHERE id=$4 RETURNING id, name, email, phone, picture, role",
      [
        name || req.user.name,
        phone || req.user.phone,
        finalPicture || req.user.picture,
        req.user.id,
      ],
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error("[adminController] updateProfile failed", error);
    res
      .status(502)
      .json({ success: false, message: "Failed to update profile" });
  }
};

module.exports = {
  getDashboard,
  getBootstrap,
  getCustomers,
  getCustomer,
  getOffers,
  createOffer,
  updateOffer,
  deleteOffer,
  getRestaurant,
  updateRestaurant,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  updateProfile,
  ensureAdminTables,
};
