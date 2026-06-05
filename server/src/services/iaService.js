const { GoogleGenerativeAI } = require("@google/generative-ai");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

// Inicializa o Gemini com a chave
function getGeminiModel() {
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY.includes("sua-chave")) {
    return null;
  }
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
}

// Buscar TODO o contexto financeiro do usuário
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
    // Receitas do mês
    prisma.transaction.aggregate({
      where: { userId, type: "income", dueDate: { gte: startOfMonth, lte: endOfMonth } },
      _sum: { amount: true },
    }),
    // Despesas do mês
    prisma.transaction.aggregate({
      where: { userId, type: "expense", dueDate: { gte: startOfMonth, lte: endOfMonth } },
      _sum: { amount: true },
    }),
    // Investimentos do mês
    prisma.transaction.aggregate({
      where: { userId, type: "investment", dueDate: { gte: startOfMonth, lte: endOfMonth } },
      _sum: { amount: true },
    }),
    // Total histórico receitas
    prisma.transaction.aggregate({
      where: { userId, type: "income" },
      _sum: { amount: true },
    }),
    // Total histórico despesas
    prisma.transaction.aggregate({
      where: { userId, type: "expense" },
      _sum: { amount: true },
    }),
    // Total histórico investimentos
    prisma.transaction.aggregate({
      where: { userId, type: "investment" },
      _sum: { amount: true },
    }),
    // Últimas 10 transações
    prisma.transaction.findMany({
      where: { userId },
      include: { category: true },
      orderBy: { dueDate: "desc" },
      take: 10,
    }),
    // Todas as transações do mês (para análise)
    prisma.transaction.findMany({
      where: { userId, dueDate: { gte: startOfMonth, lte: endOfMonth } },
      include: { category: true },
      orderBy: { dueDate: "desc" },
    }),
    // Dívidas ativas
    prisma.debt.findMany({
      where: { userId, status: { in: ["active", "late"] } },
      include: { category: true, installmentList: { orderBy: { number: "asc" } } },
    }),
    // Boletos pendentes
    prisma.boleto.findMany({
      where: { userId, paid: false },
      orderBy: { dueDate: "asc" },
    }),
    // Categorias
    prisma.category.findMany({ where: { userId } }),
  ]);

  const receitasMes = receitas._sum.amount || 0;
  const despesasMes = despesas._sum.amount || 0;
  const investimentosMes = investimentos._sum.amount || 0;
  const saldoMes = receitasMes - despesasMes - investimentosMes;
  const saldoGeral = (totalReceitas._sum.amount || 0) - (totalDespesas._sum.amount || 0) - (totalInvestimentos._sum.amount || 0);

  // Agrupar despesas por categoria no mês
  const gastosPorCategoria = {};
  todasTransacoesMes
    .filter((t) => t.type === "expense")
    .forEach((t) => {
      const nome = t.category?.name || "Outros";
      gastosPorCategoria[nome] = (gastosPorCategoria[nome] || 0) + t.amount;
    });

  return {
    mesAtual: now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
    receitasMes,
    despesasMes,
    investimentosMes,
    saldoMes,
    saldoGeral,
    gastosPorCategoria,
    transacoesRecentes: transacoesRecentes.map((t) => ({
      descricao: t.description,
      valor: t.amount,
      tipo: t.type,
      categoria: t.category?.name || "Sem categoria",
      data: t.dueDate.toLocaleDateString("pt-BR"),
      pago: t.paid,
    })),
    dividasAtivas: dividasAtivas.map((d) => {
      const paidInstallments = d.installmentList?.filter((i) => i.paid).length || 0;
      return {
        nome: d.name,
        valorTotal: d.totalAmount,
        valorRestante: d.totalAmount - d.paidAmount,
        parcelas: `${paidInstallments}/${d.installments}`,
        status: d.status === "late" ? "Atrasada" : "Em dia",
      };
    }),
    boletosPendentes: boletosPendentes.map((b) => ({
      descricao: b.description,
      valor: b.amount,
      vencimento: b.dueDate.toLocaleDateString("pt-BR"),
    })),
  };
}

// Construir prompt com dados reais
function buildSystemPrompt(context) {
  const categoriasStr = Object.entries(context.gastosPorCategoria || {})
    .map(([nome, valor]) => `  • ${nome}: R$ ${valor.toFixed(2)}`)
    .join("\n");

  const transacoesStr = context.transacoesRecentes
    .map((t) => `  • ${t.data} - ${t.descricao}: R$ ${t.valor.toFixed(2)} (${t.tipo === "income" ? "Receita" : t.tipo === "expense" ? "Despesa" : "Investimento"}, ${t.categoria}, ${t.pago ? "Pago" : "Pendente"})`)
    .join("\n");

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

// Função principal do chat
async function chatWithIA(userId, userMessage, conversationHistory = []) {
  let context = null;

  try {
    context = await getFinancialContext(userId);
  } catch (err) {
    console.error("Erro ao buscar contexto:", err);
    return {
      reply: "❌ Erro ao acessar seus dados financeiros. Tente novamente.",
      fallback: true,
    };
  }

  const model = getGeminiModel();

  // Se não tem API Key configurada
  if (!model) {
    console.log("⚠️ Gemini não configurado, usando fallback local");
    return {
      reply: getFallbackResponse(userMessage, context),
      context: {
        receitasMes: context.receitasMes,
        despesasMes: context.despesasMes,
        saldoMes: context.saldoMes,
      },
      fallback: true,
    };
  }

  try {
    const systemPrompt = buildSystemPrompt(context);

    // Construir histórico para o Gemini
    const history = conversationHistory.map((msg) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }],
    }));

    const chat = model.startChat({
      history: [
        {
          role: "user",
          parts: [{ text: "Quem é você e quais dados você tem sobre mim?" }],
        },
        {
          role: "model",
          parts: [{ text: systemPrompt }],
        },
        ...history,
      ],
      generationConfig: {
        maxOutputTokens: 500,
        temperature: 0.7,
        topP: 0.8,
      },
    });

    const result = await chat.sendMessage(userMessage);
    const reply = result.response.text();

    return {
      reply,
      context: {
        receitasMes: context.receitasMes,
        despesasMes: context.despesasMes,
        saldoMes: context.saldoMes,
        saldoGeral: context.saldoGeral,
      },
      fallback: false,
    };
  } catch (error) {
    console.error("Erro no Gemini:", error.message);
    return {
      reply: getFallbackResponse(userMessage, context),
      context: {
        receitasMes: context.receitasMes,
        despesasMes: context.despesasMes,
        saldoMes: context.saldoMes,
      },
      fallback: true,
    };
  }
}

// Fallback local inteligente (quando Gemini não está disponível)
function getFallbackResponse(message, context) {
  const msg = message.toLowerCase();

  if (msg.includes("saldo") || msg.includes("quanto tenho") || msg.includes("disponível")) {
    return `💰 **Seu Saldo Financeiro**\n\n📥 Receitas do mês: R$ ${context.receitasMes.toFixed(2)}\n📤 Despesas do mês: R$ ${context.despesasMes.toFixed(2)}\n📈 Investimentos: R$ ${context.investimentosMes.toFixed(2)}\n\n💵 **Saldo do mês: R$ ${context.saldoMes.toFixed(2)}**\n🏦 Saldo geral: R$ ${context.saldoGeral.toFixed(2)}`;
  }

  if (msg.includes("gasto") || msg.includes("gastei") || msg.includes("despesa") || msg.includes("categoria")) {
    const categorias = Object.entries(context.gastosPorCategoria || {})
      .sort((a, b) => b[1] - a[1])
      .map(([nome, valor]) => `• ${nome}: R$ ${valor.toFixed(2)}`)
      .join("\n");
    return `📊 **Gastos por Categoria (${context.mesAtual})**\n\n${categorias || "Nenhum gasto registrado"}\n\n💡 Total: R$ ${context.despesasMes.toFixed(2)}`;
  }

  if (msg.includes("dívida") || msg.includes("divida") || msg.includes("devo")) {
    if (context.dividasAtivas.length > 0) {
      const dividas = context.dividasAtivas
        .map((d) => `• ${d.nome}: R$ ${d.valorRestante.toFixed(2)} restantes (${d.parcelas} parcelas) - ${d.status}`)
        .join("\n");
      return `📋 **Dívidas Ativas**\n\n${dividas}\n\n⚠️ Total pendente: R$ ${context.dividasAtivas.reduce((acc, d) => acc + d.valorRestante, 0).toFixed(2)}`;
    }
    return "🎉 Você não tem dívidas ativas!";
  }

  if (msg.includes("boleto") || msg.includes("pagar") || msg.includes("vencimento")) {
    if (context.boletosPendentes.length > 0) {
      const boletos = context.boletosPendentes
        .map((b) => `• ${b.descricao}: R$ ${b.valor.toFixed(2)} (Vence: ${b.vencimento})`)
        .join("\n");
      return `📄 **Boletos Pendentes**\n\n${boletos}\n\n📌 Total: R$ ${context.boletosPendentes.reduce((acc, b) => acc + b.valor, 0).toFixed(2)}`;
    }
    return "✅ Não há boletos pendentes!";
  }

  if (msg.includes("dica") || msg.includes("economizar") || msg.includes("economia") || msg.includes("melhorar")) {
    const porcentagem = context.receitasMes > 0 ? ((context.despesasMes / context.receitasMes) * 100).toFixed(1) : 0;
    const maiorCategoria = Object.entries(context.gastosPorCategoria || {}).sort((a, b) => b[1] - a[1])[0];
    
    let dicas = `💡 **Análise e Dicas Personalizadas**\n\n`;
    dicas += `📊 Você gasta ${porcentagem}% da sua renda mensal.\n\n`;
    
    if (porcentagem > 70) {
      dicas += `⚠️ Alerta: seus gastos estão acima de 70% da renda. Tente reduzir despesas não essenciais.\n\n`;
    } else {
      dicas += `✅ Seus gastos estão sob controle!\n\n`;
    }
    
    if (maiorCategoria) {
      dicas += `🔍 Sua maior despesa é "${maiorCategoria[0]}": R$ ${maiorCategoria[1].toFixed(2)}\n`;
      dicas += `💡 Avalie se há como reduzir esse gasto.\n\n`;
    }
    
    dicas += `📌 Recomendações:\n`;
    dicas += `• Reserve 10% da renda para investimentos\n`;
    dicas += `• Mantenha reserva de emergência (3-6 meses de despesas)\n`;
    dicas += `• Categorize todos os gastos para identificar excessos`;
    
    return dicas;
  }

  if (msg.includes("investimento") || msg.includes("investi")) {
    return `📈 **Investimentos (${context.mesAtual})**\n\n💰 Aportes do mês: R$ ${context.investimentosMes.toFixed(2)}\n💡 Lembre-se: investir é construir patrimônio de longo prazo!`;
  }

  if (msg.includes("comprar") || msg.includes("celular") || msg.includes("meta") || msg.includes("planej") || msg.includes("organizar") || msg.includes("junta")) {
  const saldoDisponivel = context.saldoMes || 0;
  const sobraPorMes = context.receitasMes - context.despesasMes - context.investimentosMes;
  
  let resposta = `🎯 **Planejamento de Compra**\n\n`;
  resposta += `📊 Sua situação atual:\n`;
  resposta += `• Receitas: R$ ${context.receitasMes.toFixed(2)}\n`;
  resposta += `• Despesas: R$ ${context.despesasMes.toFixed(2)}\n`;
  resposta += `• Investimentos: R$ ${context.investimentosMes.toFixed(2)}\n`;
  resposta += `• Sobra mensal: R$ ${sobraPorMes.toFixed(2)}\n`;
  resposta += `• Saldo acumulado: R$ ${context.saldoGeral.toFixed(2)}\n\n`;
  
  // Pegar o maior gasto
  const categorias = Object.entries(context.gastosPorCategoria || {}).sort((a, b) => b[1] - a[1]);
  if (categorias.length > 0) {
    resposta += `🔍 Seus maiores gastos:\n`;
    categorias.slice(0, 3).forEach(([nome, valor]) => {
      resposta += `• ${nome}: R$ ${valor.toFixed(2)}\n`;
    });
    resposta += `\n`;
  }
  
  resposta += `💡 **Sugestão de planejamento:**\n`;
  resposta += `• Reserve a sobra mensal (R$ ${sobraPorMes.toFixed(2)}) para sua meta\n`;
  resposta += `• Reduza gastos não essenciais (como ${categorias[0]?.[0] || "lazer"})\n`;
  resposta += `• Crie uma categoria "Celular" como meta de investimento\n`;
  resposta += `• Acompanhe seu progresso no Dashboard\n\n`;
  resposta += `📱 Com planejamento, você consegue!`;
  
  return resposta;
}

// Resumo geral / overview
if (msg.includes("resumo") || msg.includes("geral") || msg.includes("tudo") || msg.includes("visão") || msg.includes("como estou")) {
  const categoriasStr = Object.entries(context.gastosPorCategoria || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([nome, valor]) => `• ${nome}: R$ ${valor.toFixed(2)}`)
    .join("\n");

  return `📊 **Resumo Financeiro Completo (${context.mesAtual})**\n\n` +
    `📥 Receitas: R$ ${context.receitasMes.toFixed(2)}\n` +
    `📤 Despesas: R$ ${context.despesasMes.toFixed(2)}\n` +
    `📈 Investimentos: R$ ${context.investimentosMes.toFixed(2)}\n` +
    `💵 Saldo mês: R$ ${context.saldoMes.toFixed(2)}\n` +
    `🏦 Saldo geral: R$ ${context.saldoGeral.toFixed(2)}\n\n` +
    `🔍 Top 5 gastos:\n${categoriasStr || "Nenhum gasto"}\n\n` +
    (context.dividasAtivas.length > 0 ? `📋 ${context.dividasAtivas.length} dívida(s) ativa(s)\n` : "") +
    (context.boletosPendentes.length > 0 ? `📄 ${context.boletosPendentes.length} boleto(s) pendente(s)` : "✅ Sem boletos pendentes");
}

  // Resposta padrão
  return `Olá! Sou a **FinIA**, sua assistente financeira com inteligência artificial. 💚\n\nTenho acesso aos seus dados financeiros reais e posso ajudar com:\n\n📊 Saldo e resumo financeiro\n💰 Análise de gastos por categoria\n📋 Dívidas ativas e status\n📄 Boletos pendentes\n💡 Dicas personalizadas de economia\n📈 Informações sobre investimentos\n\n**O que você gostaria de saber?**`;
}

module.exports = { chatWithIA };