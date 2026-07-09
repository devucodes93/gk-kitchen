const router = require("express").Router();
const passport = require("passport");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const { ensureUserColumns, signUserToken } = require("../controller/signupController");

router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account",
  })
);

router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: "http://localhost:3000",
  }),
  (req, res) => {
    const token = jwt.sign(
      {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        picture: req.user.picture,
        role: req.user.role || "customer",
      },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    res.redirect(
      `http://localhost:3000/auth-success?token=${token}`
    );
  }
);

router.get("/me", async (req, res) => {
  try {
    await ensureUserColumns();
    const authHeader =
      req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    const result = await pool.query(
      "SELECT id, name, email, phone, picture, role FROM users WHERE id=$1",
      [decoded.id],
    );

    if (!result.rows.length) {
      return res.status(401).json({
        success: false,
      });
    }

    const user = result.rows[0];
    const refreshedToken = signUserToken(user);

    res.json({
      success: true,
      user,
      token: refreshedToken,
    });
  } catch (error) {
    res.status(401).json({
      success: false,
    });
  }
});

module.exports = router;
