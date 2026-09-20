-- 0368: reutiliza organizations.settings. Produto é independente de memberships/papéis.
-- Não altera organizações existentes, contatos, funis, pedidos ou agentes.
create or replace function public.fn_protect_product_policy()
returns trigger language plpgsql security definer set search_path = public as $f$
begin
 if (auth.role() in ('authenticated','anon') or current_setting('role',true) in ('authenticated','anon'))
    and (new.settings->'product_platform') is distinct from (old.settings->'product_platform') then
   raise exception 'product_policy_platform_only' using errcode='42501';
 end if;
 return new;
end $f$;
revoke all on function public.fn_protect_product_policy() from public, anon, authenticated;
grant execute on function public.fn_protect_product_policy() to service_role;
drop trigger if exists protect_product_policy on public.organizations;
create trigger protect_product_policy before update of settings on public.organizations
 for each row execute function public.fn_protect_product_policy();

create or replace function public.fn_set_product_policy(p_actor uuid,p_session uuid,p_org uuid,p_expected integer,p_config jsonb)
returns jsonb language plpgsql security definer set search_path = public as $f$
declare v_settings jsonb; v_revision integer; v_config jsonb;
begin
 if not exists(select 1 from auth.sessions s join public.platform_admins a on a.user_id=s.user_id
   where s.id=p_session and s.user_id=p_actor and a.revoked_at is null and a.scope='full'
   and (s.not_after is null or s.not_after>now())
   and (not (a.mfa_required or exists(select 1 from auth.mfa_factors f where f.user_id=p_actor and f.status='verified')) or s.aal='aal2')) then
  raise exception 'product_policy_authority_required' using errcode='42501';
 end if;
 if exists(select 1 from public.platform_support_sessions where auth_session_id=p_session and ended_at is null) then
  raise exception 'preview_readonly' using errcode='42501';
 end if;
 if p_expected is null or p_expected<0 or p_config is null or jsonb_typeof(p_config)<>'object' or octet_length(p_config::text)>65536 then
  raise exception 'product_policy_invalid';
 end if;
 select settings into v_settings from public.organizations where id=p_org and status<>'redacted' for update;
 if not found then raise exception 'product_policy_organization_not_found'; end if;
 v_revision=coalesce((v_settings#>>'{product_platform,revision}')::integer,0);
 if v_revision<>p_expected then raise exception 'product_policy_revision_conflict' using errcode='40001'; end if;
 v_config=jsonb_set(p_config,'{revision}',to_jsonb(v_revision+1),true);
 update public.organizations set settings=jsonb_set(coalesce(v_settings,'{}'::jsonb),'{product_platform}',v_config,true) where id=p_org;
 return v_config;
end $f$;
revoke all on function public.fn_set_product_policy(uuid,uuid,uuid,integer,jsonb) from public, anon, authenticated;
grant execute on function public.fn_set_product_policy(uuid,uuid,uuid,integer,jsonb) to service_role;
