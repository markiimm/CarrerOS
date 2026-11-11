import { createBrowserClient as createSsrBrowserClient } from '@supabase/ssr';
import type { Database } from './database.types';

/** Cliente de navegador (anon + JWT do usuário, sob RLS). */
export function createBrowserClient() {
  return createSsrBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
