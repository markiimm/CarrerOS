import 'server-only';
import type { Tables } from '@/lib/db/database.types';
import type { ServerClient } from '@/lib/db/server';
import { computeCompleteness, type Completeness } from './completeness';
import { BENEFIT_KEYS, type BenefitKey } from './schemas';

function unwrap<T>(result: { data: T | null; error: { message: string; code?: string } | null }, what: string): T {
  if (result.error || result.data === null) {
    throw new Error(`QUERY_FAILED:${what}:${result.error?.code ?? 'no_data'}`);
  }
  return result.data;
}

export type CareerProfileView = Tables<'career_profiles'> & {
  skillIds: string[];
  experienceIds: string[];
  computed: Completeness;
};

export type UserSkillView = Tables<'user_skills'> & { name: string; category: string };

/** Perfis profissionais com associações e completude calculada agora (não a persistida). */
export async function getCareerProfiles(supabase: ServerClient, userId: string): Promise<CareerProfileView[]> {
  const [profile, careerProfiles, skillLinks, experienceLinks, educations, links] = await Promise.all([
    supabase.from('profiles').select('city, state').eq('user_id', userId).maybeSingle(),
    supabase.from('career_profiles').select('*').eq('user_id', userId)
      .order('is_primary', { ascending: false }).order('created_at', { ascending: true }),
    supabase.from('career_profile_skills').select('career_profile_id, skill_id').eq('user_id', userId),
    supabase.from('career_profile_experiences').select('career_profile_id, experience_id').eq('user_id', userId),
    supabase.from('educations').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('profile_links').select('id', { count: 'exact', head: true }).eq('user_id', userId),
  ]);

  const skills = unwrap(skillLinks, 'career_profile_skills');
  const experiences = unwrap(experienceLinks, 'career_profile_experiences');

  return unwrap(careerProfiles, 'career_profiles').map((row) => {
    const skillIds = skills.filter((s) => s.career_profile_id === row.id).map((s) => s.skill_id);
    const experienceIds = experiences.filter((e) => e.career_profile_id === row.id).map((e) => e.experience_id);
    return {
      ...row,
      skillIds,
      experienceIds,
      computed: computeCompleteness({
        targetTitle: row.target_title,
        seniority: row.seniority,
        yearsExperience: row.years_experience,
        summary: row.summary,
        profileSkillCount: skillIds.length,
        profileExperienceCount: experienceIds.length,
        educationCount: educations.count ?? 0,
        linkCount: links.count ?? 0,
        city: profile.data?.city ?? null,
        state: profile.data?.state ?? null,
      }),
    };
  });
}

export async function getProfileOverview(supabase: ServerClient, userId: string) {
  const [personal, careerProfiles, userSkills, catalog, links, experiences] = await Promise.all([
    supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
    getCareerProfiles(supabase, userId),
    supabase.from('user_skills').select('*').eq('user_id', userId),
    supabase.from('skills').select('id, name, category').eq('is_active', true).order('name'),
    supabase.from('profile_links').select('*').eq('user_id', userId).order('created_at'),
    supabase.from('experiences').select('id, role_title, company_name').eq('user_id', userId)
      .order('start_date', { ascending: false }),
  ]);

  const skillCatalog = unwrap(catalog, 'skills');
  const byId = new Map(skillCatalog.map((s) => [s.id, s]));
  const skills: UserSkillView[] = unwrap(userSkills, 'user_skills')
    .map((row) => ({ ...row, name: byId.get(row.skill_id)?.name ?? '', category: byId.get(row.skill_id)?.category ?? 'other' }))
    .filter((row) => row.name)
    .sort((a, b) => b.level - a.level || a.name.localeCompare(b.name, 'pt-BR'));

  if (personal.error) throw new Error(`QUERY_FAILED:profiles:${personal.error.code}`);

  return {
    personal: personal.data,
    careerProfiles,
    skills,
    skillCatalog,
    links: unwrap(links, 'profile_links'),
    experiences: unwrap(experiences, 'experiences'),
  };
}

export async function getHistory(supabase: ServerClient, userId: string) {
  const [experiences, educations, certifications] = await Promise.all([
    supabase.from('experiences').select('*').eq('user_id', userId)
      .order('is_current', { ascending: false }).order('start_date', { ascending: false }),
    supabase.from('educations').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('certifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
  ]);
  return {
    experiences: unwrap(experiences, 'experiences'),
    educations: unwrap(educations, 'educations'),
    certifications: unwrap(certifications, 'certifications'),
  };
}

export type CurrentEmploymentView = Omit<Tables<'current_employment'>, 'benefits'> & {
  benefits: Partial<Record<BenefitKey, number>>;
};

export async function getCurrentEmployment(supabase: ServerClient, userId: string): Promise<CurrentEmploymentView | null> {
  const { data, error } = await supabase.from('current_employment').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw new Error(`QUERY_FAILED:current_employment:${error.code}`);
  if (!data) return null;

  // benefits é jsonb: só entram as chaves conhecidas com valor numérico.
  const raw = data.benefits && typeof data.benefits === 'object' && !Array.isArray(data.benefits) ? data.benefits : {};
  const benefits: Partial<Record<BenefitKey, number>> = {};
  for (const key of BENEFIT_KEYS) {
    const value = raw[key];
    if (typeof value === 'number') benefits[key] = value;
  }
  return { ...data, benefits };
}
