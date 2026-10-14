-- Kaya can read the ordering queue. Updates are performed only through the
-- validated /api/orders/mark-ordered endpoint; her restricted role is retained.
alter policy "registered app users read order requests"
on public.order_requests
using ((select private.has_app_role(array['admin','staff','preop','kaya']::text[])));
