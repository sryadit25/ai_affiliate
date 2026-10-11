-- =====================================================================
-- PR88 — SIAP TEMPEL di Supabase SQL Editor   (project ref: lbibiofoyejwwsxfbbcs)
-- Buka: https://supabase.com/dashboard/project/lbibiofoyejwwsxfbbcs/sql/new
--
-- KENAPA FILE INI ADA:
--   Hasil probe prod 11 Okt 2026 (read-only, tanpa secret):
--     * public.luma_channel_contacts  -> MISSING (PGRST205, tabel belum ada)
--     * public.luma_resolve_listing_creator_v1 -> EXISTS (PR87 sudah applied)
--     * public.luma_listing_creator_link_report_v1 -> EXISTS
--     * public.luma_safe_workspace_assignees_v1 -> EXISTS tapi versi lama
--       (label "Saya" / "PIC 01", bukan nama asli seperti "Silvia")
--   Akibat di UI: kolom No. WhatsApp kosong, Follow Up Via fallback ke daftar
--   mati, PIC bukan nama asli. Kode app (Listings.tsx) SUDAH siap — tinggal
--   apply SQL ini di prod.
--
-- CARA PAKAI (2 langkah):
--   1) Copy SELURUH isi file ini, PASTE ke SQL Editor, klik Run.
--      Kalau muncul "Success. No rows returned" -> BERHASIL.
--   2) (Opsional) Jalankan AUDIT di bagian bawah untuk lihat hasil.
--
-- KEAMANAN DATA:
--   * ADDITIVE ONLY - TIDAK menghapus apa pun, TIDAK drop tabel.
--   * TIDAK menimpa nilai lama (insert pakai NOT EXISTS, update pakai
--     COALESCE / NULL-guard).
--   * Idempotent - aman dijalankan berulang kali.
--   * Sumber migrasi repo (jangan edit file migrasi, file ini hanya konsolidasi):
--       supabase/migrations/20261004103000_pr88_followup_channel_contacts.sql
--       supabase/migrations/20261010090000_pr89_channel_contact_backfill.sql
--       supabase/migrations/20261011140000_pr88b_pic_realname_fix.sql
-- =====================================================================


-- ----------------------------------------------------------------------------
-- 1) Tabel kanal kontak (WhatsApp / IG / TikTok / dll) per creator
-- ----------------------------------------------------------------------------
create table if not exists public.luma_channel_contacts(
  id bigserial primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  creator_id bigint references public.creators(id) on delete cascade,
  channel text not null,
  phone text,
  handle text,
  url text,
  note text,
  is_primary boolean not null default false,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists luma_channel_contacts_workspace_idx
  on public.luma_channel_contacts(workspace_id, channel);
create index if not exists luma_channel_contacts_creator_idx
  on public.luma_channel_contacts(workspace_id, creator_id);
create unique index if not exists luma_channel_contacts_unique_primary_idx
  on public.luma_channel_contacts(workspace_id, creator_id, channel)
  where is_primary;

alter table public.luma_channel_contacts enable row level security;

drop policy if exists luma_channel_contacts_select on public.luma_channel_contacts;
create policy luma_channel_contacts_select on public.luma_channel_contacts
for select to authenticated using(public.luma_has_workspace(workspace_id));

drop policy if exists luma_channel_contacts_insert on public.luma_channel_contacts;
create policy luma_channel_contacts_insert on public.luma_channel_contacts
for insert to authenticated with check(public.luma_has_workspace(workspace_id));

drop policy if exists luma_channel_contacts_update on public.luma_channel_contacts;
create policy luma_channel_contacts_update on public.luma_channel_contacts
for update to authenticated
using(public.luma_has_workspace(workspace_id))
with check(public.luma_has_workspace(workspace_id));

drop policy if exists luma_channel_contacts_delete on public.luma_channel_contacts;
create policy luma_channel_contacts_delete on public.luma_channel_contacts
for delete to authenticated using(public.luma_has_workspace(workspace_id));

comment on table public.luma_channel_contacts
is 'Per-creator outreach contacts per channel (WhatsApp, IG, TikTok, dll). Powers the Follow Up Via selector.';


-- ----------------------------------------------------------------------------
-- 2) Trigger updated_at untuk kontak channel
-- ----------------------------------------------------------------------------
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

comment on function public.luma_channel_contacts_updated_at() is
'Keeps channel contact timestamps current for CRUD updates.';


-- ----------------------------------------------------------------------------
-- 3) PIC real-name fix (PR88B final) — nama profil asli, bukan "Saya"/"PIC 01"
--    Privacy-safe: hanya user_id, safe_label, is_self.
-- ----------------------------------------------------------------------------
create or replace function public.luma_safe_workspace_assignees_v1(p_workspace_id uuid)
returns table(user_id uuid,safe_label text,is_self boolean)
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not public.luma_has_workspace(p_workspace_id) and not public.luma_is_admin() then
    raise exception 'Workspace access denied' using errcode='42501';
  end if;

  return query
  select
    wm.user_id,
    coalesce(
      nullif(btrim(coalesce(p.full_name,'')),''),
      nullif(btrim(coalesce(p.nickname,'')),''),
      nullif(btrim(coalesce(p.username,'')),''),
      nullif(split_part(coalesce(p.email,''),'@',1),''),
      'Anggota Tim'
    )::text as safe_label,
    (wm.user_id=auth.uid()) as is_self
  from public.workspace_members wm
  join public.profiles p on p.id=wm.user_id
  where wm.workspace_id=p_workspace_id
    and coalesce(p.role,'staff')<>'admin'
    and coalesce(p.active,true)=true
  order by case when wm.user_id=auth.uid() then 0 else 1 end,
    coalesce(
      nullif(btrim(coalesce(p.full_name,'')),''),
      nullif(btrim(coalesce(p.nickname,'')),''),
      nullif(btrim(coalesce(p.username,'')),''),
      nullif(split_part(coalesce(p.email,''),'@',1),''),
      'Anggota Tim'
    ),
    wm.user_id;
end
$$;

revoke all on function public.luma_safe_workspace_assignees_v1(uuid) from public,anon;
grant execute on function public.luma_safe_workspace_assignees_v1(uuid) to authenticated,service_role;


-- ----------------------------------------------------------------------------
-- 4) Backfill kontak dari data creator yang sudah ada (PR89)
--    * phone -> channel WhatsApp (primary)
--    * social_links (instagram/tiktok/...) -> channel DM
--    Semua pakai NOT EXISTS -> tidak duplikat bila dijalankan ulang.
-- ----------------------------------------------------------------------------
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


-- ----------------------------------------------------------------------------
-- 5) Backfill listing yang masih kosong (product / ratecard / stage)
--    Hanya mengisi yang NULL / 0 / kosong — tidak menimpa isian manual.
-- ----------------------------------------------------------------------------
update public.listings l
set product_name=coalesce(l.product_name,p.product_name),
    sku=coalesce(l.sku,p.sku),
    product_hpp=case when coalesce(l.product_hpp,0)=0 then coalesce(p.cost_price,0) else l.product_hpp end,
    ratecard=case when coalesce(l.ratecard,0)=0 then coalesce(c.ratecard,0) else l.ratecard end,
    stage=case when nullif(btrim(l.stage),'') is null then 'Sample Sent' else l.stage end,
    updated_at=now()
from public.product_master p
left join public.creators c on c.id=l.creator_id and c.workspace_id=l.workspace_id
where l.product_master_id=p.id and p.workspace_id=l.workspace_id;

update public.listings l
set ratecard=coalesce(c.ratecard,0),updated_at=now()
from public.creators c
where l.creator_id=c.id and l.workspace_id=c.workspace_id and coalesce(l.ratecard,0)=0;

update public.listings
set stage='Sample Sent',updated_at=now()
where nullif(btrim(stage),'') is null;

-- ===== SELESAI. Harusnya muncul "Success. No rows returned". =====


-- =====================================================================
-- AUDIT setelah apply (READ-ONLY, boleh dijalankan terpisah)
-- =====================================================================
-- select count(*) as channel_contacts from public.luma_channel_contacts;
-- select channel, count(*) from public.luma_channel_contacts group by 1 order by 2 desc;
-- select count(*) as wa_with_phone from public.luma_channel_contacts
--   where lower(channel)='whatsapp' and nullif(btrim(phone),'') is not null;
