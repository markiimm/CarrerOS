import { describe, expect, it } from 'vitest';
import { findRange, parseResumeText, type CatalogSkill } from './parse';

const catalog: CatalogSkill[] = [
  { id: 's-ts', name: 'TypeScript', aliases: ['ts'] },
  { id: 's-react', name: 'React', aliases: ['reactjs', 'react.js'] },
  { id: 's-node', name: 'Node.js', aliases: ['nodejs'] },
  { id: 's-sql', name: 'SQL', aliases: [] },
  { id: 's-linux', name: 'Linux', aliases: [] },
  { id: 's-go', name: 'Go', aliases: ['golang'] },
  { id: 's-c', name: 'C', aliases: [] },
  { id: 's-ad', name: 'Active Directory', aliases: ['ad'] },
];

const NOW = new Date('2026-11-11T00:00:00Z');

const RESUME = `MARIA DA SILVA SANTOS
Analista de Suporte Técnico N2
Campinas - SP | (19) 99999-1234 | maria@exemplo.com
linkedin.com/in/maria-silva | github.com/mariasilva

RESUMO PROFISSIONAL
Profissional com experiência em suporte e infraestrutura, foco em atendimento de qualidade.

EXPERIÊNCIA PROFISSIONAL
Analista de Suporte N2
Empresa Alfa Tecnologia
mar/2021 - Atual
• Atendimento de chamados com Linux e Active Directory
• Automação de rotinas com Node.js e SQL
Técnico de Informática - Beta Soluções Ltda
01/2018 – 02/2021
- Manutenção de estações e redes

FORMAÇÃO ACADÊMICA
Tecnologia em Redes de Computadores
Faculdade de Tecnologia de Campinas
2015 - 2018

COMPETÊNCIAS
TypeScript, React, Go, Linux

CERTIFICAÇÕES
Microsoft Azure Fundamentals (AZ-900) - Microsoft 2022
ITIL 4 Foundation
`;

describe('findRange', () => {
  it('lê mês/ano com "atual"', () => {
    expect(findRange('mar/2021 - Atual', NOW)).toMatchObject({ start: '2021-03-01', end: null, current: true });
  });
  it('lê MM/AAAA e mantém o resto da linha', () => {
    expect(findRange('Técnico - Beta 01/2018 – 02/2021', NOW)).toMatchObject({ start: '2018-01-01', end: '2021-02-01', rest: 'Técnico - Beta' });
  });
  it('lê só anos', () => {
    expect(findRange('2015 - 2018', NOW)).toMatchObject({ start: '2015-01-01', end: '2018-12-31' });
  });
  it('rejeita fim antes do início e texto sem período', () => {
    expect(findRange('2020 - 2018', NOW)).toBeNull();
    expect(findRange('Atendimento de chamados', NOW)).toBeNull();
  });
});

describe('parseResumeText', () => {
  const draft = parseResumeText(RESUME, catalog, NOW);

  it('extrai dados pessoais', () => {
    expect(draft.personal).toEqual({
      full_name: 'Maria da Silva Santos',
      headline: 'Analista de Suporte Técnico N2',
      city: 'Campinas',
      state: 'SP',
    });
  });

  it('extrai links', () => {
    expect(draft.links).toEqual([
      { kind: 'linkedin', url: 'https://linkedin.com/in/maria-silva' },
      { kind: 'github', url: 'https://github.com/mariasilva' },
    ]);
  });

  it('extrai o resumo', () => {
    expect(draft.summary).toContain('suporte e infraestrutura');
  });

  it('extrai experiências com cargo, empresa e período', () => {
    expect(draft.experiences).toHaveLength(2);
    expect(draft.experiences[0]).toMatchObject({
      role_title: 'Analista de Suporte N2', company_name: 'Empresa Alfa Tecnologia',
      start_date: '2021-03-01', end_date: null, is_current: true, incomplete: false,
    });
    expect(draft.experiences[0]?.technologies).toEqual(expect.arrayContaining(['Linux', 'Active Directory', 'Node.js', 'SQL']));
    expect(draft.experiences[1]).toMatchObject({
      role_title: 'Técnico de Informática', company_name: 'Beta Soluções Ltda',
      start_date: '2018-01-01', end_date: '2021-02-01', is_current: false,
    });
  });

  it('reconhece competências do catálogo e ignora termos curtos fora da seção de competências', () => {
    const names = draft.skills.map((s) => s.name);
    expect(names).toEqual(expect.arrayContaining(['TypeScript', 'React', 'Go', 'Linux', 'SQL', 'Node.js', 'Active Directory']));
    expect(names).not.toContain('C');
  });

  it('extrai formação', () => {
    expect(draft.educations).toEqual([
      expect.objectContaining({
        institution: 'Faculdade de Tecnologia de Campinas',
        degree: 'Tecnologia', field: 'Redes de Computadores', status: 'completed',
        start_date: '2015-01-01', end_date: '2018-12-31',
      }),
    ]);
  });

  it('extrai certificações', () => {
    expect(draft.certifications).toEqual([
      { name: 'Microsoft Azure Fundamentals (AZ-900)', issuer: 'Microsoft', issued_at: '2022-01-01' },
      { name: 'ITIL 4 Foundation', issuer: null, issued_at: null },
    ]);
  });

  it('estima anos de experiência sem contar períodos sobrepostos duas vezes', () => {
    // 01/2018–02/2021 e 03/2021–atual (nov/2026): ≈ 8,8 anos, arredondado para 9.
    expect(draft.years_experience).toBe(9);
  });

  it('não inventa nada para texto sem estrutura', () => {
    const empty = parseResumeText('lorem ipsum dolor sit amet', catalog, NOW);
    expect(empty.experiences).toEqual([]);
    expect(empty.skills).toEqual([]);
    expect(empty.personal.full_name).toBeNull();
    expect(empty.warnings.length).toBeGreaterThan(0);
  });
});
