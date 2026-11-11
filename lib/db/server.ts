import 'server-only';
import { createServerClient as createSsrClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Database } from './database.types';

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/** Cliente com a sessão do usuário: toda consulta passa pela RLS. */
export async function createServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('SUPABASE_NOT_CONFIGURED');

  const store = await cookies();
  return createSsrClient<Database>(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Server Component não pode gravar cookie; o middleware já renova a sessão.
        }
      },
    },
  });
}

export type ServerClient = Awaited<ReturnType<typeof createServerClient>>;

/** Sessão obrigatória para Server Components de (app). */
export async function requireUser() {
  const supabase = await createServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/login');
  return { supabase, user: data.user };
}
