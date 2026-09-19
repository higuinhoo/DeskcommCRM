import { Suspense } from "react";
import { TenantDiagnostics } from "./_diagnostics";
import { TenantOverviewClient } from "./_client";

interface TenantDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function TenantDetailPage({ params }: TenantDetailPageProps) {
  const { id } = await params;
  return <div className="space-y-6"><TenantOverviewClient id={id} /><Suspense fallback={<p role="status">Carregando diagnóstico…</p>}><TenantDiagnostics id={id} /></Suspense></div>;
}
