import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-24">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">NFL Over/Unders</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Sign in to draft, predict, and track the leaderboard.
        </p>
      </div>
      <LoginForm />
    </main>
  );
}
