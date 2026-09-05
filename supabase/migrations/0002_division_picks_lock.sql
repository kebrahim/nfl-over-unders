-- Lock division_predictions writes at kickoff of the 2026 regular season
-- (8:20 PM ET / 00:20 UTC on 9/10/2026). Keep in sync with the matching
-- constant in src/lib/domain/season.ts (DIVISION_PICKS_LOCK_AT).
--
-- Reads stay open to everyone via the existing
-- "division predictions are viewable by authenticated users" policy;
-- this only replaces the write policy.
drop policy "users manage their own division predictions" on division_predictions;

create policy "users can insert their own division predictions before lock"
  on division_predictions for insert to authenticated
  with check (auth.uid() = user_id and now() < timestamptz '2026-09-10 00:20:00+00');

create policy "users can update their own division predictions before lock"
  on division_predictions for update to authenticated
  using (auth.uid() = user_id and now() < timestamptz '2026-09-10 00:20:00+00')
  with check (auth.uid() = user_id and now() < timestamptz '2026-09-10 00:20:00+00');
