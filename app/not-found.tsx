import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { t } from '@/lib/i18n/pt-BR';

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center p-6 text-center">
      <div className="grid gap-3">
        <h1 className="text-xl font-semibold">{t.errors.notFoundTitle}</h1>
        <p className="text-muted-foreground">{t.errors.notFoundBody}</p>
        <Button asChild className="mx-auto">
          <Link href="/painel">{t.errors.backToPanel}</Link>
        </Button>
      </div>
    </main>
  );
}
