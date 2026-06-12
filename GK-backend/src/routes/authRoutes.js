const router = require("express").Router();
const passport = require("passport");
const jwt = require("jsonwebtoken");

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
      },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    res.redirect(
      `http://localhost:3000/auth-success?token=${token}`
    );
  }
);

router.get("/me", (req, res) => {
  try {
    const authHeader =
      req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
      });
    }

    const token = authHeader.split(" ")[1];

    const user = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    res.json({
      success: true,
      user,
    });
  } catch (error) {
    res.status(401).json({
      success: false,
    });
  }
});

module.exports = router;