import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_commissioner, phone")
    .eq("id", user.id)
    .single();
  if (!profile?.is_commissioner) {
    return NextResponse.json({ error: "Commissioner only." }, { status: 403 });
  }
  if (!profile.phone) {
    return NextResponse.json(
      { error: "Add your own phone number on My Picks first." },
      { status: 400 },
    );
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;
  if (!accountSid || !authToken || !fromNumber) {
    return NextResponse.json(
      { error: "Twilio isn't configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER." },
      { status: 500 },
    );
  }

  // Plain Messages API, not Conversations — a one-off 1:1 text to just
  // yourself, so you can confirm credentials/number work before every
  // participant has a phone number on file (Conversations setup requires
  // all 5).
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      To: profile.phone,
      From: fromNumber,
      Body: "🏈 Gridiron: this is a test text. If you got this, Twilio's wired up correctly.",
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json({ error: body.message ?? `Twilio error (${res.status}).` }, { status: 500 });
  }

  return NextResponse.json({ sid: body.sid });
}
