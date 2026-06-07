const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const projection = async (req, res, next) => {
  try {
    const months = [];
    const now = new Date();

    // Calcular média dos últimos 3 meses
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    const [avgReceitas, avgDespesas, avgInvestimentos] = await Promise.all([
      prisma.transaction.aggregate({
        where: { userId: req.userId, type: "income", dueDate: { gte: threeMonthsAgo } },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { userId: req.userId, type: "expense", dueDate: { gte: threeMonthsAgo } },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { userId: req.userId, type: "investment", dueDate: { gte: threeMonthsAgo } },
        _sum: { amount: true },
      }),
    ]);

    const mediaReceitas = (avgReceitas._sum.amount || 0) / 3;
    const mediaDespesas = (avgDespesas._sum.amount || 0) / 3;
    const mediaInvestimentos = (avgInvestimentos._sum.amount || 0) / 3;

    // Saldo atual
    const [totalReceitas, totalDespesas, totalInvestimentos] = await Promise.all([
      prisma.transaction.aggregate({ where: { userId: req.userId, type: "income" }, _sum: { amount: true } }),
      prisma.transaction.aggregate({ where: { userId: req.userId, type: "expense" }, _sum: { amount: true } }),
      prisma.transaction.aggregate({ where: { userId: req.userId, type: "investment" }, _sum: { amount: true } }),
    ]);

    const saldoAtual = (totalReceitas._sum.amount || 0) - (totalDespesas._sum.amount || 0) - (totalInvestimentos._sum.amount || 0);

    // Dívidas futuras (parcelas não pagas)
    const parcelasFuturas = await prisma.installment.findMany({
      where: {
        debt: { userId: req.userId },
        paid: false,
      },
      include: { debt: true },
      orderBy: { dueDate: "asc" },
    });

    // Projetar 6 meses
    let saldoProjetado = saldoAtual;

    for (let i = 0; i < 6; i++) {
      const mesDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const mesNome = mesDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
      const startOfMonth = new Date(mesDate.getFullYear(), mesDate.getMonth(), 1);
      const endOfMonth = new Date(mesDate.getFullYear(), mesDate.getMonth() + 1, 0);

      // Parcelas que vencem neste mês
      const parcelasDoMes = parcelasFuturas.filter((p) => {
        const due = new Date(p.dueDate);
        return due >= startOfMonth && due <= endOfMonth;
      });

      const totalParcelasMes = parcelasDoMes.reduce((acc, p) => acc + p.amount, 0);

      // Despesas do mês = média + parcelas
      const despesasProjetadas = mediaDespesas + totalParcelasMes;

      // Saldo do mês
      const saldoMes = mediaReceitas - despesasProjetadas - mediaInvestimentos;
      saldoProjetado += saldoMes;

      months.push({
        mes: mesNome,
        receitas: Math.round(mediaReceitas * 100) / 100,
        despesas: Math.round(despesasProjetadas * 100) / 100,
        investimentos: Math.round(mediaInvestimentos * 100) / 100,
        parcelas: Math.round(totalParcelasMes * 100) / 100,
        saldoMes: Math.round(saldoMes * 100) / 100,
        saldoProjetado: Math.round(saldoProjetado * 100) / 100,
      });
    }

    res.json({
      mediaReceitas: Math.round(mediaReceitas * 100) / 100,
      mediaDespesas: Math.round(mediaDespesas * 100) / 100,
      mediaInvestimentos: Math.round(mediaInvestimentos * 100) / 100,
      saldoAtual: Math.round(saldoAtual * 100) / 100,
      meses: months,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { projection };