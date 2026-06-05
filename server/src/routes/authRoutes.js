const express = require("express");
const router = express.Router();
const { register, login, checkEmail } = require("../controllers/authController");

router.post("/register", register);
router.post("/login", login);
router.post("/check-email", checkEmail);

module.exports = router;