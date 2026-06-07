const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const summary = async (req, res, next) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const [
      receitas, despesas, investimentos,
      totalReceitas, totalDespesas, totalInvestimentos,
      despesasPorCategoria, categorias,
      proximasTransacoes, dividasAtivas, boletosPendentes,
    ] = await Promise.all([
      prisma.transaction.aggregate({ where: { userId: req.userId, type: "income", dueDate: { gte: startOfMonth, lte: endOfMonth } }, _sum: { amount: true } }),
      prisma.transaction.aggregate({ where: { userId: req.userId, type: "expense", dueDate: { gte: startOfMonth, lte: endOfMonth } }, _sum: { amount: true } }),
      prisma.transaction.aggregate({ where: { userId: req.userId, type: "investment", dueDate: { gte: startOfMonth, lte: endOfMonth } }, _sum: { amount: true } }),
      prisma.transaction.aggregate({ where: { userId: req.userId, type: "income" }, _sum: { amount: true } }),
      prisma.transaction.aggregate({ where: { userId: req.userId, type: "expense" }, _sum: { amount: true } }),
      prisma.transaction.aggregate({ where: { userId: req.userId, type: "investment" }, _sum: { amount: true } }),
      prisma.transaction.groupBy({ by: ["categoryId"], where: { userId: req.userId, type: "expense", dueDate: { gte: startOfMonth, lte: endOfMonth } }, _sum: { amount: true } }),
      prisma.category.findMany({ where: { userId: req.userId } }),
      prisma.transaction.findMany({ where: { userId: req.userId, paid: false, dueDate: { gte: now } }, orderBy: { dueDate: "asc" }, take: 5 }),
      prisma.debt.findMany({ where: { userId: req.userId, status: { in: ["active", "late"] } }, include: { installmentList: { where: { paid: false }, orderBy: { dueDate: "asc" }, take: 1 } } }),
      prisma.boleto.findMany({ where: { userId: req.userId, paid: false }, orderBy: { dueDate: "asc" }, take: 5 }),
    ]);

    const receitasMes = receitas._sum.amount || 0;
    const despesasMes = despesas._sum.amount || 0;
    const investimentosMes = investimentos._sum.amount || 0;

    // Incluir total de dívidas no cálculo
    const totalDebtRemaining = dividasAtivas.reduce((acc, d) => acc + (d.totalAmount - d.paidAmount), 0);

    const saldoCorrente = (totalReceitas._sum.amount || 0) - (totalDespesas._sum.amount || 0) - (totalInvestimentos._sum.amount || 0) - totalDebtRemaining;
    const patrimonioTotal = saldoCorrente + (totalInvestimentos._sum.amount || 0) + totalDebtRemaining;

    const categoriasComValor = despesasPorCategoria
      .map((item) => {
        const categoria = categorias.find((c) => c.id === item.categoryId);
        return { nome: categoria?.name || "Sem categoria", valor: item._sum.amount || 0 };
      })
      .filter((c) => c.valor > 0)
      .sort((a, b) => b.valor - a.valor);

    // Próximos vencimentos: transações + parcelas de dívidas + boletos
    const proximosVencimentos = [
      ...proximasTransacoes.map((t) => ({
        id: t.id,
        description: t.description,
        amount: t.amount,
        dueDate: t.dueDate,
        type: t.type,
      })),
      ...dividasAtivas.flatMap((d) =>
        (d.installmentList || []).map((inst) => ({
          id: inst.id,
          description: `${d.name} (${inst.number}ª/${d.installments})`,
          amount: inst.amount,
          dueDate: inst.dueDate,
          type: "expense",
        }))
      ),
      ...boletosPendentes.map((b) => ({
        id: b.id,
        description: b.description,
        amount: b.amount,
        dueDate: b.dueDate,
        type: "boleto",
      })),
    ]
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
      .slice(0, 8);

    res.json({
      saldoAtual: saldoCorrente,
      receitasMes,
      despesasMes,
      investimentosMes,
      patrimonioTotal,
      despesasPorCategoria: categoriasComValor,
      proximosVencimentos,
      totalDividas: totalDebtRemaining,
      dividasCount: dividasAtivas.length,
      boletosCount: boletosPendentes.length,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { summary };