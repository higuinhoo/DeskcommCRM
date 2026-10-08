import { describe, expect, it, vi } from 'vitest';

const jev = vi.hoisted(() => ({
  configurado: vi.fn(() => true),
  avaliar: vi.fn(),
}));

vi.mock('@/lib/ai/system-one/client', () => ({
  jevConfigurado: jev.configurado,
  avaliarComJev: jev.avaliar,
}));

import { buildClassifierPrompt, parseIntentVerdict, classifyIntent } from './intent-classifier';

const members = [
  { agentId: 'a1', intentName: 'vendas', intentDescription: 'Quer comprar ou saber preço', examples: ['quanto custa'] },
  { agentId: 'a2', intentName: 'suporte', intentDescription: 'Problema técnico', examples: [] },
];
const router = { id: 'r1', name: 'R', classifierModel: 'claude-haiku-4-5',
    classifierProvider: null, sticky: true, minConfidence: 0.6, fallbackAgentId: null, members };

describe('buildClassifierPrompt', () => {
  it('lista as intenções com descrição e a opção none', () => {
    const p = buildClassifierPrompt(members, 'quanto custa o plano?');
    expect(p).toContain('vendas');
    expect(p).toContain('Quer comprar ou saber preço');
    expect(p).toContain('suporte');
    expect(p).toContain('none');
    expect(p).toContain('quanto custa o plano?');
  });
});

describe('parseIntentVerdict', () => {
  it('extrai intenção e confiança do JSON', () => {
    expect(parseIntentVerdict('{"intent":"vendas","confidence":0.9}', members)).toEqual({ intentName: 'vendas', confidence: 0.9 });
  });
  it('aceita JSON cercado de texto', () => {
    expect(parseIntentVerdict('Claro!\n{"intent":"suporte","confidence":0.7}\n', members)).toEqual({ intentName: 'suporte', confidence: 0.7 });
  });
  it('none vira intentName null', () => {
    expect(parseIntentVerdict('{"intent":"none","confidence":0.2}', members)).toEqual({ intentName: null, confidence: 0.2 });
  });
  it('intenção que não existe no router é recusada (modelo alucinou)', () => {
    expect(parseIntentVerdict('{"intent":"financeiro","confidence":0.95}', members)).toEqual({ intentName: null, confidence: 0 });
  });
  it('JSON inválido vira veredito nulo, sem throw', () => {
    expect(parseIntentVerdict('desculpe, não sei', members)).toEqual({ intentName: null, confidence: 0 });
  });
  it('confiança fora de 0..1 é clampada', () => {
    expect(parseIntentVerdict('{"intent":"vendas","confidence":7}', members).confidence).toBe(1);
  });
});

describe('classifyIntent', () => {
  it('usa Jev com purpose intent_router e nunca chama LLM', async () => {
    jev.configurado.mockReturnValue(true);
    jev.avaliar.mockResolvedValue({ answers: { intent: { choice: 'vendas', confidence: 0.88 } } });
    const runModelCall = vi.fn();
    const out = await classifyIntent({} as never, {} as never,
      { tenantId: 'o1', leadId: 'l1', jobId: 'j1', router, signal: 'quanto custa' },
      { log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as never, runModelCall } as never);
    expect(out).toEqual({ intentName: 'vendas', confidence: 0.88 });
    expect(jev.avaliar.mock.calls[0]![1]).toMatchObject({ purpose: 'intent_router', state: 'quanto custa' });
    expect(runModelCall).not.toHaveBeenCalled();
  });

  it('falha do Jev devolve null e nunca tenta LLM', async () => {
    jev.configurado.mockReturnValue(true);
    jev.avaliar.mockRejectedValue(new Error('typesafe unavailable'));
    const runModelCall = vi.fn();
    const warn = vi.fn();
    const out = await classifyIntent({} as never, {} as never,
      { tenantId: 'o1', leadId: 'l1', jobId: 'j1', router, signal: 'oi' },
      { log: { info: vi.fn(), warn, error: vi.fn() } as never, runModelCall } as never);
    expect(out).toBeNull();
    expect(warn).toHaveBeenCalled();
    expect(runModelCall).not.toHaveBeenCalled();
  });

  it('sem Jev usa o fallback determinístico do roteador', async () => {
    jev.configurado.mockReturnValue(false);
    const runModelCall = vi.fn();
    const out = await classifyIntent({} as never, {} as never,
      { tenantId: 'o1', leadId: null, jobId: null, router, signal: 'oi' },
      { log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as never, runModelCall } as never);
    expect(out).toBeNull();
    expect(runModelCall).not.toHaveBeenCalled();
  });
});
