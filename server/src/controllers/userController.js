const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const updateProfile = async (req, res, next) => {
  try {
    const { name, monthlyIncome } = req.body;
    const photoUrl = req.file ? `/uploads/${req.file.filename}` : undefined;

    const data = {};
    if (name) data.name = name;
    if (monthlyIncome !== undefined) data.monthlyIncome = Number(monthlyIncome);
    if (photoUrl) data.photoUrl = photoUrl;

    const user = await prisma.user.update({
      where: { id: req.userId },
      data,
      select: { id: true, name: true, email: true, monthlyIncome: true, photoUrl: true },
    });

    res.json(user);
  } catch (error) {
    next(error);
  }
};

const getProfile = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, name: true, email: true, monthlyIncome: true, photoUrl: true },
    });

    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });

    res.json(user);
  } catch (error) {
    next(error);
  }
};

module.exports = { updateProfile, getProfile };