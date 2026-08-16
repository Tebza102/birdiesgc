-- Repair for Gate 2B live-execution compatibility.
-- PostgreSQL does not provide max(uuid) in this project, so use array_agg(id)[1]
-- when a representative UUID is only needed after a count() proves uniqueness.

create or replace function private.match_historical_golf_day(
  p_game_number integer,
  p_venue text,
  p_event_date date
)
returns table(matched_id uuid, status text)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_norm_venue text := private.normalize_text(p_venue);
  v_total_candidates integer;
  v_exact_count integer;
  v_exact_id uuid;
  v_null_count integer;
  v_null_id uuid;
  v_dated_other_count integer;
begin
  if p_game_number is null then
    return query select null::uuid, 'conflict'::text;
    return;
  end if;

  select count(*) into v_total_candidates
  from public.golf_days
  where source_type = 'excel_import'
    and game_number = p_game_number
    and private.normalize_text(venue) is not distinct from v_norm_venue;

  if v_total_candidates = 0 then
    return query select null::uuid, 'new'::text;
    return;
  end if;

  if p_event_date is not null then
    select count(*), (array_agg(id))[1] into v_exact_count, v_exact_id
    from public.golf_days
    where source_type = 'excel_import'
      and game_number = p_game_number
      and private.normalize_text(venue) is not distinct from v_norm_venue
      and event_date = p_event_date;

    if v_exact_count = 1 then
      return query select v_exact_id, 'matched'::text;
      return;
    elsif v_exact_count > 1 then
      return query select null::uuid, 'conflict'::text;
      return;
    end if;

    select count(*), (array_agg(id))[1] into v_null_count, v_null_id
    from public.golf_days
    where source_type = 'excel_import'
      and game_number = p_game_number
      and private.normalize_text(venue) is not distinct from v_norm_venue
      and event_date is null;

    select count(*) into v_dated_other_count
    from public.golf_days
    where source_type = 'excel_import'
      and game_number = p_game_number
      and private.normalize_text(venue) is not distinct from v_norm_venue
      and event_date is not null;

    if v_null_count = 1 and v_dated_other_count = 0 then
      return query select v_null_id, 'matched'::text;
      return;
    end if;

    return query select null::uuid, 'conflict'::text;
    return;
  end if;

  if v_total_candidates = 1 then
    select id into v_exact_id
    from public.golf_days
    where source_type = 'excel_import'
      and game_number = p_game_number
      and private.normalize_text(venue) is not distinct from v_norm_venue
    limit 1;
    return query select v_exact_id, 'matched'::text;
    return;
  end if;

  return query select null::uuid, 'conflict'::text;
end;
$$;

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
  v_game_number integer;
  v_venue text;
  v_event_date date;
  v_game_key text;
  v_day_id uuid;
  v_match_status text;
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

  for v_member in select * from jsonb_array_elements(coalesce(payload->'members', '[]'::jsonb))
  loop
    v_norm_name := private.normalize_text(v_member->>'full_name');
    if v_norm_name is null then continue; end if;

    select count(*), (array_agg(id))[1] into v_match_count, v_member_id
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
        where id = v_member_id and current_handicap is distinct from v_new_handicap;
        if found then v_members_updated := v_members_updated + 1; end if;
      end if;
    else
      v_members_skipped := v_members_skipped + 1;
    end if;
  end loop;

  for v_game in select * from jsonb_array_elements(coalesce(payload->'games', '[]'::jsonb))
  loop
    v_game_number := nullif(v_game->>'game_number', '')::integer;
    v_venue := nullif(trim(v_game->>'venue'), '');
    v_event_date := nullif(v_game->>'event_date', '')::date;

    select matched_id, status into v_day_id, v_match_status
    from private.match_historical_golf_day(v_game_number, v_venue, v_event_date);

    if v_match_status = 'conflict' then
      v_games_skipped := v_games_skipped + 1;
      continue;
    end if;

    if v_day_id is not null then
      select source_type into v_day_source_type from public.golf_days where id = v_day_id;
      if v_day_source_type is distinct from 'excel_import' then
        v_games_skipped := v_games_skipped + 1;
        continue;
      end if;
    end if;

    v_game_key := private.legacy_game_key(v_game_number, v_venue, v_event_date);

    if v_day_id is null then
      insert into public.golf_days (
        game_number, title, venue, event_date, status, scoring_method, hole_count,
        is_public, source_type, source_reference, legacy_import_key
      ) values (
        v_game_number, 'Monthly Medal - Game ' || v_game_number::text,
        v_venue, v_event_date, 'closed', 'gross_stroke_v1', 18, false,
        'excel_import', v_filename, v_game_key
      ) returning id into v_day_id;
      v_games_created := v_games_created + 1;
    else
      update public.golf_days
      set venue = coalesce(v_venue, venue),
          event_date = coalesce(v_event_date, event_date),
          source_reference = v_filename,
          legacy_import_key = coalesce(v_game_key, legacy_import_key)
      where id = v_day_id;
      v_games_updated := v_games_updated + 1;
    end if;

    for v_player in select * from jsonb_array_elements(coalesce(v_game->'players', '[]'::jsonb))
    loop
      v_norm_name := private.normalize_text(v_player->>'full_name');
      if v_norm_name is null then continue; end if;

      v_member_id := null;
      select count(*), (array_agg(id))[1] into v_match_count, v_member_id
      from public.members
      where private.normalize_text(full_name) = v_norm_name;

      if v_match_count <> 1 then
        v_players_skipped := v_players_skipped + 1;
        continue;
      end if;

      insert into public.golf_day_players (
        golf_day_id, member_id, handicap_at_start, final_score_override, score_source, sort_order
      )
      select v_day_id, v_member_id, m.current_handicap,
        nullif(v_player->>'final_score', '')::integer, 'imported_total',
        (select coalesce(max(sort_order), 0) + 1 from public.golf_day_players where golf_day_id = v_day_id)
      from public.members m where m.id = v_member_id
      on conflict (golf_day_id, member_id) do update
        set final_score_override = excluded.final_score_override,
            score_source = 'imported_total'
      where public.golf_day_players.score_source = 'imported_total';

      if found then v_players_written := v_players_written + 1; end if;
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
