import { useAuth } from "@/hooks/auth/AuthProvider";
import { type Vocabulary, NEUTRAL_VOCABULARY } from "@/lib/vocabulary";

/**
 * Retorna os termos do vocabulário resolvidos para a organização ativa.
 * Já considera o fallback por perfil de produto (Fase 4).
 */
export function useVocabulary(): Vocabulary {
  const { activeOrg } = useAuth();
  return activeOrg?.vocabulary ?? NEUTRAL_VOCABULARY;
}
