// Cria um usuário ou redefine a senha de um existente.
//   npm run user:create
// Não existe cadastro pelo site: só quem tem acesso ao servidor/banco cria contas.
import "dotenv/config";
import readline from "node:readline";
import { prisma } from "@/lib/prisma";
import { hashPassword, validatePasswordStrength } from "@/lib/auth/password";

function ask(question: string, hidden = false): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  if (hidden) {
    // Não ecoa a senha no terminal enquanto é digitada.
    const rlWithOutput = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream };
    rlWithOutput._writeToOutput = (s: string) => {
      if (s.includes(question)) rlWithOutput.output.write(s);
      else if (s === "\r\n" || s === "\n") rlWithOutput.output.write(s);
    };
  }
  return new Promise((resolve) =>
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      resolve(answer);
    })
  );
}

async function main() {
  const username = (await ask("Usuário: ")).trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,50}$/.test(username)) {
    throw new Error("Usuário deve ter de 3 a 50 caracteres: letras, números, ponto, hífen ou _.");
  }

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) console.log(`O usuário "${username}" já existe — a senha será redefinida.`);

  const password = await ask("Senha: ", true);
  const problem = validatePasswordStrength(password);
  if (problem) throw new Error(problem);
  if ((await ask("Confirme a senha: ", true)) !== password) {
    throw new Error("As senhas não conferem.");
  }

  const passwordHash = await hashPassword(password);

  if (existing) {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: existing.id },
        data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
      }),
      // Trocar a senha derruba todas as sessões abertas desse usuário.
      prisma.session.deleteMany({ where: { userId: existing.id } }),
    ]);
    console.log(`Senha de "${username}" redefinida. Sessões abertas foram encerradas.`);
  } else {
    await prisma.user.create({ data: { username, passwordHash } });
    console.log(`Usuário "${username}" criado.`);
  }
}

main()
  .catch((err) => {
    console.error(`Erro: ${err instanceof Error ? err.message : err}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
