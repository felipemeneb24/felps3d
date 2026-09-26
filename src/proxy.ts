import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/jwt";
import { renewSession, shouldRenew } from "@/lib/auth/renew";

// Primeira barreira, antes de qualquer página ou API: confere a assinatura e a
// validade do JWT (sem ir no banco). A checagem completa — sessão ainda ativa no
// banco — acontece em cada página (requireUser) e rota de API (requireApiAuth).
// Também é aqui que a sessão é renovada enquanto o usuário está usando o sistema.

const PUBLIC_PATHS = ["/login"];
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

// Proteção extra contra CSRF (além do cookie SameSite=Strict): requisições que
// alteram dados precisam vir de uma página do próprio sistema.
function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isApi = pathname.startsWith("/api/");

  if (!SAFE_METHODS.has(request.method) && !isSameOrigin(request)) {
    return NextResponse.json({ error: "Origem não permitida." }, { status: 403 });
  }

  if (isPublic(pathname)) return NextResponse.next();

  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (session) {
    const response = NextResponse.next();
    if (shouldRenew(session)) await renewSession(session, response);
    return response;
  }

  const response = isApi
    ? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
    : NextResponse.redirect(
        new URL(pathname === "/" ? "/login" : `/login?next=${encodeURIComponent(pathname + search)}`, request.url)
      );
  if (request.cookies.has(SESSION_COOKIE)) response.cookies.delete(SESSION_COOKIE);
  return response;
}

export const config = {
  // Tudo, menos os arquivos estáticos do Next e o favicon.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
