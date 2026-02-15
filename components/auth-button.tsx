import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "./logout-button";

export async function AuthButton() {
  const supabase = await createClient();

  // If logged in, show the email + logout
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  if (user) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">
          Hey, {user.email}
        </span>
        <LogoutButton />
      </div>
    );
  }

  // If NOT logged in, show nothing (removes Sign in / Sign up buttons)
  return null;
}
