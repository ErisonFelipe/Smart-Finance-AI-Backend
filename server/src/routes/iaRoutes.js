const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/authMiddleware");
const { chat, categorize } = require("../controllers/iaController");

router.use(authMiddleware);

router.post("/chat", chat);
router.post("/categorize", categorize);

module.exports = router;