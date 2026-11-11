import { describe, expect, it } from 'vitest';
import { COMPLETENESS_WEIGHTS } from '@/lib/config/rules';
import { computeCompleteness, type CompletenessInput } from './completeness';

const empty: CompletenessInput = {
  targetTitle: null, seniority: null, yearsExperience: null, summary: null,
  profileSkillCount: 0, profileExperienceCount: 0, educationCount: 0, linkCount: 0, city: null, state: null,
};

const full: CompletenessInput = {
  targetTitle: 'Analista de Infraestrutura', seniority: 'mid', yearsExperience: 4, summary: 'x'.repeat(200),
  profileSkillCount: 5, profileExperienceCount: 1, educationCount: 1, linkCount: 1, city: 'Campinas', state: 'SP',
};

describe('computeCompleteness', () => {
  it('os pesos somam 100', () => {
    expect(Object.values(COMPLETENESS_WEIGHTS).reduce((a, b) => a + b, 0)).toBe(100);
  });

  it.each<[string, Partial<CompletenessInput>, number, string[]]>([
    ['vazio', {}, 0, ['skills', 'experiences', 'target_title', 'summary', 'seniority', 'years_experience', 'education', 'links', 'location']],
    ['só cargo-alvo', { targetTitle: 'Analista de TI' }, 15, []],
    ['cargo só com espaços não conta', { targetTitle: '   ' }, 0, []],
    ['zero anos de experiência é dado informado', { yearsExperience: 0 }, 5, []],
    ['resumo abaixo do mínimo não conta', { summary: 'x'.repeat(199) }, 0, []],
    ['resumo no mínimo conta', { summary: 'x'.repeat(200) }, 15, []],
    ['4 competências não bastam', { profileSkillCount: 4 }, 0, []],
    ['5 competências bastam', { profileSkillCount: 5 }, 20, []],
    ['cidade sem estado não conta', { city: 'Campinas' }, 0, []],
    ['cidade e estado contam', { city: 'Campinas', state: 'SP' }, 5, []],
  ])('%s', (_name, patch, score, missing) => {
    const result = computeCompleteness({ ...empty, ...patch });
    expect(result.score).toBe(score);
    if (missing.length) expect(result.missing).toEqual(missing);
  });

  it('perfil completo dá 100 e nada falta', () => {
    expect(computeCompleteness(full)).toEqual({ score: 100, missing: [] });
  });

  it('lista exatamente o critério que falta', () => {
    expect(computeCompleteness({ ...full, linkCount: 0 })).toEqual({ score: 95, missing: ['links'] });
  });
});
