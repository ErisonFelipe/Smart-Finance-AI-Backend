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
      parcelasPagasNoMes, parcelasPorCategoria,
    ] = await Promise.all([
      // Receitas do mês
     prisma.transaction.aggregate({
  where: { userId: req.userId, type: "income", paid: true, paymentDate: { gte: startOfMonth, lte: endOfMonth } },
  _sum: { amount: true },
}),
      // Despesas do mês (transações)
      prisma.transaction.aggregate({
  where: { userId: req.userId, type: "expense", paid: true, paymentDate: { gte: startOfMonth, lte: endOfMonth } },
  _sum: { amount: true },
}),
      // Investimentos do mês
      prisma.transaction.aggregate({
  where: { userId: req.userId, type: "investment", paid: true, paymentDate: { gte: startOfMonth, lte: endOfMonth } },
  _sum: { amount: true },
}),
      // Total histórico
      prisma.transaction.aggregate({ where: { userId: req.userId, type: "income" }, _sum: { amount: true } }),
      prisma.transaction.aggregate({ where: { userId: req.userId, type: "expense" }, _sum: { amount: true } }),
      prisma.transaction.aggregate({ where: { userId: req.userId, type: "investment" }, _sum: { amount: true } }),
      // Despesas por categoria (transações)
      prisma.transaction.groupBy({
        by: ["categoryId"],
        where: { userId: req.userId, type: "expense", dueDate: { gte: startOfMonth, lte: endOfMonth } },
        _sum: { amount: true },
      }),
      // Categorias
      prisma.category.findMany({ where: { userId: req.userId } }),
      // Próximos vencimentos (transações)
      prisma.transaction.findMany({
        where: { userId: req.userId, paid: false, dueDate: { gte: now } },
        orderBy: { dueDate: "asc" },
        take: 5,
      }),
      // Dívidas ativas com próximas parcelas
      prisma.debt.findMany({
        where: { userId: req.userId, status: { in: ["active", "late"] } },
        include: {
          category: true,
          installmentList: {
            where: { paid: false },
            orderBy: { dueDate: "asc" },
            take: 1,
          },
        },
      }),
      // Boletos pendentes
      prisma.boleto.findMany({
        where: { userId: req.userId, paid: false },
        orderBy: { dueDate: "asc" },
        take: 5,
      }),
      // Parcelas pagas no mês (para somar nas despesas)
      prisma.installment.aggregate({
        where: {
          debt: { userId: req.userId },
          paid: true,
          dueDate: { gte: startOfMonth, lte: endOfMonth },
        },
        _sum: { amount: true },
      }),
      // Parcelas pagas no mês agrupadas por dívida (para gráfico)
      prisma.installment.groupBy({
        by: ["debtId"],
        where: {
          debt: { userId: req.userId },
          paid: true,
          dueDate: { gte: startOfMonth, lte: endOfMonth },
        },
        _sum: { amount: true },
      }),
    ]);

    const receitasMes = receitas._sum.amount || 0;
    const despesasTransacoes = despesas._sum.amount || 0;
    const despesasParcelas = parcelasPagasNoMes._sum.amount || 0;
    const despesasMes = despesasTransacoes + despesasParcelas;
    const investimentosMes = investimentos._sum.amount || 0;

    // Total pendente de dívidas
    const totalDebtRemaining = dividasAtivas.reduce(
      (acc, d) => acc + (d.totalAmount - d.paidAmount),
      0
    );

    const saldoCorrente =
      (totalReceitas._sum.amount || 0) -
      (totalDespesas._sum.amount || 0) -
      (totalInvestimentos._sum.amount || 0);

    const patrimonioTotal = saldoCorrente + (totalInvestimentos._sum.amount || 0);

    // Despesas por categoria (transações)
    const categoriasComValor = despesasPorCategoria
      .map((item) => {
        const categoria = categorias.find((c) => c.id === item.categoryId);
        return { nome: categoria?.name || "Sem categoria", valor: item._sum.amount || 0 };
      })
      .filter((c) => c.valor > 0);

    // Adicionar parcelas de dívidas nas categorias
    if (parcelasPorCategoria.length > 0) {
      const debtIds = parcelasPorCategoria.map((p) => p.debtId);
      const debtsComCategoria = await prisma.debt.findMany({
        where: { id: { in: debtIds } },
        select: { id: true, category: true },
      });

      parcelasPorCategoria.forEach((p) => {
        const debt = debtsComCategoria.find((d) => d.id === p.debtId);
        if (debt && p._sum.amount) {
          const nome = debt.category?.name || "Dívidas";
          const existente = categoriasComValor.find((c) => c.nome === nome);
          if (existente) {
            existente.valor += p._sum.amount;
          } else {
            categoriasComValor.push({ nome, valor: p._sum.amount });
          }
        }
      });
    }

    // Ordenar por valor
    categoriasComValor.sort((a, b) => b.valor - a.valor);

    // Próximos vencimentos unificados
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
          description: `${d.name} (${inst.number}ª parcela)`,
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