const { PrismaClient } = require("@prisma/client");
const { categorySchema } = require("../validators/schemas");
const prisma = new PrismaClient();

const list = async (req, res, next) => {
  try {
    const categories = await prisma.category.findMany({ where: { userId: req.userId }, orderBy: { name: "asc" } });
    res.json(categories);
  } catch (error) { next(error); }
};

const create = async (req, res, next) => {
  try {
    const data = categorySchema.parse(req.body);
    const category = await prisma.category.create({ data: { ...data, userId: req.userId } });
    res.status(201).json(category);
  } catch (error) { next(error); }
};

module.exports = { list, create };