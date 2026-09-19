-- Usa o mesmo JWT validado disponível no Supabase e no baseline de testes.
create or replace function public.fn_protect_product_policy()
returns trigger language plpgsql security definer set search_path = public as $f$
begin
 if (auth.jwt()->>'role' in ('authenticated','anon') or current_setting('role',true) in ('authenticated','anon'))
    and (new.settings->'product_platform') is distinct from (old.settings->'product_platform') then
   raise exception 'product_policy_platform_only' using errcode='42501';
 end if;
 return new;
end $f$;
revoke all on function public.fn_protect_product_policy() from public, anon, authenticated;
grant execute on function public.fn_protect_product_policy() to service_role;
