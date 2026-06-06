const { z } = require("zod");

const registerSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("Email inválido"),
  password: z
    .string()
    .min(8, "Senha deve ter pelo menos 8 caracteres")
    .regex(/[A-Z]/, "Senha deve conter pelo menos 1 letra maiúscula")
    .regex(/[0-9]/, "Senha deve conter pelo menos 1 número"),
  monthlyIncome: z.number().min(0, "Renda não pode ser negativa").optional(),
  payDay: z.number().int().min(1).max(31).optional(),
});

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Senha é obrigatória"),
});

const transactionSchema = z.object({
  categoryId: z.string().uuid("Categoria inválida"),
  type: z.enum(["income", "expense", "investment"]),
  amount: z.number().positive("Valor deve ser positivo"),
  description: z.string().min(1, "Descrição é obrigatória").max(200, "Máximo 200 caracteres"),
  dueDate: z.string().or(z.date()),
  recurrence: z.enum(["none", "fixed", "installment"]).optional().default("none"),
  installments: z.number().int().min(1).max(120, "Máximo 120 parcelas").optional().default(1),
  paid: z.boolean().optional().default(false),
});

const debtSchema = z.object({
  categoryId: z.string().uuid("Categoria inválida"),
  name: z.string().min(1, "Nome é obrigatório").max(100, "Máximo 100 caracteres"),
  totalAmount: z.number().positive("Valor deve ser positivo"),
  startDate: z.string().or(z.date()),
  installments: z.number().int().min(1, "Mínimo 1 parcela").max(120, "Máximo 120 parcelas"),
});

const boletoSchema = z.object({
  barcode: z.string().max(100).optional().nullable(),
  amount: z.number().positive("Valor deve ser positivo"),
  dueDate: z.string().or(z.date()),
  description: z.string().min(1, "Descrição é obrigatória").max(200, "Máximo 200 caracteres"),
});

const categorySchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(50, "Máximo 50 caracteres"),
  icon: z.string().max(50).optional().default("tag"),
  type: z.enum(["income", "expense", "investment"]),
});

module.exports = {
  registerSchema,
  loginSchema,
  transactionSchema,
  debtSchema,
  boletoSchema,
  categorySchema,
};