import { moduleDecision, moduleForPath, type CapabilityContext } from "./capabilities";
import { readProductPolicy } from "./policy";
import type { Role } from "@/lib/auth/types";
export function contextFromSettings(
  organizationId: string,
  settings: unknown,
  role: Role,
  platform: boolean,
): CapabilityContext {
  const policy = readProductPolicy(settings);
  return {
    organizationId,
    role,
    isPlatformAdmin: platform,
    plan: policy.plan,
    product: policy.product,
    planModules: policy.plan_modules,
    flags: policy.flags,
    experimentalOptIn: policy.experimental_opt_in,
  };
}
export function requestProductDecision(path: string, ctx: CapabilityContext) {
  const productModule = moduleForPath(path);
  return productModule
    ? moduleDecision(productModule, ctx)
    : { allowed: true, reason: "Área comum da organização.", source: "default" as const };
}
