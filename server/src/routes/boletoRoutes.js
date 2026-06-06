const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/authMiddleware");
const { list, create, remove } = require("../controllers/boletoController");

router.use(authMiddleware);

router.get("/", list);
router.post("/", create);
router.delete("/:id", remove);

module.exports = router;