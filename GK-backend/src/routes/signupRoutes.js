const express = require("express");
const router = express.Router();

const { createUser } = require("../controller/signupController");

router.post("/register", createUser);

module.exports = router;
