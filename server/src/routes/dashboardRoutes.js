const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/authMiddleware");
const { list, create, remove } = require("../controllers/categoryController");

router.use(authMiddleware);

router.get("/", list);
router.post("/", create);
router.delete("/:id", remove);

module.exports = router;