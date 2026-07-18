const express = require("express");
const router = express.Router();

const { createPaymentOrder, verifyPayment } = require("../controller/PaymentController.js");
const protect = require("../middleware/authMiddleware");

router.post("/create-order", protect, createPaymentOrder);
router.post("/verify", protect, verifyPayment);

module.exports = router;
