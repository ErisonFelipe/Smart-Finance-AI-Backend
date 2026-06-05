const { PrismaClient } = require("@prisma/client");
const { transactionSchema } = require("../validators/schemas");

const prisma = new PrismaClient();

const list = async (req, res, next) => {
  try {
    const { month, year, type, status } = req.query;
    const where = { userId: req.userId };

    if (month && year) {
      const startDate = new Date(Number(year), Number(month) - 1, 1);
      const endDate = new Date(Number(year), Number(month), 0, 23, 59, 59);
      where.dueDate = { gte: startDate, lte: endDate };
    }

    if (type && type !== "all") where.type = type;
    if (status === "paid") where.paid = true;
    else if (status === "pending") where.paid = false;

    const transactions = await prisma.transaction.findMany({
      where,
      include: { category: true },
      orderBy: { dueDate: "desc" },
    });

    res.json(transactions);
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const data = transactionSchema.parse(req.body);

    const transaction = await prisma.transaction.create({
      data: {
        type: data.type,
        amount: data.amount,
        description: data.description,
        dueDate: new Date(data.dueDate),
        categoryId: data.categoryId,
        userId: req.userId,
        recurrence: data.recurrence || "none",
        installments: data.installments || 1,
        paid: data.paid || false,
        paymentDate: data.paid ? new Date() : null,
      },
      include: { category: true },
    });

    res.status(201).json(transaction);
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const updateData = {};
    if (data.description !== undefined) updateData.description = data.description;
    if (data.amount !== undefined) updateData.amount = Number(data.amount);
    if (data.type !== undefined) updateData.type = data.type;
    if (data.categoryId !== undefined) updateData.categoryId = data.categoryId;
    if (data.dueDate !== undefined) updateData.dueDate = new Date(data.dueDate);
    if (data.paid !== undefined) {
      updateData.paid = data.paid;
      updateData.paymentDate = data.paid ? new Date() : null;
    }

    const transaction = await prisma.transaction.updateMany({
      where: { id, userId: req.userId },
      data: updateData,
    });

    if (transaction.count === 0) {
      return res.status(404).json({ error: "Transação não encontrada" });
    }

    res.json({ message: "Transação atualizada" });
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    const { id } = req.params;

    const transaction = await prisma.transaction.deleteMany({
      where: { id, userId: req.userId },
    });

    if (transaction.count === 0) {
      return res.status(404).json({ error: "Transação não encontrada" });
    }

    res.json({ message: "Transação removida" });
  } catch (error) {
    next(error);
  }
};

// ✅ Função para deletar TODAS as transações
async function removeAll(req, res, next) {
  try {
    const result = await prisma.transaction.deleteMany({
      where: { userId: req.userId },
    });

    res.json({ message: `${result.count} transações removidas` });
  } catch (error) {
    next(error);
  }
}

const calendar = async (req, res, next) => {
  try {
    const { month, year } = req.query;
    
    const startDate = new Date(Number(year), Number(month) - 1, 1);
    const endDate = new Date(Number(year), Number(month), 0, 23, 59, 59);

    const transactions = await prisma.transaction.findMany({
      where: {
        userId: req.userId,
        dueDate: { gte: startDate, lte: endDate },
      },
      select: {
        id: true,
        description: true,
        amount: true,
        type: true,
        dueDate: true,
        paid: true,
      },
    });

    const boletos = await prisma.boleto.findMany({
      where: {
        userId: req.userId,
        dueDate: { gte: startDate, lte: endDate },
      },
      select: {
        id: true,
        description: true,
        amount: true,
        dueDate: true,
        paid: true,
      },
    });

    // Formatar eventos
    const events = [
      ...transactions.map((t) => ({
        id: t.id,
        descricao: t.description,
        valor: t.amount,
        data: t.dueDate,
        tipo: t.type === "income" ? "renda" : t.type === "expense" ? "despesa" : "investimento",
        pago: t.paid,
      })),
      ...boletos.map((b) => ({
        id: b.id,
        descricao: b.description,
        valor: b.amount,
        data: b.dueDate,
        tipo: "boleto",
        pago: b.paid,
      })),
    ];

    res.json(events);
  } catch (error) {
    next(error);
  }
};

module.exports = { list, create, update, remove, removeAll, calendar };
