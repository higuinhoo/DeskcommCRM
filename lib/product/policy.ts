import { z } from "zod";
import { MODULES, flagSchema, productSchema } from "./capabilities";
/** Guardado em organizations.settings.product_platform; escrita só da plataforma. */
export const productPolicySchema = z
  .object({
    revision: z.number().int().nonnegative().default(0),
    plan: z.string().trim().min(1).max(80).default("self_hosted"),
    plan_modules: z.array(z.enum(MODULES)).default([...MODULES]),
    product: productSchema.default(() => productSchema.parse({})),
    flags: z.array(flagSchema).max(100).default([]),
    experimental_opt_in: z.boolean().default(false),
  })
  .strict();
export type ProductPolicy = z.infer<typeof productPolicySchema>;
export function readProductPolicy(settings: unknown): ProductPolicy {
  if (!settings || typeof settings !== "object" || !("product_platform" in settings))
    return productPolicySchema.parse({});
  // Configuração explícita inválida não concede recursos por fallback silencioso.
  return productPolicySchema.parse((settings as Record<string, unknown>).product_platform);
}
