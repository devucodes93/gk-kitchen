const pool = require("../config/db");

const ensureMenuColumns = async () => {
  await pool.query(`
    ALTER TABLE menu
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS original_price NUMERIC,
    ADD COLUMN IF NOT EXISTS discounted_price NUMERIC,
    ADD COLUMN IF NOT EXISTS is_discounted BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  `);
};

const AddMenu = async (req, res) => {
  try {
    await ensureMenuColumns();
    const {
      menu_type,
      menu_name,
      price,
      category,
      image_url,
      description,
      is_available = true,
      original_price,
      discounted_price,
      is_discounted = false,
    } = req.body;

    const result = await pool.query(
      `INSERT INTO menu
      (menu_type, menu_name, price, category, image_url, description, is_available, original_price, discounted_price, is_discounted)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        menu_type,
        menu_name,
        price,
        category,
        image_url,
        description,
        is_available,
        original_price || price,
        discounted_price || null,
        is_discounted,
      ],
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
    await ensureMenuColumns();
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
    await ensureMenuColumns();
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
    await ensureMenuColumns();
    const { id } = req.params;

    const {
      menu_type,
      menu_name,
      price,
      category,
      image_url,
      description,
      is_available = true,
      original_price,
      discounted_price,
      is_discounted = false,
    } = req.body;

    const result = await pool.query(
      `UPDATE menu
       SET
       menu_type=$1,
       menu_name=$2,
       price=$3,
       category=$4,
       image_url=$5,
       description=$6,
       is_available=$7,
       original_price=$8,
       discounted_price=$9,
       is_discounted=$10,
       updated_at=CURRENT_TIMESTAMP
       WHERE menu_id=$11
       RETURNING *`,
      [
        menu_type,
        menu_name,
        price,
        category,
        image_url,
        description,
        is_available,
        original_price || price,
        discounted_price || null,
        is_discounted,
        id,
      ],
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

const updateMenuStatus = async (req, res) => {
  try {
    await ensureMenuColumns();
    const { id } = req.params;
    const { is_available } = req.body;

    const result = await pool.query(
      `UPDATE menu
       SET is_available=$1, updated_at=CURRENT_TIMESTAMP
       WHERE menu_id=$2
       RETURNING *`,
      [is_available, id],
    );

    res.json({
      success: true,
      message: "Menu status updated successfully",
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

const updateMenuPrice = async (req, res) => {
  try {
    await ensureMenuColumns();
    const { id } = req.params;
    const { price, original_price, discounted_price, is_discounted } = req.body;

    const result = await pool.query(
      `UPDATE menu
       SET price=$1,
           original_price=$2,
           discounted_price=$3,
           is_discounted=$4,
           updated_at=CURRENT_TIMESTAMP
       WHERE menu_id=$5
       RETURNING *`,
      [
        price,
        original_price || price,
        discounted_price || null,
        Boolean(is_discounted),
        id,
      ],
    );

    res.json({
      success: true,
      message: "Menu price updated successfully",
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

module.exports = {
  AddMenu,
  fetchMenu,
  getMenu,
  updateMenu,
  deleteMenu,
  updateMenuStatus,
  updateMenuPrice,
};
