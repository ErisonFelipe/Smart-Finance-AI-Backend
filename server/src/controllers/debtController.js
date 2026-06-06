const { PrismaClient } = require("@prisma/client");
const { debtSchema } = require("../validators/schemas");
const prisma = new PrismaClient();

const list = async (req, res, next) => {
  try {
    const { status } = req.query;
    const where = { userId: req.userId };
    if (status && status !== "all") where.status = status;

    const debts = await prisma.debt.findMany({
      where,
      include: { category: true, installmentList: { orderBy: { number: "asc" } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(debts);
  } catch (error) { next(error); }
};

const create = async (req, res, next) => {
  try {
    const data = debtSchema.parse(req.body);
    const debt = await prisma.debt.create({
      data: {
        userId: req.userId,
        categoryId: data.categoryId,
        name: data.name,
        totalAmount: data.totalAmount,
        startDate: new Date(data.startDate),
        installments: data.installments,
      },
    });

    const installmentAmount = data.totalAmount / data.installments;
    const installments = [];
    for (let i = 0; i < data.installments; i++) {
      const dueDate = new Date(data.startDate);
      dueDate.setMonth(dueDate.getMonth() + i);
      installments.push({
        debtId: debt.id,
        number: i + 1,
        amount: Math.round(installmentAmount * 100) / 100,
        dueDate,
      });
    }
    const totalCalculated = installments.reduce((acc, inst) => acc + inst.amount, 0);
    installments[installments.length - 1].amount += data.totalAmount - totalCalculated;

    await prisma.installment.createMany({ data: installments });

    const debtWithInstallments = await prisma.debt.findUnique({
      where: { id: debt.id },
      include: { category: true, installmentList: { orderBy: { number: "asc" } } },
    });
    res.status(201).json(debtWithInstallments);
  } catch (error) { next(error); }
};

const remove = async (req, res, next) => {
  try {
    const { id } = req.params;
    const debt = await prisma.debt.deleteMany({
      where: { id, userId: req.userId },
    });
    if (debt.count === 0) {
      return res.status(404).json({ error: "Dívida não encontrada" });
    }
    res.json({ message: "Dívida removida" });
  } catch (error) { next(error); }
};

const payInstallment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { paid } = req.body;

    const installment = await prisma.installment.findUnique({
      where: { id },
      include: { debt: true },
    });

    if (!installment || installment.debt.userId !== req.userId) {
      return res.status(404).json({ error: "Parcela não encontrada" });
    }

    await prisma.installment.update({
      where: { id },
      data: { paid: paid !== false },
    });

    const totalPaid = await prisma.installment.aggregate({
      where: { debtId: installment.debtId, paid: true },
      _sum: { amount: true },
    });

    const paidCount = await prisma.installment.count({
      where: { debtId: installment.debtId, paid: true },
    });

    const totalCount = await prisma.installment.count({
      where: { debtId: installment.debtId },
    });

    let status = "active";
    if (paidCount === totalCount) status = "finished";
    else if (new Date(installment.dueDate) < new Date()) status = "late";

    await prisma.debt.update({
      where: { id: installment.debtId },
      data: {
        paidAmount: totalPaid._sum.amount || 0,
        status,
      },
    });

    const updatedDebt = await prisma.debt.findUnique({
      where: { id: installment.debtId },
      include: { category: true, installmentList: { orderBy: { number: "asc" } } },
    });

    res.json(updatedDebt);
  } catch (error) { next(error); }
};

module.exports = { list, create, remove, payInstallment };