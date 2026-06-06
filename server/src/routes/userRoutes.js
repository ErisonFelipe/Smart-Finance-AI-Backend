const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const authMiddleware = require("../middlewares/authMiddleware");
const { getProfile, updateProfile } = require("../controllers/userController");

// Garantir que a pasta uploads existe
const uploadsDir = path.join(__dirname, "..", "..", "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname).toLowerCase());
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  }

  cb(new Error("Apenas imagens (JPEG, PNG, GIF, WebP) são permitidas"), false);
};

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter,
});

router.use(authMiddleware);

router.get("/profile", getProfile);
router.put("/profile", upload.single("photo"), updateProfile);

module.exports = router;