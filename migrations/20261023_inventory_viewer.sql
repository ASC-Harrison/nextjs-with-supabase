-- View-only inventory/order-request access. Existing staff permissions stay intact.
begin;
alter table public.app_user_roles drop constraint app_user_roles_role_check;
alter table public.app_user_roles add constraint app_user_roles_role_check
  check (role in ('admin','staff','preop','kaya','viewer'));

-- Legacy security-definer inventory RPCs bypass table RLS. Explicitly reject
-- viewer accounts before any mutation, including calls outside the app UI.
do $guard$
declare fn record; definition text;
begin
  for fn in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prosecdef and p.proname in
      ('move_stock','use_stock','add_stock','apply_scan','apply_transaction',
       'process_inventory_transaction','apply_inventory_tx','upsert_storage_inventory')
  loop
    definition:=pg_get_functiondef(fn.oid);
    if position('View-only accounts cannot modify inventory' in definition)=0 then
      definition:=regexp_replace(definition,'\mBEGIN\M',
        E'BEGIN\n  IF private.has_app_role(ARRAY[''viewer'']::text[]) THEN\n    RAISE EXCEPTION ''View-only accounts cannot modify inventory'' USING ERRCODE = ''42501'';\n  END IF;','i');
      execute definition;
    end if;
  end loop;
end $guard$;

-- Defense in depth for tables with legacy open write policies.
create policy "viewers cannot insert audit entries" on public.audit_log as restrictive
  for insert to authenticated with check (not (select private.has_app_role(array['viewer']::text[])));
create policy "viewers cannot insert presence" on public.staff_presence as restrictive
  for insert to authenticated with check (not (select private.has_app_role(array['viewer']::text[])));
create policy "viewers cannot update presence" on public.staff_presence as restrictive
  for update to authenticated using (not (select private.has_app_role(array['viewer']::text[])))
  with check (not (select private.has_app_role(array['viewer']::text[])));
create policy "viewers cannot delete presence" on public.staff_presence as restrictive
  for delete to authenticated using (not (select private.has_app_role(array['viewer']::text[])));
commit;
