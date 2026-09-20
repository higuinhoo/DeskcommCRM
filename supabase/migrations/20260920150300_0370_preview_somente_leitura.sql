-- 0370: preview é somente leitura no banco, nas APIs e nos callbacks.
-- Limpar o preview mantém somente leitura: edição exige uma nova sessão explícita.
create or replace function public.fn_support_context()
returns jsonb language sql stable security definer set search_path = public as $f$
 select jsonb_build_object(
   'id', s.id,
   'organization_id', s.organization_id,
   'actor_user_id', s.actor_user_id,
   'auth_session_id', s.auth_session_id,
   'previous_organization_id', s.previous_organization_id,
   'expires_at', s.expires_at,
   'name', o.display_name,
   'locale', o.locale,
   'preview_context', s.preview_context,
   'access_mode', case
     when s.preview_context is not null or s.access_mode = 'support_readonly' or p.scope <> 'full'
     then 'support_readonly' else 'full' end,
   'status', case
     when s.expires_at <= now() then 'expired'
     when p.user_id is null or a.id is null or (a.not_after is not null and a.not_after <= now())
       or o.status <> 'active' then 'revoked'
     when (p.mfa_required or exists(select 1 from auth.mfa_factors f where f.user_id=s.actor_user_id and f.status='verified'))
       and coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' then 'revoked'
     else 'active' end)
 from public.platform_support_sessions s
 join public.organizations o on o.id=s.organization_id
 left join public.platform_admins p on p.user_id=s.actor_user_id and p.revoked_at is null
 left join auth.sessions a on a.id=s.auth_session_id and a.user_id=s.actor_user_id
 where s.actor_user_id=auth.uid()
 and s.auth_session_id=nullif(auth.jwt()->>'session_id','')::uuid and s.ended_at is null
 limit 1;
$f$;
revoke all on function public.fn_support_context() from public, anon;
grant execute on function public.fn_support_context() to authenticated, service_role;


create or replace function public.fn_set_preview_context(p_actor uuid, p_session uuid, p_preview jsonb)
returns jsonb language plpgsql security definer set search_path = public as $f$
declare v_row public.platform_support_sessions;
begin
  perform 1 from auth.sessions a join public.platform_admins p on p.user_id=a.user_id
  where a.id=p_session and a.user_id=p_actor and p.revoked_at is null
    and (a.not_after is null or a.not_after>now())
    and (not (p.mfa_required or exists(select 1 from auth.mfa_factors f where f.user_id=p_actor and f.status='verified'))
      or a.aal::text='aal2') for update of a;
  if not found then raise exception 'preview_authority_required' using errcode='42501'; end if;
  if p_preview is not null and (
    jsonb_typeof(p_preview)<>'object' or octet_length(p_preview::text)>2048
    or (p_preview - array['profile','role','interface_mode','is_lab']) <> '{}'::jsonb
    or coalesce(p_preview->>'profile','essential') not in ('essential','assistant_agenda','sales')
    or coalesce(p_preview->>'role','viewer') not in ('viewer','agent','manager','admin')
    or coalesce(p_preview->>'interface_mode','simple') not in ('simple','advanced')
    or (p_preview ? 'is_lab' and p_preview->'is_lab' is distinct from 'false'::jsonb)
  ) then raise exception 'preview_invalid' using errcode='22023'; end if;
  update public.platform_support_sessions s
    set preview_context=p_preview, access_mode='support_readonly'
    where s.actor_user_id=p_actor and s.auth_session_id=p_session
      and s.ended_at is null and s.expires_at>now()
      and exists(select 1 from public.organizations o where o.id=s.organization_id and o.status='active')
    returning s.* into v_row;
  if not found then raise exception 'preview_session_not_found' using errcode='22000'; end if;
  return to_jsonb(v_row);
end $f$;
revoke all on function public.fn_set_preview_context(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.fn_set_preview_context(uuid,uuid,jsonb) to service_role;

create or replace function public.fn_support_callback_write_allowed(p_org uuid,p_actor uuid default null,p_session uuid default null)
returns boolean language sql stable security definer set search_path=public as $f$
 select not exists(
 select 1 from platform_support_sessions s
 left join platform_admins p on p.user_id=s.actor_user_id and p.revoked_at is null
 left join auth.sessions a on a.id=s.auth_session_id and a.user_id=s.actor_user_id
 join organizations o on o.id=s.organization_id
 where s.organization_id=p_org and s.ended_at is null
 and (p_actor is null or s.actor_user_id=p_actor)
 and (p_session is null or s.auth_session_id=p_session)
 and (s.preview_context is not null or s.access_mode<>'full' or p.scope<>'full' or p.user_id is null or s.expires_at<=now()
 or a.id is null or (a.not_after is not null and a.not_after<=now()) or o.status<>'active'
 or ((p.mfa_required or exists(select 1 from auth.mfa_factors f where f.user_id=s.actor_user_id and f.status='verified')) and coalesce(a.aal::text,'aal1')<>'aal2')));
$f$;
revoke all on function public.fn_support_callback_write_allowed(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.fn_support_callback_write_allowed(uuid,uuid,uuid) to service_role;

notify pgrst, 'reload schema';
