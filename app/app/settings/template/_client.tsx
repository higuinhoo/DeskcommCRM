"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BUSINESS_TEMPLATES, getTemplate, type BusinessTemplateDef } from "@/lib/templates/business-templates";
import { applyBusinessTemplate } from "@/app/actions/settings/applyBusinessTemplate";

interface Props {
  currentTemplateId: string;
}

export function TemplateSelectorClient({ currentTemplateId: initialTemplateId }: Props) {
  const [selectedId, setSelectedId] = useState(initialTemplateId || "vendas");
  const [isPending, startTransition] = useTransition();

  const templatesList = Object.values(BUSINESS_TEMPLATES);
  const currentTemplate: BusinessTemplateDef = getTemplate(selectedId);

  function handleApply(t: BusinessTemplateDef) {
    startTransition(async () => {
      const res = await applyBusinessTemplate(t.id, { applyToAssistant: true });
      if (res.ok) {
        setSelectedId(t.id);
        toast.success(`Template "${t.label}" aplicado com sucesso!`);
      } else {
        toast.error(`Erro ao aplicar template: ${res.error}`);
      }
    });
  }

  return (
    <div className="space-y-8">
      {/* Resumo do Template Atual */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-4xl">{currentTemplate.icon}</span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-foreground">{currentTemplate.label}</h2>
                <Badge variant="default" className="text-xs">Ativo na sua Empresa</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{currentTemplate.description}</p>
            </div>
          </div>
        </div>

        {/* Nomenclaturas ativas */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 pt-3 border-t text-xs">
          <div className="rounded-lg bg-background/80 p-2.5 border">
            <span className="text-muted-foreground block text-[11px]">Contatos:</span>
            <span className="font-semibold text-foreground text-sm">{currentTemplate.vocabulary.contacts}</span>
          </div>
          <div className="rounded-lg bg-background/80 p-2.5 border">
            <span className="text-muted-foreground block text-[11px]">Catálogo / Itens:</span>
            <span className="font-semibold text-foreground text-sm">{currentTemplate.vocabulary.products}</span>
          </div>
          <div className="rounded-lg bg-background/80 p-2.5 border">
            <span className="text-muted-foreground block text-[11px]">Oportunidades / Deals:</span>
            <span className="font-semibold text-foreground text-sm">{currentTemplate.vocabulary.deals}</span>
          </div>
          <div className="rounded-lg bg-background/80 p-2.5 border">
            <span className="text-muted-foreground block text-[11px]">Funil Principal:</span>
            <span className="font-semibold text-foreground text-sm">{currentTemplate.vocabulary.pipeline_name}</span>
          </div>
        </div>
      </div>

      {/* Grid de Escolha dos 6 Templates */}
      <div>
        <h3 className="text-base font-semibold mb-1">Escolha o Segmento da sua Empresa</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Ao trocar de template, as telas do CRM, nomenclaturas e o catálogo do assistente de IA se adaptam automaticamente ao seu nicho.
        </p>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templatesList.map((tpl) => {
            const isCurrent = tpl.id === selectedId;
            return (
              <Card
                key={tpl.id}
                className={`flex flex-col justify-between transition-all ${
                  isCurrent ? "border-primary ring-2 ring-primary/20 shadow-sm" : "hover:border-primary/50"
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <span className="text-3xl">{tpl.icon}</span>
                    {isCurrent ? (
                      <Badge variant="default" className="text-xs">Em Uso</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">Disponível</Badge>
                    )}
                  </div>
                  <CardTitle className="text-base mt-2">{tpl.label}</CardTitle>
                  <CardDescription className="text-xs leading-relaxed">
                    {tpl.description}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-2 text-xs border-t pt-3 bg-muted/20">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Termo de Clientes:</span>
                    <span className="font-medium text-foreground">{tpl.vocabulary.contacts}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Itens do Catálogo:</span>
                    <span className="font-medium text-foreground">{tpl.vocabulary.products}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Agendamentos/Vendas:</span>
                    <span className="font-medium text-foreground">{tpl.vocabulary.deals}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Exemplo de Serviço:</span>
                    <span className="font-medium text-foreground truncate max-w-[150px]">
                      {tpl.defaultServices[0]?.name}
                    </span>
                  </div>
                </CardContent>

                <CardFooter className="pt-3 border-t">
                  <Button
                    className="w-full"
                    variant={isCurrent ? "outline" : "default"}
                    disabled={isPending || isCurrent}
                    onClick={() => handleApply(tpl)}
                  >
                    {isCurrent ? "Template Selecionado" : `Aplicar ${tpl.label}`}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
