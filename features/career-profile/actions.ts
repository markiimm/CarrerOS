'use server';

import { revalidatePath } from 'next/cache';
import type { z } from 'zod';
import { createServerClient, type ServerClient } from '@/lib/db/server';
import { t } from '@/lib/i18n/pt-BR';
import { issuesToErrors } from '@/lib/utils/form';
import { logger } from '@/lib/utils/logger';
import { fail, ok, type ActionResult } from '@/lib/utils/result';
import { normalizeText } from '@/lib/utils/text';
import {
  BENEFIT_KEYS, careerProfileSchema, certificationSchema, currentEmploymentSchema, educationSchema,
  experienceSchema, idSchema, linkSchema, personalDataSchema, userSkillSchema,
} from './schemas';
import { syncCompleteness, type DbError } from './sync';

interface Ctx<T> {
  supabase: ServerClient;
  userId: string;
  data: T;
}

/**
 * Invólucro único das mutações do domínio: valida com Zod, exige sessão (o usuário vem da
 * sessão, nunca do cliente), nunca lança para o cliente e mantém a completude em dia.
 */
async function mutate<S extends z.ZodType>(
  where: string,
  schema: S,
  input: unknown,
  run: (ctx: Ctx<z.output<S>>) => Promise<DbError>,
): Promise<ActionResult<void>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const [field, message] = Object.entries(issuesToErrors(parsed.error))[0] ?? ['_form', t.errors.generic];
    return fail('VALIDATION_FAILED', message, field === '_form' ? undefined : field);
  }
  try {
    const supabase = await createServerClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return fail('UNAUTHENTICATED', t.errors.unauthenticated);

    const error = await run({ supabase, userId: auth.user.id, data: parsed.data }) ?? await syncCompleteness(supabase, auth.user.id);
    if (error) throw new Error(`${error.code ?? 'db'}: ${error.message}`);

    revalidatePath('/perfil', 'layout');
    revalidatePath('/painel');
    return ok(undefined);
  } catch (error) {
    const requestId = crypto.randomUUID();
    logger.error('career_profile.action_failed', { where, requestId, detail: error instanceof Error ? error.message : 'unknown' });
    return fail('INTERNAL', t.errors.internal(requestId));
  }
}

export async function savePersonalData(input: unknown) {
  return mutate('savePersonalData', personalDataSchema, input, async ({ supabase, userId, data }) => {
    const { error } = await supabase.from('profiles').upsert({ user_id: userId, ...data }, { onConflict: 'user_id' });
    return error;
  });
}

export async function saveCareerProfile(input: unknown) {
  return mutate('saveCareerProfile', careerProfileSchema, input, async ({ supabase, userId, data }) => {
    const { id, skill_ids, experience_ids, ...fields } = data;
    const row = { ...fields, normalized_target_title: normalizeText(fields.target_title) || null };

    let profileId = id;
    if (profileId) {
      const { error } = await supabase.from('career_profiles').update(row).eq('id', profileId).eq('user_id', userId);
      if (error) return error;
    } else {
      const existing = await supabase.from('career_profiles').select('id', { count: 'exact', head: true }).eq('user_id', userId);
      if (existing.error) return existing.error;
      const created = await supabase.from('career_profiles')
        .insert({ ...row, user_id: userId, is_primary: (existing.count ?? 0) === 0 }).select('id').single();
      if (created.error) return created.error;
      profileId = created.data.id;
    }

    // Só associa o que é do próprio usuário (a FK sozinha não verifica o dono).
    const [ownSkills, ownExperiences] = await Promise.all([
      supabase.from('user_skills').select('skill_id').eq('user_id', userId),
      supabase.from('experiences').select('id').eq('user_id', userId),
    ]);
    if (ownSkills.error) return ownSkills.error;
    if (ownExperiences.error) return ownExperiences.error;
    const skillSet = new Set(ownSkills.data.map((s) => s.skill_id));
    const experienceSet = new Set(ownExperiences.data.map((e) => e.id));

    const clearSkills = await supabase.from('career_profile_skills').delete().eq('career_profile_id', profileId).eq('user_id', userId);
    if (clearSkills.error) return clearSkills.error;
    const skills = [...new Set(skill_ids)].filter((s) => skillSet.has(s));
    if (skills.length) {
      const { error } = await supabase.from('career_profile_skills')
        .insert(skills.map((skill_id) => ({ career_profile_id: profileId, skill_id, user_id: userId })));
      if (error) return error;
    }

    const clearExperiences = await supabase.from('career_profile_experiences').delete().eq('career_profile_id', profileId).eq('user_id', userId);
    if (clearExperiences.error) return clearExperiences.error;
    const experiences = [...new Set(experience_ids)].filter((e) => experienceSet.has(e));
    if (experiences.length) {
      const { error } = await supabase.from('career_profile_experiences').insert(
        experiences.map((experience_id, index) => ({ career_profile_id: profileId, experience_id, user_id: userId, display_order: index })),
      );
      if (error) return error;
    }
    return null;
  });
}

async function promote(supabase: ServerClient, userId: string, profileId: string): Promise<DbError> {
  // O índice único parcial só admite um primário: primeiro rebaixa, depois promove.
  const demoted = await supabase.from('career_profiles').update({ is_primary: false }).eq('user_id', userId).eq('is_primary', true);
  if (demoted.error) return demoted.error;
  return (await supabase.from('career_profiles').update({ is_primary: true }).eq('id', profileId).eq('user_id', userId)).error;
}

export async function setPrimaryCareerProfile(input: unknown) {
  return mutate('setPrimaryCareerProfile', idSchema, input, ({ supabase, userId, data }) => promote(supabase, userId, data.id));
}

export async function deleteCareerProfile(input: unknown) {
  return mutate('deleteCareerProfile', idSchema, input, async ({ supabase, userId, data }) => {
    const { error } = await supabase.from('career_profiles').delete().eq('id', data.id).eq('user_id', userId);
    if (error) return error;
    const rest = await supabase.from('career_profiles').select('id, is_primary').eq('user_id', userId).order('created_at');
    if (rest.error) return rest.error;
    const first = rest.data[0];
    return first && !rest.data.some((p) => p.is_primary) ? promote(supabase, userId, first.id) : null;
  });
}

export async function saveExperience(input: unknown) {
  return mutate('saveExperience', experienceSchema, input, async ({ supabase, userId, data }) => {
    const { id, ...fields } = data;
    return id
      ? (await supabase.from('experiences').update(fields).eq('id', id).eq('user_id', userId)).error
      : (await supabase.from('experiences').insert({ ...fields, user_id: userId })).error;
  });
}

export async function deleteExperience(input: unknown) {
  return mutate('deleteExperience', idSchema, input, async ({ supabase, userId, data }) =>
    (await supabase.from('experiences').delete().eq('id', data.id).eq('user_id', userId)).error);
}

export async function saveEducation(input: unknown) {
  return mutate('saveEducation', educationSchema, input, async ({ supabase, userId, data }) => {
    const { id, ...fields } = data;
    return id
      ? (await supabase.from('educations').update(fields).eq('id', id).eq('user_id', userId)).error
      : (await supabase.from('educations').insert({ ...fields, user_id: userId })).error;
  });
}

export async function deleteEducation(input: unknown) {
  return mutate('deleteEducation', idSchema, input, async ({ supabase, userId, data }) =>
    (await supabase.from('educations').delete().eq('id', data.id).eq('user_id', userId)).error);
}

export async function saveCertification(input: unknown) {
  return mutate('saveCertification', certificationSchema, input, async ({ supabase, userId, data }) => {
    const { id, ...fields } = data;
    return id
      ? (await supabase.from('certifications').update(fields).eq('id', id).eq('user_id', userId)).error
      : (await supabase.from('certifications').insert({ ...fields, user_id: userId })).error;
  });
}

export async function deleteCertification(input: unknown) {
  return mutate('deleteCertification', idSchema, input, async ({ supabase, userId, data }) =>
    (await supabase.from('certifications').delete().eq('id', data.id).eq('user_id', userId)).error);
}

export async function saveUserSkill(input: unknown) {
  return mutate('saveUserSkill', userSkillSchema, input, async ({ supabase, userId, data }) =>
    (await supabase.from('user_skills').upsert({ ...data, user_id: userId }, { onConflict: 'user_id,skill_id' })).error);
}

export async function deleteUserSkill(input: unknown) {
  return mutate('deleteUserSkill', idSchema, input, async ({ supabase, userId, data }) => {
    const links = await supabase.from('career_profile_skills').delete().eq('skill_id', data.id).eq('user_id', userId);
    if (links.error) return links.error;
    return (await supabase.from('user_skills').delete().eq('skill_id', data.id).eq('user_id', userId)).error;
  });
}

export async function saveLink(input: unknown) {
  return mutate('saveLink', linkSchema, input, async ({ supabase, userId, data }) =>
    (await supabase.from('profile_links').insert({ ...data, user_id: userId })).error);
}

export async function deleteLink(input: unknown) {
  return mutate('deleteLink', idSchema, input, async ({ supabase, userId, data }) =>
    (await supabase.from('profile_links').delete().eq('id', data.id).eq('user_id', userId)).error);
}

export async function saveCurrentEmployment(input: unknown) {
  return mutate('saveCurrentEmployment', currentEmploymentSchema, input, async ({ supabase, userId, data }) => {
    // Benefício não informado fica fora do jsonb: ausência não é zero (RN-001).
    const benefits: Record<string, number> = {};
    for (const key of BENEFIT_KEYS) {
      const value = data[`benefit_${key}`];
      if (value !== null) benefits[key] = value;
    }
    const { error } = await supabase.from('current_employment').upsert(
      {
        user_id: userId,
        company_name: data.company_name,
        role_title: data.role_title,
        started_at: data.started_at,
        contract_type: data.contract_type,
        work_model: data.work_model,
        base_salary: data.base_salary,
        bonus_annual: data.bonus_annual,
        benefits,
        commute_cost_monthly: data.commute_cost_monthly,
        commute_minutes_daily: data.commute_minutes_daily,
        satisfaction: data.satisfaction,
        notes: data.notes,
      },
      { onConflict: 'user_id' },
    );
    return error;
  });
}

export async function deleteCurrentEmployment() {
  return mutate('deleteCurrentEmployment', idSchema.partial(), {}, async ({ supabase, userId }) =>
    (await supabase.from('current_employment').delete().eq('user_id', userId)).error);
}
