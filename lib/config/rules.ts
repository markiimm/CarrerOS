// Constantes de regra de negócio (T5). Nada disto é repetido em componente ou action.

export const PASSWORD_MIN_LENGTH = 10; // documento 16 §2

/**
 * Completude do perfil profissional (RF-PRF-06). Os pesos somam 100.
 * O Opportunity Score trata completude < 40 como compatibilidade indisponível (documento 08).
 */
export const COMPLETENESS_WEIGHTS = {
  target_title: 15,
  seniority: 10,
  years_experience: 5,
  summary: 15,
  skills: 20,
  experiences: 20,
  education: 5,
  links: 5,
  location: 5,
} as const;

export const COMPLETENESS_MIN_SUMMARY_CHARS = 200;
export const COMPLETENESS_MIN_SKILLS = 5;

export type CompletenessCriterion = keyof typeof COMPLETENESS_WEIGHTS;
