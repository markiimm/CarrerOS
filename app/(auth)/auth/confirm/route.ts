import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { safeNext } from '@/features/auth/schemas';
import { createServerClient, isSupabaseConfigured } from '@/lib/db/server';

const OTP_TYPES: EmailOtpType[] = ['signup', 'magiclink', 'recovery', 'invite', 'email', 'email_change'];

// Destino dos links de e-mail (confirmação, magic link, recuperação).
// Aceita os dois formatos do Supabase: ?code= (PKCE) e ?token_hash=&type= (template próprio).
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const target = request.nextUrl.clone();
  target.search = '';

  if (isSupabaseConfigured()) {
    const supabase = await createServerClient();
    const code = params.get('code');
    const tokenHash = params.get('token_hash');
    const type = params.get('type') as EmailOtpType | null;

    let failed = true;
    if (code) {
      failed = Boolean((await supabase.auth.exchangeCodeForSession(code)).error);
    } else if (tokenHash && type && OTP_TYPES.includes(type)) {
      failed = Boolean((await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error);
    }

    if (!failed) {
      const [path, query] = safeNext(params.get('next')).split('?');
      target.pathname = path ?? '/painel';
      target.search = query ? `?${query}` : '';
      return NextResponse.redirect(target);
    }
  }

  target.pathname = '/login';
  target.search = '?erro=link';
  return NextResponse.redirect(target);
}
