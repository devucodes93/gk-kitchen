const pool = require("../config/db");

let orderSchemaReady = false;
let orderSchemaPromise = null;
let restaurantSchemaReady = false;
let restaurantSchemaPromise = null;

const ensureOrderColumns = async () => {
  if (orderSchemaReady) return;
  if (orderSchemaPromise) return orderSchemaPromise;

  orderSchemaPromise = (async () => {
  await pool.query(`
    ALTER TABLE orders
    ALTER COLUMN user_id DROP NOT NULL,
    ADD COLUMN IF NOT EXISTS payment_method VARCHAR(80) DEFAULT 'Cash on Delivery',
    ADD COLUMN IF NOT EXISTS delivery_lat NUMERIC,
    ADD COLUMN IF NOT EXISTS delivery_lng NUMERIC,
    ADD COLUMN IF NOT EXISTS location_label TEXT,
    ADD COLUMN IF NOT EXISTS rider_id INTEGER,
    ADD COLUMN IF NOT EXISTS rider_name VARCHAR(180),
    ADD COLUMN IF NOT EXISTS order_instructions TEXT,
    ADD COLUMN IF NOT EXISTS order_preferences TEXT,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_orders_user_created
    ON orders (user_id, created_at DESC)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_orders_status_created
    ON orders (status, created_at DESC)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_orders_rider_status
    ON orders (rider_id, status)
  `);
    orderSchemaReady = true;
  })().finally(() => {
    orderSchemaPromise = null;
  });

  return orderSchemaPromise;
};

const ensureRestaurantAvailability = async () => {
  if (restaurantSchemaReady) return;
  if (restaurantSchemaPromise) return restaurantSchemaPromise;

  restaurantSchemaPromise = (async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS restaurant_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      is_accepting_orders BOOLEAN DEFAULT TRUE
    )
  `);
  await pool.query(`
    ALTER TABLE restaurant_settings
    ADD COLUMN IF NOT EXISTS is_accepting_orders BOOLEAN DEFAULT TRUE
  `);
  await pool.query(`
    INSERT INTO restaurant_settings (id)
    VALUES (1)
    ON CONFLICT (id) DO NOTHING
  `);
    restaurantSchemaReady = true;
  })().finally(() => {
    restaurantSchemaPromise = null;
  });

  return restaurantSchemaPromise;
};

const createOrder = async (req, res) => {
  try {
    await ensureOrderColumns();
    await ensureRestaurantAvailability();
    const setting = await pool.query(
      "SELECT is_accepting_orders FROM restaurant_settings WHERE id=1",
    );
    if (setting.rows[0]?.is_accepting_orders === false) {
      return res.status(423).json({
        success: false,
        message: "Delivery is currently unavailable. Please visit our restaurant or try again later.",
      });
    }
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Please login before placing an order.",
      });
    }

    const {
      customer_name,
      phone_number,
      location,
      items,
      total_price,
      cartItems,
      pricing,
      paymentMethod,
      userInfo,
      addons = [],
      preferences = [],
      instructions = "",
    } = req.body;

    const baseItems = items || cartItems || (req.body.item ? [req.body.item] : []);
    const addonItems = Array.isArray(addons)
      ? addons.map((addon) => ({
          name: addon.name,
          price: addon.price,
          quantity: addon.quantity || 1,
          item_type: "addon",
        }))
      : [];
    const orderItems = [...baseItems, ...addonItems];
    const deliveryLocation =
      typeof location === "string"
        ? location
        : location?.address || JSON.stringify(location || {});
    const deliveryLat =
      typeof location === "object" && location?.lat
        ? Number(location.lat)
        : null;
    const deliveryLng =
      typeof location === "object" && location?.lng
        ? Number(location.lng)
        : null;
    const totalPrice = total_price || pricing?.total || 0;
    const customerName = customer_name || userInfo?.name || req.user?.name || "Customer";
    const phoneNumber = phone_number || userInfo?.phone || "";
    const payment = paymentMethod === "cod" ? "Cash on Delivery" : paymentMethod || "Cash on Delivery";

    if (userId && phoneNumber) {
      await pool.query(
        `UPDATE users
         SET phone = COALESCE(NULLIF(phone, ''), $1)
         WHERE id = $2`,
        [phoneNumber, userId],
      );
    }

    const query = `
      INSERT INTO orders
      (user_id, customer_name, phone_number, location, items, total_price, payment_method, delivery_lat, delivery_lng, location_label, order_instructions, order_preferences)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *;
    `;

    const values = [
      userId,
      customerName,
      phoneNumber,
      deliveryLocation,
      JSON.stringify(orderItems),
      totalPrice,
      payment,
      deliveryLat,
      deliveryLng,
      deliveryLocation,
      instructions,
      JSON.stringify(preferences || []),
    ];

    const result = await pool.query(query, values);

    res.status(201).json({
      success: true,
      message: "Order placed successfully",
      data: result.rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

const getOrders = async (req, res) => {
  try {
    await ensureOrderColumns();
    const result = await pool.query(
      "SELECT * FROM orders ORDER BY created_at DESC LIMIT 200"
    );

    res.status(200).json({
      success: true,
      data: result.rows,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};


const getMyOrders = async (req, res) => {
  try {
    await ensureOrderColumns();
    const userId = req.user.id;

    const query = `
      SELECT
        id,
        customer_name,
        phone_number,
        location,
        items,
        total_price,
        payment_method,
        delivery_lat,
        delivery_lng,
        location_label,
        rider_name,
        order_instructions,
        order_preferences,
        status,
        created_at
      FROM orders
      WHERE user_id = $1
      ORDER BY created_at DESC;
    `;

    const result = await pool.query(query, [userId]);

    res.status(200).json({
      success: true,
      orders: result.rows,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch order history",
    });
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    await ensureOrderColumns();
    const { id } = req.params;
    const { status } = req.body;
    const allowedStatuses = [
      "Pending",
      "Preparing",
      "Ready",
      "Out for Delivery",
      "Delivered",
      "Cancelled",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order status",
      });
    }

    const result = await pool.query(
      `UPDATE orders
       SET status=$1, updated_at=CURRENT_TIMESTAMP
       WHERE id=$2
       RETURNING *`,
      [status, id],
    );

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    res.json({
      success: true,
      message: "Order status updated successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to update order status",
    });
  }
};

module.exports = {
  createOrder,
  getOrders,
  getMyOrders,
  updateOrderStatus,
  ensureOrderColumns,
};
