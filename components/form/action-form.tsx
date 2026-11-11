'use client';

import * as React from 'react';
import { toast } from 'sonner';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { t } from '@/lib/i18n/pt-BR';
import { cn } from '@/lib/utils/cn';
import { formToObject, issuesToErrors } from '@/lib/utils/form';
import type { ActionResult } from '@/lib/utils/result';

type Action = (input: unknown) => Promise<ActionResult<unknown>>;

const ErrorsContext = React.createContext<Record<string, string>>({});
export const useFieldError = (name: string) => React.useContext(ErrorsContext)[name];

interface ActionFormProps {
  /** O MESMO schema que a Server Action usa (documento 15 §8). */
  schema: z.ZodType;
  action: Action;
  children: React.ReactNode;
  submitLabel?: string;
  pendingLabel?: string;
  successMessage?: string | null;
  onSuccess?: (data: unknown) => void;
  footer?: React.ReactNode;
  className?: string;
}

export function ActionForm({
  schema,
  action,
  children,
  submitLabel = t.common.save,
  pendingLabel = t.common.saving,
  successMessage = t.common.saved,
  onSuccess,
  footer,
  className,
}: ActionFormProps) {
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, startTransition] = React.useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const raw = formToObject(new FormData(event.currentTarget));
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      setErrors(issuesToErrors(parsed.error));
      return;
    }
    setErrors({});
    startTransition(async () => {
      const result = await action(raw);
      if (!result.ok) {
        if (result.error.field) setErrors({ [result.error.field]: result.error.message });
        else setErrors({ _form: result.error.message });
        return;
      }
      if (successMessage) toast.success(successMessage);
      onSuccess?.(result.data);
    });
  }

  return (
    <ErrorsContext.Provider value={errors}>
      <form onSubmit={onSubmit} noValidate className={cn('grid gap-4', className)}>
        {children}
        {errors._form ? (
          <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-13 text-destructive">
            {errors._form}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center justify-end gap-2">
          {footer}
          <Button type="submit" disabled={pending}>
            {pending ? pendingLabel : submitLabel}
          </Button>
        </div>
      </form>
    </ErrorsContext.Provider>
  );
}

/** Formulário dentro de diálogo; fecha sozinho quando a action devolve ok. */
export function FormDialog({
  trigger,
  title,
  description,
  ...form
}: Omit<ActionFormProps, 'footer'> & { trigger: React.ReactNode; title: string; description?: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title={title} description={description}>
        <ActionForm
          {...form}
          onSuccess={(data) => {
            setOpen(false);
            form.onSuccess?.(data);
          }}
          footer={
            <DialogClose asChild>
              <Button variant="ghost">{t.common.cancel}</Button>
            </DialogClose>
          }
        />
      </DialogContent>
    </Dialog>
  );
}

/** Confirmação obrigatória de ação destrutiva (documento 15 §8). */
export function ConfirmAction({
  trigger,
  title,
  body,
  action,
  confirmLabel = t.common.remove,
  successMessage = t.common.removed,
}: {
  trigger: React.ReactNode;
  title: string;
  body: string;
  action: () => Promise<ActionResult<unknown>>;
  confirmLabel?: string;
  successMessage?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success(successMessage);
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title={title} description={body} className="max-w-md">
        <div className="flex justify-end gap-2">
          <DialogClose asChild>
            <Button variant="ghost">{t.common.cancel}</Button>
          </DialogClose>
          <Button variant="destructive" onClick={confirm} disabled={pending}>
            {pending ? t.common.removing : confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
