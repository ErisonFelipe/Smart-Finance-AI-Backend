const { ZodError } = require("zod");

const errorHandler = (err, req, res, next) => {
  console.error("❌ Erro:", err.message);

  // Erro de validação do Zod
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: "Dados inválidos",
      details: err.errors.map((e) => ({
        campo: e.path.join("."),
        mensagem: e.message,
      })),
    });
  }

  // Erros do Prisma
  if (err.code === "P2002") {
    return res.status(409).json({ error: "Registro já existe" });
  }

  if (err.code === "P2025") {
    return res.status(404).json({ error: "Registro não encontrado" });
  }

  if (err.code === "P2003") {
    return res.status(400).json({ error: "Registro vinculado não encontrado" });
  }

  // Erro de arquivo muito grande (Multer)
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ error: "Arquivo muito grande. Máximo 2MB" });
  }

  // Erro genérico
  const status = err.status || 500;
  const message = status === 500 ? "Erro interno do servidor" : err.message;

  res.status(status).json({ error: message });
};

module.exports = errorHandler;