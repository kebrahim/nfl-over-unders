-- The demo account is a real signed-up profile (so it can log in through
-- the normal /login flow), which means it was leaking into the real
-- overall_leaderboard view. Exclude is_demo profiles at the source.
create or replace view overall_leaderboard as
with draft_points as (
  select user_id, coalesce(sum(points), 0) as draft_points
  from draft_pick_scores
  group by user_id
),
division_points as (
  select
    dp.user_id,
    count(*) filter (where dw.team_id = dp.predicted_team_id) as division_points
  from division_predictions dp
  left join division_winners dw on dw.division = dp.division
  group by dp.user_id
)
select
  p.id as user_id,
  p.display_name,
  coalesce(d.draft_points, 0) as draft_points,
  coalesce(dv.division_points, 0) as division_points,
  coalesce(d.draft_points, 0) + coalesce(dv.division_points, 0) as total_points
from profiles p
left join draft_points d on d.user_id = p.id
left join division_points dv on dv.user_id = p.id
where p.is_demo = false
order by total_points desc;
