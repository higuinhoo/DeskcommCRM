import { describe, expect, it } from "vitest";
import { sql } from "./gov-helpers";
const actor = "f3120000-0000-4000-8000-000000000001",
  session = "f3120000-0000-4000-8000-000000000002",
  org = "f3120000-0000-4000-8000-000000000003";
const seed = `begin;
insert into auth.users(id,email) values('${actor}','product@invariant.test');
insert into auth.sessions(id,user_id,aal) values('${session}','${actor}','aal1');
insert into organizations(id,slug,display_name,legal_name,settings) values('${org}','product-test','Product','Product','{"unrelated":{"preserved":true}}');
insert into user_organizations(organization_id,user_id,role,accepted_at) values('${org}','${actor}','admin',now());
insert into platform_admins(user_id,granted_by,scope,mfa_required,reason) values('${actor}','${actor}','full',false,'Invariant');`;
const config = `'{"product":{"enabled":true,"profile":"essential"},"plan":"test"}'::jsonb`;
const write = `select fn_set_product_policy('${actor}','${session}','${org}',0,${config});`;
function prove(body: string) {
  expect(sql(`${seed}\n${body}\nrollback;select 'proved';`)).toContain("proved");
}
describe("política de produto persistente", () => {
  it("salva sem alterar papel, dados ou outras configurações", () =>
    prove(`${write}
 do $$ begin
 if (select settings#>>'{product_platform,revision}' from organizations where id='${org}')<>'1' then raise exception 'revision missing';end if;
 if (select settings#>>'{unrelated,preserved}' from organizations where id='${org}')<>'true' then raise exception 'unrelated settings overwritten';end if;
 if (select role from user_organizations where organization_id='${org}' and user_id='${actor}')<>'admin' then raise exception 'role changed';end if;
 end $$;`));
  it("recusa revisão antiga sem sobrescrever", () =>
    prove(`${write}
 do $$ begin begin perform fn_set_product_policy('${actor}','${session}','${org}',0,${config});raise exception 'stale write accepted';exception when serialization_failure then null;end;end $$;`));
  it("organização não altera plano diretamente mesmo com ator de plataforma", () =>
    prove(`
 select set_config('request.jwt.claims','{"sub":"${actor}","role":"authenticated","session_id":"${session}"}',true);
 set local role authenticated;
 do $$ begin begin update organizations set settings=jsonb_set(settings,'{product_platform}',${config}) where id='${org}';raise exception 'direct escalation';exception when insufficient_privilege then null;end;end $$;`));
  it("ator sem autorização persistente não configura produto", () =>
    prove(`delete from platform_admins where user_id='${actor}';
 do $$ begin begin perform fn_set_product_policy('${actor}','${session}','${org}',0,${config});raise exception 'missing authorization';exception when insufficient_privilege then null;end;end $$;`));
  it("sessão alheia não concede autoridade", () =>
    prove(`
 do $$ begin begin perform fn_set_product_policy('${actor}','f3120000-0000-4000-8000-000000000099','${org}',0,${config});raise exception 'foreign session accepted';exception when insufficient_privilege then null;end;end $$;`));
  it("preview e suporte não alteram perfil persistido", () =>
    prove(`select fn_start_support('${actor}','${session}','${org}',null,'support_readonly',300);
 do $$ begin begin perform fn_set_product_policy('${actor}','${session}','${org}',0,${config});raise exception 'preview mutation';exception when insufficient_privilege then null;end;end $$;`));
});
