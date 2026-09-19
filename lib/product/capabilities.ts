/** Política única de produto. Não substitui autenticação, MFA, RLS ou RBAC.
 * Entradas são resolvidas pelo servidor; workers nunca recebem preview. */
import { z } from "zod";
import { roleAtLeast, type Role } from "@/lib/auth/types";

export const MODULES = [
  "inbox",
  "ai_assistant",
  "knowledge",
  "calendar",
  "sales",
  "reports",
  "automations",
  "integrations",
] as const;
export type Module = (typeof MODULES)[number];
export const PROFILES = ["essential", "assistant_agenda", "sales"] as const;
export type ProductProfile = (typeof PROFILES)[number];
export const productSchema = z
  .object({
    enabled: z.boolean().default(false),
    profile: z.enum(PROFILES).default("sales"),
    interface_mode: z.enum(["simple", "advanced"]).default("advanced"),
    modules: z.partialRecord(z.enum(MODULES), z.boolean()).default({}),
    vocabulary: z.enum(["neutral", "commercial", "custom"]).default("commercial"),
    custom_vocabulary: z.record(z.string().max(40), z.string().trim().min(1).max(80)).default({}),
  })
  .strict();
export type ProductConfiguration = z.infer<typeof productSchema>;
export const flagSchema = z
  .object({
    key: z.string().min(1).max(100),
    enabled: z.boolean(),
    plans: z.array(z.string()).optional(),
    profiles: z.array(z.enum(PROFILES)).optional(),
    organizations: z.array(z.string().uuid()).optional(),
    platform_only: z.boolean().default(false),
    percentage: z.number().min(0).max(100).default(100),
    experimental: z.boolean().default(false),
  })
  .strict();
export type FeatureFlag = z.infer<typeof flagSchema>;
export type Decision = {
  allowed: boolean;
  reason: string;
  source: "default" | "profile" | "plan" | "organization" | "role" | "flag" | "override";
};
export type CapabilityContext = {
  organizationId: string;
  role: Role;
  isPlatformAdmin: boolean;
  plan: string;
  product: ProductConfiguration;
  planModules?: readonly Module[];
  flags?: readonly FeatureFlag[];
  experimentalOptIn?: boolean;
  /** Só restrições; não concede plano, papel, nem ignora bloqueio persistente. */
  override?: { expiresAt: number; modules: Partial<Record<Module, boolean>> };
  now?: number;
};
const PROFILE_MODULES: Record<ProductProfile, readonly Module[]> = {
  essential: ["inbox"],
  assistant_agenda: ["inbox", "ai_assistant", "knowledge", "calendar"],
  sales: MODULES,
};
/** Distribuição estável, independente da ordem das organizações e do processo. */
export function rolloutBucket(organizationId: string, key: string): number {
  let hash = 2166136261;
  for (const c of `${key}:${organizationId}`) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
  return ((hash >>> 0) % 10000) / 100;
}
export function featureDecision(flag: FeatureFlag, ctx: CapabilityContext): Decision {
  const allowed =
    flag.enabled &&
    (!flag.platform_only || ctx.isPlatformAdmin) &&
    (!flag.plans || flag.plans.includes(ctx.plan)) &&
    (!flag.profiles || flag.profiles.includes(ctx.product.profile)) &&
    (!flag.organizations || flag.organizations.includes(ctx.organizationId)) &&
    (!flag.experimental || ctx.experimentalOptIn === true) &&
    rolloutBucket(ctx.organizationId, flag.key) < flag.percentage;
  return {
    allowed,
    source: "flag",
    reason: allowed
      ? "Funcionalidade liberada para esta organização."
      : "Funcionalidade fora das regras de liberação.",
  };
}
export function moduleDecision(module: Module, ctx: CapabilityContext): Decision {
  if (!ctx.product.enabled)
    return {
      allowed: true,
      source: "default",
      reason: "Experiência existente preservada; liberação modular desligada.",
    };
  if (ctx.planModules && !ctx.planModules.includes(module))
    return { allowed: false, source: "plan", reason: "O plano não inclui este módulo." };
  if (ctx.product.modules[module] === false)
    return {
      allowed: false,
      source: "organization",
      reason: "Módulo desativado na organização; dados preservados.",
    };
  const enabled =
    ctx.product.modules[module] ?? PROFILE_MODULES[ctx.product.profile].includes(module);
  if (!enabled)
    return {
      allowed: false,
      source: "profile",
      reason: "Módulo não incluído no perfil de produto.",
    };
  const flag = ctx.flags?.find((f) => f.key === `module.${module}`);
  if (flag) {
    const d = featureDecision(flag, ctx);
    if (!d.allowed) return d;
  }
  if (
    ctx.override &&
    ctx.override.expiresAt > (ctx.now ?? Date.now()) &&
    ctx.override.modules[module] === false
  )
    return { allowed: false, source: "override", reason: "Restrição administrativa temporária." };
  return {
    allowed: true,
    source: ctx.product.modules[module] === true ? "organization" : "profile",
    reason: "Módulo disponível.",
  };
}
export function operationDecision(module: Module, minRole: Role, ctx: CapabilityContext): Decision {
  const product = moduleDecision(module, ctx);
  if (!product.allowed) return product;
  if (!roleAtLeast(ctx.role, minRole))
    return { allowed: false, source: "role", reason: "Seu papel não permite esta operação." };
  return product;
}
export function resolveCapabilities(ctx: CapabilityContext): Record<Module, Decision> {
  return Object.fromEntries(MODULES.map((m) => [m, moduleDecision(m, ctx)])) as Record<
    Module,
    Decision
  >;
}
/** Uma mesma classificação para páginas, APIs e consumidores de navegação. */
export function moduleForPath(path: string): Module | null {
  const p = path.split("?")[0] ?? path;
  // Contatos são núcleo do atendimento; a página comercial é uma projeção.
  if (p === "/api/v1/contacts" || p.startsWith("/api/v1/contacts/")) return "inbox";
  const normalized = p.replace(/^\/api\/v1\//, "/app/");
  const prefixes: Array<[Module, readonly string[]]> = [
    [
      "calendar",
      ["/app/agenda", "/app/appointments", "/app/appointment-types", "/app/settings/tenant/agenda"],
    ],
    ["knowledge", ["/app/ai/knowledge"]],
    ["automations", ["/app/ai/followups", "/app/ai/followup-flows", "/app/automations"]],
    ["reports", ["/app/metrics", "/app/activities", "/app/ads", "/app/analise"]],
    [
      "sales",
      [
        "/app/crm",
        "/app/kanban",
        "/app/leads",
        "/app/pipelines",
        "/app/contacts",
        "/app/companies",
        "/app/products",
        "/app/orders",
        "/app/tasks",
        "/app/integrations/nuvemshop",
        "/app/radar",
      ],
    ],
    ["ai_assistant", ["/app/assistant", "/app/ai"]],
    ["inbox", ["/app/inbox", "/app/conversations", "/app/messages"]],
    ["integrations", ["/app/webhooks", "/app/extensions"]],
  ];
  return (
    prefixes.find(([, paths]) =>
      paths.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`)),
    )?.[0] ?? null
  );
}

const RESOURCE_MODULES: Partial<Record<Module, readonly string[]>> = {
  sales: [
    "crm_leads",
    "crm_pipelines",
    "crm_stages",
    "crm_tasks",
    "pipelines",
    "pipeline_agent_mapping",
    "catalog_products",
    "orders",
    "lead_captures",
    "leads_at_risk",
  ],
  calendar: ["agenda", "calendar_connections", "calendar_event_types", "attendant_availability"],
  knowledge: ["ai_knowledge", "org_memory"],
  ai_assistant: [
    "ai_agents",
    "ai_credentials",
    "ai_providers",
    "ai_routers",
    "ai_runs",
    "ai_skills",
    "ai_guardrail_layers",
    "agent_cases",
    "agent_inbox_items",
    "flywheel_proposals",
  ],
  reports: [
    "metrics",
    "reports",
    "ads_insights",
    "ad_platform_connections",
    "ai_usage",
    "ai_budget",
    "ai_evolution",
    "ai_operator_metrics",
  ],
  automations: [
    "automation_rules",
    "followup_enrollments",
    "followup_flows",
    "followup_promises",
    "followup_queue",
  ],
  integrations: [
    "webhook_sources",
    "extension_installations",
    "extension_operations",
    "organization_extensions",
  ],
  inbox: [
    "contact",
    "contacts",
    "conversations",
    "messages",
    "conversation_media",
    "conversation_notes",
    "demandas",
  ],
};
export function moduleForResource(resource: string | undefined): Module | null {
  return MODULES.find((m) => resource && RESOURCE_MODULES[m]?.includes(resource)) ?? null;
}
