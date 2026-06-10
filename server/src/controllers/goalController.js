const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const list = async (req, res, next) => {
  try {
    const goals = await prisma.goal.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: "desc" },
    });
    res.json(goals);
  } catch (error) { next(error); }
};

const create = async (req, res, next) => {
  try {
    const { name, targetAmount, deadline, color, icon } = req.body;

    if (!name || !targetAmount) {
      return res.status(400).json({ error: "Nome e valor são obrigatórios" });
    }

    const goal = await prisma.goal.create({
      data: {
        userId: req.userId,
        name: name.trim(),
        targetAmount: Number(targetAmount),
        deadline: deadline ? new Date(deadline) : null,
        color: color || "#059669",
        icon: icon || "target",
      },
    });

    res.status(201).json(goal);
  } catch (error) { next(error); }
};

const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, targetAmount, currentAmount, deadline, color, status } = req.body;

    const goal = await prisma.goal.findFirst({
      where: { id, userId: req.userId },
    });

    if (!goal) return res.status(404).json({ error: "Meta não encontrada" });

    const data = {};
    if (name !== undefined) data.name = name;
    if (targetAmount !== undefined) data.targetAmount = Number(targetAmount);
    if (currentAmount !== undefined) {
      data.currentAmount = Number(currentAmount);
      // Auto-completar se atingiu a meta
      if (Number(currentAmount) >= goal.targetAmount) {
        data.status = "completed";
      }
    }
    if (deadline !== undefined) data.deadline = deadline ? new Date(deadline) : null;
    if (color !== undefined) data.color = color;
    if (status !== undefined) data.status = status;

    const updated = await prisma.goal.update({ where: { id }, data });
    res.json(updated);
  } catch (error) { next(error); }
};

const remove = async (req, res, next) => {
  try {
    const { id } = req.params;
    const goal = await prisma.goal.findFirst({ where: { id, userId: req.userId } });
    if (!goal) return res.status(404).json({ error: "Meta não encontrada" });

    await prisma.goal.delete({ where: { id } });
    res.json({ message: "Meta removida" });
  } catch (error) { next(error); }
};

const addValue = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ error: "Valor deve ser maior que zero" });
    }

    const goal = await prisma.goal.findFirst({ where: { id, userId: req.userId } });
    if (!goal) return res.status(404).json({ error: "Meta não encontrada" });

    const newAmount = goal.currentAmount + Number(amount);
    const status = newAmount >= goal.targetAmount ? "completed" : "active";

    const updated = await prisma.goal.update({
      where: { id },
      data: { currentAmount: newAmount, status },
    });

    res.json(updated);
  } catch (error) { next(error); }
};

module.exports = { list, create, update, remove, addValue };