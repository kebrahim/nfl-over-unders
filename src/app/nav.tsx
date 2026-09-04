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
    <header className="border-b border-black/10 dark:border-white/15">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          NFL Over/Unders
        </Link>

        {user && (
          <div className="hidden items-center gap-6 text-sm sm:flex">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-zinc-600 transition-colors hover:text-foreground dark:text-zinc-400"
              >
                {link.label}
              </Link>
            ))}
            {isCommissioner && (
              <Link
                href="/admin"
                className="text-zinc-600 transition-colors hover:text-foreground dark:text-zinc-400"
              >
                Admin
              </Link>
            )}
          </div>
        )}

        <div className="flex items-center gap-4 text-sm">
          {user ? (
            <>
              <span className="hidden text-zinc-600 sm:inline dark:text-zinc-400">
                {displayName}
              </span>
              <form action={signOut}>
                <button type="submit" className="font-medium hover:underline">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link href="/login" className="font-medium hover:underline">
              Sign in
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
