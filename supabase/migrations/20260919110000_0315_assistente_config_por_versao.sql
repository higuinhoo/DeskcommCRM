-- Configuração guiada pertence à versão; rascunhar não altera o runtime publicado.
alter table public.ai_agent_versions add column if not exists assistant_config jsonb;

create or replace function public.fn_guard_assistant_version()
returns trigger language plpgsql set search_path=public as $f$
begin
  if old.assistant_config is not null and
     (to_jsonb(new)-array['status','published_at','superseded_at']) is distinct from
     (to_jsonb(old)-array['status','published_at','superseded_at']) then
    raise exception 'assistant_create_new_draft' using errcode='42501';
  end if;
  if new.assistant_config is not null and new.status='published' and old.status is distinct from 'published'
     and not exists(select 1 from public.ai_agent_runs r where r.organization_id=new.organization_id
       and r.agent_id=new.agent_id and r.agent_version_id=new.id and r.is_dry_run and r.status='completed') then
    raise exception 'assistant_test_required' using errcode='42501';
  end if;
  return new;
end $f$;
revoke all on function public.fn_guard_assistant_version() from public,anon,authenticated;
grant execute on function public.fn_guard_assistant_version() to service_role;
drop trigger if exists guard_assistant_version on public.ai_agent_versions;
create trigger guard_assistant_version before update on public.ai_agent_versions
for each row execute function public.fn_guard_assistant_version();

-- Junto da troca do ponteiro publicado, no MESMO commit. Pausa e nome preservados.
create or replace function public.fn_apply_assistant_config()
returns trigger language plpgsql set search_path=public as $f$
declare cfg jsonb;
begin
  if new.published_version_id is distinct from old.published_version_id then
    select assistant_config into cfg from public.ai_agent_versions
      where id=new.published_version_id and agent_id=new.id and organization_id=new.organization_id;
    if cfg is not null then
      new.config:=jsonb_set(coalesce(new.config,'{}'::jsonb),'{assistant_config}',cfg);
      new.operation_mode:=case when cfg->>'autonomy'='suggest_only' then 'assisted' else 'automatic' end;
    end if;
  end if;
  return new;
end $f$;
revoke all on function public.fn_apply_assistant_config() from public,anon,authenticated;
grant execute on function public.fn_apply_assistant_config() to service_role;
drop trigger if exists aaa_apply_assistant_config on public.ai_agents;
create trigger aaa_apply_assistant_config before update on public.ai_agents
for each row execute function public.fn_apply_assistant_config();
notify pgrst, 'reload schema';
