import 'server-only';
import type { ServerClient } from '@/lib/db/server';
import { getCareerProfiles } from './queries';

export type DbError = { message: string; code?: string } | null;

/** Persiste career_profiles.completeness, lido pelo Opportunity Score (documento 08). */
export async function syncCompleteness(supabase: ServerClient, userId: string): Promise<DbError> {
  for (const profile of await getCareerProfiles(supabase, userId)) {
    if (profile.completeness === profile.computed.score) continue;
    const { error } = await supabase.from('career_profiles')
      .update({ completeness: profile.computed.score }).eq('id', profile.id).eq('user_id', userId);
    if (error) return error;
  }
  return null;
}
