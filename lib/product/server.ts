import { applyPreview } from "@/lib/impersonate/preview";
import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActiveOrg, AuthUser } from "@/lib/auth/types";
import { env } from "@/lib/env";
import { productPolicySchema, readProductPolicy } from "./policy";
import type { CapabilityContext } from "./capabilities";

/** Escopo deve vir de membership, sessão de suporte ou token já autenticados. */
export const loadProductPolicy = cache(async (organizationId: string) => {
  if (!env.PRODUCT_PROFILES_ENABLED) return productPolicySchema.parse({});
  const { data, error } = await createAdminClient()
    .from("organizations")
    .select("settings")
    .eq("id", organizationId)
    .maybeSingle();
  if (error || !data) throw new Error("product_configuration_unavailable");
  return readProductPolicy(data.settings);
});
export async function productContext(org: ActiveOrg, user: AuthUser): Promise<CapabilityContext> {
  const policy = await loadProductPolicy(org.orgId);
  return applyPreview({
    organizationId: org.orgId,
    role: org.role,
    isPlatformAdmin: user.is_platform_admin,
    plan: policy.plan,
    planModules: policy.plan_modules,
    product: policy.product,
    flags: policy.flags,
    experimentalOptIn: policy.experimental_opt_in,
  }, user.support?.organization_id === org.orgId ? user.support.preview_context : null);
}
