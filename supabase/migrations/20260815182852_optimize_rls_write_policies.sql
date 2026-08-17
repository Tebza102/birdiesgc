create index if not exists golf_days_created_by_idx on public.golf_days (created_by);
create index if not exists hole_scores_updated_by_idx on public.hole_scores (updated_by);

drop policy if exists members_manage_admin_management on public.members;
create policy members_insert_admin_management
on public.members for insert to authenticated
with check (exists (select 1 from public.user_profiles p where p.id = (select auth.uid()) and p.role in ('admin','management')));
create policy members_update_admin_management
on public.members for update to authenticated
using (exists (select 1 from public.user_profiles p where p.id = (select auth.uid()) and p.role in ('admin','management')))
with check (exists (select 1 from public.user_profiles p where p.id = (select auth.uid()) and p.role in ('admin','management')));
create policy members_delete_admin_management
on public.members for delete to authenticated
using (exists (select 1 from public.user_profiles p where p.id = (select auth.uid()) and p.role in ('admin','management')));

drop policy if exists golf_days_manage_admin_management on public.golf_days;
create policy golf_days_insert_admin_management
on public.golf_days for insert to authenticated
with check (exists (select 1 from public.user_profiles p where p.id = (select auth.uid()) and p.role in ('admin','management')));
create policy golf_days_update_admin_management
on public.golf_days for update to authenticated
using (exists (select 1 from public.user_profiles p where p.id = (select auth.uid()) and p.role in ('admin','management')))
with check (exists (select 1 from public.user_profiles p where p.id = (select auth.uid()) and p.role in ('admin','management')));
create policy golf_days_delete_admin_management
on public.golf_days for delete to authenticated
using (exists (select 1 from public.user_profiles p where p.id = (select auth.uid()) and p.role in ('admin','management')));

drop policy if exists golf_day_players_staff_manage on public.golf_day_players;
create policy golf_day_players_staff_insert
on public.golf_day_players for insert to authenticated
with check (exists (select 1 from public.user_profiles p where p.id = (select auth.uid()) and p.role in ('admin','management','scorer')));
create policy golf_day_players_staff_update
on public.golf_day_players for update to authenticated
using (exists (select 1 from public.user_profiles p where p.id = (select auth.uid()) and p.role in ('admin','management','scorer')))
with check (exists (select 1 from public.user_profiles p where p.id = (select auth.uid()) and p.role in ('admin','management','scorer')));
create policy golf_day_players_staff_delete
on public.golf_day_players for delete to authenticated
using (exists (select 1 from public.user_profiles p where p.id = (select auth.uid()) and p.role in ('admin','management','scorer')));

drop policy if exists hole_scores_staff_manage on public.hole_scores;
create policy hole_scores_staff_insert
on public.hole_scores for insert to authenticated
with check (exists (select 1 from public.user_profiles p where p.id = (select auth.uid()) and p.role in ('admin','management','scorer')));
create policy hole_scores_staff_update
on public.hole_scores for update to authenticated
using (exists (select 1 from public.user_profiles p where p.id = (select auth.uid()) and p.role in ('admin','management','scorer')))
with check (exists (select 1 from public.user_profiles p where p.id = (select auth.uid()) and p.role in ('admin','management','scorer')));
create policy hole_scores_staff_delete
on public.hole_scores for delete to authenticated
using (exists (select 1 from public.user_profiles p where p.id = (select auth.uid()) and p.role in ('admin','management','scorer')));
