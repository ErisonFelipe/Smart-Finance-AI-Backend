const { PrismaClient } = require("@prisma/client");
const { transactionSchema } = require("../validators/schemas");

const prisma = new PrismaClient();

const list = async (req, res, next) => {
  try {
    const { month, year, type, status, search } = req.query;
    const where = { userId: req.userId };

    // Filtro por mês/ano
    if (month && year) {
      const startDate = new Date(Number(year), Number(month) - 1, 1);
      const endDate = new Date(Number(year), Number(month), 0, 23, 59, 59);
      where.dueDate = { gte: startDate, lte: endDate };
    }

    // Filtro por tipo
    if (type && type !== "all") where.type = type;

    // Filtro por status
    if (status === "paid") where.paid = true;
    else if (status === "pending") where.paid = false;

    // Filtro por busca textual
    if (search) {
      where.description = { contains: search };
    }

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
        description: data.description.trim(),
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

    // Verificar se a transação existe e pertence ao usuário
    const existing = await prisma.transaction.findFirst({
      where: { id, userId: req.userId },
    });

    if (!existing) {
      return res.status(404).json({ error: "Transação não encontrada" });
    }

    const data = req.body;
    const updateData = {};

    if (data.description !== undefined) updateData.description = data.description.trim();
    if (data.amount !== undefined) updateData.amount = Number(data.amount);
    if (data.type !== undefined) updateData.type = data.type;
    if (data.categoryId !== undefined) updateData.categoryId = data.categoryId;
    if (data.dueDate !== undefined) updateData.dueDate = new Date(data.dueDate);
    if (data.paid !== undefined) {
      updateData.paid = data.paid;
      updateData.paymentDate = data.paid ? new Date() : null;
    }

    const updated = await prisma.transaction.update({
      where: { id },
      data: updateData,
      include: { category: true },
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    const { id } = req.params;

    const transaction = await prisma.transaction.findFirst({
      where: { id, userId: req.userId },
    });

    if (!transaction) {
      return res.status(404).json({ error: "Transação não encontrada" });
    }

    await prisma.transaction.delete({ where: { id } });

    res.json({ message: "Transação removida" });
  } catch (error) {
    next(error);
  }
};

const removeAll = async (req, res, next) => {
  try {
    const result = await prisma.transaction.deleteMany({
      where: { userId: req.userId },
    });

    res.json({ message: `${result.count} transações removidas` });
  } catch (error) {
    next(error);
  }
};

const calendar = async (req, res, next) => {
  try {
    const { month, year } = req.query;

    const startDate = new Date(Number(year), Number(month) - 1, 1);
    const endDate = new Date(Number(year), Number(month), 0, 23, 59, 59);

    const [transactions, boletos] = await Promise.all([
      prisma.transaction.findMany({
        where: { userId: req.userId, dueDate: { gte: startDate, lte: endDate } },
        select: { id: true, description: true, amount: true, type: true, dueDate: true, paid: true },
      }),
      prisma.boleto.findMany({
        where: { userId: req.userId, dueDate: { gte: startDate, lte: endDate } },
        select: { id: true, description: true, amount: true, dueDate: true, paid: true },
      }),
    ]);

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