import { normalizeText } from '@/lib/utils/text';

/**
 * Extração DETERMINÍSTICA de um currículo a partir do texto do PDF (sem IA, sem custo).
 * Política anti-invenção (documento 20): só sai daqui o que está escrito no texto. O que não foi
 * identificado fica vazio ou marcado `incomplete` — nunca é preenchido por suposição.
 */

export interface CatalogSkill { id: string; name: string; aliases: string[] }

export interface DraftSkill { skill_id: string; name: string }
export interface DraftExperience {
  company_name: string;
  role_title: string;
  start_date: string;
  end_date: string | null;
  is_current: boolean;
  description: string;
  technologies: string[];
  incomplete: boolean;
}
export interface DraftEducation {
  institution: string;
  degree: string | null;
  field: string | null;
  start_date: string | null;
  end_date: string | null;
  status: 'completed' | 'in_progress' | 'paused' | 'dropped';
  incomplete: boolean;
}
export interface DraftCertification { name: string; issuer: string | null; issued_at: string | null }
export interface DraftLink { kind: 'github' | 'portfolio' | 'linkedin'; url: string }

export interface ResumeDraft {
  personal: { full_name: string | null; headline: string | null; city: string | null; state: string | null };
  summary: string | null;
  years_experience: number | null;
  skills: DraftSkill[];
  experiences: DraftExperience[];
  educations: DraftEducation[];
  certifications: DraftCertification[];
  links: DraftLink[];
  warnings: string[];
}

// ─── Texto ───────────────────────────────────────────────────────────────────

/** Minúsculo e sem acento, preservando a pontuação (o normalizeText a remove). */
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const BULLET = /^[\s•·●▪■◦○◆►▶➢➤✓✔*\-–—>]+/;
const stripBullet = (s: string) => s.replace(BULLET, '').trim();
const isBullet = (s: string) => BULLET.test(s) && /^[\s]*[•·●▪■◦○◆►▶➢➤✓✔*>\-–—]/.test(s);

const cut = (s: string, max: number) => (s.length <= max ? s : s.slice(0, max).trim());
const titleCase = (s: string) =>
  s.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (_m, sep: string, ch: string) => sep + ch.toUpperCase())
    .replace(/\s(?:De|Da|Do|Das|Dos|E)\s/g, (m) => m.toLowerCase());

// ─── Seções ──────────────────────────────────────────────────────────────────

type Section = 'header' | 'experience' | 'education' | 'skills' | 'certifications' | 'summary' | 'other';

const SECTION_HEADERS: Array<[Exclude<Section, 'header'>, RegExp]> = [
  ['experience', /^(experiencias?( profissionais?| profissional)?|historico profissional|trajetoria profissional|atuacao profissional|work experience|professional experience|employment history|experience)$/],
  ['education', /^(formacao( academica| e cursos)?|educacao|escolaridade|academic background|education)$/],
  ['skills', /^(competencias( tecnicas| principais)?|principais competencias|habilidades( tecnicas)?|hard skills|skills|technical skills|tecnologias|conhecimentos( tecnicos)?|ferramentas)$/],
  ['certifications', /^(certificacoes?( e cursos)?|cursos( e certificacoes| complementares| e treinamentos)?|treinamentos|licencas e certificacoes|certifications|courses)$/],
  ['summary', /^(resumo( profissional)?|objetivo( profissional)?|perfil( profissional)?|sobre( mim)?|apresentacao|summary|professional summary|about( me)?)$/],
  ['other', /^(idiomas|languages|projetos|projects|publicacoes|referencias|interesses|voluntariado|atividades( extracurriculares)?|informacoes adicionais|dados pessoais|contato|contact)$/],
];

function sectionOf(line: string): Exclude<Section, 'header'> | null {
  if (line.length > 45) return null;
  const key = fold(line).replace(/[:|_•·\-–—]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!key) return null;
  for (const [name, re] of SECTION_HEADERS) if (re.test(key)) return name;
  return null;
}

export function splitSections(lines: string[]): Record<Section, string[]> {
  const out: Record<Section, string[]> = { header: [], experience: [], education: [], skills: [], certifications: [], summary: [], other: [] };
  let current: Section = 'header';
  for (const line of lines) {
    const header = sectionOf(line);
    if (header) { current = header; continue; }
    out[current].push(line);
  }
  return out;
}

// ─── Datas ───────────────────────────────────────────────────────────────────

const MONTHS: Record<string, number> = {
  jan: 1, fev: 2, feb: 2, mar: 3, abr: 4, apr: 4, mai: 5, may: 5, jun: 6, jul: 7,
  ago: 8, aug: 8, set: 9, sep: 9, out: 10, oct: 10, nov: 11, dez: 12, dec: 12,
};

const D = String.raw`(?:\d{1,2}\s*[\/.]\s*\d{4}|[a-z]{3,9}\.?\s*(?:de\s+|\/\s*|,\s*)?\d{4}|\d{4})`;
const NOW = String.raw`(?:atual(?:mente)?|presente|present|hoje|current|now|o momento|momento atual)`;
const RANGE = new RegExp(String.raw`(${D})\s*(?:[-–—]|\s(?:a|ate|to)\s)\s*(${D}|${NOW})(?![a-z0-9])`, 'i');

const iso = (y: number, m: number, d: number) => `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

function parseDateToken(token: string, now: Date, end: boolean): string | null {
  const s = fold(token).trim();
  const maxYear = now.getUTCFullYear() + 6;
  const validYear = (y: number) => y >= 1960 && y <= maxYear;
  let m = s.match(/^(\d{1,2})\s*[/.]\s*(\d{4})$/);
  if (m) {
    const month = Number(m[1]); const year = Number(m[2]);
    return month >= 1 && month <= 12 && validYear(year) ? iso(year, month, 1) : null;
  }
  m = s.match(/^([a-z]{3,9})\.?\s*(?:de\s+|\/\s*|,\s*)?(\d{4})$/);
  if (m) {
    const month = MONTHS[(m[1] ?? '').slice(0, 3)]; const year = Number(m[2]);
    return month && validYear(year) ? iso(year, month, 1) : null;
  }
  m = s.match(/^(\d{4})$/);
  if (m && validYear(Number(m[1]))) return end ? iso(Number(m[1]), 12, 31) : iso(Number(m[1]), 1, 1);
  return null;
}

interface Range { start: string; end: string | null; current: boolean; rest: string }

export function findRange(line: string, now = new Date()): Range | null {
  const folded = fold(line);
  const m = RANGE.exec(folded);
  if (!m) return null;
  const start = parseDateToken(m[1] ?? '', now, false);
  if (!start) return null;
  const endToken = (m[2] ?? '').trim();
  const isNow = new RegExp(`^${NOW}$`, 'i').test(endToken);
  const end = isNow ? null : parseDateToken(endToken, now, true);
  if (!isNow && !end) return null;
  if (end && end < start) return null;
  // "folded" mantém o mesmo comprimento de "line" (NFD + remoção de marcas combinantes só altera
  // acentos precompostos), então os índices valem para o texto original.
  const rest = (line.slice(0, m.index) + ' ' + line.slice(m.index + m[0].length))
    .replace(/[()[\]]/g, ' ').replace(/\s+/g, ' ').replace(/^[\s,;:|\-–—]+|[\s,;:|\-–—]+$/g, '').trim();
  return { start, end, current: isNow, rest };
}

// ─── Competências ────────────────────────────────────────────────────────────

interface CompiledSkill { skill: CatalogSkill; terms: string[] }

export function compileSkills(catalog: CatalogSkill[]): CompiledSkill[] {
  return catalog.map((skill) => ({
    skill,
    terms: [...new Set([skill.name, ...skill.aliases].map(normalizeText).filter((term) => term.length >= 2))],
  }));
}

/** Compara por palavras inteiras no texto normalizado; termos de 2 letras só valem na seção de competências. */
export function matchSkills(compiled: CompiledSkill[], text: string, strictText = ''): CatalogSkill[] {
  const hay = ` ${normalizeText(text)} `;
  const strictHay = ` ${normalizeText(strictText)} `;
  return compiled
    .filter(({ terms }) => terms.some((term) => (term.length >= 3 ? hay : strictHay).includes(` ${term} `)))
    .map(({ skill }) => skill);
}

// ─── Cabeçalho (nome, título, local) ─────────────────────────────────────────

const UFS = new Set('AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' '));
const PHONE = /(?:\+?\d{2}\s*)?\(?\d{2}\)?[\s.-]?\d{4,5}[\s.-]?\d{4}/;

const isContactLine = (line: string) =>
  /@|https?:\/\/|www\.|linkedin|github/i.test(line) || PHONE.test(line);

function findLocation(lines: string[]): { city: string; state: string } | null {
  for (const line of lines) {
    for (const part of line.split(/\s[|•·]\s|\s{2,}/)) {
      const m = part.trim().match(/^(?:.*?:\s*)?(\p{Lu}[\p{L}'. ]{2,40}?)\s*(?:,|\s-\s|–|\/)\s*([A-Z]{2})$/u);
      if (m?.[1] && m[2] && UFS.has(m[2])) return { city: m[1].trim(), state: m[2] };
    }
  }
  return null;
}

function findName(lines: string[]): string | null {
  for (const line of lines.slice(0, 8)) {
    const clean = line.trim();
    if (clean.length < 5 || clean.length > 80 || isContactLine(clean) || /\d/.test(clean)) continue;
    if (/curriculo|curriculum|resume|\bcv\b/i.test(fold(clean))) continue;
    const words = clean.split(/\s+/);
    if (words.length < 2 || words.length > 6) continue;
    const connector = /^(?:da|de|do|das|dos|e|di|du|van|von|del|la)$/i;
    if (!words.every((w) => /^[\p{L}][\p{L}'.-]*$/u.test(w) && (/^\p{Lu}/u.test(w) || connector.test(w)))) continue;
    return clean === clean.toUpperCase() ? titleCase(clean) : clean;
  }
  return null;
}

function findHeadline(lines: string[], name: string | null): string | null {
  for (const line of lines.slice(0, 10)) {
    const clean = line.trim();
    if (!clean || (name && fold(clean) === fold(name)) || isContactLine(clean) || clean.length > 160 || clean.length < 4) continue;
    if (findLocation([clean]) || /^\d/.test(clean)) continue;
    return clean;
  }
  return null;
}

// ─── Links ───────────────────────────────────────────────────────────────────

export function findLinks(text: string): DraftLink[] {
  const found = new Map<string, DraftLink>();
  const add = (kind: DraftLink['kind'], raw: string) => {
    const clean = raw.replace(/[.,;:)\]]+$/, '');
    const url = /^https?:\/\//i.test(clean) ? clean : `https://${clean}`;
    if (url.length <= 300) found.set(url.toLowerCase(), { kind, url });
  };
  for (const m of text.matchAll(/(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/(?:in|pub)\/[\w%.-]+/gi)) add('linkedin', m[0]);
  for (const m of text.matchAll(/(?:https?:\/\/)?(?:www\.)?github\.com\/[\w-]+/gi)) add('github', m[0]);
  for (const m of text.matchAll(/https?:\/\/[^\s,;)\]]+/gi)) {
    if (/linkedin\.com|github\.com/i.test(m[0])) continue;
    add('portfolio', m[0]);
  }
  return [...found.values()].slice(0, 6);
}

// ─── Experiências ────────────────────────────────────────────────────────────

const ROLE_RE = /\b(analista|engenheir[oa]|desenvolvedor[a]?|programador[a]?|tecnic[oa]|gerente|coordenador[a]?|assistente|auxiliar|consultor[a]?|especialista|estagiari[oa]|estagio|suporte|administrador[a]?|arquitet[oa]|designer|supervisor[a]?|diretor[a]?|lider|operador[a]?|atendente|developer|engineer|manager|analyst|specialist|technician|intern|lead|architect|administrator|consultant|support|coordinator|director|head|trainee|jovem aprendiz|aprendiz)\b/;
const CONTRACT_WORDS = /^(clt|pj|tempo integral|meio periodo|full[- ]?time|part[- ]?time|remoto|presencial|hibrido|home office|estagio|freelance|contrato)$/;

const looksLikeHeaderLine = (line: string) =>
  line.length >= 2 && line.length <= 90 && !isBullet(line) && !/[.;]$/.test(line.trim()) && line.trim().split(/\s+/).length <= 12;

function splitParts(line: string): string[] {
  return stripBullet(line)
    .split(/\s[-–—|@]\s|\s(?:na|em|at)\s(?=\p{Lu})|\s[|•·]\s/u)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p && !CONTRACT_WORDS.test(fold(p)));
}

function pickRoleAndCompany(headerLines: string[]): { role: string | null; company: string | null } {
  const parts = headerLines.flatMap(splitParts);
  const [first, second] = parts;
  if (first === undefined) return { role: null, company: null };
  if (parts.length === 1) {
    return ROLE_RE.test(fold(first)) ? { role: first, company: null } : { role: null, company: first };
  }
  const roleIdx = parts.map((p, i) => (ROLE_RE.test(fold(p)) ? i : -1)).filter((i) => i >= 0);
  if (roleIdx.length === 1) {
    const company = parts.find((_p, i) => i !== roleIdx[0]) ?? null;
    return { role: parts[roleIdx[0] ?? 0] ?? first, company };
  }
  return { role: first, company: second ?? null };
}

function parseExperiences(lines: string[], compiled: CompiledSkill[], now: Date): DraftExperience[] {
  const hits: Array<{ index: number; range: Range }> = [];
  lines.forEach((line, index) => {
    const range = findRange(line, now);
    if (range) hits.push({ index, range });
  });
  if (!hits.length) return [];

  const entries = hits.map(({ index, range }, k) => {
    const lowerBound = k === 0 ? 0 : (hits[k - 1]?.index ?? -1) + 1;
    let headerLines: string[] = [];
    let headerStart = index;
    let bodyStart = index + 1;
    if (range.rest) {
      headerLines = [range.rest];
      // Data na mesma linha da empresa: o cargo costuma vir na linha seguinte.
      const next = lines[index + 1];
      if (splitParts(range.rest).length === 1 && next && looksLikeHeaderLine(next) && !findRange(next, now)) {
        headerLines.push(next);
        bodyStart = index + 2;
      }
    } else {
      for (let j = index - 1; j >= Math.max(lowerBound, index - 2); j--) {
        const candidate = lines[j];
        if (candidate === undefined || !looksLikeHeaderLine(candidate)) break;
        headerLines.unshift(candidate);
        headerStart = j;
      }
    }
    return { range, headerLines, headerStart, bodyStart };
  });

  return entries.flatMap((entry, k): DraftExperience[] => {
    const bodyEnd = entries[k + 1]?.headerStart ?? lines.length;
    const description = cut(
      lines.slice(entry.bodyStart, Math.max(entry.bodyStart, bodyEnd)).map(stripBullet).filter(Boolean).join('\n'), 4000,
    );
    const { role, company } = pickRoleAndCompany(entry.headerLines);
    if (!role && !company) return [];
    return [{
      company_name: cut(company ?? 'Empresa não identificada', 120),
      role_title: cut(role ?? 'Cargo não identificado', 120),
      start_date: entry.range.start,
      end_date: entry.range.current ? null : entry.range.end,
      is_current: entry.range.current,
      description,
      technologies: matchSkills(compiled, description).slice(0, 15).map((s) => cut(s.name, 60)),
      incomplete: !role || !company,
    }];
  });
}

function yearsOfExperience(experiences: DraftExperience[], now: Date): number | null {
  const spans = experiences.map((e) => [Date.parse(e.start_date), Date.parse(e.end_date ?? now.toISOString())] as const)
    .filter(([a, b]) => b >= a).sort((x, y) => x[0] - y[0]);
  if (!spans.length) return null;
  let total = 0;
  const firstSpan = spans[0];
  if (!firstSpan) return null;
  let [curStart, curEnd] = firstSpan;
  for (const [a, b] of spans.slice(1)) {
    if (a <= curEnd) curEnd = Math.max(curEnd, b);
    else { total += curEnd - curStart; [curStart, curEnd] = [a, b]; }
  }
  total += curEnd - curStart;
  const years = Math.round((total / (365.25 * 24 * 3600 * 1000)) * 2) / 2;
  return years > 0 && years <= 60 ? years : null;
}

// ─── Formação ────────────────────────────────────────────────────────────────

const INSTITUTION_RE = /(universidade|faculdade|instituto|centro universitario|escola|colegio|fatec|etec|senac|senai|unicamp|\busp\b|unesp|ufrj|ufmg|ufsc|ufrgs|\bpuc|\bfgv\b|insper|mackenzie|uninove|\bunip\b|estacio|anhanguera|uninter|college|university|institute|school|academy|alura|udemy|coursera|\bdio\b)/;
const DEGREE_RE = /^(bacharel\w*|licenciatura|tecnolog\w*|tecnic[oa]|graduacao|pos[- ]?graduacao|mba|mestrado|doutorado|especializacao|ensino (?:medio|fundamental|superior)|bachelor\w*|master\w*|phd|degree|associate\w*|diploma)/;

function parseEducations(lines: string[], now: Date): DraftEducation[] {
  const out: DraftEducation[] = [];
  let cur: DraftEducation | null = null;
  const flush = () => {
    if (cur && (cur.institution || cur.degree)) out.push(cur);
    cur = null;
  };
  const blank = (): DraftEducation => ({
    institution: '', degree: null, field: null, start_date: null, end_date: null, status: 'completed', incomplete: false,
  });

  for (const raw of lines) {
    const line = stripBullet(raw);
    if (!line) continue;
    const range = findRange(line, now);
    const text = range ? range.rest : line;
    const f = fold(text);

    const yearOnly = !range ? text.match(/\b(19[6-9]\d|20[0-4]\d)\b/g) : null;

    if (text && INSTITUTION_RE.test(f)) {
      if (cur?.institution) flush();
      cur ??= blank();
      const [first, ...others] = splitParts(text);
      cur.institution = cut(first ?? text, 160);
      for (const o of others) if (DEGREE_RE.test(fold(o)) && !cur.degree) assignDegree(cur, o);
    } else if (text && DEGREE_RE.test(f)) {
      if (cur?.degree) flush();
      cur ??= blank();
      assignDegree(cur, text);
    }

    if (cur && range) {
      cur.start_date = range.start;
      cur.end_date = range.current ? null : range.end;
      if (range.current || (range.end && Date.parse(range.end) > now.getTime())) cur.status = 'in_progress';
    } else if (cur && yearOnly?.length) {
      const y = Number(yearOnly[yearOnly.length - 1]);
      cur.end_date ??= iso(y, 12, 31);
      if (cur.end_date && Date.parse(cur.end_date) > now.getTime()) cur.status = 'in_progress';
    }
    if (cur && /cursando|em andamento|incompleto|previsao|previsto/.test(f)) cur.status = 'in_progress';
    if (cur && /trancado|pausado/.test(f)) cur.status = 'paused';
  }
  flush();

  return out.slice(0, 10).map((e) => ({
    ...e,
    incomplete: !e.institution,
    institution: e.institution || 'Instituição não identificada',
  }));
}

function assignDegree(entry: DraftEducation, text: string) {
  const m = text.match(/^(.{3,60}?)\s+(?:em|in|de|of)\s+(.+)$/i);
  if (m?.[1] && m[2] && DEGREE_RE.test(fold(m[1]))) {
    entry.degree = cut(m[1].trim(), 80);
    entry.field = cut(m[2].trim(), 160);
  } else {
    entry.degree = cut(text, 80);
  }
}

// ─── Certificações ───────────────────────────────────────────────────────────

function parseCertifications(lines: string[], now: Date): DraftCertification[] {
  const out: DraftCertification[] = [];
  for (const raw of lines) {
    const line = stripBullet(raw);
    if (line.length < 4 || line.length > 200 || findRange(line, now) && !findRange(line, now)?.rest) continue;
    const year = line.match(/\b(19[89]\d|20[0-4]\d)\b/);
    const text = line.replace(/[([]?\b(?:19[89]\d|20[0-4]\d)\b[)\]]?/g, '').replace(/\s+/g, ' ').replace(/[\s,;:|\-–—]+$/g, '').trim();
    if (text.length < 4) continue;
    const [name = text, issuer] = text.split(/\s[-–—|]\s/);
    out.push({
      name: cut(name.trim(), 160),
      issuer: issuer ? cut(issuer.trim(), 120) : null,
      issued_at: year ? iso(Number(year[1]), 1, 1) : null,
    });
  }
  return out.slice(0, 15);
}

// ─── Orquestração ────────────────────────────────────────────────────────────

export function parseResumeText(text: string, catalog: CatalogSkill[], now = new Date()): ResumeDraft {
  const lines = text.replace(/\r/g, '').split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const sections = splitSections(lines);
  const compiled = compileSkills(catalog);
  const warnings: string[] = [];

  const header = sections.header;
  const fullName = findName(header);
  const location = findLocation(header);
  const experiences = parseExperiences(sections.experience, compiled, now);

  const skillsText = sections.skills.join('\n');
  const skills = matchSkills(compiled, lines.join('\n'), skillsText)
    .slice(0, 60)
    .map((s) => ({ skill_id: s.id, name: s.name }));

  const summaryText = sections.summary.map(stripBullet).join(' ').replace(/\s+/g, ' ').trim();

  if (!sections.experience.length) warnings.push('Não encontrei uma seção de experiência profissional.');
  else if (!experiences.length) warnings.push('Encontrei a seção de experiência, mas não consegui ler os períodos (ex.: “jan/2020 – atual”).');
  if (!skills.length) warnings.push('Nenhuma competência do catálogo foi reconhecida no texto.');

  return {
    personal: {
      full_name: fullName ? cut(fullName, 120) : null,
      headline: findHeadline(header, fullName),
      city: location ? cut(location.city, 80) : null,
      state: location?.state ?? null,
    },
    summary: summaryText ? cut(summaryText, 4000) : null,
    years_experience: yearsOfExperience(experiences, now),
    skills,
    experiences: experiences.slice(0, 30),
    educations: parseEducations(sections.education, now),
    certifications: parseCertifications(sections.certifications, now),
    links: findLinks(text),
    warnings,
  };
}
