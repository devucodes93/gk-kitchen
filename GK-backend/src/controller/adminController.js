const bcrypt = require("bcrypt");
const pool = require("../config/db");

let adminSchemaReady = false;
let adminSchemaPromise = null;

const ensureAdminTables = async () => {
  if (adminSchemaReady) return;
  if (adminSchemaPromise) return adminSchemaPromise;

  adminSchemaPromise = (async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS offers (
      id SERIAL PRIMARY KEY,
      title VARCHAR(160) NOT NULL,
      description TEXT,
      discount_type VARCHAR(40) DEFAULT 'percent',
      discount_value NUMERIC DEFAULT 0,
      enabled BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS restaurant_settings (
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
    )
  `);

  await pool.query(`
    ALTER TABLE restaurant_settings
    ADD COLUMN IF NOT EXISTS name VARCHAR(180) DEFAULT 'Gautam Kitchen',
    ADD COLUMN IF NOT EXISTS logo_url TEXT,
    ADD COLUMN IF NOT EXISTS banner_url TEXT,
    ADD COLUMN IF NOT EXISTS contact_number VARCHAR(40),
    ADD COLUMN IF NOT EXISTS address TEXT,
    ADD COLUMN IF NOT EXISTS delivery_charge NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS opening_time VARCHAR(20),
    ADD COLUMN IF NOT EXISTS closing_time VARCHAR(20),
    ADD COLUMN IF NOT EXISTS is_accepting_orders BOOLEAN DEFAULT TRUE
  `);

  await pool.query(`
    INSERT INTO restaurant_settings (id)
    VALUES (1)
    ON CONFLICT (id) DO NOTHING
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS menu_categories (
      id SERIAL PRIMARY KEY,
      name VARCHAR(120) NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
    adminSchemaReady = true;
  })().finally(() => {
    adminSchemaPromise = null;
  });

  return adminSchemaPromise;
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
      pool.query("SELECT * FROM orders ORDER BY created_at DESC LIMIT 8"),
    ]);

    const row = stats.rows[0] || {};

    res.json({
      success: true,
      data: {
        totalRevenue: Number(row.total_revenue || 0),
        todaysRevenue: Number(row.todays_revenue || 0),
        totalOrders: Number(row.total_orders || 0),
        pendingOrders: Number(row.pending_orders || 0),
        completedOrders: Number(row.completed_orders || 0),
        cancelledOrders: Number(row.cancelled_orders || 0),
        totalCustomers: Number(row.total_customers || 0),
        totalMenuItems: Number(row.total_menu_items || 0),
        recentOrders: recentOrders.rows,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to load dashboard" });
  }
};

const getCustomers = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        u.id,
        u.name,
        u.email,
        u.phone,
        u.picture,
        COUNT(o.id) AS order_count,
        COALESCE(SUM(o.total_price), 0) AS total_spent
      FROM users u
      LEFT JOIN orders o ON o.user_id = u.id
      GROUP BY u.id
      ORDER BY u.id DESC
    `);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to load customers" });
  }
};

const getCustomer = async (req, res) => {
  try {
    const customer = await pool.query(
      "SELECT id, name, email, phone, picture FROM users WHERE id=$1",
      [req.params.id],
    );
    const orders = await pool.query(
      "SELECT * FROM orders WHERE user_id=$1 ORDER BY created_at DESC",
      [req.params.id],
    );

    if (!customer.rows.length) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    res.json({
      success: true,
      data: { ...customer.rows[0], orders: orders.rows },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to load customer" });
  }
};

const getOffers = async (req, res) => {
  await ensureAdminTables();
  const result = await pool.query("SELECT * FROM offers ORDER BY id DESC");
  res.json({ success: true, data: result.rows });
};

const createOffer = async (req, res) => {
  await ensureAdminTables();
  const { title, description, discount_type, discount_value, enabled = true } = req.body;
  const result = await pool.query(
    `INSERT INTO offers (title, description, discount_type, discount_value, enabled)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [title, description, discount_type, discount_value, enabled],
  );
  res.status(201).json({ success: true, data: result.rows[0] });
};

const updateOffer = async (req, res) => {
  await ensureAdminTables();
  const { title, description, discount_type, discount_value, enabled = true } = req.body;
  const result = await pool.query(
    `UPDATE offers
     SET title=$1, description=$2, discount_type=$3, discount_value=$4, enabled=$5, updated_at=CURRENT_TIMESTAMP
     WHERE id=$6
     RETURNING *`,
    [title, description, discount_type, discount_value, enabled, req.params.id],
  );
  res.json({ success: true, data: result.rows[0] });
};

const deleteOffer = async (req, res) => {
  await ensureAdminTables();
  await pool.query("DELETE FROM offers WHERE id=$1", [req.params.id]);
  res.json({ success: true, message: "Offer deleted successfully" });
};

const getRestaurant = async (req, res) => {
  await ensureAdminTables();
  const result = await pool.query("SELECT * FROM restaurant_settings WHERE id=1");
  res.json({ success: true, data: result.rows[0] });
};

const updateRestaurant = async (req, res) => {
  await ensureAdminTables();
  const {
    name,
    logo_url,
    banner_url,
    contact_number,
    address,
    delivery_charge,
    opening_time,
    closing_time,
    is_accepting_orders = true,
  } = req.body;

  const result = await pool.query(
    `UPDATE restaurant_settings
     SET name=$1, logo_url=$2, banner_url=$3, contact_number=$4, address=$5,
         delivery_charge=$6, opening_time=$7, closing_time=$8,
         is_accepting_orders=$9, updated_at=CURRENT_TIMESTAMP
     WHERE id=1
     RETURNING *`,
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
    ],
  );

  res.json({ success: true, data: result.rows[0] });
};

const getCategories = async (req, res) => {
  await ensureAdminTables();
  const result = await pool.query("SELECT * FROM menu_categories ORDER BY name ASC");
  res.json({ success: true, data: result.rows });
};

const createCategory = async (req, res) => {
  await ensureAdminTables();
  const result = await pool.query(
    "INSERT INTO menu_categories (name) VALUES ($1) RETURNING *",
    [req.body.name],
  );
  res.status(201).json({ success: true, data: result.rows[0] });
};

const updateCategory = async (req, res) => {
  await ensureAdminTables();
  const result = await pool.query(
    "UPDATE menu_categories SET name=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2 RETURNING *",
    [req.body.name, req.params.id],
  );
  res.json({ success: true, data: result.rows[0] });
};

const deleteCategory = async (req, res) => {
  await ensureAdminTables();
  await pool.query("DELETE FROM menu_categories WHERE id=$1", [req.params.id]);
  res.json({ success: true, message: "Category deleted successfully" });
};

const updateProfile = async (req, res) => {
  try {
    const { name, phone, picture, currentPassword, newPassword } = req.body;
    const updates = [name || req.user.name, phone || req.user.phone, picture || req.user.picture, req.user.id];

    if (newPassword) {
      const user = await pool.query("SELECT password FROM users WHERE id=$1", [req.user.id]);
      const hasPassword = Boolean(user.rows[0]?.password);
      if (hasPassword) {
        const matches = await bcrypt.compare(currentPassword || "", user.rows[0].password);
        if (!matches) {
          return res.status(400).json({ success: false, message: "Current password is incorrect" });
        }
      }
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await pool.query("UPDATE users SET password=$1 WHERE id=$2", [hashedPassword, req.user.id]);
    }

    const result = await pool.query(
      "UPDATE users SET name=$1, phone=$2, picture=$3 WHERE id=$4 RETURNING id, name, email, phone, picture, role",
      updates,
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to update profile" });
  }
};

module.exports = {
  getDashboard,
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
