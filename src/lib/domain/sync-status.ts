import { createServiceRoleClient } from "@/lib/supabase/service-role";

const LAST_SYNC_AT_KEY = "last_synced_at";

export async function getLastSyncedAt(): Promise<string | null> {
  const db = createServiceRoleClient();
  const { data } = await db
    .from("app_settings")
    .select("value")
    .eq("key", LAST_SYNC_AT_KEY)
    .maybeSingle();
  return data?.value ?? null;
}

/** Called once each time performSync (src/app/api/sync/games/route.ts) completes. */
export async function recordSyncCompleted(): Promise<void> {
  const db = createServiceRoleClient();
  await db
    .from("app_settings")
    .upsert({ key: LAST_SYNC_AT_KEY, value: new Date().toISOString() }, { onConflict: "key" });
}
