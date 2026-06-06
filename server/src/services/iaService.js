const { GoogleGenerativeAI } = require("@google/generative-ai");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function getGeminiModel() {
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY.includes("sua-chave")) {
    return null;
  }
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
}

async function getFinancialContext(userId) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const [
    receitas, despesas, investimentos,
    totalReceitas, totalDespesas, totalInvestimentos,
    transacoesRecentes, todasTransacoesMes,
    dividasAtivas, boletosPendentes, categorias,
  ] = await Promise.all([
    prisma.transaction.aggregate({ where: { userId, type: "income", dueDate: { gte: startOfMonth, lte: endOfMonth } }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { userId, type: "expense", dueDate: { gte: startOfMonth, lte: endOfMonth } }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { userId, type: "investment", dueDate: { gte: startOfMonth, lte: endOfMonth } }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { userId, type: "income" }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { userId, type: "expense" }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { userId, type: "investment" }, _sum: { amount: true } }),
    prisma.transaction.findMany({ where: { userId }, include: { category: true }, orderBy: { dueDate: "desc" }, take: 10 }),
    prisma.transaction.findMany({ where: { userId, dueDate: { gte: startOfMonth, lte: endOfMonth } }, include: { category: true }, orderBy: { dueDate: "desc" } }),
    prisma.debt.findMany({ where: { userId, status: { in: ["active", "late"] } }, include: { category: true, installmentList: { orderBy: { number: "asc" } } } }),
    prisma.boleto.findMany({ where: { userId, paid: false }, orderBy: { dueDate: "asc" } }),
    prisma.category.findMany({ where: { userId } }),
  ]);

  const receitasMes = receitas._sum.amount || 0;
  const despesasMes = despesas._sum.amount || 0;
  const investimentosMes = investimentos._sum.amount || 0;
  const saldoMes = receitasMes - despesasMes - investimentosMes;
  const saldoGeral = (totalReceitas._sum.amount || 0) - (totalDespesas._sum.amount || 0) - (totalInvestimentos._sum.amount || 0);

  const gastosPorCategoria = {};
  todasTransacoesMes
    .filter((t) => t.type === "expense")
    .forEach((t) => {
      const nome = t.category?.name || "Outros";
      gastosPorCategoria[nome] = (gastosPorCategoria[nome] || 0) + t.amount;
    });

  return {
    mesAtual: now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
    receitasMes, despesasMes, investimentosMes, saldoMes, saldoGeral, gastosPorCategoria,
    transacoesRecentes: transacoesRecentes.map((t) => ({
      descricao: t.description, valor: t.amount, tipo: t.type,
      categoria: t.category?.name || "Sem categoria",
      data: t.dueDate.toLocaleDateString("pt-BR"), pago: t.paid,
    })),
    dividasAtivas: dividasAtivas.map((d) => {
      const paidInstallments = d.installmentList?.filter((i) => i.paid).length || 0;
      return {
        nome: d.name, valorTotal: d.totalAmount,
        valorRestante: d.totalAmount - d.paidAmount,
        parcelas: `${paidInstallments}/${d.installments}`,
        status: d.status === "late" ? "Atrasada" : "Em dia",
      };
    }),
    boletosPendentes: boletosPendentes.map((b) => ({
      descricao: b.description, valor: b.amount,
      vencimento: b.dueDate.toLocaleDateString("pt-BR"),
    })),
  };
}

function buildSystemPrompt(context) {
  const categoriasStr = Object.entries(context.gastosPorCategoria || {})
    .map(([nome, valor]) => `  • ${nome}: R$ ${valor.toFixed(2)}`).join("\n");
  const transacoesStr = context.transacoesRecentes
    .map((t) => `  • ${t.data} - ${t.descricao}: R$ ${t.valor.toFixed(2)} (${t.tipo === "income" ? "Receita" : t.tipo === "expense" ? "Despesa" : "Investimento"}, ${t.categoria}, ${t.pago ? "Pago" : "Pendente"})`).join("\n");
  const dividasStr = context.dividasAtivas.length > 0
    ? context.dividasAtivas.map((d) => `  • ${d.nome}: Restante R$ ${d.valorRestante.toFixed(2)} (${d.parcelas} parcelas, ${d.status})`).join("\n")
    : "  Nenhuma dívida ativa";
  const boletosStr = context.boletosPendentes.length > 0
    ? context.boletosPendentes.map((b) => `  • ${b.descricao}: R$ ${b.valor.toFixed(2)} (Vence ${b.vencimento})`).join("\n")
    : "  Nenhum boleto pendente";

  return `Você é a FinIA, uma assistente financeira pessoal inteligente e amigável.

📊 DADOS FINANCEIROS REAIS DO USUÁRIO:
Mês atual: ${context.mesAtual}
Receitas do mês: R$ ${context.receitasMes.toFixed(2)}
Despesas do mês: R$ ${context.despesasMes.toFixed(2)}
Investimentos do mês: R$ ${context.investimentosMes.toFixed(2)}
Saldo do mês: R$ ${context.saldoMes.toFixed(2)}
Saldo geral acumulado: R$ ${context.saldoGeral.toFixed(2)}

📂 GASTOS POR CATEGORIA (este mês):
${categoriasStr || "  Nenhum gasto registrado"}

📋 ÚLTIMAS TRANSAÇÕES:
${transacoesStr || "  Nenhuma transação"}

💰 DÍVIDAS ATIVAS:
${dividasStr}

📄 BOLETOS PENDENTES:
${boletosStr}

REGRAS DE RESPOSTA:
1. Responda SEMPRE em português do Brasil
2. Use APENAS os dados fornecidos acima — NÃO invente valores
3. Use emojis e bullets para organizar a informação
4. Seja direta e útil, máximo 250 palavras
5. Se perguntarem algo que não está nos dados, diga "Não tenho essa informação no momento"
6. Ao dar dicas, baseie-se nos gastos reais do usuário
7. Mostre preocupação genuína com a saúde financeira do usuário
8. Se detectar gastos excessivos em alguma categoria, alerte com educação`;
}

async function chatWithIA(userId, userMessage, conversationHistory = []) {
  let context = null;
  try {
    context = await getFinancialContext(userId);
  } catch (err) {
    console.error("Erro ao buscar contexto:", err);
    return { reply: "❌ Erro ao acessar seus dados financeiros. Tente novamente.", fallback: true };
  }

  const model = getGeminiModel();
  if (!model) {
    console.log("⚠️ Gemini não configurado, usando fallback local");
    return {
      reply: getFallbackResponse(userMessage, context),
      context: { receitasMes: context.receitasMes, despesasMes: context.despesasMes, saldoMes: context.saldoMes },
      fallback: true,
    };
  }

  try {
    const systemPrompt = buildSystemPrompt(context);
    const history = conversationHistory.map((msg) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }],
    }));

    const chat = model.startChat({
      history: [
        { role: "user", parts: [{ text: "Quem é você e quais dados você tem sobre mim?" }] },
        { role: "model", parts: [{ text: systemPrompt }] },
        ...history,
      ],
      generationConfig: { maxOutputTokens: 500, temperature: 0.7, topP: 0.8 },
    });

    const result = await chat.sendMessage(userMessage);
    return {
      reply: result.response.text(),
      context: { receitasMes: context.receitasMes, despesasMes: context.despesasMes, saldoMes: context.saldoMes, saldoGeral: context.saldoGeral },
      fallback: false,
    };
  } catch (error) {
    console.error("Erro no Gemini:", error.message);
    return {
      reply: getFallbackResponse(userMessage, context),
      context: { receitasMes: context.receitasMes, despesasMes: context.despesasMes, saldoMes: context.saldoMes },
      fallback: true,
    };
  }
}

// ... funções getFallbackResponse e categorizeTransaction mantidas ...

module.exports = { chatWithIA };