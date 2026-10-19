-- Atomic metadata editing from Inventory Accuracy; callable only by the server.
create or replace function public.edit_counted_item_details(
  p_item_id uuid, p_area_id uuid, p_expected jsonb, p_details jsonb,
  p_user_id uuid, p_staff text, p_confirm_units boolean default false
) returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare
  old_item public.items%rowtype;
  next_item public.items%rowtype;
  old_shelf text;
  snapshot jsonb;
  units_changed boolean;
  pricing_changed boolean;
begin
  if not exists(select 1 from public.app_user_roles where user_id=p_user_id and role='admin') then
    raise exception 'ADMIN_REQUIRED';
  end if;
  select * into old_item from public.items where id=p_item_id and is_active=true for update;
  if not found then raise exception 'ITEM_MISSING'; end if;
  select shelf into old_shelf from public.storage_inventory where item_id=p_item_id and storage_area_id=p_area_id for update;
  if not found then raise exception 'AREA_ITEM_MISSING'; end if;
  snapshot := jsonb_build_object('name',old_item.name,'reference_number',old_item.reference_number,
    'vendor',old_item.vendor,'category',old_item.category,'unit',old_item.unit,
    'par_level',old_item.par_level,'low_level',old_item.low_level,'units_per_box',old_item.units_per_box,
    'price',old_item.price,'notes',old_item.notes,'alert_note',old_item.alert_note,
    'price_updated_at',old_item.price_updated_at,'shelf',old_shelf);
  if snapshot is distinct from p_expected then raise exception 'ITEM_DETAILS_CONFLICT'; end if;
  next_item := jsonb_populate_record(old_item,p_details - 'shelf');
  units_changed := old_item.unit is distinct from next_item.unit or old_item.units_per_box is distinct from next_item.units_per_box;
  if units_changed and not p_confirm_units then raise exception 'CONFIRM_UNIT_CHANGE'; end if;
  pricing_changed := old_item.price is distinct from next_item.price or old_item.vendor is distinct from next_item.vendor or old_item.units_per_box is distinct from next_item.units_per_box;
  update public.items set name=next_item.name,reference_number=next_item.reference_number,
    vendor=next_item.vendor,category=next_item.category,unit=next_item.unit,
    par_level=next_item.par_level,low_level=next_item.low_level,units_per_box=next_item.units_per_box,
    price=next_item.price,notes=next_item.notes,alert_note=next_item.alert_note,
    price_updated_at=case when pricing_changed then now() else old_item.price_updated_at end,
    price_source=case when pricing_changed then 'Inventory Accuracy' else old_item.price_source end
  where id=p_item_id;
  update public.storage_inventory set shelf=p_details->>'shelf' where item_id=p_item_id and storage_area_id=p_area_id;
  if units_changed then
    -- Counts keep their numeric values; every area needs a fresh physical check.
    update public.storage_inventory set updated_at=clock_timestamp() where item_id=p_item_id;
  end if;
  if pricing_changed then
    insert into public.item_price_history(item_id,previous_price,new_price,previous_units_per_box,new_units_per_box,
      previous_vendor,new_vendor,source,changed_by,changed_by_name)
    values(p_item_id,old_item.price,next_item.price,old_item.units_per_box,next_item.units_per_box,
      old_item.vendor,next_item.vendor,'Inventory Accuracy',p_user_id,p_staff);
  end if;
  return jsonb_build_object('ok',true,'units_changed',units_changed);
end $$;
revoke all on function public.edit_counted_item_details(uuid,uuid,jsonb,jsonb,uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.edit_counted_item_details(uuid,uuid,jsonb,jsonb,uuid,text,boolean) to service_role;
