const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const role = require("../middleware/roleMiddleware");
const {
  getRiderOrders,
  pickOrder,
  markDelivered,
} = require("../controller/riderController");

router.use(protect, role("rider", "admin"));

router.get("/orders", getRiderOrders);
router.patch("/orders/:id/pick", pickOrder);
router.patch("/orders/:id/delivered", markDelivered);

module.exports = router;
