const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const summary = async (req, res, next) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const [receitas, despesas, investimentos] = await Promise.all([
      prisma.transaction.aggregate({
        where: { userId: req.userId, type: "income", dueDate: { gte: startOfMonth, lte: endOfMonth } },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { userId: req.userId, type: "expense", dueDate: { gte: startOfMonth, lte: endOfMonth } },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { userId: req.userId, type: "investment", dueDate: { gte: startOfMonth, lte: endOfMonth } },
        _sum: { amount: true },
      }),
    ]);

    const [totalReceitas, totalDespesas, totalInvestimentos] = await Promise.all([
      prisma.transaction.aggregate({
        where: { userId: req.userId, type: "income" },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { userId: req.userId, type: "expense" },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { userId: req.userId, type: "investment" },
        _sum: { amount: true },
      }),
    ]);

    const receitasMes = receitas._sum.amount || 0;
    const despesasMes = despesas._sum.amount || 0;
    const investimentosMes = investimentos._sum.amount || 0;

    const saldoCorrente = (totalReceitas._sum.amount || 0) - (totalDespesas._sum.amount || 0) - (totalInvestimentos._sum.amount || 0);
    const patrimonioTotal = saldoCorrente + (totalInvestimentos._sum.amount || 0);

    // Despesas por categoria
    const despesasPorCategoria = await prisma.transaction.groupBy({
      by: ["categoryId"],
      where: { userId: req.userId, type: "expense", dueDate: { gte: startOfMonth, lte: endOfMonth } },
      _sum: { amount: true },
    });

    const categorias = await prisma.category.findMany({ where: { userId: req.userId } });
    const categoriasComValor = despesasPorCategoria.map((item) => {
      const categoria = categorias.find((c) => c.id === item.categoryId);
      return { nome: categoria?.name || "Sem categoria", valor: item._sum.amount || 0 };
    });

    // Próximos vencimentos
    const proximosVencimentos = await prisma.transaction.findMany({
      where: { userId: req.userId, paid: false, dueDate: { gte: now } },
      orderBy: { dueDate: "asc" },
      take: 5,
    });

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