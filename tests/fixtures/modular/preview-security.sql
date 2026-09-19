-- Smoke test: preview context na sessão de suporte
BEGIN;
INSERT INTO auth.users(id,email) VALUES ('f3130000-0000-4000-8000-000000000001','preview@smoke.test');
INSERT INTO auth.sessions(id,user_id,aal) VALUES ('f3130000-0000-4000-8000-000000000002','f3130000-0000-4000-8000-000000000001','aal1');
INSERT INTO public.organizations(id,slug,display_name,legal_name) VALUES ('f3130000-0000-4000-8000-000000000003','preview-test','Preview Test','Preview Test');
INSERT INTO public.user_organizations(organization_id,user_id,role,accepted_at) VALUES ('f3130000-0000-4000-8000-000000000003','f3130000-0000-4000-8000-000000000001','admin',now());
INSERT INTO public.platform_admins(user_id,granted_by,scope,mfa_required,reason) VALUES ('f3130000-0000-4000-8000-000000000001','f3130000-0000-4000-8000-000000000001','full',false,'Preview smoke');

-- Inicia sessão de suporte
SELECT fn_start_support(
  'f3130000-0000-4000-8000-000000000001',
  'f3130000-0000-4000-8000-000000000002',
  'f3130000-0000-4000-8000-000000000003',
  NULL, 'full', 300
);

DO $$
DECLARE
  actor uuid := 'f3130000-0000-4000-8000-000000000001';
  sess uuid := 'f3130000-0000-4000-8000-000000000002';
  ctx jsonb := '{"profile":"essential","role":"viewer","interface_mode":"simple","is_lab":false}';
  result jsonb;
BEGIN
  -- Define preview context
  result := fn_set_preview_context(actor, sess, ctx);
  IF result->>'preview_context' IS NULL AND (
    SELECT preview_context FROM platform_support_sessions
    WHERE actor_user_id=actor AND auth_session_id=sess AND ended_at IS NULL
  ) IS NULL THEN
    RAISE EXCEPTION 'preview_context not saved';
  END IF;

  -- Verifica que o constraint rejeita role inválido
  BEGIN
    UPDATE platform_support_sessions SET preview_context = '{"role":"superadmin"}'
    WHERE actor_user_id=actor AND auth_session_id=sess AND ended_at IS NULL;
    RAISE EXCEPTION 'invalid_role_accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;

  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub',actor,'session_id',sess,'aal','aal1')::text,true);
  IF fn_support_write_allowed('f3130000-0000-4000-8000-000000000003') THEN
    RAISE EXCEPTION 'preview_write_allowed';
  END IF;
  IF fn_support_callback_write_allowed('f3130000-0000-4000-8000-000000000003',actor,sess) THEN
    RAISE EXCEPTION 'preview_callback_allowed';
  END IF;
  BEGIN
    PERFORM fn_set_preview_context(actor,sess,'{"is_lab":true}');
    RAISE EXCEPTION 'lab_escalation_allowed';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
  -- Limpa preview context
  PERFORM fn_set_preview_context(actor, sess, NULL);
  IF (SELECT preview_context FROM platform_support_sessions WHERE actor_user_id=actor AND auth_session_id=sess AND ended_at IS NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'preview_context not cleared';
  END IF;

  IF fn_support_write_allowed('f3130000-0000-4000-8000-000000000003') THEN
    RAISE EXCEPTION 'clearing_preview_restored_writes';
  END IF;
  -- Sessão alheia não pode alterar preview
  BEGIN
    PERFORM fn_set_preview_context(actor, 'f3130000-0000-4000-8000-000000000099', ctx);
    RAISE EXCEPTION 'foreign_session_accepted';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL; END;
END $$;

ROLLBACK;
SELECT 'preview_context_security_verified';
