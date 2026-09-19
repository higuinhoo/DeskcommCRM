import { useAuth } from "@/hooks/auth/AuthProvider";
import { type Module, resolveCapabilities } from "@/lib/product/capabilities";
import { useMemo } from "react";

export function useProductModules() {
  const { activeOrg } = useAuth();
  
  return useMemo(() => {
    if (!activeOrg?.product_context) return null;
    return resolveCapabilities(activeOrg.product_context);
  }, [activeOrg?.product_context]);
}

export function useModuleAccess(module: Module): boolean {
  const modules = useProductModules();
  if (!modules) return true; // Se o contexto não estiver carregado, assume true (comportamento legacy)
  return modules[module].allowed;
}
