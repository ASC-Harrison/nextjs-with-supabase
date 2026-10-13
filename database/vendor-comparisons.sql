create table public.vendor_comparisons (
  item_id uuid primary key references public.items(id),
  requested_by uuid not null references auth.users(id),
  searched_at timestamptz not null default now(),
  status text not null check(status in ('SEARCHING','READY','FAILED')),
  result jsonb,
  error text
);
alter table public.vendor_comparisons enable row level security;
revoke all on public.vendor_comparisons from anon,authenticated;
grant select on public.vendor_comparisons to authenticated;
grant all on public.vendor_comparisons to service_role;
create policy "admins read vendor research" on public.vendor_comparisons for select to authenticated using ((select private.has_app_role(array['admin']::text[])));
