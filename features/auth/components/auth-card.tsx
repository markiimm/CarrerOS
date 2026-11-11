import Link from 'next/link';
import * as React from 'react';

export function AuthCard({
  title,
  subtitle,
  alert,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  alert?: string | null;
  children: React.ReactNode;
  footer?: { text?: string; href: string; link: string };
}) {
  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="mt-1 text-13 text-muted-foreground">{subtitle}</p>
      </div>
      {alert ? (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-13 text-destructive">
          {alert}
        </p>
      ) : null}
      {children}
      {footer ? (
        <p className="text-13 text-muted-foreground">
          {footer.text ? `${footer.text} ` : null}
          <Link href={footer.href} className="text-primary underline-offset-4 hover:underline">
            {footer.link}
          </Link>
        </p>
      ) : null}
    </div>
  );
}
