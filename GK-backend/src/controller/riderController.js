const pool = require("../config/db");
const { broadcastOrderEvent } = require("../utils/orderEvents");

const getRiderOrders = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         id,
         user_id,
         customer_name,
         phone_number,
         location,
         items,
         total_price,
         payment_method,
         delivery_lat,
         delivery_lng,
         location_label,
         rider_id,
         rider_name,
         order_instructions,
         order_preferences,
         status,
         created_at,
         updated_at
       FROM orders
       WHERE status != 'Cancelled'
         AND (
           rider_id = $1
           OR (
             rider_id IS NULL
             AND status NOT IN ('Out for Delivery', 'Delivered')
           )
         )
       ORDER BY
         CASE WHEN status = 'Delivered' THEN 1 ELSE 0 END,
         id DESC`,
      [req.user.id],
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to load rider orders" });
  }
};

const pickOrder = async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE orders
       SET rider_id=$1,
           rider_name=$2,
           status='Out for Delivery',
           updated_at=CURRENT_TIMESTAMP
       WHERE id=$3
         AND status NOT IN ('Out for Delivery', 'Delivered', 'Cancelled')
         AND rider_id IS NULL
       RETURNING *`,
      [req.user.id, req.user.name || req.user.email || "Rider", req.params.id],
    );

    if (!result.rows.length) {
      return res.status(409).json({ success: false, message: "Order is already picked or unavailable" });
    }

    broadcastOrderEvent("order-picked", result.rows[0]);
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to pick order" });
  }
};

const markDelivered = async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE orders
       SET status='Delivered', updated_at=CURRENT_TIMESTAMP
       WHERE id=$1 AND rider_id=$2
       RETURNING *`,
      [req.params.id, req.user.id],
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: "Picked order not found" });
    }

    broadcastOrderEvent("order-updated", result.rows[0]);
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to mark delivered" });
  }
};

module.exports = { getRiderOrders, pickOrder, markDelivered };
