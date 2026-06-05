const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/authMiddleware");
const ctrl = require("../controllers/transactionController");

router.use(authMiddleware);

router.get("/", ctrl.list);
router.post("/", ctrl.create);
router.delete("/all", ctrl.removeAll);
router.get("/calendar", ctrl.calendar);
router.put("/:id", ctrl.update);
router.delete("/:id", ctrl.remove);

module.exports = router;