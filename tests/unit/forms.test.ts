import { describe, expect, it } from 'vitest';
import { careerProfileSchema, currentEmploymentSchema, experienceSchema, personalDataSchema } from '@/features/career-profile/schemas';
import { newPasswordSchema, safeNext } from '@/features/auth/schemas';
import { formToObject } from '@/lib/utils/form';
import { normalizeText } from '@/lib/utils/text';
import { parseDecimal } from '@/lib/validation';

describe('parseDecimal', () => {
  it.each<[unknown, unknown]>([
    ['4500', 4500],
    ['4.500,50', 4500.5],
    ['4500.50', 4500.5],
    ['4500,5', 4500.5],
    [' 1 200 ', 1200],
    ['', null],
    [12, 12],
  ])('%j → %j', (input, expected) => expect(parseDecimal(input)).toBe(expected));

  it('texto que não é número vira NaN (rejeitado pelo schema, nunca zero)', () => {
    expect(parseDecimal('abc')).toBeNaN();
    expect(parseDecimal('12abc')).toBeNaN();
  });
});

describe('safeNext', () => {
  it.each<[string | null | undefined, string]>([
    ['/perfil', '/perfil'],
    ['/perfil/experiencias?x=1', '/perfil/experiencias?x=1'],
    [null, '/painel'],
    ['', '/painel'],
    ['https://evil.example', '/painel'],
    ['//evil.example', '/painel'],
    ['/\\evil.example', '/painel'],
    ['perfil', '/painel'],
  ])('%j → %j', (input, expected) => expect(safeNext(input)).toBe(expected));
});

describe('normalizeText', () => {
  it.each<[string | null, string]>([
    ['Analista de Infraestrutura Sênior', 'analista de infraestrutura senior'],
    ['  Front-End (React.js) ', 'front end react js'],
    ['Programação C#/.NET', 'programacao c net'],
    [null, ''],
  ])('%j → %j', (input, expected) => expect(normalizeText(input)).toBe(expected));
});

describe('schemas de formulário', () => {
  it('dados pessoais: vazio vira null, grupo ausente vira lista vazia e checkbox vira boolean', () => {
    const form = new FormData();
    form.set('full_name', '  Ana Souza ');
    form.set('headline', '');
    form.set('city', 'Campinas');
    form.set('state', 'SP');
    form.set('country', 'br');
    form.set('salary_expectation_min', '4.500,00');
    form.set('salary_expectation_max', '');
    form.append('accepted_work_models[]', 'remote');
    form.append('accepted_work_models[]', 'hybrid');
    form.set('willing_to_travel', 'on');

    const parsed = personalDataSchema.parse(formToObject(form));
    expect(parsed).toEqual({
      full_name: 'Ana Souza', headline: null, city: 'Campinas', state: 'SP', country: 'BR',
      willing_to_relocate: false, willing_to_travel: true,
      salary_expectation_min: 4500, salary_expectation_max: null,
      accepted_work_models: ['remote', 'hybrid'], accepted_contract_types: [],
    });
  });

  it('dados pessoais: máximo abaixo do mínimo aponta o campo', () => {
    const result = personalDataSchema.safeParse({ full_name: 'Ana', country: 'BR', salary_expectation_min: '5000', salary_expectation_max: '4000' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['salary_expectation_max']);
  });

  it('experiência: listas são separadas e a saída não pode anteceder o início', () => {
    const base = { company_name: 'ACME', role_title: 'Analista', start_date: '2023-03-01' };
    const parsed = experienceSchema.parse({ ...base, achievements: 'Reduzi o tempo de chamados\n\nMigrei o AD', technologies: 'Linux, Zabbix,linux, ' });
    expect(parsed.achievements).toEqual(['Reduzi o tempo de chamados', 'Migrei o AD']);
    expect(parsed.technologies).toEqual(['Linux', 'Zabbix', 'linux']);
    expect(parsed.is_current).toBe(false);
    expect(parsed.end_date).toBeNull();

    expect(experienceSchema.safeParse({ ...base, end_date: '2022-01-01' }).success).toBe(false);
    expect(experienceSchema.safeParse({ ...base, end_date: '2024-01-01', is_current: 'on' }).success).toBe(false);
    expect(experienceSchema.safeParse({ ...base, start_date: '' }).success).toBe(false);
  });

  it('perfil profissional: id vazio é criação e ids inválidos são recusados', () => {
    expect(careerProfileSchema.parse({ id: '', name: 'Infra' })).toMatchObject({ id: null, skill_ids: [], experience_ids: [], years_experience: null });
    expect(careerProfileSchema.safeParse({ name: 'Infra', skill_ids: ['nao-e-uuid'] }).success).toBe(false);
    expect(careerProfileSchema.safeParse({ name: '' }).success).toBe(false);
  });

  it('emprego atual: benefício em branco fica null, não zero', () => {
    const parsed = currentEmploymentSchema.parse({ company_name: 'ACME', role_title: 'Analista', contract_type: 'clt', benefit_meal_voucher: '', benefit_health_plan: '350' });
    expect(parsed.benefit_meal_voucher).toBeNull();
    expect(parsed.benefit_health_plan).toBe(350);
    expect(currentEmploymentSchema.safeParse({ company_name: 'ACME', role_title: 'Analista', contract_type: 'clt', satisfaction: '6' }).success).toBe(false);
  });

  it('nova senha: mínimo de 10 caracteres e confirmação igual', () => {
    expect(newPasswordSchema.safeParse({ password: 'curta', password_confirm: 'curta' }).success).toBe(false);
    expect(newPasswordSchema.safeParse({ password: 'senha-bem-longa', password_confirm: 'outra-coisa-aqui' }).success).toBe(false);
    expect(newPasswordSchema.safeParse({ password: 'senha-bem-longa', password_confirm: 'senha-bem-longa' }).success).toBe(true);
  });
});
