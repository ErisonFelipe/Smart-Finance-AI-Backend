const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/authMiddleware");
const ctrl = require("../controllers/debtController");

router.use(authMiddleware);

router.get("/", ctrl.list);
router.post("/", ctrl.create);
router.put("/installment/:id", ctrl.payInstallment);
router.put("/:id", ctrl.update);
router.delete("/:id", ctrl.remove);

module.exports = router;