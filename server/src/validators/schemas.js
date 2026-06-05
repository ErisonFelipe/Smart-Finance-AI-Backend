const { z } = require("zod");

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  monthlyIncome: z.number().min(0).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const transactionSchema = z.object({
  categoryId: z.string(),
  type: z.enum(["income", "expense", "investment"]),
  amount: z.number().positive(),
  description: z.string().min(1),
  dueDate: z.string().or(z.date()),
  recurrence: z.enum(["none", "fixed", "installment"]).optional(),
  installments: z.number().int().min(1).optional(),
  paid: z.boolean().optional(),
});

const debtSchema = z.object({
  categoryId: z.string(),
  name: z.string().min(1),
  totalAmount: z.number().positive(),
  startDate: z.string().or(z.date()),
  installments: z.number().int().min(1),
});

const boletoSchema = z.object({
  barcode: z.string().optional(),
  amount: z.number().positive(),
  dueDate: z.string().or(z.date()),
  description: z.string().min(1),
});

const categorySchema = z.object({
  name: z.string().min(1),
  icon: z.string().optional(),
  type: z.enum(["income", "expense", "investment"]),
});

module.exports = { registerSchema, loginSchema, transactionSchema, debtSchema, boletoSchema, categorySchema };