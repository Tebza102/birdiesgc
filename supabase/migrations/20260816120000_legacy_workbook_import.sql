-- Birdie Squad MVP: admin-only legacy Excel workbook import.
-- Adds a deterministic legacy-game fingerprint, an import audit table, and a
-- single atomic RPC entry point that performs the whole import server-side.
-- The RPC re-validates admin/approval itself; it never trusts the browser.

create or replace function private.normalize_text(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(lower(regexp_replace(trim(coalesce(p_value, '')), '\s+', ' ', 'g')), '');
$$;

-- Deterministic legacy-game fingerprint: game number + normalized venue,
-- plus the event date when one is known. This is recomputed server-side on
-- every import call rather than trusted from the client payload.
create or replace function private.legacy_game_key(p_game_number integer, p_venue text, p_event_date date)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_game_number is null then null
    when p_event_date is not null then
      p_game_number::text || '|' || coalesce(private.normalize_text(p_venue), '') || '|' || p_event_date::text
    else
      p_game_number::text || '|' || coalesce(private.normalize_text(p_venue), '')
  end;
$$;

alter table public.golf_days add column legacy_import_key text;

-- Only one excel_import golf day may ever claim a given legacy key. This is
-- the structural guarantee that makes "matched vs new" a deterministic
-- 0-or-1 lookup rather than something the import logic has to guess about.
create unique index golf_days_legacy_import_key_unique
on public.golf_days (legacy_import_key)
where legacy_import_key is not null;

-- Backfill the seeded Game 15 so a later workbook containing Game 15 matches
-- the existing record instead of creating a duplicate historical round.
update public.golf_days
set legacy_import_key = private.legacy_game_key(game_number, venue, event_date)
where source_type = 'excel_import'
  and legacy_import_key is null
  and game_number is not null;

create table public.workbook_imports (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  checksum_sha256 text not null,
  imported_by uuid references auth.users(id) on delete set null,
  imported_at timestamptz not null default now(),
  summary jsonb not null default '{}'::jsonb
);

-- The exact same file (byte-for-byte) can only ever be imported once.
create unique index workbook_imports_checksum_unique on public.workbook_imports (checksum_sha256);

alter table public.workbook_imports enable row level security;

grant select on public.workbook_imports to authenticated;

create policy workbook_imports_admin_read
on public.workbook_imports for select
to authenticated
using (
  exists (
    select 1 from public.user_profiles p
    where p.id = (select auth.uid())
      and p.approved = true
      and p.role = 'admin'
  )
);

-- No insert/update/delete grants for `authenticated` on workbook_imports or
-- on members/golf_days/golf_day_players via this path: the only way legacy
-- data can be written by an import is through this single atomic function.
create or replace function public.import_legacy_workbook(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
  v_is_admin boolean;
  v_filename text;
  v_checksum text;
  v_existing_import_id uuid;
  v_member jsonb;
  v_game jsonb;
  v_player jsonb;
  v_norm_name text;
  v_match_count integer;
  v_member_id uuid;
  v_new_handicap text;
  v_members_created integer := 0;
  v_members_updated integer := 0;
  v_members_skipped integer := 0;
  v_games_created integer := 0;
  v_games_updated integer := 0;
  v_games_skipped integer := 0;
  v_players_written integer := 0;
  v_players_skipped integer := 0;
  v_game_key text;
  v_day_id uuid;
  v_day_source_type text;
  v_import_id uuid;
  v_summary jsonb;
begin
  if v_caller is null then
    raise exception 'Sign-in required.' using errcode = '28000';
  end if;

  select exists (
    select 1 from public.user_profiles p
    where p.id = v_caller
      and p.approved = true
      and p.role = 'admin'
  ) into v_is_admin;

  if not v_is_admin then
    raise exception 'Only an approved club administrator can import a workbook.' using errcode = '42501';
  end if;

  v_filename := nullif(trim(payload->>'filename'), '');
  v_checksum := nullif(trim(payload->>'checksum'), '');

  if v_filename is null or v_checksum is null then
    raise exception 'A workbook filename and checksum are required.' using errcode = '22023';
  end if;

  select id into v_existing_import_id
  from public.workbook_imports
  where checksum_sha256 = v_checksum;

  if v_existing_import_id is not null then
    raise exception 'This exact workbook has already been imported.' using errcode = '23505';
  end if;

  -- Roster members: safe normalized-name matching only, never fuzzy.
  for v_member in select * from jsonb_array_elements(coalesce(payload->'members', '[]'::jsonb))
  loop
    v_norm_name := private.normalize_text(v_member->>'full_name');
    if v_norm_name is null then
      continue;
    end if;

    select count(*), max(id) into v_match_count, v_member_id
    from public.members
    where private.normalize_text(full_name) = v_norm_name;

    if v_match_count = 0 then
      insert into public.members (full_name, current_handicap, source_type, source_reference)
      values (trim(v_member->>'full_name'), nullif(trim(v_member->>'current_handicap'), ''), 'excel_import', v_filename);
      v_members_created := v_members_created + 1;
    elsif v_match_count = 1 then
      v_new_handicap := nullif(trim(v_member->>'current_handicap'), '');
      if v_new_handicap is not null then
        update public.members
        set current_handicap = v_new_handicap
        where id = v_member_id
          and current_handicap is distinct from v_new_handicap;
        if found then
          v_members_updated := v_members_updated + 1;
        end if;
      end if;
    else
      -- Ambiguous name: multiple existing members match. Skip rather than guess.
      v_members_skipped := v_members_skipped + 1;
    end if;
  end loop;

  -- Historical games, matched/created only via the deterministic legacy key.
  for v_game in select * from jsonb_array_elements(coalesce(payload->'games', '[]'::jsonb))
  loop
    v_game_key := private.legacy_game_key(
      nullif(v_game->>'game_number', '')::integer,
      v_game->>'venue',
      nullif(v_game->>'event_date', '')::date
    );

    if v_game_key is null then
      v_games_skipped := v_games_skipped + 1;
      continue;
    end if;

    v_day_id := null;
    v_day_source_type := null;

    select id, source_type into v_day_id, v_day_source_type
    from public.golf_days
    where legacy_import_key = v_game_key;

    if v_day_id is not null and v_day_source_type <> 'excel_import' then
      -- Never overwrite, convert or downgrade an app-created/live golf day.
      v_games_skipped := v_games_skipped + 1;
      continue;
    end if;

    if v_day_id is null then
      insert into public.golf_days (
        game_number, title, venue, event_date, status, scoring_method, hole_count,
        is_public, source_type, source_reference, legacy_import_key
      ) values (
        nullif(v_game->>'game_number', '')::integer,
        'Monthly Medal - Game ' || (v_game->>'game_number'),
        nullif(trim(v_game->>'venue'), ''),
        nullif(v_game->>'event_date', '')::date,
        'closed', 'gross_stroke_v1', 18, false, 'excel_import', v_filename, v_game_key
      )
      returning id into v_day_id;
      v_games_created := v_games_created + 1;
    else
      update public.golf_days
      set venue = coalesce(nullif(trim(v_game->>'venue'), ''), venue),
          event_date = coalesce(nullif(v_game->>'event_date', '')::date, event_date),
          source_reference = v_filename
      where id = v_day_id;
      v_games_updated := v_games_updated + 1;
    end if;

    -- Defensive re-check: this code path must only ever write into an
    -- excel_import round, even if an earlier step in this function changes.
    select source_type into v_day_source_type from public.golf_days where id = v_day_id;
    if v_day_source_type is distinct from 'excel_import' then
      raise exception 'Refusing to write imported scores into a non-imported golf day.' using errcode = '42501';
    end if;

    for v_player in select * from jsonb_array_elements(coalesce(v_game->'players', '[]'::jsonb))
    loop
      v_norm_name := private.normalize_text(v_player->>'full_name');
      if v_norm_name is null then
        continue;
      end if;

      v_member_id := null;
      select count(*), max(id) into v_match_count, v_member_id
      from public.members
      where private.normalize_text(full_name) = v_norm_name;

      if v_match_count <> 1 then
        -- Unknown or ambiguous player name for this row: skip, do not guess.
        v_players_skipped := v_players_skipped + 1;
        continue;
      end if;

      insert into public.golf_day_players (
        golf_day_id, member_id, handicap_at_start, final_score_override, score_source, sort_order
      )
      select
        v_day_id, v_member_id, m.current_handicap,
        nullif(v_player->>'final_score', '')::integer, 'imported_total',
        (select coalesce(max(sort_order), 0) + 1 from public.golf_day_players where golf_day_id = v_day_id)
      from public.members m where m.id = v_member_id
      on conflict (golf_day_id, member_id) do update
        set final_score_override = excluded.final_score_override,
            score_source = 'imported_total'
      where public.golf_day_players.score_source = 'imported_total';

      if found then
        v_players_written := v_players_written + 1;
      end if;
    end loop;
  end loop;

  v_summary := jsonb_build_object(
    'members_created', v_members_created,
    'members_updated', v_members_updated,
    'members_skipped', v_members_skipped,
    'games_created', v_games_created,
    'games_updated', v_games_updated,
    'games_skipped', v_games_skipped,
    'players_written', v_players_written,
    'players_skipped', v_players_skipped
  );

  insert into public.workbook_imports (filename, checksum_sha256, imported_by, summary)
  values (v_filename, v_checksum, v_caller, v_summary)
  returning id into v_import_id;

  return v_summary || jsonb_build_object('import_id', v_import_id);
end;
$$;

revoke all on function public.import_legacy_workbook(jsonb) from public;
grant execute on function public.import_legacy_workbook(jsonb) to authenticated;
