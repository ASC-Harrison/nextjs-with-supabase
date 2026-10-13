-- Order-specific snapshots; old orders remain unknown rather than being repriced today.
alter table public.order_requests
  add column requested_unit_price numeric(14,4) check(requested_unit_price>0),
  add column requested_price_basis text,
  add column ordered_unit_price numeric(14,4) check(ordered_unit_price>0),
  add column invoice_unit_price numeric(14,4) check(invoice_unit_price>0),
  add column received_spend numeric(16,2) not null default 0,
  add column received_unpriced_qty integer not null default 0,
  add column received_estimated_qty integer not null default 0,
  add column requested_total numeric generated always as (round(qty_requested*requested_unit_price,2)) stored,
  add column ordered_total numeric generated always as (round(coalesce(qty_actual_ordered,qty_requested)*ordered_unit_price,2)) stored;

create function public.snapshot_order_spending() returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_price numeric; v_size integer; v_delta integer; v_unit_price numeric;
begin
  if TG_OP='INSERT' then
    select price,units_per_box into v_price,v_size from public.items where id=new.item_id;
    new.requested_unit_price:=case when v_price>0 then
      case when lower(btrim(coalesce(new.unit,''))) in ('box','boxes','bx','case','cases','package','packages','pack','packs') then v_price
           when v_size>0 then v_price/v_size else v_price end else null end;
    new.requested_price_basis:=case when not coalesce(v_price>0,false) then 'Cost unknown: no positive saved price'
      when v_size is null or v_size<=0 then 'Saved-price estimate; package basis needs confirmation'
      else 'Saved-price estimate using recorded package size' end;
    new.received_spend:=0;new.received_unpriced_qty:=coalesce(new.qty_actual_received,0);new.received_estimated_qty:=0;
  else
    -- Preserve the request snapshot even if current item prices change.
    new.requested_unit_price:=old.requested_unit_price;new.requested_price_basis:=old.requested_price_basis;
    new.received_spend:=old.received_spend;new.received_unpriced_qty:=old.received_unpriced_qty;new.received_estimated_qty:=old.received_estimated_qty;
    v_delta:=coalesce(new.qty_actual_received,0)-coalesce(old.qty_actual_received,0);
    if v_delta>0 then
      v_unit_price:=coalesce(new.invoice_unit_price,new.ordered_unit_price);
      if v_unit_price is null then new.received_unpriced_qty:=old.received_unpriced_qty+v_delta;
      else
        new.received_spend:=old.received_spend+round(v_delta*v_unit_price,2);
        if new.invoice_unit_price is null then new.received_estimated_qty:=old.received_estimated_qty+v_delta;end if;
      end if;
    elsif v_delta<0 then
      raise exception 'Received quantity cannot decrease; use a documented correction';
    end if;
  end if;
  return new;
end $$;
revoke execute on function public.snapshot_order_spending() from public,anon,authenticated;
-- Existing received quantities have no historical price snapshot.
update public.order_requests set received_unpriced_qty=coalesce(qty_actual_received,0);
create trigger order_spending_snapshot before insert or update on public.order_requests for each row execute function public.snapshot_order_spending();

-- Set the invoice basis in the same atomic inventory receipt update.
do $$ declare v_definition text;begin
  select pg_get_functiondef(oid) into v_definition from pg_proc where pronamespace='public'::regnamespace and proname='receive_order_with_pricing';
  if position('set status=v_status,' in v_definition)=0 then raise exception 'Receipt function changed; inspect before updating';end if;
  v_definition:=replace(v_definition,'set status=v_status,','set invoice_unit_price=case when v_price>0 then v_price / greatest(coalesce(p_units_per_package,1),1) else null end, status=v_status,');
  execute v_definition;
end $$;
