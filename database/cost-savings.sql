create table public.cost_savings (
id uuid primary key default gen_random_uuid(),
created_at timestamptz not null default now(),
created_by uuid not null default auth.uid() references auth.users(id),
event_date date not null,
item_id uuid references public.items(id),
item_name text not null check (length(btrim(item_name)) between 1 and 300),
category text not null check (category in ('Duplicate order avoided','Return credit','Lower purchase price','Transfer instead of purchase','Waste prevented','Other')),
kind text not null check (kind in ('Actual savings','Avoided cost')),
quantity numeric(12,3) not null check (quantity > 0 and quantity <= 1000000),
unit_label text not null check(length(btrim(unit_label)) between 1 and 80),
baseline_cost numeric(12,2) not null check(baseline_cost>=0),
actual_cost numeric(12,2) not null check(actual_cost>=0 and actual_cost<baseline_cost),
amount numeric generated always as (round(quantity*(baseline_cost-actual_cost),2)) stored,
action_taken text not null check(length(btrim(action_taken)) between 1 and 2000),
evidence text not null check(length(btrim(evidence)) between 1 and 2000),
credited_to text not null check(length(btrim(credited_to)) between 1 and 200),
confirmed boolean not null default false,
voided boolean not null default false
);
create index cost_savings_created_by_idx on public.cost_savings(created_by);
create index cost_savings_item_idx on public.cost_savings(item_id);
create index cost_savings_event_date_idx on public.cost_savings(event_date);
alter table public.cost_savings enable row level security;
revoke all on public.cost_savings from anon, authenticated;
grant select, insert on public.cost_savings to authenticated;
grant update(voided, confirmed) on public.cost_savings to authenticated;
grant all on public.cost_savings to service_role;
create policy "admins read savings" on public.cost_savings for select to authenticated using ((select private.has_app_role(array['admin']::text[])));
create policy "admins record own savings" on public.cost_savings for insert to authenticated with check (created_by=(select auth.uid()) and (select private.has_app_role(array['admin']::text[])));
create policy "admins void own savings" on public.cost_savings for update to authenticated using (created_by=(select auth.uid()) and (select private.has_app_role(array['admin']::text[]))) with check (created_by=(select auth.uid()) and (select private.has_app_role(array['admin']::text[])));
