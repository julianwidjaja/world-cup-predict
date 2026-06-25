-- World Cup 2026 Prediction App - Database Schema
-- Run this in the Supabase SQL Editor

-- ============================================
-- TABLES
-- ============================================

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null unique,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique default substr(md5(random()::text), 1, 8),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique(group_id, user_id)
);

create table public.matches (
  id serial primary key,
  match_number int unique,
  stage text not null check (stage in ('group', 'round_of_32', 'round_of_16', 'quarter_final', 'semi_final', 'third_place', 'final')),
  group_label text,
  home_team text not null,
  away_team text not null,
  home_team_resolved text,
  away_team_resolved text,
  match_date timestamptz not null,
  venue text,
  home_score int,
  away_score int,
  result text check (result in ('home', 'away', 'draw')),
  is_completed boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  match_id int not null references public.matches(id) on delete cascade,
  predicted_result text not null check (predicted_result in ('home', 'away', 'draw')),
  predicted_home_score int,
  predicted_away_score int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, match_id)
);

create table public.winner_predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  predicted_team text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);

create table public.deadlines (
  stage text primary key,
  deadline_time timestamptz not null
);

create table public.tournament_winner (
  id int primary key default 1 check (id = 1),
  team text,
  decided_at timestamptz
);

insert into public.tournament_winner (id) values (1);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.matches enable row level security;
alter table public.predictions enable row level security;
alter table public.winner_predictions enable row level security;
alter table public.deadlines enable row level security;
alter table public.tournament_winner enable row level security;

-- Helper function to check admin status
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and is_admin = true
  );
$$;

-- Profiles
create policy "Profiles viewable by authenticated users"
  on profiles for select to authenticated using (true);

create policy "Users can create own profile"
  on profiles for insert to authenticated
  with check ((select auth.uid()) = id);

create policy "Users can update own profile"
  on profiles for update to authenticated
  using ((select auth.uid()) = id);

-- Groups
create policy "Groups viewable by authenticated users"
  on groups for select to authenticated using (true);

create policy "Authenticated users can create groups"
  on groups for insert to authenticated
  with check ((select auth.uid()) = created_by);

-- Group Members
create policy "Group memberships viewable"
  on group_members for select to authenticated using (true);

create policy "Users can join groups"
  on group_members for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can leave groups"
  on group_members for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Matches
create policy "Matches viewable by authenticated users"
  on matches for select to authenticated using (true);

create policy "Admins can insert matches"
  on matches for insert to authenticated
  with check ((select public.is_admin()));

create policy "Admins can update matches"
  on matches for update to authenticated
  using ((select public.is_admin()));

-- Predictions
create policy "Predictions viewable by authenticated users"
  on predictions for select to authenticated using (true);

create policy "Users can create predictions"
  on predictions for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update own predictions"
  on predictions for update to authenticated
  using ((select auth.uid()) = user_id);

-- Winner Predictions
create policy "Winner predictions viewable by authenticated users"
  on winner_predictions for select to authenticated using (true);

create policy "Users can create winner prediction"
  on winner_predictions for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update own winner prediction"
  on winner_predictions for update to authenticated
  using ((select auth.uid()) = user_id);

-- Deadlines
create policy "Deadlines viewable by authenticated users"
  on deadlines for select to authenticated using (true);

create policy "Admins can manage deadlines"
  on deadlines for all to authenticated
  using ((select public.is_admin()));

-- Tournament Winner
create policy "Tournament winner viewable"
  on tournament_winner for select to authenticated using (true);

create policy "Admins can set winner"
  on tournament_winner for update to authenticated
  using ((select public.is_admin()));

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, split_part(new.email, '@', 1));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Enforce prediction deadlines
create or replace function public.enforce_prediction_deadline()
returns trigger
language plpgsql
as $$
declare
  v_stage text;
  v_deadline timestamptz;
begin
  select stage
    into v_stage
    from public.matches where id = new.match_id;

  select deadline_time into v_deadline
    from public.deadlines where stage = v_stage;

  if v_deadline is not null and now() > v_deadline then
    raise exception 'Prediction deadline for this stage has passed';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger check_prediction_deadline
  before insert or update on public.predictions
  for each row execute function public.enforce_prediction_deadline();

-- Enforce winner prediction deadline
create or replace function public.enforce_winner_deadline()
returns trigger
language plpgsql
as $$
declare
  v_deadline timestamptz;
begin
  select deadline_time into v_deadline
    from public.deadlines where stage = 'tournament_winner';

  if v_deadline is not null and now() > v_deadline then
    raise exception 'Tournament winner prediction deadline has passed';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger check_winner_deadline
  before insert or update on public.winner_predictions
  for each row execute function public.enforce_winner_deadline();

-- ============================================
-- FUNCTIONS
-- ============================================

-- Leaderboard calculation
create or replace function public.get_leaderboard(p_group_id uuid)
returns table (
  user_id uuid,
  display_name text,
  total_points int,
  correct_predictions int,
  total_completed int,
  exact_scores int
)
language sql
stable
as $$
  with point_values(stage, points) as (
    values
      ('group', 50),
      ('round_of_32', 75),
      ('round_of_16', 100),
      ('quarter_final', 125),
      ('semi_final', 150),
      ('third_place', 175),
      ('final', 175)
  ),
  completed_count as (
    select count(*)::int as cnt from public.matches where is_completed = true
  ),
  match_scores as (
    select
      p.user_id,
      pr.display_name,
      coalesce(sum(case when p.predicted_result = m.result then pv.points else 0 end), 0) as match_points,
      count(case when p.predicted_result = m.result then 1 end) as correct_count,
      count(case when m.home_score is not null and m.away_score is not null
                  and p.predicted_home_score = m.home_score
                  and p.predicted_away_score = m.away_score then 1 end) as exact_count
    from public.group_members gm
    join public.profiles pr on pr.id = gm.user_id
    left join public.predictions p on p.user_id = gm.user_id
    left join public.matches m on m.id = p.match_id and m.is_completed = true
    left join point_values pv on pv.stage = m.stage
    where gm.group_id = p_group_id
    group by p.user_id, pr.display_name, gm.user_id
  ),
  winner_bonus as (
    select
      wp.user_id,
      case when tw.team is not null and wp.predicted_team = tw.team then 250 else 0 end as bonus
    from public.winner_predictions wp
    cross join public.tournament_winner tw
    where tw.id = 1
  )
  select
    coalesce(ms.user_id, gm2.user_id),
    coalesce(ms.display_name, pr2.display_name),
    (coalesce(ms.match_points, 0) + coalesce(wb.bonus, 0))::int,
    coalesce(ms.correct_count, 0)::int,
    cc.cnt,
    coalesce(ms.exact_count, 0)::int
  from public.group_members gm2
  join public.profiles pr2 on pr2.id = gm2.user_id
  cross join completed_count cc
  left join match_scores ms on ms.user_id = gm2.user_id
  left join winner_bonus wb on wb.user_id = gm2.user_id
  where gm2.group_id = p_group_id
  order by 3 desc, 4 desc;
$$;

-- Resolve knockout teams based on completed match results
create or replace function public.resolve_knockout_teams()
returns void
language plpgsql
security definer
as $$
declare
  r record;
  winner_team text;
  loser_team text;
begin
  for r in
    select id, match_number, result,
           coalesce(home_team_resolved, home_team) as home,
           coalesce(away_team_resolved, away_team) as away
    from public.matches
    where match_number is not null
      and is_completed = true
  loop
    winner_team := case when r.result = 'home' then r.home else r.away end;
    loser_team := case when r.result = 'home' then r.away else r.home end;

    update public.matches
    set home_team_resolved = winner_team
    where home_team = 'W' || r.match_number
      and home_team_resolved is null;

    update public.matches
    set away_team_resolved = winner_team
    where away_team = 'W' || r.match_number
      and away_team_resolved is null;

    update public.matches
    set home_team_resolved = loser_team
    where home_team = 'L' || r.match_number
      and home_team_resolved is null;

    update public.matches
    set away_team_resolved = loser_team
    where away_team = 'L' || r.match_number
      and away_team_resolved is null;
  end loop;
end;
$$;
