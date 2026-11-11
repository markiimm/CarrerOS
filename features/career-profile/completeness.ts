import {
  COMPLETENESS_MIN_SKILLS,
  COMPLETENESS_MIN_SUMMARY_CHARS,
  COMPLETENESS_WEIGHTS,
  type CompletenessCriterion,
} from '@/lib/config/rules';

export interface CompletenessInput {
  targetTitle: string | null;
  seniority: string | null;
  yearsExperience: number | null;
  summary: string | null;
  profileSkillCount: number;
  profileExperienceCount: number;
  educationCount: number;
  linkCount: number;
  city: string | null;
  state: string | null;
}

export interface Completeness {
  /** 0–100, soma dos pesos dos critérios atendidos. */
  score: number;
  /** Critérios não atendidos, na ordem de maior peso. */
  missing: CompletenessCriterion[];
}

const filled = (v: string | null) => Boolean(v && v.trim());

/** Função pura (RF-PRF-06): cada critério vale tudo ou nada; nada é estimado. */
export function computeCompleteness(input: CompletenessInput): Completeness {
  const met: Record<CompletenessCriterion, boolean> = {
    target_title: filled(input.targetTitle),
    seniority: filled(input.seniority),
    years_experience: input.yearsExperience !== null,
    summary: (input.summary?.trim().length ?? 0) >= COMPLETENESS_MIN_SUMMARY_CHARS,
    skills: input.profileSkillCount >= COMPLETENESS_MIN_SKILLS,
    experiences: input.profileExperienceCount >= 1,
    education: input.educationCount >= 1,
    links: input.linkCount >= 1,
    location: filled(input.city) && filled(input.state),
  };

  const criteria = Object.keys(COMPLETENESS_WEIGHTS) as CompletenessCriterion[];
  const score = criteria.reduce((sum, c) => sum + (met[c] ? COMPLETENESS_WEIGHTS[c] : 0), 0);
  const missing = criteria
    .filter((c) => !met[c])
    .sort((a, b) => COMPLETENESS_WEIGHTS[b] - COMPLETENESS_WEIGHTS[a]);

  return { score, missing };
}
