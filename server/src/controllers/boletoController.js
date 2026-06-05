const { PrismaClient } = require("@prisma/client");
const { boletoSchema } = require("../validators/schemas");
const prisma = new PrismaClient();

const list = async (req, res, next) => {
  try {
    const { status } = req.query;
    const where = { userId: req.userId };
    if (status === "paid") where.paid = true;
    else if (status === "pending") where.paid = false;
    const boletos = await prisma.boleto.findMany({ where, orderBy: { dueDate: "asc" } });
    res.json(boletos);
  } catch (error) { next(error); }
};

const create = async (req, res, next) => {
  try {
    const data = boletoSchema.parse(req.body);
    const boleto = await prisma.boleto.create({
      data: { userId: req.userId, barcode: data.barcode, amount: data.amount, dueDate: new Date(data.dueDate), description: data.description },
    });
    res.status(201).json(boleto);
  } catch (error) { next(error); }
};

module.exports = { list, create };