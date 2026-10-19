-- Service-only single-count save with unit/concurrency checks and retry recognition.
create or replace function public.save_inventory_accuracy_count(
  p_area_id uuid,p_item_id uuid,p_expected integer,p_actual integer,p_unit text,p_staff text
) returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_unit text; v_current integer; v_verification public.inventory_count_verifications%rowtype;
begin
  if p_expected is null or p_actual is null or p_expected<0 or p_actual<0 or p_actual>9999999 then raise exception 'INVALID_COUNT';end if;
  select unit into v_unit from public.items where id=p_item_id and is_active=true for update;
  if not found then raise exception 'ITEM_MISSING';end if;
  if v_unit is distinct from p_unit then raise exception 'COUNT_UNIT_CHANGED';end if;
  select on_hand into v_current from public.storage_inventory where item_id=p_item_id and storage_area_id=p_area_id for update;
  if not found then raise exception 'COUNT_MISSING';end if;
  -- A retry after a lost response must not overwrite newer inventory or duplicate verification.
  select * into v_verification from public.inventory_count_verifications
    where item_id=p_item_id and storage_area_id=p_area_id
    order by verified_at desc,id desc limit 1;
  if v_current=p_actual and v_verification.expected_on_hand=p_expected and v_verification.actual_on_hand=p_actual
     and v_verification.verified_by=p_staff and v_verification.verified_at>=now()-interval '15 minutes'
     and not exists(select 1 from public.storage_inventory where item_id=p_item_id and storage_area_id=p_area_id and updated_at>v_verification.verified_at) then
    return jsonb_build_object('on_hand',v_current,'verification',to_jsonb(v_verification),'replayed',true);
  end if;
  if v_current is distinct from p_expected then raise exception 'COUNT_CHANGED';end if;
  perform public.apply_verified_inventory_counts(p_area_id,jsonb_build_array(jsonb_build_object(
    'item_id',p_item_id,'expected_on_hand',p_expected,'actual_on_hand',p_actual)),p_staff);
  select * into v_verification from public.inventory_count_verifications where item_id=p_item_id and storage_area_id=p_area_id order by verified_at desc,id desc limit 1;
  return jsonb_build_object('on_hand',p_actual,'verification',to_jsonb(v_verification),'replayed',false);
end $$;
revoke all on function public.save_inventory_accuracy_count(uuid,uuid,integer,integer,text,text) from public,anon,authenticated;
grant execute on function public.save_inventory_accuracy_count(uuid,uuid,integer,integer,text,text) to service_role;
