import { z } from "zod";
import { notFound } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { readProductPolicy } from "@/lib/product/policy";
import { resolveCapabilities } from "@/lib/product/capabilities";
import { contextFromSettings } from "@/lib/product/request";
import { env } from "@/lib/env";
import { ProductPolicyEditor } from "./policy-editor";
export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePlatformAdmin();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const { data, error } = await createAdminClient()
    .from("organizations")
    .select("settings")
    .eq("id", id)
    .maybeSingle();
  if (error)
    return (
      <p role="alert">
        Não foi possível consultar a configuração. Recarregue para tentar novamente.
      </p>
    );
  if (!data) notFound();
  const policy = readProductPolicy(data.settings);
  return (
    <ProductPolicyEditor
      key={id}
      organizationId={id}
      initialPolicy={policy}
      initialDecisions={resolveCapabilities(contextFromSettings(id, data.settings, "admin", false))}
      globalEnabled={env.PRODUCT_PROFILES_ENABLED}
    />
  );
}
