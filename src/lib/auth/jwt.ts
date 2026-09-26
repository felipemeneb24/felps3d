import { SignJWT, jwtVerify } from "jose";

// Assinatura e verificação do JWT de sessão. Fica separado de session.ts (que
// fala com o banco) porque o proxy também usa: lá só conferimos a assinatura e a
// validade do token, sem ir no banco a cada requisição.

const ISSUER = "felps3d";
const AUDIENCE = "felps3d-web";
const ALGORITHM = "HS256";

// A sessão expira após 1 hora SEM uso. Enquanto o usuário estiver usando, o proxy
// renova o token (no máximo a cada RENEW_AFTER_SECONDS, pra não gravar no banco a
// cada clique). Mesmo com uso contínuo, um login vale no máximo MAX_SESSION_SECONDS.
export const SESSION_DURATION_SECONDS = 60 * 60; // 1 hora de inatividade
export const RENEW_AFTER_SECONDS = 5 * 60; // 5 minutos
export const MAX_SESSION_SECONDS = 12 * 60 * 60; // 12 horas por login

// Em produção o prefixo __Host- obriga o navegador a só aceitar o cookie vindo de
// HTTPS, no domínio exato (sem subdomínios) e com path=/.
const isProduction = process.env.NODE_ENV === "production";
export const SESSION_COOKIE = isProduction ? "__Host-felps_session" : "felps_session";

export const sessionCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "strict" as const,
  path: "/",
  maxAge: SESSION_DURATION_SECONDS,
};

let cachedKey: Uint8Array | undefined;
function getSecretKey() {
  if (cachedKey) return cachedKey;
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET não configurado no .env (mínimo de 32 caracteres).");
  }
  cachedKey = new TextEncoder().encode(secret);
  return cachedKey;
}

export type SessionClaims = {
  userId: number;
  sessionId: string;
  authTime: number; // quando o login foi feito (segundos desde 1970)
  issuedAt?: number; // quando este token específico foi emitido
};

export async function signSessionToken({ userId, sessionId, authTime }: SessionClaims) {
  return new SignJWT({ auth_time: authTime })
    .setProtectedHeader({ alg: ALGORITHM, typ: "JWT" })
    .setSubject(String(userId))
    .setJti(sessionId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSecretKey());
}

// Retorna null pra qualquer token inválido, adulterado, expirado ou de outro emissor.
export async function verifySessionToken(token: string | undefined): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      algorithms: [ALGORITHM],
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    const userId = Number(payload.sub);
    const authTime = Number(payload.auth_time);
    if (!Number.isInteger(userId) || typeof payload.jti !== "string" || !Number.isFinite(authTime)) {
      return null;
    }
    if (Date.now() / 1000 - authTime > MAX_SESSION_SECONDS) return null;
    return { userId, sessionId: payload.jti, authTime, issuedAt: payload.iat };
  } catch {
    return null;
  }
}
