-- PR89: make channel contacts usable for existing creator data.

create or replace function public.luma_channel_contacts_updated_at()
returns trigger
language plpgsql
set search_path=public,pg_temp
as $$
begin
  new.updated_at=now();
  return new;
end
$$;

drop trigger if exists trg_luma_channel_contacts_updated_at on public.luma_channel_contacts;
create trigger trg_luma_channel_contacts_updated_at
before update on public.luma_channel_contacts
for each row execute function public.luma_channel_contacts_updated_at();

insert into public.luma_channel_contacts(workspace_id,creator_id,channel,phone,is_primary,created_at,updated_at)
select c.workspace_id,c.id,'WhatsApp',nullif(btrim(c.phone),''),true,now(),now()
from public.creators c
where nullif(btrim(c.phone),'') is not null
  and not exists(
    select 1 from public.luma_channel_contacts existing
    where existing.workspace_id=c.workspace_id
      and existing.creator_id=c.id
      and lower(existing.channel)='whatsapp'
  );

insert into public.luma_channel_contacts(workspace_id,creator_id,channel,handle,url,is_primary,created_at,updated_at)
select c.workspace_id,c.id,
  case lower(pair.key)
    when 'instagram' then 'DM Instagram'
    when 'tiktok' then 'DM TikTok'
    else initcap(pair.key)
  end,
  case when pair.value like '@%' then pair.value else null end,
  case when pair.value like 'http://%' or pair.value like 'https://%' then pair.value else null end,
  true,now(),now()
from public.creators c
cross join lateral jsonb_each_text(coalesce(c.social_links,'{}'::jsonb)) pair
where nullif(btrim(pair.value),'') is not null
  and not exists(
    select 1 from public.luma_channel_contacts existing
    where existing.workspace_id=c.workspace_id
      and existing.creator_id=c.id
      and lower(existing.channel)=lower(case lower(pair.key) when 'instagram' then 'DM Instagram' when 'tiktok' then 'DM TikTok' else initcap(pair.key) end)
  );

update public.listings l
set product_name=coalesce(l.product_name,p.product_name),
    sku=coalesce(l.sku,p.sku),
    product_hpp=case when coalesce(l.product_hpp,0)=0 then coalesce(p.cost_price,0) else l.product_hpp end,
    stage=case when nullif(btrim(l.stage),'') is null then 'Sample Sent' else l.stage end,
    updated_at=now()
from public.product_master p
where l.product_master_id=p.id and p.workspace_id=l.workspace_id;

update public.listings l
set ratecard=coalesce(c.ratecard,0),updated_at=now()
from public.creators c
where l.creator_id=c.id and l.workspace_id=c.workspace_id and coalesce(l.ratecard,0)=0;

update public.listings
set stage='Sample Sent',updated_at=now()
where nullif(btrim(stage),'') is null;

comment on function public.luma_channel_contacts_updated_at() is
'Keeps channel contact timestamps current for CRUD updates.';
