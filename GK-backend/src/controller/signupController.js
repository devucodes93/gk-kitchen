const pool = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const SALT_ROUNDS = 10;

const ensureUserColumns = async () => {
  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS role VARCHAR(40) DEFAULT 'customer',
    ADD COLUMN IF NOT EXISTS picture TEXT
  `);
};

const signUserToken = (user) =>
  jwt.sign(
    {
      id: user.id,
      name: user.name,
      email: user.email,
      picture: user.picture,
      role: user.role || "customer",
    },
    process.env.JWT_SECRET,
    { expiresIn: "30d" },
  );

const createUser = async (req, res) => {
  try {
    await ensureUserColumns();
    const { name, email, phone, birthday, favDish, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: "name, email and password are required" });
    }

    const existing = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, message: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const result = await pool.query(
      `INSERT INTO users (name, email, phone, birthday, fav_dish, password)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, email, phone, birthday, fav_dish`,
      [name, email, phone, birthday, favDish, hashedPassword]
    );

    res.status(201).json({ success: true, message: "User created successfully", user: result.rows[0] });
  } catch (error) {
    console.error("createUser error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const loginUser = async (req, res) => {
  try {
    await ensureUserColumns();
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "email and password are required" });
    }

    const result = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    const token = signUserToken(user);

    const { password: _, ...safeUser } = user; // strip password from response
    res.status(200).json({ success: true, message: "Login successful", user: safeUser, token });
  } catch (error) {
    console.error("loginUser error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const adminLogin = async (req, res) => {
  try {
    await ensureUserColumns();
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "email and password are required" });
    }

    const adminCount = await pool.query("SELECT COUNT(*) FROM users WHERE role = 'admin'");
    const hasAdmin = Number(adminCount.rows[0].count) > 0;
    let result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);

    if (!hasAdmin && result.rows.length === 0) {
      const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
      result = await pool.query(
        `INSERT INTO users (name, email, password, role)
         VALUES ($1, $2, $3, 'admin')
         RETURNING *`,
        ["Restaurant Admin", email, hashedPassword],
      );
    } else if (!hasAdmin && result.rows.length > 0) {
      const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
      result = await pool.query(
        `UPDATE users
         SET password=$1, role='admin'
         WHERE email=$2
         RETURNING *`,
        [hashedPassword, email],
      );
    }

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: "Invalid admin email or password" });
    }

    const user = result.rows[0];
    if (user.role !== "admin") {
      return res.status(403).json({ success: false, message: "This account is not an admin" });
    }

    const match = await bcrypt.compare(password, user.password || "");
    if (!match) {
      return res.status(401).json({ success: false, message: "Invalid admin email or password" });
    }

    const { password: _, ...safeUser } = user;
    res.json({
      success: true,
      message: hasAdmin ? "Admin login successful" : "First admin created",
      user: safeUser,
      token: signUserToken(user),
    });
  } catch (error) {
    console.error("adminLogin error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const riderLogin = async (req, res) => {
  try {
    await ensureUserColumns();
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "email and password are required" });
    }

    let result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);

    if (result.rows.length === 0) {
      const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
      result = await pool.query(
        `INSERT INTO users (name, email, password, role)
         VALUES ($1, $2, $3, 'rider')
         RETURNING *`,
        [name || "Delivery Rider", email, hashedPassword],
      );
    }

    const user = result.rows[0];
    if (user.role !== "rider" && user.role !== "admin") {
      return res.status(403).json({ success: false, message: "This account is not a rider" });
    }

    const match = await bcrypt.compare(password, user.password || "");
    if (!match) {
      return res.status(401).json({ success: false, message: "Invalid rider email or password" });
    }

    const { password: _, ...safeUser } = user;
    res.json({
      success: true,
      message: result.rows[0].role === "rider" ? "Rider login successful" : "Admin rider access",
      user: safeUser,
      token: signUserToken(user),
    });
  } catch (error) {
    console.error("riderLogin error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

module.exports = { createUser, loginUser, adminLogin, riderLogin, ensureUserColumns, signUserToken };
