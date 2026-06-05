const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/authMiddleware");
const { summary } = require("../controllers/dashboardController");

router.use(authMiddleware);

router.get("/summary", summary);

module.exports = router;