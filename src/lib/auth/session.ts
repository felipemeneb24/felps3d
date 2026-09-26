import "server-only";
import { cache } from "react";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  MAX_SESSION_SECONDS,
  SESSION_COOKIE,
  SESSION_DURATION_SECONDS,
  sessionCookieOptions,
  signSessionToken,
  verifySessionToken,
} from "@/lib/auth/jwt";

export type CurrentUser = { id: number; username: string };

export async function createSession(userId: number, meta: { userAgent?: string | null; ip?: string | null }) {
  const sessionId = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_SECONDS * 1000);

  await prisma.session.create({
    data: {
      id: sessionId,
      userId,
      expiresAt,
      userAgent: meta.userAgent?.slice(0, 255) ?? null,
      ip: meta.ip?.slice(0, 64) ?? null,
    },
  });
  // Aproveita o login pra limpar sessões vencidas desse usuário.
  await prisma.session.deleteMany({ where: { userId, expiresAt: { lt: new Date() } } });

  const token = await signSessionToken({ userId, sessionId, authTime: Math.floor(Date.now() / 1000) });
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions);
}

// Verificação completa: assinatura do JWT + sessão ainda existente no banco.
// Memoizada por requisição, então chamar várias vezes num mesmo render é barato.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const claims = await verifySessionToken(token);
  if (!claims) return null;

  const session = await prisma.session.findUnique({
    where: { id: claims.sessionId },
    select: {
      userId: true,
      expiresAt: true,
      createdAt: true,
      user: { select: { id: true, username: true } },
    },
  });
  const now = Date.now();
  if (
    !session ||
    session.userId !== claims.userId ||
    session.expiresAt.getTime() <= now ||
    now - session.createdAt.getTime() > MAX_SESSION_SECONDS * 1000
  ) {
    return null;
  }
  return session.user;
});

export async function deleteCurrentSession() {
  const cookieStore = await cookies();
  const claims = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  if (claims) {
    await prisma.session.deleteMany({ where: { id: claims.sessionId } });
  }
  cookieStore.delete(SESSION_COOKIE);
}

// Pra páginas (Server Components): sem sessão válida, manda pro login.
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

// Pra rotas de API: retorna uma resposta 401 quando não autenticado, ou null se ok.
//   const unauthorized = await requireApiAuth();
//   if (unauthorized) return unauthorized;
export async function requireApiAuth(): Promise<NextResponse | null> {
  const user = await getCurrentUser();
  if (user) return null;
  return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
}
