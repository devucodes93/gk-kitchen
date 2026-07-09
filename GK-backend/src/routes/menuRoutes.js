const express = require("express");
const router = express.Router();
const {
  AddMenu,
  fetchMenu,
  getMenu,
  updateMenu,
  deleteMenu,
  updateMenuStatus,
  updateMenuPrice,
} = require("../controller/menuController");
const protect = require("../middleware/authMiddleware");
const role = require("../middleware/roleMiddleware");

// Create Menu
router.post("/", protect, role("admin"), AddMenu);

// Get All Menu
router.get("/", fetchMenu);

// Get Single Menu
router.get("/:id", getMenu);

// Update Menu
router.put("/:id", protect, role("admin"), updateMenu);
router.patch("/:id/status", protect, role("admin"), updateMenuStatus);
router.patch("/:id/price", protect, role("admin"), updateMenuPrice);

// Delete Menu
router.delete("/:id", protect, role("admin"), deleteMenu);

module.exports = router;
