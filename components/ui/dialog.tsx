'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import * as React from 'react';
import { t } from '@/lib/i18n/pt-BR';
import { cn } from '@/lib/utils/cn';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  title,
  description,
  children,
  className,
  side,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  /** 'left' transforma o diálogo em gaveta lateral (menu em telas pequenas). */
  side?: 'left';
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm data-[state=open]:animate-fade-in" />
      <DialogPrimitive.Content
        className={cn(
          'fixed z-50 border-border bg-popover text-foreground shadow-2xl focus:outline-none data-[state=open]:animate-fade-in',
          side === 'left'
            ? 'inset-y-0 left-0 w-[280px] overflow-y-auto border-r'
            : 'left-1/2 top-1/2 max-h-[90dvh] w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border p-5',
          className,
        )}
      >
        <div className={cn(side === 'left' ? 'sr-only' : 'mb-4 pr-8')}>
          <DialogPrimitive.Title className="text-base font-semibold">{title}</DialogPrimitive.Title>
          {description ? (
            <DialogPrimitive.Description className="mt-1 text-13 text-muted-foreground">
              {description}
            </DialogPrimitive.Description>
          ) : (
            <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
          )}
        </div>
        {children}
        <DialogPrimitive.Close
          aria-label={t.common.close}
          className="absolute right-3 top-3 rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-4" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
