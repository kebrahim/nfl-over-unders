-- draft_pick_scores previously only exposed wins/games_played, so every
-- UI computed a pick's losses as games_played - wins — wrong whenever
-- the team has a tie (e.g. a 3-1-1 team showed as 3-2). Add losses and
-- ties straight from team_records so displays can show the real record.
--
-- Using create or replace (not drop+create) so existing grants on the
-- view are preserved; new columns must be appended at the end — Postgres
-- requires the existing columns to keep their names, order, and types.
create or replace view draft_pick_scores as
select
  dp.id as pick_id,
  dp.session_id,
  dp.user_id,
  dp.team_id,
  dp.side,
  dp.round,
  dp.pick_number,
  tr.wins,
  tr.games_played,
  t.win_total_line,
  (tr.games_played >= 17) as resolved,
  case
    when tr.games_played < 17 then null
    when dp.side = 'over' then tr.wins > t.win_total_line
    else tr.wins < t.win_total_line
  end as correct,
  case
    when tr.games_played < 17 then 0
    when (dp.side = 'over' and tr.wins > t.win_total_line)
      or (dp.side = 'under' and tr.wins < t.win_total_line)
      then 1 + least(floor(abs(tr.wins - t.win_total_line)) * 0.5, 3)
    else 0
  end as points,
  tr.losses,
  tr.ties
from draft_picks dp
join teams t on t.id = dp.team_id
join team_records tr on tr.team_id = dp.team_id;
