// components/auth-button.tsx
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "./logout-button";

export default async function AuthButton() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  const user = data?.claims;

  // If logged in, show email + logout. If not logged in, show nothing.
  if (!user) return null;

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm opacity-80">Hey, {user.email}</span>
      <LogoutButton />
    </div>
  );
}
