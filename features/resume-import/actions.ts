'use server';

import { revalidatePath } from 'next/cache';
import { syncCompleteness } from '@/features/career-profile/sync';
import { createServerClient, type ServerClient } from '@/lib/db/server';
import { t } from '@/lib/i18n/pt-BR';
import { getPlanInfo } from '@/lib/plan';
import { logger } from '@/lib/utils/logger';
import { fail, ok, type ActionResult } from '@/lib/utils/result';
import { normalizeText } from '@/lib/utils/text';
import { extractPdfText } from './extract';
import { parseResumeText, type ResumeDraft } from './parse';
import { resumeApplySchema, type ImportSummary } from './schemas';

/** Vercel limita o corpo da requisição a 4,5 MB; um currículo em PDF raramente passa de 1 MB. */
const MAX_RESUME_MB = 4;
const MAX_PAGES = 12;

type Failure = ActionResult<never>;

/** Sessão + plano premium, verificados no servidor a cada chamada (a UI é só conveniência). */
async function requirePremium(): Promise<{ supabase: ServerClient; userId: string; maxUploadMb: number } | Failure> {
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return fail('UNAUTHENTICATED', t.errors.unauthenticated);
  const plan = await getPlanInfo(supabase, auth.user.id);
  if (!plan.isPremium) return fail('FORBIDDEN', t.profile.resumeImport.errors.notPremium);
  return { supabase, userId: auth.user.id, maxUploadMb: plan.maxUploadMb };
}

const isFailure = (v: unknown): v is Failure => typeof v === 'object' && v !== null && 'ok' in v;

/**
 * Passo 1: lê o PDF e devolve um RASCUNHO. Nada é gravado: o usuário revisa antes (RF-PRF-09).
 */
export async function analyzeResume(formData: FormData): Promise<ActionResult<ResumeDraft>> {
  const e = t.profile.resumeImport.errors;
  try {
    const gate = await requirePremium();
    if (isFailure(gate)) return gate;

    const file = formData.get('file');
    if (!(file instanceof File) || file.size === 0) return fail('VALIDATION_FAILED', e.noFile, 'file');
    const maxMb = Math.min(gate.maxUploadMb, MAX_RESUME_MB);
    if (file.size > maxMb * 1024 * 1024) return fail('VALIDATION_FAILED', e.tooBig(maxMb), 'file');

    const bytes = new Uint8Array(await file.arrayBuffer());
    // Confere a assinatura do arquivo; o tipo MIME informado pelo navegador não é confiável.
    if (new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-') return fail('VALIDATION_FAILED', e.notPdf, 'file');

    let extracted: Awaited<ReturnType<typeof extractPdfText>>;
    try {
      extracted = await extractPdfText(bytes);
    } catch {
      return fail('VALIDATION_FAILED', e.unreadable, 'file');
    }
    if (extracted.pages > MAX_PAGES) return fail('VALIDATION_FAILED', e.tooManyPages, 'file');
    if (extracted.text.trim().length < 80) return fail('VALIDATION_FAILED', e.noText, 'file');

    const catalog = await gate.supabase.from('skills').select('id, name, aliases').eq('is_active', true).limit(2000);
    if (catalog.error) throw new Error(`${catalog.error.code ?? 'db'}: ${catalog.error.message}`);

    const draft = parseResumeText(extracted.text, catalog.data);
    // Só contagens no log: o conteúdo do currículo é dado pessoal e nunca é registrado.
    logger.info('resume_import.analyzed', {
      pages: extracted.pages,
      experiences: draft.experiences.length,
      skills: draft.skills.length,
    });
    return ok(draft);
  } catch (error) {
    return internal('analyzeResume', error);
  }
}

function internal(where: string, error: unknown): Failure {
  const requestId = crypto.randomUUID();
  logger.error('resume_import.action_failed', { where, requestId, detail: error instanceof Error ? error.message : 'unknown' });
  return fail('INTERNAL', t.errors.internal(requestId));
}

type DbResult<T> = { data: T; error: { message: string; code?: string } | null };
function must<T>(result: DbResult<T>): T {
  if (result.error) throw new Error(`${result.error.code ?? 'db'}: ${result.error.message}`);
  return result.data;
}
/** Lista de linhas: erro vira exceção e "sem dados" vira lista vazia. */
function rows<T>(result: DbResult<T[] | null>): T[] {
  return must(result) ?? [];
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- o id opcional dos schemas não vai no INSERT
const withoutId = <T extends { id?: unknown }>({ id: _id, ...rest }: T) => rest;

const key = (...parts: Array<string | null | undefined>) => parts.map((p) => normalizeText(p ?? '')).join('|');

/**
 * Passo 2: grava o que o usuário aprovou. Só ADICIONA: nunca substitui nem apaga dado existente,
 * e campos pessoais só são preenchidos quando estão em branco.
 */
export async function applyResumeImport(input: unknown): Promise<ActionResult<ImportSummary>> {
  const parsed = resumeApplySchema.safeParse(input);
  if (!parsed.success) return fail('VALIDATION_FAILED', t.errors.generic);
  const data = parsed.data;

  try {
    const gate = await requirePremium();
    if (isFailure(gate)) return gate;
    const { supabase, userId } = gate;
    let added = 0;
    let skipped = 0;

    // Dados pessoais: só campos em branco.
    const profile = must(await supabase.from('profiles').select('full_name, headline, city, state').eq('user_id', userId).maybeSingle());
    const patch: Partial<Record<'full_name' | 'headline' | 'city' | 'state', string>> = {};
    for (const field of ['full_name', 'headline', 'city', 'state'] as const) {
      const incoming = data.personal[field];
      if (incoming && !profile?.[field]?.trim()) patch[field] = incoming;
    }
    if (Object.keys(patch).length) {
      must(await supabase.from('profiles').upsert({ user_id: userId, ...patch }, { onConflict: 'user_id' }));
      added += Object.keys(patch).length;
    }

    // Competências: só as do catálogo e ainda não cadastradas.
    const wanted = [...new Set(data.skill_ids)];
    let validSkillIds: string[] = [];
    if (wanted.length) {
      const [catalog, owned] = await Promise.all([
        supabase.from('skills').select('id').in('id', wanted),
        supabase.from('user_skills').select('skill_id').eq('user_id', userId),
      ]);
      validSkillIds = rows(catalog).map((s) => s.id);
      const ownedSet = new Set(rows(owned).map((s) => s.skill_id));
      const fresh = validSkillIds.filter((id) => !ownedSet.has(id));
      if (fresh.length) {
        must(await supabase.from('user_skills').insert(fresh.map((skill_id) => ({ user_id: userId, skill_id, level: 3 }))));
      }
      added += fresh.length;
      skipped += validSkillIds.length - fresh.length;
    }

    // Experiências.
    const knownExperiences = new Set(
      rows(await supabase.from('experiences').select('company_name, role_title, start_date').eq('user_id', userId))
        .map((x) => key(x.company_name, x.role_title, x.start_date)),
    );
    const newExperiences = data.experiences.filter((x) => !knownExperiences.has(key(x.company_name, x.role_title, x.start_date)));
    skipped += data.experiences.length - newExperiences.length;
    let newExperienceIds: string[] = [];
    if (newExperiences.length) {
      newExperienceIds = rows(await supabase.from('experiences')
        .insert(newExperiences.map((x) => ({ ...withoutId(x), user_id: userId }))).select('id')).map((x) => x.id);
      added += newExperiences.length;
    }

    // Formação.
    const knownEducations = new Set(
      rows(await supabase.from('educations').select('institution, degree, field').eq('user_id', userId))
        .map((x) => key(x.institution, x.degree, x.field)),
    );
    const newEducations = data.educations.filter((x) => !knownEducations.has(key(x.institution, x.degree, x.field)));
    skipped += data.educations.length - newEducations.length;
    if (newEducations.length) {
      must(await supabase.from('educations').insert(newEducations.map((x) => ({ ...withoutId(x), user_id: userId }))));
      added += newEducations.length;
    }

    // Certificações.
    const knownCertifications = new Set(
      rows(await supabase.from('certifications').select('name').eq('user_id', userId)).map((x) => key(x.name)),
    );
    const newCertifications = data.certifications.filter((x) => !knownCertifications.has(key(x.name)));
    skipped += data.certifications.length - newCertifications.length;
    if (newCertifications.length) {
      must(await supabase.from('certifications').insert(newCertifications.map((x) => ({ ...withoutId(x), user_id: userId }))));
      added += newCertifications.length;
    }

    // Links.
    const knownLinks = new Set(
      rows(await supabase.from('profile_links').select('url').eq('user_id', userId)).map((x) => x.url.toLowerCase().replace(/\/$/, '')),
    );
    const newLinks = data.links.filter((x) => !knownLinks.has(x.url.toLowerCase().replace(/\/$/, '')));
    skipped += data.links.length - newLinks.length;
    if (newLinks.length) {
      must(await supabase.from('profile_links').insert(newLinks.map((x) => ({ ...x, user_id: userId }))));
      added += newLinks.length;
    }

    // Perfil profissional principal: cria se não existe; senão só completa o que está em branco.
    const targetTitle = data.personal.headline ?? newExperiences[0]?.role_title ?? data.experiences[0]?.role_title ?? null;
    const careerProfiles = rows(await supabase.from('career_profiles')
      .select('id, target_title, summary, years_experience').eq('user_id', userId)
      .order('is_primary', { ascending: false }).order('created_at', { ascending: true }));
    let primary: (typeof careerProfiles)[number] | null = careerProfiles[0] ?? null;

    if (!primary && (targetTitle || data.summary || validSkillIds.length || newExperienceIds.length)) {
      primary = must(await supabase.from('career_profiles').insert({
        user_id: userId,
        name: t.profile.resumeImport.primaryProfileName,
        target_title: targetTitle,
        normalized_target_title: normalizeText(targetTitle) || null,
        summary: data.summary,
        years_experience: data.years_experience,
        is_primary: true,
      }).select('id, target_title, summary, years_experience').single());
      added += 1;
    } else if (primary) {
      const fill: { target_title?: string; normalized_target_title?: string; summary?: string; years_experience?: number } = {};
      if (!primary.target_title && targetTitle) {
        fill.target_title = targetTitle;
        fill.normalized_target_title = normalizeText(targetTitle);
      }
      if (!primary.summary && data.summary) fill.summary = data.summary;
      if (primary.years_experience === null && data.years_experience !== null) fill.years_experience = data.years_experience;
      if (Object.keys(fill).length) {
        must(await supabase.from('career_profiles').update(fill).eq('id', primary.id).eq('user_id', userId));
        added += Object.keys(fill).filter((k) => k !== 'normalized_target_title').length;
      }
    }

    if (primary) {
      if (validSkillIds.length) {
        must(await supabase.from('career_profile_skills').upsert(
          validSkillIds.map((skill_id) => ({ career_profile_id: primary.id, skill_id, user_id: userId })),
          { onConflict: 'career_profile_id,skill_id', ignoreDuplicates: true },
        ));
      }
      if (newExperienceIds.length) {
        const linked = await supabase.from('career_profile_experiences')
          .select('experience_id', { count: 'exact', head: true }).eq('career_profile_id', primary.id);
        if (linked.error) throw new Error(`${linked.error.code ?? 'db'}: ${linked.error.message}`);
        must(await supabase.from('career_profile_experiences').upsert(
          newExperienceIds.map((experience_id, index) => ({
            career_profile_id: primary.id, experience_id, user_id: userId, display_order: (linked.count ?? 0) + index,
          })),
          { onConflict: 'career_profile_id,experience_id', ignoreDuplicates: true },
        ));
      }
    }

    const synced = await syncCompleteness(supabase, userId);
    if (synced) throw new Error(`${synced.code ?? 'db'}: ${synced.message}`);

    revalidatePath('/perfil', 'layout');
    revalidatePath('/painel');
    logger.info('resume_import.applied', { added, skipped });
    return ok({ added, skipped });
  } catch (error) {
    return internal('applyResumeImport', error);
  }
}
