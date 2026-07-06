const express = require("express");
const router = express.Router();
const {
  AddMenu,
  fetchMenu,
  getMenu,
  updateMenu,
  deleteMenu,
} = require("../controller/menuController");
const role = require("../middleware/roleMiddleware");

// Create Menu
router.post("/", role("admin"), AddMenu);

// Get All Menu
router.get("/", fetchMenu);

// Get Single Menu
router.get("/:id", getMenu);

// Update Menu
router.put("/:id", role("admin"), updateMenu);

// Delete Menu
router.delete("/:id", role("admin"), deleteMenu);

module.exports = router;
