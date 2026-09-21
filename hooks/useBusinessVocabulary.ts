"use client";

import { useAuth } from "@/hooks/auth/AuthProvider";
import { type BusinessVocabulary, getTemplate } from "@/lib/templates/business-templates";

export function useBusinessVocabulary(): BusinessVocabulary & {
  templateId: string;
  templateLabel: string;
  templateIcon: string;
} {
  const { activeOrg } = useAuth();
  const settings =
    (activeOrg?.interface_settings as Record<string, unknown> | undefined) ||
    (activeOrg as unknown as { settings?: Record<string, unknown> })?.settings ||
    {};

  const templateId = (settings.business_template as string) || "vendas";
  const def = getTemplate(templateId);
  const customVocab = (settings.vocabulary as Record<string, string> | undefined) || {};

  return {
    ...def.vocabulary,
    ...(customVocab.contacts_plural ? { contacts: customVocab.contacts_plural } : {}),
    ...(customVocab.lead ? { contact_singular: customVocab.lead } : {}),
    ...(customVocab.products_plural ? { products: customVocab.products_plural } : {}),
    ...(customVocab.deals_plural ? { deals: customVocab.deals_plural } : {}),
    ...(customVocab.deal ? { deal_singular: customVocab.deal } : {}),
    ...(customVocab.pipeline_name ? { pipeline_name: customVocab.pipeline_name } : {}),
    ...(customVocab.won ? { won_label: customVocab.won } : {}),
    ...(customVocab.lost ? { lost_label: customVocab.lost } : {}),
    ...(customVocab.appointment_singular ? { appointment_singular: customVocab.appointment_singular } : {}),
    ...(customVocab.appointment_plural ? { appointment_plural: customVocab.appointment_plural } : {}),
    ...(customVocab.new_appointment_button ? { new_appointment_button: customVocab.new_appointment_button } : {}),
    ...(customVocab.calendar_title ? { calendar_title: customVocab.calendar_title } : {}),
    ...(customVocab.calendar_subtitle ? { calendar_subtitle: customVocab.calendar_subtitle } : {}),
    templateId: def.id,
    templateLabel: def.label,
    templateIcon: def.icon,
  };
}
