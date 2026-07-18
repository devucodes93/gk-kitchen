const express = require("express");
const router = express.Router();

const {
  createPaymentOrder,
  verifyPayment,
  handleWebhook,
} = require("../controller/paymentController");
const protect = require("../middleware/authMiddleware");

router.post("/create-order", protect, createPaymentOrder);
router.post("/verify", protect, verifyPayment);

// NOTE: the webhook route is intentionally NOT registered here. It needs
// the raw request body (not JSON-parsed) to verify Razorpay's signature,
// and by the time a request reaches this router your global express.json()
// middleware in server.js has almost certainly already parsed it. Mount
// `handleWebhook` directly in server.js instead — see the snippet below.
module.exports = router;
module.exports.handleWebhook = handleWebhook;