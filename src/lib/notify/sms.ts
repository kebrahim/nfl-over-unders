import { createServiceRoleClient } from "@/lib/supabase/service-role";

const CONVERSATION_SID_KEY = "sms_conversation_sid";

export async function getSmsConversationSid(): Promise<string | null> {
  const db = createServiceRoleClient();
  const { data } = await db
    .from("app_settings")
    .select("value")
    .eq("key", CONVERSATION_SID_KEY)
    .maybeSingle();
  return data?.value ?? null;
}

export async function setSmsConversationSid(sid: string): Promise<void> {
  const db = createServiceRoleClient();
  await db.from("app_settings").upsert({ key: CONVERSATION_SID_KEY, value: sid }, { onConflict: "key" });
}

function twilioAuthHeader(): string | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) return null;
  return `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`;
}

/**
 * Posts a message into the group MMS thread, if one's been set up.
 * No-ops (and logs) rather than throwing — a notification failure should
 * never break the draft pick or score sync it's attached to.
 */
export async function sendGroupText(message: string): Promise<void> {
  const auth = twilioAuthHeader();
  if (!auth) return;

  const conversationSid = await getSmsConversationSid();
  if (!conversationSid) return;

  try {
    const res = await fetch(
      `https://conversations.twilio.com/v1/Conversations/${conversationSid}/Messages`,
      {
        method: "POST",
        headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ Body: `🏈 Gridiron: ${message} Reply STOP to opt out.` }),
      },
    );
    if (!res.ok) {
      console.error("Twilio sendGroupText failed:", res.status, await res.text());
    }
  } catch (err) {
    console.error("Twilio sendGroupText error:", err);
  }
}

const OPT_IN_MESSAGE =
  "🏈 Gridiron: You're opted in to text updates for the Gridiron NFL pool " +
  "(gridiron.zebrahim.com) — draft turn alerts, pick updates, and score notifications. " +
  "Msg frequency varies, msg & data rates may apply. Reply STOP to opt out, HELP for help.";

/**
 * Sends the one-time opt-in confirmation directly to a newly-added phone
 * number (1:1, via the plain Messages API — the group Conversation may
 * not exist yet at this point). Call only when a phone number is first
 * set, not on every edit. No-ops/logs on failure, same as sendGroupText.
 */
export async function sendOptInConfirmation(phone: string): Promise<void> {
  const auth = twilioAuthHeader();
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;
  if (!auth || !fromNumber) return;

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: phone, From: fromNumber, Body: OPT_IN_MESSAGE }),
    });
    if (!res.ok) {
      console.error("Twilio sendOptInConfirmation failed:", res.status, await res.text());
    }
  } catch (err) {
    console.error("Twilio sendOptInConfirmation error:", err);
  }
}
