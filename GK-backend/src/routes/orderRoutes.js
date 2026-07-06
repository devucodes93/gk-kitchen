const express = require("express");
const router = express.Router();

const {
  createOrder,
  getOrders,
  getMyOrders
} = require("../controller/orderController.js");

const protect = require("../middleware/authMiddleware");
const role = require("../middleware/roleMiddleware");

// Logged-in users can place orders
router.post("/place-order", protect, createOrder);

// Only admins can view all orders
router.get("/orders", protect, role("admin"), getOrders);

//only user can see their past orders
router.get("/my-orders", protect, getMyOrders);

module.exports = router;