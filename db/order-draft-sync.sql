
create table public.order_draft_accounts (
 user_id uuid primary key references auth.users(id) on delete cascade,
 entries jsonb not null default '{}'::jsonb check (jsonb_typeof(entries)='object'),
 revision bigint not null default 0,
 updated_at timestamptz not null default now()
);
create table public.order_draft_operations (
 user_id uuid not null references auth.users(id) on delete cascade,
 operation_id uuid not null,
 payload jsonb not null,
 created_at timestamptz not null default now(),
 primary key(user_id,operation_id)
);
alter table public.order_draft_accounts enable row level security;
alter table public.order_draft_operations enable row level security;
revoke all on public.order_draft_accounts, public.order_draft_operations from public, anon, authenticated;
grant select,insert,update,delete on public.order_draft_accounts, public.order_draft_operations to service_role;

create function public.sync_order_draft(p_user_id uuid,p_operations jsonb default '[]'::jsonb)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare
 doc jsonb; op jsonb; change jsonb; current_entry jsonb; next_entry jsonb;
 item_key text; kind text; inserted_count int; rev bigint; q text; n text;
begin
 if p_user_id is null or jsonb_typeof(p_operations)<>'array' or jsonb_array_length(p_operations)>100 then
  raise exception 'Invalid draft operations';
 end if;
 insert into public.order_draft_accounts(user_id) values(p_user_id) on conflict do nothing;
 select entries,revision into doc,rev from public.order_draft_accounts where user_id=p_user_id for update;
 for op in select value from jsonb_array_elements(p_operations) loop
  insert into public.order_draft_operations(user_id,operation_id,payload)
   values(p_user_id,(op->>'id')::uuid,op) on conflict do nothing;
  get diagnostics inserted_count=row_count;
  if inserted_count=0 then continue; end if;
  kind=op->>'kind';
  if kind not in ('import','patch','ack','remove') then raise exception 'Invalid operation kind'; end if;
  if jsonb_typeof(op->'changes')<>'array' or jsonb_array_length(op->'changes')>2000 then raise exception 'Invalid draft changes'; end if;
  for change in select value from jsonb_array_elements(op->'changes') loop
   item_key=change->>'item_id';
   if item_key is null or item_key !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'Invalid item ID'; end if;
   current_entry=doc->item_key;
   if kind='remove' then
    -- A send/removal may only remove the exact values that were reviewed.
    if current_entry is not null and current_entry->>'qty'=change->>'before_qty' and current_entry->>'note'=change->>'before_note' then
     doc=doc-item_key;
    elsif current_entry is not null then
     doc=jsonb_set(doc,array[item_key,'review'],'true'::jsonb);
    end if;
    continue;
   end if;
   if kind='ack' then
    if current_entry is not null and current_entry->>'qty'=change->>'before_qty' and current_entry->>'note'=change->>'before_note' then
     doc=jsonb_set(doc,array[item_key,'review'],'false'::jsonb);
    end if;
    continue;
   end if;
   -- Do not resurrect a removed entry when a stale device edits its note.
   if current_entry is null and not (change ? 'qty') then continue; end if;
   next_entry=coalesce(current_entry,jsonb_build_object('qty','','note','','review',false));
   if change ? 'qty' then
    q=change->>'qty';
    if q is null or (q<>'' and (q !~ '^[0-9]{1,9}$')) then raise exception 'Invalid draft quantity'; end if;
    if current_entry is null or current_entry->>'qty'=q then
     next_entry=jsonb_set(next_entry,'{qty}',to_jsonb(q));
    elsif kind='patch' and current_entry->>'qty'=change->>'before_qty' then
     next_entry=jsonb_set(jsonb_set(next_entry,'{qty}',to_jsonb(q)),'{review}','false'::jsonb);
    else
     -- Imports and concurrent quantity conflicts retain the larger amount, never sum.
     q=greatest(coalesce(nullif(current_entry->>'qty',''),'0')::bigint,coalesce(nullif(q,''),'0')::bigint)::text;
     next_entry=jsonb_set(jsonb_set(next_entry,'{qty}',to_jsonb(q)),'{review}','true'::jsonb);
    end if;
   end if;
   if change ? 'note' then
    n=change->>'note';
    if n is null or length(n)>10000 then raise exception 'Invalid draft note'; end if;
    if current_entry is null or current_entry->>'note'=n or (kind='patch' and current_entry->>'note'=change->>'before_note') then
     next_entry=jsonb_set(next_entry,'{note}',to_jsonb(n));
    elsif n<>'' and current_entry->>'note'='' then
     next_entry=jsonb_set(next_entry,'{note}',to_jsonb(n));
    elsif n<>'' and position(n in coalesce(current_entry->>'note',''))=0 then
     next_entry=jsonb_set(jsonb_set(next_entry,'{note}',to_jsonb((current_entry->>'note')||E'\n--- Other device note ---\n'||n)),'{review}','true'::jsonb);
    end if;
   end if;
   doc=jsonb_set(doc,array[item_key],next_entry,true);
  end loop;
  rev=rev+1;
 end loop;
 update public.order_draft_accounts set entries=doc,revision=rev,updated_at=now() where user_id=p_user_id;
 return jsonb_build_object('entries',doc,'revision',rev);
end $$;
revoke all on function public.sync_order_draft(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.sync_order_draft(uuid,jsonb) to service_role;
