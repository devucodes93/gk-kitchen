const pool = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const SALT_ROUNDS = 10;

const createUser = async (req, res) => {
  try {
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

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    const { password: _, ...safeUser } = user; // strip password from response
    res.status(200).json({ success: true, message: "Login successful", user: safeUser, token });
  } catch (error) {
    console.error("loginUser error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

module.exports = { createUser, loginUser };