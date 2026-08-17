create schema if not exists private;

create table public.members (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  current_handicap text,
  email text,
  active boolean not null default true,
  source_type text not null default 'app' check (source_type in ('app','excel_import')),
  source_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index members_email_unique on public.members ((lower(email))) where email is not null;
create index members_full_name_idx on public.members (full_name);
create index members_active_idx on public.members (active);

create table public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  member_id uuid unique references public.members(id) on delete set null,
  role text not null default 'member' check (role in ('admin','management','scorer','member')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.golf_days (
  id uuid primary key default gen_random_uuid(),
  game_number integer,
  title text not null,
  venue text,
  event_date date,
  status text not null default 'scheduled' check (status in ('scheduled','live','closed','cancelled')),
  scoring_method text not null default 'gross_stroke_v1' check (scoring_method in ('gross_stroke_v1')),
  hole_count integer not null default 18 check (hole_count between 1 and 18),
  is_public boolean not null default true,
  source_type text not null default 'app' check (source_type in ('app','excel_import')),
  source_reference text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index golf_days_date_idx on public.golf_days (event_date);
create index golf_days_status_idx on public.golf_days (status);

create table public.golf_day_players (
  id uuid primary key default gen_random_uuid(),
  golf_day_id uuid not null references public.golf_days(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete restrict,
  handicap_at_start text,
  final_score_override integer check (final_score_override is null or final_score_override >= 0),
  score_source text not null default 'live' check (score_source in ('live','imported_total')),
  sort_order integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (golf_day_id, member_id)
);

create index golf_day_players_day_idx on public.golf_day_players (golf_day_id);
create index golf_day_players_member_idx on public.golf_day_players (member_id);

create table public.hole_scores (
  id uuid primary key default gen_random_uuid(),
  golf_day_player_id uuid not null references public.golf_day_players(id) on delete cascade,
  hole_number integer not null check (hole_number between 1 and 18),
  strokes integer not null check (strokes between 1 and 30),
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (golf_day_player_id, hole_number)
);

create index hole_scores_player_idx on public.hole_scores (golf_day_player_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger members_set_updated_at before update on public.members
for each row execute function public.set_updated_at();
create trigger user_profiles_set_updated_at before update on public.user_profiles
for each row execute function public.set_updated_at();
create trigger golf_days_set_updated_at before update on public.golf_days
for each row execute function public.set_updated_at();
create trigger golf_day_players_set_updated_at before update on public.golf_day_players
for each row execute function public.set_updated_at();
create trigger hole_scores_set_updated_at before update on public.hole_scores
for each row execute function public.set_updated_at();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_profiles (id, role)
  values (new.id, 'member')
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public;
grant execute on function private.handle_new_user() to supabase_auth_admin;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

alter table public.members enable row level security;
alter table public.user_profiles enable row level security;
alter table public.golf_days enable row level security;
alter table public.golf_day_players enable row level security;
alter table public.hole_scores enable row level security;

grant select on public.members to authenticated;
grant insert, update, delete on public.members to authenticated;
grant select on public.user_profiles to authenticated;
grant select on public.golf_days to anon, authenticated;
grant insert, update, delete on public.golf_days to authenticated;
grant select, insert, update, delete on public.golf_day_players to authenticated;
grant select, insert, update, delete on public.hole_scores to authenticated;

create policy user_profiles_read_own
on public.user_profiles for select
to authenticated
using (id = (select auth.uid()));

create policy members_read_authenticated
on public.members for select
to authenticated
using (
  active = true
  or exists (
    select 1 from public.user_profiles p
    where p.id = (select auth.uid())
      and p.role in ('admin','management')
  )
);

create policy members_manage_admin_management
on public.members for all
to authenticated
using (
  exists (
    select 1 from public.user_profiles p
    where p.id = (select auth.uid())
      and p.role in ('admin','management')
  )
)
with check (
  exists (
    select 1 from public.user_profiles p
    where p.id = (select auth.uid())
      and p.role in ('admin','management')
  )
);

create policy golf_days_public_read
on public.golf_days for select
to anon
using (is_public = true);

create policy golf_days_member_read
on public.golf_days for select
to authenticated
using (true);

create policy golf_days_manage_admin_management
on public.golf_days for all
to authenticated
using (
  exists (
    select 1 from public.user_profiles p
    where p.id = (select auth.uid())
      and p.role in ('admin','management')
  )
)
with check (
  exists (
    select 1 from public.user_profiles p
    where p.id = (select auth.uid())
      and p.role in ('admin','management')
  )
);

create policy golf_day_players_member_read
on public.golf_day_players for select
to authenticated
using (true);

create policy golf_day_players_staff_manage
on public.golf_day_players for all
to authenticated
using (
  exists (
    select 1 from public.user_profiles p
    where p.id = (select auth.uid())
      and p.role in ('admin','management','scorer')
  )
)
with check (
  exists (
    select 1 from public.user_profiles p
    where p.id = (select auth.uid())
      and p.role in ('admin','management','scorer')
  )
);

create policy hole_scores_member_read
on public.hole_scores for select
to authenticated
using (true);

create policy hole_scores_staff_manage
on public.hole_scores for all
to authenticated
using (
  exists (
    select 1 from public.user_profiles p
    where p.id = (select auth.uid())
      and p.role in ('admin','management','scorer')
  )
)
with check (
  exists (
    select 1 from public.user_profiles p
    where p.id = (select auth.uid())
      and p.role in ('admin','management','scorer')
  )
);

create or replace view public.live_leaderboard
with (security_invoker = true)
as
with player_totals as (
  select
    gdp.id as golf_day_player_id,
    gdp.golf_day_id,
    gdp.member_id,
    m.full_name as player_name,
    gdp.handicap_at_start,
    gdp.score_source,
    case
      when count(hs.id) > 0 then count(hs.id)::integer
      when gdp.final_score_override is not null then gd.hole_count
      else 0
    end as holes_completed,
    case
      when count(hs.id) > 0 then sum(hs.strokes)::integer
      else gdp.final_score_override
    end as total_score,
    gd.game_number,
    gd.title,
    gd.venue,
    gd.event_date,
    gd.status,
    gd.hole_count
  from public.golf_day_players gdp
  join public.members m on m.id = gdp.member_id
  join public.golf_days gd on gd.id = gdp.golf_day_id
  left join public.hole_scores hs on hs.golf_day_player_id = gdp.id
  group by gdp.id, gdp.golf_day_id, gdp.member_id, m.full_name, gdp.handicap_at_start,
           gdp.score_source, gdp.final_score_override, gd.game_number, gd.title, gd.venue,
           gd.event_date, gd.status, gd.hole_count
)
select
  player_totals.*,
  case
    when total_score is null then null
    else rank() over (partition by golf_day_id order by total_score asc nulls last)
  end as position
from player_totals;

grant select on public.live_leaderboard to authenticated;

alter publication supabase_realtime add table public.hole_scores;
alter publication supabase_realtime add table public.golf_day_players;
alter publication supabase_realtime add table public.golf_days;
