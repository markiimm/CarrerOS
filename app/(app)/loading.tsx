import { Skeleton } from '@/components/ui/card';
import { t } from '@/lib/i18n/pt-BR';

export default function AppLoading() {
  return (
    <div role="status" aria-label={t.common.loading} className="grid gap-6">
      <div className="grid gap-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-28" />)}
      </div>
    </div>
  );
}
