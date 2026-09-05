import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

const LINKS = [
  { href: "/draft", label: "Draft" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/my-picks", label: "My Picks" },
  { href: "/standings", label: "Standings" },
];

export async function Nav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let displayName: string | null = null;
  let isCommissioner = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, is_commissioner")
      .eq("id", user.id)
      .single();
    displayName = profile?.display_name ?? user.email ?? null;
    isCommissioner = profile?.is_commissioner ?? false;
  }

  return (
    <header className="border-b border-border bg-surface">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="font-heading text-lg font-semibold tracking-wide text-accent uppercase"
        >
          Over/Unders
        </Link>

        {user && (
          <div className="hidden items-center gap-6 text-sm font-medium sm:flex">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-ink-muted transition-colors hover:text-ink"
              >
                {link.label}
              </Link>
            ))}
            {isCommissioner && (
              <Link
                href="/admin"
                className="text-ink-muted transition-colors hover:text-ink"
              >
                Admin
              </Link>
            )}
          </div>
        )}

        <div className="flex items-center gap-4 text-sm">
          {user ? (
            <>
              <span className="hidden text-ink-muted sm:inline">{displayName}</span>
              <form action={signOut}>
                <button type="submit" className="font-medium hover:text-accent">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link href="/login" className="font-medium hover:text-accent">
              Sign in
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
