'use client';

import { TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { t } from '@/lib/i18n/pt-BR';

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="mx-auto grid max-w-md justify-items-center gap-3 py-16 text-center">
      <TriangleAlert aria-hidden className="size-8 text-warning" />
      <h1 className="text-xl font-semibold">{t.errors.pageTitle}</h1>
      <p className="text-muted-foreground">{t.errors.pageBody}</p>
      {error.digest ? (
        <p className="text-13 text-muted-foreground">
          {t.errors.pageCode}: <code className="font-mono">{error.digest}</code>
        </p>
      ) : null}
      <Button onClick={reset}>{t.common.tryAgain}</Button>
    </div>
  );
}
