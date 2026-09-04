-- NFL Over/Unders — initial schema
--
-- A note on "games_played": the NFL regular season is 17 games per team
-- (played across 18 weeks, with each team getting one bye week). A team's
-- draft picks resolve once its games_played reaches 17. The league-wide
-- point total (used for the tiebreaker) resolves once all 272 regular
-- season games are final.

-- ============================================================
-- profiles
-- ============================================================
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  email text not null,
  is_commissioner boolean not null default false,
  created_at timestamptz not null default now()
);

-- Auto-create a profile row whenever a new auth user signs up.
create function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Helper used by RLS policies below.
create function is_commissioner()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select p.is_commissioner from profiles p where p.id = auth.uid()), false);
$$;

-- ============================================================
-- teams
-- ============================================================
create table teams (
  id serial primary key,
  name text not null,
  code text not null unique,
  conference text not null check (conference in ('AFC', 'NFC')),
  division text not null check (division in ('East', 'North', 'South', 'West')),
  win_total_line numeric(4, 1),
  win_total_source text not null default 'manual' check (win_total_source in ('manual', 'api')),
  win_total_updated_at timestamptz
);

-- ============================================================
-- games (synced from an external scores source)
-- ============================================================
create table games (
  id integer primary key,
  week integer not null check (week between 1 and 18),
  home_team_id integer not null references teams (id),
  away_team_id integer not null references teams (id),
  home_score integer,
  away_score integer,
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'final')),
  kickoff_utc timestamptz not null
);

create index games_week_idx on games (week);

-- ============================================================
-- the draft
-- ============================================================
create table draft_sessions (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'pending' check (status in ('pending', 'active', 'completed')),
  total_rounds integer not null default 6,
  current_round integer not null default 1,
  current_pick_index integer not null default 0,
  snake_order uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table draft_picks (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references draft_sessions (id) on delete cascade,
  user_id uuid not null references profiles (id),
  team_id integer not null references teams (id),
  side text not null check (side in ('over', 'under')),
  round integer not null,
  pick_number integer not null,
  picked_at timestamptz not null default now(),
  unique (session_id, team_id, side),
  unique (session_id, pick_number)
);

-- ============================================================
-- division bonus + tiebreaker
-- ============================================================
create table division_predictions (
  user_id uuid not null references profiles (id),
  division text not null check (
    division in (
      'AFC East', 'AFC North', 'AFC South', 'AFC West',
      'NFC East', 'NFC North', 'NFC South', 'NFC West'
    )
  ),
  predicted_team_id integer not null references teams (id),
  created_at timestamptz not null default now(),
  primary key (user_id, division)
);

create table division_winners (
  division text primary key check (
    division in (
      'AFC East', 'AFC North', 'AFC South', 'AFC West',
      'NFC East', 'NFC North', 'NFC South', 'NFC West'
    )
  ),
  team_id integer not null references teams (id),
  set_at timestamptz not null default now()
);

create table tiebreaker_predictions (
  user_id uuid primary key references profiles (id),
  points_guess integer not null check (points_guess > 0),
  created_at timestamptz not null default now()
);

-- ============================================================
-- derived views
-- ============================================================
create view team_records as
select
  t.id as team_id,
  count(*) filter (
    where g.status = 'final' and (
      (g.home_team_id = t.id and g.home_score > g.away_score) or
      (g.away_team_id = t.id and g.away_score > g.home_score)
    )
  ) as wins,
  count(*) filter (
    where g.status = 'final' and (
      (g.home_team_id = t.id and g.home_score < g.away_score) or
      (g.away_team_id = t.id and g.away_score < g.home_score)
    )
  ) as losses,
  count(*) filter (
    where g.status = 'final' and g.home_score = g.away_score and
      (g.home_team_id = t.id or g.away_team_id = t.id)
  ) as ties,
  count(*) filter (
    where g.status = 'final' and (g.home_team_id = t.id or g.away_team_id = t.id)
  ) as games_played
from teams t
left join games g on g.home_team_id = t.id or g.away_team_id = t.id
group by t.id;

create view league_total_points as
select
  coalesce(sum(home_score), 0) + coalesce(sum(away_score), 0) as total_points,
  count(*) as games_final
from games
where status = 'final';

-- Per-pick scoring: 1 point for the correct side, plus 0.5 bonus points
-- per full win of margin beyond the line, capped at 3 bonus points.
-- Resolves to null/0 until the team's regular season is complete.
create view draft_pick_scores as
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
  end as points
from draft_picks dp
join teams t on t.id = dp.team_id
join team_records tr on tr.team_id = dp.team_id;

create view overall_leaderboard as
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
order by total_points desc;

-- ============================================================
-- row level security
-- ============================================================
alter table profiles enable row level security;
alter table teams enable row level security;
alter table games enable row level security;
alter table draft_sessions enable row level security;
alter table draft_picks enable row level security;
alter table division_predictions enable row level security;
alter table division_winners enable row level security;
alter table tiebreaker_predictions enable row level security;

-- profiles: everyone signed in can see everyone (it's a 5-person pool);
-- a user can only edit their own row.
create policy "profiles are viewable by authenticated users"
  on profiles for select to authenticated using (true);
create policy "users can update their own profile"
  on profiles for update to authenticated using (auth.uid() = id);

-- teams, games, division_winners: public read for anyone signed in;
-- writes are commissioner-only (or via the service role from a sync job).
create policy "teams are viewable by authenticated users"
  on teams for select to authenticated using (true);
create policy "commissioner can modify teams"
  on teams for all to authenticated using (is_commissioner()) with check (is_commissioner());

create policy "games are viewable by authenticated users"
  on games for select to authenticated using (true);
create policy "commissioner can modify games"
  on games for all to authenticated using (is_commissioner()) with check (is_commissioner());

create policy "division winners are viewable by authenticated users"
  on division_winners for select to authenticated using (true);
create policy "commissioner can set division winners"
  on division_winners for all to authenticated using (is_commissioner()) with check (is_commissioner());

-- draft_sessions / draft_picks: everyone can watch the draft; picks are
-- written by the /api/draft/pick route (service role), not directly by
-- clients, so no client-facing insert policy is granted here.
create policy "draft sessions are viewable by authenticated users"
  on draft_sessions for select to authenticated using (true);
create policy "commissioner can manage draft sessions"
  on draft_sessions for all to authenticated using (is_commissioner()) with check (is_commissioner());

create policy "draft picks are viewable by authenticated users"
  on draft_picks for select to authenticated using (true);

-- division_predictions / tiebreaker_predictions: everyone can see
-- everyone's picks (no hidden info needed for a friends pool); a user
-- can only write their own row.
create policy "division predictions are viewable by authenticated users"
  on division_predictions for select to authenticated using (true);
create policy "users manage their own division predictions"
  on division_predictions for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "tiebreaker predictions are viewable by authenticated users"
  on tiebreaker_predictions for select to authenticated using (true);
create policy "users manage their own tiebreaker prediction"
  on tiebreaker_predictions for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
