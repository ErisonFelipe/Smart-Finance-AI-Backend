const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const { generateToken } = require("../utils/jwt");
const { registerSchema, loginSchema } = require("../validators/schemas");

const prisma = new PrismaClient();

const register = async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);
    const existingUser = await prisma.user.findUnique({ where: { email: data.email } });
    if (existingUser) return res.status(409).json({ error: "Email já cadastrado" });

    const hashedPassword = await bcrypt.hash(data.password, 10);
    const user = await prisma.user.create({
      data: { name: data.name, email: data.email, password: hashedPassword, monthlyIncome: data.monthlyIncome || 0 },
      select: { id: true, name: true, email: true, monthlyIncome: true },
    });
    const token = generateToken(user.id);
    res.status(201).json({ user, token });
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user) return res.status(401).json({ error: "Credenciais inválidas" });

    const validPassword = await bcrypt.compare(data.password, user.password);
    if (!validPassword) return res.status(401).json({ error: "Credenciais inválidas" });

    const token = generateToken(user.id);
    res.json({ user: { id: user.id, name: user.name, email: user.email, monthlyIncome: user.monthlyIncome }, token });
  } catch (error) {
    next(error);
  }
};

const checkEmail = async (req, res, next) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: "Email é obrigatório" });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    
    res.json({ exists: !!user });
  } catch (error) {
    next(error);
  }
};

module.exports = { register, login, checkEmail };