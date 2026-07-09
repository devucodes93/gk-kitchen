const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { ensureAdminTables } = require("../controller/adminController");

router.get("/", async (req, res) => {
  try {
    await ensureAdminTables();
    const result = await pool.query("SELECT * FROM restaurant_settings WHERE id=1");
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to load restaurant settings" });
  }
});

module.exports = router;
