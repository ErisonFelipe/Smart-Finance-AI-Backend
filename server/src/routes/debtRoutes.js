const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/authMiddleware");
const { list, create, remove } = require("../controllers/debtController");
const { list, create, remove, payInstallment } = require("../controllers/debtController");

router.use(authMiddleware);

router.get("/", list);
router.post("/", create);
router.delete("/:id", remove);
router.put("/installment/:id", payInstallment);

module.exports = router;