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

// Middlewares globais
app.use(cors({
  origin: [
    "https://smart-finance-ai-one.vercel.app",
    "https://smart-finance-ai-zeta.vercel.app",
    "http://localhost:5173"
  ],
  credentials: true
}));
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

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Error handler (deve ser o último middleware)
app.use(errorHandler);

module.exports = app;