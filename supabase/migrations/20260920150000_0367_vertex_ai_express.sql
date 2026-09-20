-- 0367 — Google Cloud Vertex AI em modo Express
--
-- O provider `vertex` usa os mesmos modelos Gemini do provider `google`, mas
-- com autenticação, faturamento e governança da Vertex AI. São providers
-- distintos porque a chave de um endpoint não autentica o outro e porque o
-- operador precisa saber para qual serviço seus dados e custos estão indo.
--
-- O catálogo é copiado das linhas Gemini já curadas. `ai_pricing` é indexada
-- pelo model_id (não pelo provider), portanto os preços existentes continuam
-- sendo a única fonte de contabilidade e não devem ser duplicados.

insert into public.ai_models
  (provider, model_id, display_name, description, context_window,
   input_price_per_million_cents, output_price_per_million_cents,
   supports_tools, supports_vision, is_default_for_provider, released_at,
   metadata)
select
  'vertex', model_id, display_name,
  coalesce(description, '') || ' Via Google Cloud Vertex AI (modo Express).',
  context_window, input_price_per_million_cents,
  output_price_per_million_cents, supports_tools, supports_vision,
  model_id = 'gemini-3.5-flash', released_at,
  coalesce(metadata, '{}'::jsonb) || '{"authentication":"express_api_key"}'::jsonb
from public.ai_models
where provider = 'google'
  and model_id in (
    'gemini-3.5-flash',
    'gemini-3.1-pro-preview',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.5-pro'
  )
on conflict (provider, model_id) do update set
  display_name = excluded.display_name,
  description = excluded.description,
  context_window = excluded.context_window,
  input_price_per_million_cents = excluded.input_price_per_million_cents,
  output_price_per_million_cents = excluded.output_price_per_million_cents,
  supports_tools = excluded.supports_tools,
  supports_vision = excluded.supports_vision,
  released_at = excluded.released_at,
  metadata = excluded.metadata;

-- O índice de um default por provider é imediato. Limpa antes de marcar.
update public.ai_models
set is_default_for_provider = false
where provider = 'vertex' and is_default_for_provider;

update public.ai_models
set is_default_for_provider = true
where provider = 'vertex' and model_id = 'gemini-3.5-flash';
