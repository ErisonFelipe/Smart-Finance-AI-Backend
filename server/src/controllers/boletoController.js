const { PrismaClient } = require("@prisma/client");
const { boletoSchema } = require("../validators/schemas");
const prisma = new PrismaClient();

const list = async (req, res, next) => {
  try {
    const { status } = req.query;
    const where = { userId: req.userId };
    if (status === "paid") where.paid = true;
    else if (status === "pending") where.paid = false;

    const boletos = await prisma.boleto.findMany({
      where,
      orderBy: { dueDate: "asc" },
    });
    res.json(boletos);
  } catch (error) { next(error); }
};

const create = async (req, res, next) => {
  try {
    const data = boletoSchema.parse(req.body);
    const boleto = await prisma.boleto.create({
      data: {
        userId: req.userId,
        barcode: data.barcode,
        amount: data.amount,
        dueDate: new Date(data.dueDate),
        description: data.description,
      },
    });
    res.status(201).json(boleto);
  } catch (error) { next(error); }
};

const remove = async (req, res, next) => {
  try {
    const { id } = req.params;
    const boleto = await prisma.boleto.deleteMany({
      where: { id, userId: req.userId },
    });
    if (boleto.count === 0) {
      return res.status(404).json({ error: "Boleto não encontrado" });
    }
    res.json({ message: "Boleto removido" });
  } catch (error) { next(error); }
};

const togglePaid = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { paid } = req.body;

    const boleto = await prisma.boleto.findUnique({ where: { id } });

    if (!boleto || boleto.userId !== req.userId) {
      return res.status(404).json({ error: "Boleto não encontrado" });
    }

    const updated = await prisma.boleto.update({
      where: { id },
      data: { paid: paid !== false },
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }

  const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { description, amount, dueDate, barcode } = req.body;

    const boleto = await prisma.boleto.findUnique({ where: { id } });
    if (!boleto || boleto.userId !== req.userId) {
      return res.status(404).json({ error: "Boleto não encontrado" });
    }

    const data = {};
    if (description) data.description = description;
    if (amount) data.amount = Number(amount);
    if (dueDate) data.dueDate = new Date(dueDate);
    if (barcode !== undefined) data.barcode = barcode;

    const updated = await prisma.boleto.update({
      where: { id },
      data,
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
};

module.exports = { list, create, remove, update };