import 'server-only';
import { z } from 'zod';
import type { ServerClient } from '@/lib/db/server';

// Forma devolvida por public.dashboard_counters() (migration 0017). Validada na borda:
// se a função mudar, o painel falha de forma explícita em vez de exibir número errado.
const countersSchema = z.object({
  new_jobs_24h: z.number(),
  high_score_jobs: z.number(),
  active_applications: z.number(),
  interviews_next_7d: z.number(),
  overdue_actions: z.number(),
  stale_applications: z.number(),
  pending_linkedin_findings: z.number(),
  ai_cost_cycle_usd: z.number().nullable(),
  ai_cost_cap_usd: z.number().nullable(),
  has_collected_jobs: z.boolean(),
  has_linkedin_audit: z.boolean(),
});

export interface DashboardData {
  /** `null` = não há base para medir (RF-DSH-08). Nunca é convertido em zero. */
  counters: {
    newJobs24h: number | null;
    highScoreJobs: number | null;
    activeApplications: number | null;
    interviewsNext7d: number | null;
    overdueActions: number | null;
    staleApplications: number | null;
    pendingLinkedinFindings: number | null;
    aiCostUsd: number | null;
    aiCapUsd: number | null;
  };
  setup: Record<'personal' | 'careerProfile' | 'skills' | 'experience' | 'employment', boolean>;
}

export async function getDashboard(supabase: ServerClient, userId: string): Promise<DashboardData> {
  const count = { count: 'exact', head: true } as const;
  const [rpc, applications, profile, careerProfiles, skills, experiences, employment] = await Promise.all([
    supabase.rpc('dashboard_counters'),
    supabase.from('applications').select('id', count).eq('user_id', userId),
    supabase.from('profiles').select('full_name, city, accepted_work_models').eq('user_id', userId).maybeSingle(),
    supabase.from('career_profiles').select('id', count).eq('user_id', userId),
    supabase.from('user_skills').select('skill_id', count).eq('user_id', userId),
    supabase.from('experiences').select('id', count).eq('user_id', userId),
    supabase.from('current_employment').select('id', count).eq('user_id', userId),
  ]);

  for (const [name, result] of Object.entries({ rpc, applications, profile, careerProfiles, skills, experiences, employment })) {
    if (result.error) throw new Error(`QUERY_FAILED:dashboard.${name}:${result.error.code}`);
  }

  const c = countersSchema.parse(rpc.data);
  const hasApplications = (applications.count ?? 0) > 0;
  const jobs = (value: number) => (c.has_collected_jobs ? value : null);
  const apps = (value: number) => (hasApplications ? value : null);

  return {
    counters: {
      newJobs24h: jobs(c.new_jobs_24h),
      highScoreJobs: jobs(c.high_score_jobs),
      activeApplications: apps(c.active_applications),
      interviewsNext7d: apps(c.interviews_next_7d),
      overdueActions: apps(c.overdue_actions),
      staleApplications: apps(c.stale_applications),
      pendingLinkedinFindings: c.has_linkedin_audit ? c.pending_linkedin_findings : null,
      aiCostUsd: c.ai_cost_cap_usd === null ? null : c.ai_cost_cycle_usd,
      aiCapUsd: c.ai_cost_cap_usd,
    },
    setup: {
      personal: Boolean(profile.data?.full_name?.trim() && profile.data.city?.trim() && profile.data.accepted_work_models.length),
      careerProfile: (careerProfiles.count ?? 0) > 0,
      skills: (skills.count ?? 0) > 0,
      experience: (experiences.count ?? 0) > 0,
      employment: (employment.count ?? 0) > 0,
    },
  };
}
