BEGIN;
INSERT INTO auth.users(id,email) VALUES ('f3150000-0000-4000-8000-000000000001','assistant@smoke.test');
INSERT INTO organizations(id,slug,display_name,legal_name) VALUES ('f3150000-0000-4000-8000-000000000002','assistant-smoke','Assistant Smoke','Assistant Smoke');
INSERT INTO ai_agents(id,organization_id,name,system_prompt,kind,config,operation_mode)
VALUES ('f3150000-0000-4000-8000-000000000003','f3150000-0000-4000-8000-000000000002','Smoke','Prompt anterior','mcp_agent','{"preserved":true}','automatic');
INSERT INTO ai_agent_versions(id,organization_id,agent_id,version_number,system_prompt,provider,model,channel_session_id,assistant_config)
VALUES ('f3150000-0000-4000-8000-000000000004','f3150000-0000-4000-8000-000000000002','f3150000-0000-4000-8000-000000000003',1,'Prompt de teste','openai','test-model',null,'{"autonomy":"suggest_only"}');
DO $$ BEGIN
  BEGIN
    UPDATE ai_agent_versions SET status='published' WHERE id='f3150000-0000-4000-8000-000000000004';
    RAISE EXCEPTION 'untested_publish_allowed';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL; END;
  BEGIN
    UPDATE ai_agent_versions SET system_prompt='Modified' WHERE id='f3150000-0000-4000-8000-000000000004';
    RAISE EXCEPTION 'draft_mutation_allowed';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL; END;
  IF (SELECT operation_mode FROM ai_agents WHERE id='f3150000-0000-4000-8000-000000000003') <> 'automatic' THEN
    RAISE EXCEPTION 'draft_changed_runtime';
  END IF;
END $$;
INSERT INTO ai_agent_runs(organization_id,agent_id,agent_version_id,is_dry_run,status)
VALUES ('f3150000-0000-4000-8000-000000000002','f3150000-0000-4000-8000-000000000003','f3150000-0000-4000-8000-000000000004',true,'completed');
UPDATE ai_agent_versions SET status='published' WHERE id='f3150000-0000-4000-8000-000000000004';
UPDATE ai_agents SET published_version_id='f3150000-0000-4000-8000-000000000004' WHERE id='f3150000-0000-4000-8000-000000000003';
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM ai_agents WHERE id='f3150000-0000-4000-8000-000000000003'
    AND operation_mode='assisted' AND config->>'preserved'='true' AND config->'assistant_config'->>'autonomy'='suggest_only') THEN
    RAISE EXCEPTION 'publication_did_not_apply_configuration';
  END IF;
END $$;
ROLLBACK;
SELECT 'assistant_version_verified';
