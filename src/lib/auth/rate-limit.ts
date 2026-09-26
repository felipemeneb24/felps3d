import "server-only";

// Limite de tentativas de login por IP, em memória (janela fixa). Complementa o
// bloqueio por conta (users.lockedUntil): este segura quem testa muitos usuários
// diferentes a partir do mesmo IP. Por ser em memória, zera se o servidor reiniciar.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 20;

const attempts = new Map<string, { count: number; resetAt: number }>();

export function consumeLoginAttempt(ip: string): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();

  if (attempts.size > 10_000) {
    for (const [key, entry] of attempts) if (entry.resetAt <= now) attempts.delete(key);
  }

  const entry = attempts.get(ip);
  if (!entry || entry.resetAt <= now) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, retryAfterMs: 0 };
  }
  entry.count += 1;
  return { allowed: entry.count <= MAX_ATTEMPTS, retryAfterMs: entry.resetAt - now };
}

export function resetLoginAttempts(ip: string) {
  attempts.delete(ip);
}
