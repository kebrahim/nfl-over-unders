"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SmsSetup({
  configured,
  missingPhoneNames,
}: {
  configured: boolean;
  missingPhoneNames: string[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [twilioError, setTwilioError] = useState<unknown>(null);

  async function setUp(recreate: boolean) {
    setPending(true);
    setError(null);
    setResult(null);
    setTwilioError(null);
    const res = await fetch("/api/admin/sms/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recreate }),
    });
    const body = await res.json();
    setPending(false);
    if (!res.ok) {
      setError(body.error ?? "Something went wrong.");
      if (body.twilioError) setTwilioError(body.twilioError);
      return;
    }
    setResult(
      body.alreadyExists
        ? "Group text is already set up."
        : "Group text thread created! Ask everyone to save the Twilio number as a contact.",
    );
    router.refresh();
  }

  async function sendTest() {
    setPending(true);
    setError(null);
    setResult(null);
    const res = await fetch("/api/admin/sms/test", { method: "POST" });
    const body = await res.json();
    setPending(false);
    if (!res.ok) {
      setError(body.error ?? "Something went wrong.");
      return;
    }
    setResult("Test text sent to your own number — check your phone.");
  }

  return (
    <div className="space-y-2">
      {missingPhoneNames.length > 0 && (
        <p className="text-sm text-bad">
          Missing phone numbers for: {missingPhoneNames.join(", ")}. They need to add theirs on
          My Picks first.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setUp(false)}
          disabled={pending || missingPhoneNames.length > 0}
          className="rounded-full border border-border px-4 py-1.5 text-sm font-medium text-ink hover:bg-surface-2 disabled:opacity-50"
        >
          {pending ? "Working…" : configured ? "Group text already set up" : "Create SMS group text"}
        </button>
        {configured && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm("This creates a brand-new group thread. Continue?")) setUp(true);
            }}
            disabled={pending || missingPhoneNames.length > 0}
            className="rounded-full border border-border px-4 py-1.5 text-sm font-medium text-ink hover:bg-surface-2 disabled:opacity-50"
          >
            Recreate
          </button>
        )}
        <button
          type="button"
          onClick={sendTest}
          disabled={pending}
          className="rounded-full border border-border px-4 py-1.5 text-sm font-medium text-ink hover:bg-surface-2 disabled:opacity-50"
        >
          Send me a test text
        </button>
      </div>
      {result && <p className="text-sm text-good">{result}</p>}
      {error && <p className="text-sm text-bad">{error}</p>}
      {twilioError != null && (
        <pre className="overflow-x-auto rounded-md border border-border bg-bg p-3 text-xs text-ink-muted">
          {JSON.stringify(twilioError, null, 2)}
        </pre>
      )}
    </div>
  );
}
