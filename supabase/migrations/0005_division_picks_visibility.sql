-- Division picks are predictions — seeing someone else's before the lock
-- would be unfair, so reads (not just writes) are now gated too: a user
-- can always see their own pick, the commissioner can always see
-- everyone's, and everyone can see everyone's once picks lock at kickoff.
-- Keep the timestamp in sync with DIVISION_PICKS_LOCK_AT
-- (src/lib/domain/season.ts) and migration 0002's write-lock.
drop policy "division predictions are viewable by authenticated users" on division_predictions;

create policy "division predictions viewable by owner, commissioner, or after lock"
  on division_predictions for select to authenticated
  using (
    auth.uid() = user_id
    or now() >= timestamptz '2026-09-10 00:20:00+00'
    or exists (select 1 from profiles p where p.id = auth.uid() and p.is_commissioner)
  );
