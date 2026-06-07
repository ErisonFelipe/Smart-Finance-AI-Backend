const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const app = express();

const errorHandler = require("./middlewares/errorHandler");

// Rotas
const authRoutes = require("./routes/authRoutes");
const transactionRoutes = require("./routes/transactionRoutes");
const debtRoutes = require("./routes/debtRoutes");
const boletoRoutes = require("./routes/boletoRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const iaRoutes = require("./routes/iaRoutes");
const userRoutes = require("./routes/userRoutes");
const projectionRoutes = require("./routes/projectionRoutes");

// Middlewares globais
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  
  // Responder imediatamente a requisições preflight
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  
  next();
});
app.use(express.json());

// Rotas
app.use("/api/auth", authRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/debts", debtRoutes);
app.use("/api/boletos", boletoRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/ia", iaRoutes);
app.use("/api/user", userRoutes);
app.use("/api/projection", projectionRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Error handler (deve ser o último middleware)
app.use(errorHandler);

module.exports = app;