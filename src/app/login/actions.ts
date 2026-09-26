"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getDummyHash, verifyPassword } from "@/lib/auth/password";
import { createSession, deleteCurrentSession } from "@/lib/auth/session";
import { consumeLoginAttempt, resetLoginAttempts } from "@/lib/auth/rate-limit";

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

// Mensagem única pra usuário inexistente e senha errada: não entrega quais usuários existem.
const INVALID_CREDENTIALS = "Usuário ou senha incorretos.";

export type LoginState = { error?: string; username?: string } | undefined;

// Só aceita caminhos internos ("/pedidos"), nunca "//site.com" ou URLs absolutas,
// pra que o ?next= do login não vire um redirecionamento pra site de terceiros.
function safeNextPath(raw: FormDataEntryValue | null) {
  const value = typeof raw === "string" ? raw : "";
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return "/";
  if (value.startsWith("/login")) return "/";
  return value;
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const nextPath = safeNextPath(formData.get("next"));

  if (!username || !password || username.length > 50 || password.length > 256) {
    return { error: INVALID_CREDENTIALS, username };
  }

  const headerList = await headers();
  const ip =
    headerList.get("x-real-ip") ?? headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const userAgent = headerList.get("user-agent");

  const rate = consumeLoginAttempt(ip);
  if (!rate.allowed) {
    const minutes = Math.ceil(rate.retryAfterMs / 60_000);
    return { error: `Muitas tentativas. Tente novamente em ${minutes} min.`, username };
  }

  const user = await prisma.user.findUnique({ where: { username } });

  if (!user) {
    await verifyPassword(password, await getDummyHash());
    return { error: INVALID_CREDENTIALS, username };
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
    return { error: `Conta bloqueada por excesso de tentativas. Tente em ${minutes} min.`, username };
  }

  if (!(await verifyPassword(password, user.passwordHash))) {
    const failed = user.failedLoginAttempts + 1;
    const lock = failed >= MAX_FAILED_ATTEMPTS;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: lock ? 0 : failed,
        lockedUntil: lock ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
      },
    });
    if (lock) {
      return { error: `Conta bloqueada por ${LOCK_MINUTES} min após várias tentativas.`, username };
    }
    return { error: INVALID_CREDENTIALS, username };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
  });
  resetLoginAttempts(ip);
  await createSession(user.id, { userAgent, ip });

  redirect(nextPath);
}

export async function logout() {
  await deleteCurrentSession();
  redirect("/login");
}
