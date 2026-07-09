const express = require("express");
const router = express.Router();
const { createUser, loginUser, adminLogin, riderLogin } = require("../controller/signupController");

router.post("/register", createUser);
router.post("/login", loginUser);
router.post("/admin-login", adminLogin);
router.post("/rider-login", riderLogin);

module.exports = router;
