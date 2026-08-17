-- Rich event details + poster upload for golf_days (public promotional
-- presentation), extending — not replacing — the existing MVP scoring
-- schema. All new columns are nullable/defaulted so existing rows keep
-- working unchanged.
--
-- Migration-compatibility lesson from Gate 2B: js/birdie-mvp.js's base
-- loadGolfDays() (used by every signed-in user to render the ordinary
-- calendar/list) intentionally does NOT select these new columns. Only the
-- day-detail/public-event queries select them, and those are wrapped so a
-- migration that hasn't been applied yet degrades gracefully (no
-- presentation block / plain calendar) instead of breaking the hub.

alter table public.golf_days
  add column short_description text,
  add column description text,
  add column reporting_time time,
  add column tee_off_time time,
  add column green_fee text,
  add column event_note text,
  add column sponsor_name text,
  add column prizes jsonb not null default '[]'::jsonb,
  add column poster_path text,
  add column poster_alt text,
  add column featured boolean not null default false;

alter table public.golf_days
  add constraint golf_days_prizes_is_array check (jsonb_typeof(prizes) = 'array');

-- No new RLS policies are needed on public.golf_days itself: the existing
-- select policies already expose every column of an eligible row (RLS is
-- row-level, not column-level), and the existing
-- golf_days_insert_admin_management / golf_days_update_admin_management
-- policies already gate every write — including writes that touch these
-- new columns — to approved admin/management, and are untouched by this
-- migration. Scorer/member roles remain unable to write to golf_days at all.

-- Public poster storage. Event posters are promotional, not member-private
-- data, so reads are public; writes/deletes are restricted to approved
-- admin/management, mirroring the golf_days write policies above. Only
-- JPG/PNG/WebP up to 5MB are accepted, enforced server-side by the bucket
-- itself (not just client-side validation).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-posters', 'event-posters', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- storage.objects already has RLS enabled and is owned by Supabase's storage
-- service in hosted projects. Do not ALTER that table here; project migrations
-- only define the policies needed for this bucket.

drop policy if exists event_posters_public_read on storage.objects;
create policy event_posters_public_read
on storage.objects for select
to public
using (bucket_id = 'event-posters');

drop policy if exists event_posters_admin_insert on storage.objects;
create policy event_posters_admin_insert
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'event-posters'
  and exists (
    select 1 from public.user_profiles p
    where p.id = (select auth.uid())
      and p.approved = true
      and p.role in ('admin', 'management')
  )
);

drop policy if exists event_posters_admin_update on storage.objects;
create policy event_posters_admin_update
on storage.objects for update
to authenticated
using (
  bucket_id = 'event-posters'
  and exists (
    select 1 from public.user_profiles p
    where p.id = (select auth.uid())
      and p.approved = true
      and p.role in ('admin', 'management')
  )
)
with check (
  bucket_id = 'event-posters'
  and exists (
    select 1 from public.user_profiles p
    where p.id = (select auth.uid())
      and p.approved = true
      and p.role in ('admin', 'management')
  )
);

drop policy if exists event_posters_admin_delete on storage.objects;
create policy event_posters_admin_delete
on storage.objects for delete
to authenticated
using (
  bucket_id = 'event-posters'
  and exists (
    select 1 from public.user_profiles p
    where p.id = (select auth.uid())
      and p.approved = true
      and p.role in ('admin', 'management')
  )
);
