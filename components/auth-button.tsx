import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/logout-button";

export default async function AuthButton() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ✅ If logged in: show email + logout
  if (user) {
    return (
      <div className="flex items-center gap-3">
        <div className="text-sm text-muted-foreground hidden sm:block">
          Hey, {user.email}
        </div>
        <LogoutButton />
      </div>
    );
  }

  // ✅ If NOT logged in: show sign in / sign up
  return (
    <div className="flex items-center gap-2">
      <Button asChild variant="outline" size="sm">
        <Link href="/auth/login">Sign in</Link>
      </Button>
      <Button asChild size="sm">
        <Link href="/auth/sign-up">Sign up</Link>
      </Button>
    </div>
  );
}
