const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/authMiddleware");
const ctrl = require("../controllers/goalController");

router.use(authMiddleware);

router.get("/", ctrl.list);
router.post("/", ctrl.create);
router.put("/:id", ctrl.update);
router.delete("/:id", ctrl.remove);
router.post("/:id/add", ctrl.addValue);

module.exports = router;