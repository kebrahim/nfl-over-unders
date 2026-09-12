import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSmsConversationSid, sendDirectText, sendGroupText } from "@/lib/notify/sms";
import {
  findLatestRecapWeek,
  generateUpcomingPreviewMessage,
  generateWeeklyRecapMessage,
} from "@/lib/notify/weekly-recap";

type Kind = "recap" | "preview";
type Target = "self" | "group";

export async function POST(request: Request) {
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

  const body = await request.json().catch(() => ({}));
  const kind: Kind = body?.kind;
  const target: Target = body?.target;
  if (kind !== "recap" && kind !== "preview") {
    return NextResponse.json({ error: "Invalid kind." }, { status: 400 });
  }
  if (target !== "self" && target !== "group") {
    return NextResponse.json({ error: "Invalid target." }, { status: 400 });
  }

  let message: string | null;
  if (kind === "recap") {
    const week = await findLatestRecapWeek();
    if (week == null) {
      return NextResponse.json({ error: "No completed games yet to recap." }, { status: 400 });
    }
    message = await generateWeeklyRecapMessage(week);
  } else {
    message = await generateUpcomingPreviewMessage();
  }
  if (!message) {
    return NextResponse.json(
      {
        error:
          "Couldn't generate a message — check ANTHROPIC_API_KEY is set, and that there's relevant game/pick data in the database.",
      },
      { status: 400 },
    );
  }

  if (target === "self") {
    if (!profile.phone) {
      return NextResponse.json(
        { error: "Add your own phone number on My Picks first." },
        { status: 400 },
      );
    }
    const result = await sendDirectText(profile.phone, message);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });
  } else {
    const conversationSid = await getSmsConversationSid();
    if (!conversationSid) {
      return NextResponse.json(
        { error: "No group text thread yet — create one first." },
        { status: 400 },
      );
    }
    const result = await sendGroupText(message);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, message });
}
