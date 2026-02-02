import Link from "next/link";
import { Suspense } from "react";

import { AuthButton } from "@/components/auth-button";
import { ThemeSwitcher } from "@/components/theme-switcher";

const hasEnvVars =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="font-semibold">
              Inventory
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <ThemeSwitcher />
            <Suspense fallback={null}>
              {hasEnvVars ? (
                <AuthButton />
              ) : (
                <span className="text-sm text-muted-foreground">
                  Missing env vars
                </span>
              )}
            </Suspense>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 p-4">{children}</main>
    </div>
  );
}
