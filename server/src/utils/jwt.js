const jwt = require("jsonwebtoken");

const generateToken = (userId) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET não configurado");
  }
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "7d" });
};

const verifyToken = (token) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET não configurado");
  }
  return jwt.verify(token, process.env.JWT_SECRET);
};

module.exports = { generateToken, verifyToken };