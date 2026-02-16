import { Suspense } from "react";
import AuthButton from "@/components/auth-button";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <header className="border-b border-neutral-800 bg-neutral-950">
        <div className="mx-auto max-w-md px-4 py-3 flex items-center justify-between">
          <div className="text-sm font-semibold">ASC Inventory</div>

          {/* IMPORTANT: AuthButton reads session/cookies, so it MUST be inside Suspense */}
          <Suspense
            fallback={
              <div className="h-9 w-24 rounded-md bg-neutral-900 border border-neutral-800" />
            }
          >
            <AuthButton />
          </Suspense>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-4">{children}</main>
    </div>
  );
}
