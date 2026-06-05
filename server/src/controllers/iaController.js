const { PrismaClient } = require("@prisma/client");
const { chatWithIA, categorizeTransaction } = require("../services/iaService");
const prisma = new PrismaClient();

const chat = async (req, res, next) => {
  try {
    const { message, history = [] } = req.body;
    if (!message) return res.status(400).json({ error: "Mensagem é obrigatória" });
    const result = await chatWithIA(req.userId, message, history);
    res.json({ reply: result.reply, context: result.context, fallback: result.fallback || false });
  } catch (error) { next(error); }
};

const categorize = async (req, res, next) => {
  try {
    const { description, amount } = req.body;
    if (!description || !amount) return res.status(400).json({ error: "Descrição e valor são obrigatórios" });
    const categories = await prisma.category.findMany({ where: { userId: req.userId } });
    const categoryId = await categorizeTransaction(description, amount, categories);
    res.json({ categoryId });
  } catch (error) { next(error); }
};

module.exports = { chat, categorize };