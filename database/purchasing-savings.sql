-- Purchasing improvements and documented purchases. Existing savings entries are preserved.
create table public.purchasing_improvements (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references auth.users(id),
  effective_date date not null,
  old_product text not null check(length(btrim(old_product)) between 1 and 300),
  new_product text not null check(length(btrim(new_product)) between 1 and 300),
  old_vendor text not null default '',
  new_vendor text not null default '',
  old_package_price numeric(12,2) not null check(old_package_price>0),
  new_package_price numeric(12,2) not null check(new_package_price>=0),
  old_package_units numeric(12,3) not null check(old_package_units>0),
  new_package_units numeric(12,3) not null check(new_package_units>0),
  unit_label text not null check(length(btrim(unit_label)) between 1 and 80),
  monthly_packages numeric(12,3) not null check(monthly_packages>=0 and monthly_packages<=1000000),
  credited_to text not null check(length(btrim(credited_to)) between 1 and 200),
  evidence text not null check(length(btrim(evidence)) between 1 and 2000),
  active boolean not null default true,
  check(new_package_price/new_package_units < old_package_price/old_package_units)
);
create table public.purchasing_savings_purchases (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references auth.users(id),
  improvement_id uuid not null references public.purchasing_improvements(id),
  purchase_date date not null,
  invoice_reference text not null check(length(btrim(invoice_reference)) between 1 and 300),
  packages numeric(12,3) not null check(packages>0 and packages<=1000000),
  paid_package_price numeric(12,2) not null check(paid_package_price>=0),
  old_package_price numeric(12,2) not null check(old_package_price>0),
  old_package_units numeric(12,3) not null check(old_package_units>0),
  new_package_units numeric(12,3) not null check(new_package_units>0),
  previous_spend numeric generated always as (round(packages*new_package_units*old_package_price/old_package_units,2)) stored,
  current_spend numeric generated always as (round(packages*paid_package_price,2)) stored,
  savings numeric generated always as (round(packages*new_package_units*old_package_price/old_package_units,2)-round(packages*paid_package_price,2)) stored,
  confirmed boolean not null default false,
  voided boolean not null default false
);
create unique index purchasing_purchase_reference_unique on public.purchasing_savings_purchases(improvement_id,lower(btrim(invoice_reference))) where not voided;
create index purchasing_purchases_improvement_idx on public.purchasing_savings_purchases(improvement_id);
create index purchasing_purchases_created_by_idx on public.purchasing_savings_purchases(created_by);
create index purchasing_improvements_created_by_idx on public.purchasing_improvements(created_by);
alter table public.purchasing_improvements enable row level security;
alter table public.purchasing_savings_purchases enable row level security;
revoke all on public.purchasing_improvements,public.purchasing_savings_purchases from anon,authenticated;
grant select,insert on public.purchasing_improvements,public.purchasing_savings_purchases to authenticated;
grant update(active) on public.purchasing_improvements to authenticated;
grant update(confirmed,voided) on public.purchasing_savings_purchases to authenticated;
grant all on public.purchasing_improvements,public.purchasing_savings_purchases to service_role;
create policy "admins read purchasing improvements" on public.purchasing_improvements for select to authenticated using ((select private.has_app_role(array['admin']::text[])));
create policy "admins record purchasing improvements" on public.purchasing_improvements for insert to authenticated with check (created_by=(select auth.uid()) and (select private.has_app_role(array['admin']::text[])));
create policy "admins archive own purchasing improvements" on public.purchasing_improvements for update to authenticated using (created_by=(select auth.uid()) and (select private.has_app_role(array['admin']::text[]))) with check (created_by=(select auth.uid()) and (select private.has_app_role(array['admin']::text[])));
create policy "admins read purchasing purchases" on public.purchasing_savings_purchases for select to authenticated using ((select private.has_app_role(array['admin']::text[])));
create policy "admins record purchasing purchases" on public.purchasing_savings_purchases for insert to authenticated with check (
  created_by=(select auth.uid()) and (select private.has_app_role(array['admin']::text[])) and exists (
    select 1 from public.purchasing_improvements i where i.id=improvement_id
      and i.old_package_price=purchasing_savings_purchases.old_package_price
      and i.old_package_units=purchasing_savings_purchases.old_package_units
      and i.new_package_units=purchasing_savings_purchases.new_package_units
      and i.effective_date<=purchase_date
  )
);
create policy "admins correct own purchasing purchases" on public.purchasing_savings_purchases for update to authenticated using (created_by=(select auth.uid()) and (select private.has_app_role(array['admin']::text[]))) with check (created_by=(select auth.uid()) and (select private.has_app_role(array['admin']::text[])));
