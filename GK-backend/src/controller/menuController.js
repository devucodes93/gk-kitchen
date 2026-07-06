const pool = require("../config/db");

const AddMenu = async (req, res) => {
  try {
    const { menu_type, menu_name, price, category, image_url } = req.body;

    const result = await pool.query(
      `INSERT INTO menu
      (menu_type, menu_name, price, category, image_url)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [menu_type, menu_name, price, category, image_url],
    );

    res.status(201).json({
      success: true,
      message: "Menu added successfully",
      data: result.rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

// All Menues
const fetchMenu = async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM menu ORDER BY menu_id DESC");

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Server Error",
    });
  }
};

// Single Menu
const getMenu = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query("SELECT * FROM menu WHERE menu_id=$1", [
      id,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Menu not found",
      });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Server Error",
    });
  }
};

const updateMenu = async (req, res) => {
  try {
    const { id } = req.params;

    const { menu_type, menu_name, price, category, image_url } = req.body;

    const result = await pool.query(
      `UPDATE menu
       SET
       menu_type=$1,
       menu_name=$2,
       price=$3,
       category=$4,
       image_url=$5,
       updated_at=CURRENT_TIMESTAMP
       WHERE menu_id=$6
       RETURNING *`,
      [menu_type, menu_name, price, category, image_url, id],
    );

    res.json({
      success: true,
      message: "Menu updated successfully",
      data: result.rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Server Error",
    });
  }
};

const deleteMenu = async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query("DELETE FROM menu WHERE menu_id=$1", [id]);

    res.json({
      success: true,
      message: "Menu deleted successfully",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Server Error",
    });
  }
};

module.exports = {
  AddMenu,
  fetchMenu,
  getMenu,
  updateMenu,
  deleteMenu,
};
