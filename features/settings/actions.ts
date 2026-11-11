'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/db/server';
import { t } from '@/lib/i18n/pt-BR';
import { logger } from '@/lib/utils/logger';
import { fail, ok, type ActionResult } from '@/lib/utils/result';
import { appearanceSchema } from './schemas';

export async function saveAppearance(input: unknown): Promise<ActionResult<void>> {
  const parsed = appearanceSchema.safeParse(input);
  if (!parsed.success) return fail('VALIDATION_FAILED', t.errors.invalidOption);
  try {
    const supabase = await createServerClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return fail('UNAUTHENTICATED', t.errors.unauthenticated);
    const { error } = await supabase.from('user_settings')
      .upsert({ user_id: auth.user.id, ...parsed.data }, { onConflict: 'user_id' });
    if (error) throw new Error(`${error.code}: ${error.message}`);
    revalidatePath('/', 'layout');
    return ok(undefined);
  } catch (error) {
    const requestId = crypto.randomUUID();
    logger.error('settings.action_failed', { where: 'saveAppearance', requestId, detail: error instanceof Error ? error.message : 'unknown' });
    return fail('INTERNAL', t.errors.internal(requestId));
  }
}
