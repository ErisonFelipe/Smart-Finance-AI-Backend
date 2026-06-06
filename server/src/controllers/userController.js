const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const getProfile = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        name: true,
        email: true,
        monthlyIncome: true,
        payDay: true,
        photoUrl: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    res.json(user);
  } catch (error) {
    next(error);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const { name, monthlyIncome, payDay } = req.body;
    const photoUrl = req.file ? `/uploads/${req.file.filename}` : undefined;

    const data = {};
    if (name !== undefined) data.name = name.trim();
    if (monthlyIncome !== undefined) data.monthlyIncome = Number(monthlyIncome);
    if (payDay !== undefined) {
      const day = Number(payDay);
      if (day >= 1 && day <= 31) data.payDay = day;
    }
    if (photoUrl) data.photoUrl = photoUrl;

    const user = await prisma.user.update({
      where: { id: req.userId },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        monthlyIncome: true,
        payDay: true,
        photoUrl: true,
      },
    });

    res.json(user);
  } catch (error) {
    next(error);
  }
};

module.exports = { getProfile, updateProfile };