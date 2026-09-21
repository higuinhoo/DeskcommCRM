"use client";

import { useAuth } from "@/hooks/auth/AuthProvider";
import { BUSINESS_TEMPLATES, type BusinessVocabulary, getTemplate } from "@/lib/templates/business-templates";

export function useBusinessVocabulary(): BusinessVocabulary & { templateId: string; templateLabel: string; templateIcon: string } {
  const { activeOrg } = useAuth();
  const settings = (activeOrg?.interface_settings as Record<string, unknown> | undefined) ||
                   (activeOrg as unknown as { settings?: Record<string, unknown> })?.settings || {};

  const templateId = (settings.business_template as string) || "vendas";
  const def = getTemplate(templateId);

  return {
    ...def.vocabulary,
    templateId: def.id,
    templateLabel: def.label,
    templateIcon: def.icon,
  };
}
