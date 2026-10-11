-- PR88B: PIC real-name fix for luma_safe_workspace_assignees_v1
-- Fixes p.n typo (profiles has no column n) from PR88.
-- Real names: full_name to nickname to username to email prefix to Anggota Tim.
-- Never static Saya or PIC aliases. Privacy-safe: user_id, safe_label, is_self only.

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
