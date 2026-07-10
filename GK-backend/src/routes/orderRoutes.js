const express = require("express");
const router = express.Router();

const {
  createOrder,
  getOrders,
  getMyOrders,
  updateOrderStatus,
  getOrdersPing,
} = require("../controller/orderController.js");
const { orderEvents } = require("../utils/orderEvents.js");

const protect = require("../middleware/authMiddleware");
const role = require("../middleware/roleMiddleware");

// Customers must login before placing orders so order history and tracking stay exact.
router.post("/place-order", protect, createOrder);

// Only admins can view all orders
router.get("/events", orderEvents);
router.get("/ping", protect, role("admin"), getOrdersPing);
router.get("/orders", protect, role("admin"), getOrders);
router.get("/", protect, role("admin"), getOrders);
router.patch("/:id/status", protect, role("admin"), updateOrderStatus);
//only user can see their past orders
router.get("/my-orders", protect, getMyOrders);

module.exports = router;
