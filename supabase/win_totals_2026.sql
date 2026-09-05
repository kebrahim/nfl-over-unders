-- 2026 season win-total lines, sourced from FanDuel (via oddsshopper.com,
-- checked ~early Sept 2026). Not a schema migration — a one-off data load,
-- run once before the draft starts.
update teams as t
set
  win_total_line = v.line,
  win_total_source = 'manual',
  win_total_updated_at = now()
from (values
  ('BAL', 10.5),
  ('LAR', 11.5),
  ('BUF', 10.5),
  ('DET', 10.5),
  ('KC', 10.5),
  ('NE', 10.5),
  ('PHI', 9.5),
  ('SF', 9.5),
  ('SEA', 10.5),
  ('CHI', 9.5),
  ('CIN', 10.5),
  ('DAL', 9.5),
  ('DEN', 9.5),
  ('GB', 9.5),
  ('HOU', 9.5),
  ('LAC', 9.5),
  ('JAX', 8.5),
  ('MIN', 8.5),
  ('PIT', 7.5),
  ('TB', 8.5),
  ('CAR', 7.5),
  ('IND', 7.5),
  ('NO', 7.5),
  ('NYG', 7.5),
  ('WAS', 7.5),
  ('ATL', 7.5),
  ('CLE', 5.5),
  ('TEN', 7.5),
  ('LV', 5.5),
  ('NYJ', 5.5),
  ('ARI', 3.5),
  ('MIA', 3.5)
) as v(code, line)
where t.code = v.code;

-- verify: should return 32 rows, none with a null win_total_line
select code, name, win_total_line from teams order by win_total_line desc;
