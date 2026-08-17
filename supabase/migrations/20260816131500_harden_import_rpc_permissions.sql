-- Keep the legacy workbook RPC callable only by signed-in users.
-- The function itself still performs the authoritative approved-admin check
-- against public.user_profiles before writing anything.
revoke execute on function public.import_legacy_workbook(jsonb) from public;
revoke execute on function public.import_legacy_workbook(jsonb) from anon;
grant execute on function public.import_legacy_workbook(jsonb) to authenticated;
