const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Iniciando seed no MySQL...\n");

  // 1. Criar usuário de teste
  const hashedPassword = await bcrypt.hash("123456", 10);
  const user = await prisma.user.upsert({
    where: { email: "joao@teste.com" },
    update: {},
    create: {
      name: "João Silva",
      email: "joao@teste.com",
      password: hashedPassword,
      monthlyIncome: 8000,
      payDay: 5,
    },
  });
  console.log("✅ Usuário criado:", user.email);

  // 2. Criar categorias padrão
  const categoriesData = [
    { name: "Alimentação", icon: "utensils", type: "expense", isDefault: true },
    { name: "Transporte", icon: "car", type: "expense", isDefault: true },
    { name: "Moradia", icon: "home", type: "expense", isDefault: true },
    { name: "Saúde", icon: "heart", type: "expense", isDefault: true },
    { name: "Lazer", icon: "smile", type: "expense", isDefault: true },
    { name: "Serviços", icon: "wrench", type: "expense", isDefault: true },
    { name: "Educação", icon: "book", type: "expense", isDefault: true },
    { name: "Salário", icon: "briefcase", type: "income", isDefault: true },
    { name: "Freelance", icon: "laptop", type: "income", isDefault: true },
    { name: "Vendas", icon: "tag", type: "income", isDefault: true },
    { name: "Renda Fixa", icon: "shield", type: "investment", isDefault: true },
    { name: "Ações", icon: "bar-chart", type: "investment", isDefault: true },
    { name: "FIIs", icon: "building", type: "investment", isDefault: true },
  ];

  const createdCategories = [];
  for (const cat of categoriesData) {
    const existing = await prisma.category.findFirst({
      where: { userId: user.id, name: cat.name, type: cat.type },
    });
    if (!existing) {
      const category = await prisma.category.create({
        data: { ...cat, userId: user.id },
      });
      createdCategories.push(category);
    } else {
      createdCategories.push(existing);
    }
  }
  console.log(`✅ ${createdCategories.length} categorias criadas`);

  // 3. Criar transações
  const transactionsData = [
    { description: "Salário Junho", amount: 5000, type: "income", dueDate: new Date("2026-06-01"), paid: true },
    { description: "Freelance Site", amount: 2000, type: "income", dueDate: new Date("2026-06-15"), paid: true },
    { description: "Aluguel", amount: 1500, type: "expense", dueDate: new Date("2026-06-05"), paid: true },
    { description: "Supermercado", amount: 650.30, type: "expense", dueDate: new Date("2026-06-08"), paid: true },
    { description: "Gasolina", amount: 200, type: "expense", dueDate: new Date("2026-06-10"), paid: false },
    { description: "Internet", amount: 119.90, type: "expense", dueDate: new Date("2026-06-10"), paid: false },
    { description: "Plano de Saúde", amount: 450, type: "expense", dueDate: new Date("2026-06-10"), paid: false },
    { description: "Tesouro Direto", amount: 500, type: "investment", dueDate: new Date("2026-06-01"), paid: true },
    { description: "Restaurante", amount: 120, type: "expense", dueDate: new Date("2026-06-12"), paid: true },
    { description: "Uber", amount: 35, type: "expense", dueDate: new Date("2026-06-14"), paid: true },
    { description: "Farmácia", amount: 80, type: "expense", dueDate: new Date("2026-06-16"), paid: false },
    { description: "Cinema", amount: 60, type: "expense", dueDate: new Date("2026-06-18"), paid: false },
    { description: "Curso Online", amount: 197, type: "expense", dueDate: new Date("2026-06-20"), paid: false },
    { description: "Venda Produto", amount: 350, type: "income", dueDate: new Date("2026-05-28"), paid: true },
  ];

  const getCategoryByType = (type) => {
    const cats = createdCategories.filter((c) => c.type === type);
    if (cats.length === 0) return createdCategories[0]; // fallback
    return cats[Math.floor(Math.random() * cats.length)];
  };

  let transactionCount = 0;
  for (const trans of transactionsData) {
    const category = getCategoryByType(trans.type);
    if (category) {
      await prisma.transaction.create({
        data: {
          ...trans,
          userId: user.id,
          categoryId: category.id,
          paymentDate: trans.paid ? trans.dueDate : null,
        },
      });
      transactionCount++;
    }
  }
  console.log(`✅ ${transactionCount} transações criadas`);

  // 4. Criar dívidas
  const debtsData = [
    { name: "Notebook Dell", totalAmount: 4800, paidInstallments: 4, startDate: new Date("2026-02-10"), installments: 12, status: "active" },
    { name: "Curso de Inglês", totalAmount: 2400, paidInstallments: 6, startDate: new Date("2025-11-15"), installments: 6, status: "finished" },
    { name: "Reforma Cozinha", totalAmount: 8000, paidInstallments: 2, startDate: new Date("2026-04-20"), installments: 10, status: "late" },
  ];

  for (const debtData of debtsData) {
    const category = getCategoryByType("expense");
    const { paidInstallments, ...data } = debtData;
    const paidAmount = (data.totalAmount / data.installments) * paidInstallments;

    const debt = await prisma.debt.create({
      data: {
        ...data,
        userId: user.id,
        categoryId: category.id,
        paidAmount: Math.round(paidAmount * 100) / 100,
      },
    });

    const installmentAmount = data.totalAmount / data.installments;
    for (let i = 0; i < data.installments; i++) {
      const dueDate = new Date(data.startDate);
      dueDate.setMonth(dueDate.getMonth() + i);
      await prisma.installment.create({
        data: {
          debtId: debt.id,
          number: i + 1,
          amount: Math.round(installmentAmount * 100) / 100,
          dueDate,
          paid: i < paidInstallments,
        },
      });
    }
  }
  console.log(`✅ ${debtsData.length} dívidas criadas com parcelas`);

  // 5. Criar boletos
  const boletosData = [
    { description: "Plano de Saúde", barcode: "34191790010104351004791020150008291070026000", amount: 450, dueDate: new Date("2026-06-10"), paid: false },
    { description: "Seguro Auto", barcode: "00190000090312934000900005333175872600000018900", amount: 320, dueDate: new Date("2026-06-05"), paid: true },
    { description: "IPTU 3ª parcela", barcode: "85820000026017860180201506304072867300123456789", amount: 280, dueDate: new Date("2026-05-30"), paid: false },
    { description: "Condomínio", barcode: "23790000026017860180201506304072867300123456789", amount: 580, dueDate: new Date("2026-07-10"), paid: false },
  ];

  for (const boleto of boletosData) {
    await prisma.boleto.create({ data: { ...boleto, userId: user.id } });
  }
  console.log(`✅ ${boletosData.length} boletos criados`);

  console.log("\n🎉 Seed concluído no MySQL!");
  console.log("📧 Login: joao@teste.com");
  console.log("🔑 Senha: 123456");
  console.log("💡 Use este usuário apenas para testes. Crie sua própria conta!");
}

main()
  .catch((e) => {
    console.error("❌ Erro no seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });