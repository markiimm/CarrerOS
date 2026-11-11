'use client';

import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react';
import { useTheme } from 'next-themes';
import * as React from 'react';
import { toast } from 'sonner';
import { t } from '@/lib/i18n/pt-BR';
import { cn } from '@/lib/utils/cn';
import { saveAppearance } from '../actions';
import { DENSITIES, THEMES } from '../schemas';

type Theme = (typeof THEMES)[number];
type Density = (typeof DENSITIES)[number];

const THEME_ICONS: Record<Theme, LucideIcon> = { dark: Moon, light: Sun, system: Monitor };

function Choice({
  legend, name, value, options, onChange,
}: {
  legend: string;
  name: string;
  value: string;
  options: Array<{ value: string; label: string; icon?: LucideIcon }>;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-2 text-13 font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map(({ value: optionValue, label, icon: Icon }) => (
          <label
            key={optionValue}
            className={cn(
              'flex h-10 cursor-pointer items-center gap-2 rounded-md border border-border px-4 text-sm transition-colors hover:bg-secondary has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
              value === optionValue && 'border-primary bg-primary/10 font-medium',
            )}
          >
            <input type="radio" name={name} value={optionValue} checked={value === optionValue} onChange={() => onChange(optionValue)} className="sr-only" />
            {Icon ? <Icon aria-hidden className="size-4" /> : null}
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Aplica na hora e persiste na conta; em erro, volta ao valor anterior (RNF-RES-07). */
export function AppearanceForm({ theme, density }: { theme: Theme; density: Density }) {
  const { setTheme } = useTheme();
  const [state, setState] = React.useState({ theme, density });
  const [, startTransition] = React.useTransition();

  function apply(next: { theme: Theme; density: Density }) {
    const previous = state;
    setState(next);
    setTheme(next.theme);
    startTransition(async () => {
      const result = await saveAppearance(next);
      if (result.ok) {
        toast.success(t.common.saved);
      } else {
        setState(previous);
        setTheme(previous.theme);
        toast.error(result.error.message);
      }
    });
  }

  const a = t.settings.appearance;
  return (
    <div className="grid gap-6">
      <Choice
        legend={a.theme}
        name="theme"
        value={state.theme}
        options={THEMES.map((value) => ({ value, label: t.theme[value], icon: THEME_ICONS[value] }))}
        onChange={(value) => apply({ ...state, theme: value as Theme })}
      />
      <Choice
        legend={a.density}
        name="density"
        value={state.density}
        options={DENSITIES.map((value) => ({ value, label: a.densities[value] ?? value }))}
        onChange={(value) => apply({ ...state, density: value as Density })}
      />
    </div>
  );
}

/** Leva a preferência salva na conta para um navegador que ainda não a conhece. */
export function ThemeSync({ theme }: { theme: Theme }) {
  const { theme: current, setTheme } = useTheme();
  const synced = React.useRef(false);
  React.useEffect(() => {
    if (synced.current) return;
    synced.current = true;
    if (current !== theme) setTheme(theme);
  }, [current, theme, setTheme]);
  return null;
}
