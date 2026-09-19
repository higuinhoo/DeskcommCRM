import { z } from "zod";
import { MODULES, PROFILES, moduleDecision, type CapabilityContext } from "@/lib/product/capabilities";
import { roleAtLeast, type Role } from "@/lib/auth/types";

/** Contexto validado da sessão de suporte. Nunca é consumido por workers. */
export const previewContextSchema = z.object({
  profile: z.enum(PROFILES).nullable().default(null),
  role: z.enum(["viewer", "agent", "manager", "admin"] as const satisfies readonly Role[]).nullable().default(null),
  interface_mode: z.enum(["simple", "advanced"]).nullable().default(null),
  // Laboratório exige isolamento próprio; não é liberado por um booleano do cliente.
  is_lab: z.literal(false).default(false),
}).strict();
export type PreviewContext = z.infer<typeof previewContextSchema>;

/** Interseção com a política real: simulação jamais libera módulo indisponível. */
export function applyPreview(context: CapabilityContext, preview: PreviewContext | null | undefined): CapabilityContext {
  if (!preview) return context;
  const simulated: CapabilityContext = {
    ...context,
    isPlatformAdmin: false,
    role: preview.role && roleAtLeast(context.role, preview.role) ? preview.role : context.role,
    product: {
      ...context.product,
      enabled: true,
      profile: preview.profile ?? context.product.profile,
      interface_mode: preview.interface_mode ?? context.product.interface_mode,
      modules: {},
    },
  };
  return {
    ...simulated,
    product: {
      ...simulated.product,
      modules: Object.fromEntries(MODULES.map((key) => [key,
        moduleDecision(key, context).allowed && moduleDecision(key, simulated).allowed,
      ])),
    },
  };
}
