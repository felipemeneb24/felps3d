import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { IconSpool } from "@/components/icons";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Entrar · Felps 3D",
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function LoginPage({ searchParams }: PageProps) {
  if (await getCurrentUser()) redirect("/");
  const { next } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top,var(--accent-soft),transparent_60%)] px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-accent-foreground shadow-lg shadow-accent/30">
            <IconSpool className="h-7 w-7" />
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Felps 3D</h1>
            <p className="mt-1 text-sm text-muted-foreground">Entre para acessar o sistema</p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-xl shadow-black/40">
          <LoginForm next={typeof next === "string" ? next : "/"} />
        </div>
      </div>
    </div>
  );
}
