const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/authMiddleware");
const { projection } = require("../controllers/projectionController");

router.use(authMiddleware);
router.get("/", projection);

module.exports = router;