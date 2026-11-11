import 'server-only';
import type { ServerClient } from '@/lib/db/server';

export const PLANS = ['personal', 'premium'] as const;
export type Plan = (typeof PLANS)[number];

export interface PlanInfo {
  plan: Plan;
  isPremium: boolean;
  maxUploadMb: number;
}

/**
 * Plano do usuário, lido de user_limits (a fonte da verdade). A linha é somente leitura para o
 * usuário (migration 0020), então o valor não pode ser forjado pelo cliente. Na dúvida, "personal".
 */
export async function getPlanInfo(supabase: ServerClient, userId: string): Promise<PlanInfo> {
  const { data } = await supabase.from('user_limits').select('plan, max_upload_mb').eq('user_id', userId).maybeSingle();
  const plan: Plan = data?.plan === 'premium' ? 'premium' : 'personal';
  return { plan, isPremium: plan === 'premium', maxUploadMb: data?.max_upload_mb ?? 10 };
}
