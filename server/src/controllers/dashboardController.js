const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const summary = async (req, res, next) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Paralelizar todas as queries
    const [
      receitas,
      despesas,
      investimentos,
      totalReceitas,
      totalDespesas,
      totalInvestimentos,
      despesasPorCategoria,
      categorias,
      proximosVencimentos,
    ] = await Promise.all([
      // Receitas do mês
      prisma.transaction.aggregate({
        where: { userId: req.userId, type: "income", dueDate: { gte: startOfMonth, lte: endOfMonth } },
        _sum: { amount: true },
      }),
      // Despesas do mês
      prisma.transaction.aggregate({
        where: { userId: req.userId, type: "expense", dueDate: { gte: startOfMonth, lte: endOfMonth } },
        _sum: { amount: true },
      }),
      // Investimentos do mês
      prisma.transaction.aggregate({
        where: { userId: req.userId, type: "investment", dueDate: { gte: startOfMonth, lte: endOfMonth } },
        _sum: { amount: true },
      }),
      // Total histórico receitas
      prisma.transaction.aggregate({
        where: { userId: req.userId, type: "income" },
        _sum: { amount: true },
      }),
      // Total histórico despesas
      prisma.transaction.aggregate({
        where: { userId: req.userId, type: "expense" },
        _sum: { amount: true },
      }),
      // Total histórico investimentos
      prisma.transaction.aggregate({
        where: { userId: req.userId, type: "investment" },
        _sum: { amount: true },
      }),
      // Despesas por categoria no mês
      prisma.transaction.groupBy({
        by: ["categoryId"],
        where: { userId: req.userId, type: "expense", dueDate: { gte: startOfMonth, lte: endOfMonth } },
        _sum: { amount: true },
      }),
      // Categorias do usuário
      prisma.category.findMany({ where: { userId: req.userId } }),
      // Próximos vencimentos (inclui boletos)
      prisma.transaction.findMany({
        where: { userId: req.userId, paid: false, dueDate: { gte: now } },
        orderBy: { dueDate: "asc" },
        take: 10,
      }),
    ]);

    const receitasMes = receitas._sum.amount || 0;
    const despesasMes = despesas._sum.amount || 0;
    const investimentosMes = investimentos._sum.amount || 0;

    const saldoCorrente =
      (totalReceitas._sum.amount || 0) -
      (totalDespesas._sum.amount || 0) -
      (totalInvestimentos._sum.amount || 0);

    const patrimonioTotal = saldoCorrente + (totalInvestimentos._sum.amount || 0);

    // Mapear categorias com valores
    const categoriasComValor = despesasPorCategoria
      .map((item) => {
        const categoria = categorias.find((c) => c.id === item.categoryId);
        return {
          nome: categoria?.name || "Sem categoria",
          valor: item._sum.amount || 0,
        };
      })
      .filter((c) => c.valor > 0)
      .sort((a, b) => b.valor - a.valor);

    res.json({
      saldoAtual: saldoCorrente,
      receitasMes,
      despesasMes,
      investimentosMes,
      patrimonioTotal,
      despesasPorCategoria: categoriasComValor,
      proximosVencimentos,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { summary };