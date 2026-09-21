-- 0373 — Adiciona Claude 3.5 Haiku ao catálogo de modelos (Anthropic e Vertex AI)
--
-- O modelo Claude 3.5 Haiku (claude-3-5-haiku e claude-3-5-haiku-20241022) é
-- otimizado para baixa latência, excelente raciocínio de contexto e tool-use preciso
-- para atendimento e agendamento.
--
-- Disponível para Anthropic (direto) e Vertex AI (Google Cloud Model Garden).

insert into public.ai_models
  (provider, model_id, display_name, description, context_window,
   input_price_per_million_cents, output_price_per_million_cents,
   supports_tools, supports_vision, is_default_for_provider)
values
  ('anthropic', 'claude-3-5-haiku', 'Claude 3.5 Haiku',
   'Ultrarrápido, excelente para atendimento, agendamento e classificação com ferramentas.',
   200000, 80, 400, true, true, false),
  ('anthropic', 'claude-3-5-haiku-20241022', 'Claude 3.5 Haiku (Snapshot)',
   'Versão fixa do Claude 3.5 Haiku.',
   200000, 80, 400, true, true, false),
  ('vertex', 'claude-3-5-haiku', 'Claude 3.5 Haiku (Vertex AI)',
   'Claude 3.5 Haiku via Google Cloud Vertex AI Model Garden.',
   200000, 80, 400, true, true, false),
  ('vertex', 'gemini-2.5-flash-lite', 'Gemini 2.5 Flash Lite',
   'Ultrarrápido e econômico no Google Cloud Vertex AI.',
   1000000, 8, 30, true, true, false)
on conflict (provider, model_id) do update set
  display_name = excluded.display_name,
  description = excluded.description,
  context_window = excluded.context_window,
  input_price_per_million_cents = excluded.input_price_per_million_cents,
  output_price_per_million_cents = excluded.output_price_per_million_cents,
  supports_tools = excluded.supports_tools,
  supports_vision = excluded.supports_vision;

insert into public.ai_pricing
  (model_id, input_price_per_million_cents, output_price_per_million_cents, notes)
values
  ('claude-3-5-haiku', 80, 400, 'Claude 3.5 Haiku oficial: $0.80 / $4.00 por MTok'),
  ('claude-3-5-haiku-20241022', 80, 400, 'Snapshot Claude 3.5 Haiku'),
  ('gemini-2.5-flash-lite', 8, 30, 'Gemini 2.5 Flash Lite oficial: $0.075 / $0.30 por MTok')
on conflict (model_id) do update set
  input_price_per_million_cents = excluded.input_price_per_million_cents,
  output_price_per_million_cents = excluded.output_price_per_million_cents,
  notes = excluded.notes;
