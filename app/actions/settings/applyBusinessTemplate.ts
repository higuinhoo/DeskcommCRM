"use server";

import { revalidatePath } from "next/cache";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { BUSINESS_TEMPLATES } from "@/lib/templates/business-templates";
import { getRequestPool } from "@/lib/agent-engine/db/request-pool";
import { saveAssistantDraft } from "@/lib/assistant/save-draft";
import { assistantConfigSchema } from "@/lib/assistant/config-schema";

export interface ApplyTemplateResult {
  ok: boolean;
  error?: string;
  templateId?: string;
}

export async function applyBusinessTemplate(
  templateId: string,
  options?: { applyToAssistant?: boolean },
): Promise<ApplyTemplateResult> {
  try {
    const user = await requireAuth();
    const activeOrg = await resolveActiveOrg(user);
    if (!activeOrg) return { ok: false, error: "Organização não encontrada" };

    const template = BUSINESS_TEMPLATES[templateId as keyof typeof BUSINESS_TEMPLATES];
    if (!template) return { ok: false, error: "Template não encontrado" };

    const supabase = await createClient();

    // 1. Atualiza as configurações da organização no banco
    const { data: org, error: fetchErr } = await supabase
      .from("organizations")
      .select("settings")
      .eq("id", activeOrg.orgId)
      .single();

    if (fetchErr || !org) return { ok: false, error: "Erro ao carregar organização" };

    const currentSettings = (org.settings as Record<string, unknown>) || {};
    const updatedSettings = {
      ...currentSettings,
      business_template: templateId,
      vocabulary: {
        lead: template.vocabulary.contact_singular.toLowerCase(),
        deal: template.vocabulary.deal_singular.toLowerCase(),
        won: template.vocabulary.won_label.toLowerCase(),
        lost: template.vocabulary.lost_label.toLowerCase(),
        contacts_plural: template.vocabulary.contacts,
        products_plural: template.vocabulary.products,
        deals_plural: template.vocabulary.deals,
        pipeline_name: template.vocabulary.pipeline_name,
        appointment_singular: template.vocabulary.appointment_singular,
        appointment_plural: template.vocabulary.appointment_plural,
        new_appointment_button: template.vocabulary.new_appointment_button,
        calendar_title: template.vocabulary.calendar_title,
        calendar_subtitle: template.vocabulary.calendar_subtitle,
      },
    };

    const { error: updateErr } = await supabase
      .from("organizations")
      .update({ settings: updatedSettings })
      .eq("id", activeOrg.orgId);

    if (updateErr) return { ok: false, error: updateErr.message };

    // 2. Se solicitado, atualiza o assistente padrão da organização com as configurações do template
    if (options?.applyToAssistant !== false) {
      const { data: agent } = await supabase
        .from("ai_agents")
        .select("id, config")
        .eq("organization_id", activeOrg.orgId)
        .eq("is_default", true)
        .is("archived_at", null)
        .maybeSingle();

      if (agent) {
        const pool = getRequestPool();
        const existingConfig = (agent.config as Record<string, unknown> | null)?.assistant_config ?? {};
        const mergedConfig = assistantConfigSchema.parse({
          ...existingConfig,
          assistant_name: template.assistant.name,
          presentation: template.assistant.presentation,
          objective: template.assistant.objective,
          tone: template.assistant.tone,
          formality: template.assistant.formality,
          use_emojis: template.assistant.use_emojis,
          can_schedule: template.assistant.can_schedule,
          service_items: template.defaultServices,
          services: "",
          faq: template.assistant.faq,
          knowledge_notes: template.assistant.knowledge_notes,
          forbidden_topics: template.assistant.forbidden_topics,
          escalation_triggers: template.assistant.escalation_triggers,
          template_id: templateId,
        });

        await saveAssistantDraft(pool, activeOrg.orgId, user.id, agent.id, mergedConfig);
      }
    }

    // 3. Atualiza/Cria os tipos de agendamento na agenda correspondentes ao segmento
    if (template.defaultEventTypes && template.defaultEventTypes.length > 0) {
      for (let i = 0; i < template.defaultEventTypes.length; i++) {
        const et = template.defaultEventTypes[i]!;
        await supabase
          .from("calendar_event_types")
          .upsert(
            {
              organization_id: activeOrg.orgId,
              name: et.name,
              slug: `${templateId}-${et.slug}`,
              category: et.category,
              duration_minutes: et.duration_minutes,
              description: et.description,
              position: (i + 1) * 1000,
              is_active: true,
              location_kind: "in_person",
            },
            { onConflict: "organization_id, slug" },
          );
      }
    }

    revalidatePath("/app/assistant");
    revalidatePath("/app/settings");
    revalidatePath("/app/settings/template");
    revalidatePath("/app/settings/tenant/agenda");
    revalidatePath("/app/agenda");
    revalidatePath("/app/contacts");
    revalidatePath("/app/products");
    revalidatePath("/app/kanban");

    return { ok: true, templateId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}
