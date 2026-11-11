'use client';

import * as React from 'react';
import { Checkbox, Input, Label, Select, Textarea } from '@/components/ui/input';
import { t } from '@/lib/i18n/pt-BR';
import { cn } from '@/lib/utils/cn';
import { useFieldError } from './action-form';

interface BaseProps {
  name: string;
  label: string;
  hint?: string;
  optional?: boolean;
  className?: string;
}

function Shell({ name, label, hint, optional, className, children }: BaseProps & { children: React.ReactNode }) {
  const error = useFieldError(name);
  return (
    <div className={cn('grid content-start gap-1.5', className)}>
      <Label htmlFor={name}>
        {label}
        {optional ? <span className="ml-1 font-normal text-muted-foreground">({t.common.optional})</span> : null}
      </Label>
      {children}
      {error ? (
        <p id={`${name}-error`} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

const aria = (name: string, error?: string) => ({
  id: name,
  name,
  'aria-invalid': Boolean(error),
  'aria-describedby': error ? `${name}-error` : undefined,
});

type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'name' | 'className'>;

export function TextField({ name, label, hint, optional, className, ...input }: BaseProps & InputProps) {
  const error = useFieldError(name);
  return (
    <Shell {...{ name, label, hint, optional, className }}>
      <Input {...aria(name, error)} {...input} />
    </Shell>
  );
}

/** Valor monetário ou numérico: aceita vírgula decimal, normalizada no schema. */
export function NumberField(props: BaseProps & InputProps) {
  return <TextField inputMode="decimal" autoComplete="off" {...props} />;
}

export function TextareaField({
  name, label, hint, optional, className, ...area
}: BaseProps & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'name' | 'className'>) {
  const error = useFieldError(name);
  return (
    <Shell {...{ name, label, hint, optional, className }}>
      <Textarea {...aria(name, error)} {...area} />
    </Shell>
  );
}

export interface Option {
  value: string;
  label: string;
  group?: string;
}

export function SelectField({
  name, label, hint, optional, className, options, placeholder = t.common.select, ...select
}: BaseProps & { options: Option[]; placeholder?: string | null } &
  Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'name' | 'className'>) {
  const error = useFieldError(name);
  const groups = new Map<string, Option[]>();
  for (const option of options) {
    const key = option.group ?? '';
    groups.set(key, [...(groups.get(key) ?? []), option]);
  }
  const render = (list: Option[]) => list.map((o) => <option key={o.value} value={o.value}>{o.label}</option>);
  return (
    <Shell {...{ name, label, hint, optional, className }}>
      <Select {...aria(name, error)} {...select}>
        {placeholder === null ? null : <option value="">{placeholder}</option>}
        {[...groups.entries()].map(([group, list]) =>
          group ? <optgroup key={group} label={group}>{render(list)}</optgroup> : render(list),
        )}
      </Select>
    </Shell>
  );
}

export function CheckboxField({
  name, label, defaultChecked, className,
}: { name: string; label: string; defaultChecked?: boolean; className?: string }) {
  return (
    <label className={cn('flex min-h-8 items-center gap-2 text-sm', className)}>
      <Checkbox name={name} defaultChecked={defaultChecked} />
      {label}
    </label>
  );
}

export function CheckboxGroup({
  name, label, options, defaultValues = [], emptyText, className,
}: {
  name: string;
  label: string;
  options: Option[];
  defaultValues?: string[];
  emptyText?: string;
  className?: string;
}) {
  const error = useFieldError(name);
  return (
    <fieldset className={cn('grid gap-1.5', className)}>
      <legend className="mb-1.5 text-13 font-medium">{label}</legend>
      {options.length === 0 && emptyText ? <p className="text-13 text-muted-foreground">{emptyText}</p> : null}
      <div className="flex flex-wrap gap-x-5 gap-y-1">
        {options.map((option) => (
          <label key={option.value} className="flex min-h-8 items-center gap-2 text-sm">
            <Checkbox name={`${name}[]`} value={option.value} defaultChecked={defaultValues.includes(option.value)} />
            {option.label}
          </label>
        ))}
      </div>
      {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
    </fieldset>
  );
}

export function FieldRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('grid gap-4 sm:grid-cols-2', className)}>{children}</div>;
}
