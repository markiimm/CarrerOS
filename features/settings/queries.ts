import 'server-only';
import type { ServerClient } from '@/lib/db/server';
import { DENSITIES, THEMES } from './schemas';

type Theme = (typeof THEMES)[number];
type Density = (typeof DENSITIES)[number];

const oneOf = <T extends string>(values: readonly T[], value: unknown, fallback: T): T =>
  values.includes(value as T) ? (value as T) : fallback;

/** Preferências de aparência; sem linha em user_settings valem os padrões do schema. */
export async function getAppearance(supabase: ServerClient, userId: string): Promise<{ theme: Theme; density: Density }> {
  const { data, error } = await supabase.from('user_settings').select('theme, density').eq('user_id', userId).maybeSingle();
  if (error) throw new Error(`QUERY_FAILED:user_settings:${error.code}`);
  return { theme: oneOf(THEMES, data?.theme, 'dark'), density: oneOf(DENSITIES, data?.density, 'comfortable') };
}
