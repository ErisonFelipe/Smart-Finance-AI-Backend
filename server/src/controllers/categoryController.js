const { PrismaClient } = require("@prisma/client");
const { categorySchema } = require("../validators/schemas");
const prisma = new PrismaClient();

const list = async (req, res, next) => {
  try {
    const { type } = req.query;
    const where = { userId: req.userId };

    // Filtrar por tipo se especificado
    if (type && type !== "all") {
      where.type = type;
    }

    const categories = await prisma.category.findMany({
      where,
      orderBy: [{ type: "asc" }, { name: "asc" }],
    });

    res.json(categories);
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const data = categorySchema.parse(req.body);

    // Verificar se já existe categoria com mesmo nome e tipo
    const existing = await prisma.category.findFirst({
      where: {
        userId: req.userId,
        name: data.name,
        type: data.type,
      },
    });

    if (existing) {
      return res.status(409).json({
        error: "Categoria já existe",
        category: existing,
      });
    }

    const category = await prisma.category.create({
      data: {
        name: data.name.trim(),
        icon: data.icon || "tag",
        type: data.type,
        userId: req.userId,
      },
    });

    res.status(201).json(category);
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    const { id } = req.params;

    const category = await prisma.category.findFirst({
      where: { id, userId: req.userId },
    });

    if (!category) {
      return res.status(404).json({ error: "Categoria não encontrada" });
    }

    // Verificar se há transações usando esta categoria
    const transactionCount = await prisma.transaction.count({
      where: { categoryId: id },
    });

    if (transactionCount > 0) {
      return res.status(400).json({
        error: "Não é possível excluir: categoria possui transações vinculadas",
        count: transactionCount,
      });
    }

    await prisma.category.delete({ where: { id } });

    res.json({ message: "Categoria removida" });
  } catch (error) {
    next(error);
  }
};

module.exports = { list, create, remove };