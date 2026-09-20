-- 0369: preview context na sessão de suporte
-- Adiciona preview_context JSONB à platform_support_sessions para que o
-- platform_admin possa simular perfil, papel e interface sem alterar a configuração
-- persistida da organização. O banco é a única fonte de autoridade do preview;
-- o cookie de impersonação existente (HMAC, HttpOnly) continua sendo o portador.
--
-- Campos do preview_context:
--   profile: "essential" | "assistant_agenda" | "sales"   (perfil de produto simulado)
--   role: "viewer" | "agent" | "manager" | "admin"         (papel simulado)
--   interface_mode: "simple" | "advanced"                  (complexidade visual simulada)
--   is_lab: boolean                                         (true = organização de lab/demo)
--   lab_org_id: uuid | null                                 (ID da org de lab, se is_lab)
--
-- O preview_context nunca concede acesso a dados de outra organização.
-- Workers, automações e tarefas em background ignoram completamente o preview.

alter table public.platform_support_sessions
  add column if not exists preview_context jsonb;

-- Valida o preview_context quando presente: só chaves conhecidas e valores válidos.
alter table public.platform_support_sessions
  drop constraint if exists platform_support_sessions_preview_context_valid;

alter table public.platform_support_sessions
  add constraint platform_support_sessions_preview_context_valid
  check (
    preview_context is null
    or (
      jsonb_typeof(preview_context) = 'object'
      and octet_length(preview_context::text) <= 2048
      and (preview_context->>'profile' is null or preview_context->>'profile' in ('essential','assistant_agenda','sales'))
      and (preview_context->>'role' is null or preview_context->>'role' in ('viewer','agent','manager','admin'))
      and (preview_context->>'interface_mode' is null or preview_context->>'interface_mode' in ('simple','advanced'))
    )
  );

-- Atualiza fn_support_context para expor o preview_context na resposta JSON.
-- Nenhum outro campo é alterado; callers existentes recebem o campo adicional
-- e continuam funcionando (extensão aditiva).
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
     when s.access_mode = 'support_readonly' or p.scope <> 'full'
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

-- fn_set_preview_context: atualiza o preview_context da sessão ativa.
-- Só o ator da sessão pode alterar seu próprio preview; service_role apenas.
create or replace function public.fn_set_preview_context(
  p_actor uuid,
  p_session uuid,
  p_preview jsonb
) returns jsonb language plpgsql security definer set search_path = public as $f$
declare v_row public.platform_support_sessions;
begin
  -- Valida que o ator possui a sessão ativa e que a sessão não expirou.
  update public.platform_support_sessions
    set preview_context = p_preview
    where actor_user_id = p_actor
      and auth_session_id = p_session
      and ended_at is null
      and expires_at > now()
    returning * into v_row;
  if not found then
    raise exception 'preview_session_not_found' using errcode = '22000';
  end if;
  return to_jsonb(v_row);
end $f$;
revoke all on function public.fn_set_preview_context(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.fn_set_preview_context(uuid, uuid, jsonb) to service_role;
