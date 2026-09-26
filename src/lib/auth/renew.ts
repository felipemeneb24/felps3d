// Renovação da sessão enquanto o usuário usa o sistema. Chamado pelo proxy, por
// isso não importa "server-only" nem next/headers (o proxy não roda como React Server).
import type { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  RENEW_AFTER_SECONDS,
  SESSION_COOKIE,
  SESSION_DURATION_SECONDS,
  sessionCookieOptions,
  signSessionToken,
  type SessionClaims,
} from "@/lib/auth/jwt";

export function shouldRenew(claims: SessionClaims) {
  const issuedAt = claims.issuedAt ?? 0;
  return Date.now() / 1000 - issuedAt >= RENEW_AFTER_SECONDS;
}

// Estende a sessão no banco e grava um token novo (mesmo jti, validade renovada) no
// cookie da resposta. Retorna false se a sessão já não existe mais no banco (saiu,
// trocou a senha ou expirou) — nesse caso nada é renovado.
export async function renewSession(claims: SessionClaims, response: NextResponse) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DURATION_SECONDS * 1000);

  const { count } = await prisma.session.updateMany({
    where: { id: claims.sessionId, userId: claims.userId, expiresAt: { gt: now } },
    data: { expiresAt },
  });
  if (count === 0) return false;

  const token = await signSessionToken(claims);
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  return true;
}
