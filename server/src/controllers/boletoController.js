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
      orderBy: [{ paid: "asc" }, { dueDate: "asc" }], // Pendentes primeiro
    });

    res.json(boletos);
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const data = boletoSchema.parse(req.body);

    const boleto = await prisma.boleto.create({
      data: {
        userId: req.userId,
        barcode: data.barcode || null,
        amount: data.amount,
        dueDate: new Date(data.dueDate),
        description: data.description.trim(),
      },
    });

    res.status(201).json(boleto);
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    const { id } = req.params;

    const boleto = await prisma.boleto.findFirst({
      where: { id, userId: req.userId },
    });

    if (!boleto) {
      return res.status(404).json({ error: "Boleto não encontrado" });
    }

    await prisma.boleto.delete({ where: { id } });

    res.json({ message: "Boleto removido" });
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { description, amount, dueDate, barcode, paid } = req.body;

    const boleto = await prisma.boleto.findFirst({
      where: { id, userId: req.userId },
    });

    if (!boleto) {
      return res.status(404).json({ error: "Boleto não encontrado" });
    }

    const data = {};
    if (description !== undefined) data.description = description.trim();
    if (amount !== undefined) data.amount = Number(amount);
    if (dueDate !== undefined) data.dueDate = new Date(dueDate);
    if (barcode !== undefined) data.barcode = barcode || null;
    if (paid !== undefined) data.paid = Boolean(paid);

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