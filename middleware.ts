import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Documento 12 §7. Rota pública nova entra SOMENTE aqui e em app/(auth).
const AUTH_PAGES = ['/login', '/cadastro', '/recuperar-senha'];
const OPEN_PATHS = ['/auth/confirm', '/nova-senha'];

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const isAuthPage = AUTH_PAGES.includes(pathname);

  const redirect = (to: string) => {
    const target = request.nextUrl.clone();
    const [path, query] = to.split('?');
    target.pathname = path ?? '/';
    target.search = query ? `?${query}` : '';
    const res = NextResponse.redirect(target);
    response.cookies.getAll().forEach((c) => res.cookies.set(c));
    return res;
  };

  // Sem Supabase configurado ninguém tem sessão: tudo que é protegido vai para /login,
  // que exibe o aviso de configuração pendente.
  if (!url || !key) {
    return isAuthPage || OPEN_PATHS.includes(pathname) ? response : redirect('/login');
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookies) => {
        cookies.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // getUser() revalida o JWT no servidor de autenticação e renova o refresh token.
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  if (OPEN_PATHS.includes(pathname)) return response;
  if (isAuthPage) return user ? redirect('/painel') : response;
  if (pathname === '/') return redirect(user ? '/painel' : '/login');
  if (!user) return redirect(`/login?next=${encodeURIComponent(pathname + search)}`);
  return response;
}

export const config = {
  // api/cron autentica por CRON_SECRET e não passa por aqui.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/cron|.*\\.(?:png|jpg|svg|webp|ico)$).*)'],
};
