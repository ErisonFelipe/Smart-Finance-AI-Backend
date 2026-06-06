const { PrismaClient } = require("@prisma/client");
const { chatWithIA, categorizeTransaction } = require("../services/iaService");
const prisma = new PrismaClient();

const chat = async (req, res, next) => {
  try {
    const { message, history = [] } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: "Mensagem é obrigatória" });
    }

    const result = await chatWithIA(req.userId, message.trim(), history);

    res.json({
      reply: result.reply,
      context: result.context,
      fallback: result.fallback || false,
    });
  } catch (error) {
    console.error("Erro no chat IA:", error.message);
    next(error);
  }
};

const categorize = async (req, res, next) => {
  try {
    const { description, amount } = req.body;

    if (!description || !description.trim()) {
      return res.status(400).json({ error: "Descrição é obrigatória" });
    }

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ error: "Valor deve ser maior que zero" });
    }

    const categories = await prisma.category.findMany({
      where: { userId: req.userId },
    });

    if (categories.length === 0) {
      return res.json({ categoryId: null });
    }

    const categoryId = await categorizeTransaction(
      description.trim(),
      Number(amount),
      categories
    );

    res.json({ categoryId });
  } catch (error) {
    console.error("Erro na categorização:", error.message);
    next(error);
  }
};

module.exports = { chat, categorize };