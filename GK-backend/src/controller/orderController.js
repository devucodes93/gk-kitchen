const pool = require("../config/db");

const createOrder = async (req, res) => {
  try {
    const userId = req.user.id; // From JWT

    const {
      customer_name,
      phone_number,
      location,
      items,
      total_price,
    } = req.body;

    const query = `
      INSERT INTO orders
      (user_id, customer_name, phone_number, location, items, total_price)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;

    const values = [
      userId,
      customer_name,
      phone_number,
      location,
      JSON.stringify(items),
      total_price,
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
    const result = await pool.query(
      "SELECT * FROM orders ORDER BY created_at DESC"
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
    const userId = req.user.id;

    const query = `
      SELECT
        id,
        customer_name,
        phone_number,
        location,
        items,
        total_price,
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

module.exports = {
  createOrder,
  getOrders,
  getMyOrders,
};