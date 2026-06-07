const pool = require("../config/db");

const createUser = async (req, res) => {
  try {
    console.log("Register route hit");
    console.log(req.body);
    const { name, phone, birthday, favDish } = req.body;

    const result = await pool.query(
      `INSERT INTO users_signup(name, phone, birthday, fav_dish)
       VALUES($1,$2,$3,$4)
       RETURNING *`,
      [name, phone, birthday, favDish],
    );

    res.status(201).json({
      success: true,
      message: "User created successfully",
      user: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

module.exports = {
  createUser,
};
