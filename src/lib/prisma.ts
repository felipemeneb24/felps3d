import { PrismaClient } from "@/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import type { PoolConfig } from "mariadb";

// Evita criar múltiplas conexões com o banco durante o hot-reload do Next.js em desenvolvimento.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Passar a connection string direto pro driver não deixa a gente forçar o charset da
// conexão: se o servidor MySQL tiver um charset padrão diferente de utf8mb4 (comum em
// hospedagens), acentos gravam corrompidos mesmo com a tabela em utf8mb4. Por isso
// convertemos a URL em um PoolConfig e fixamos charset: "utf8mb4" explicitamente.
function parseConnectionString(connectionString: string): PoolConfig {
  const url = new URL(connectionString);
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
    charset: "utf8mb4",
    // Hospedagens de MySQL costumam ter um limite baixo de conexões simultâneas.
    // Mantemos o pool pequeno pra não estourar esse limite.
    connectionLimit: 5,
  };
}

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL não configurada no .env");
  }
  const adapter = new PrismaMariaDb(parseConnectionString(connectionString));
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
