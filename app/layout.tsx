import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import { t } from '@/lib/i18n/pt-BR';
import './globals.css';

const sans = Inter({ subsets: ['latin'], display: 'swap', weight: ['400', '500', '600'], variable: '--font-sans' });
const mono = JetBrains_Mono({ subsets: ['latin'], display: 'swap', weight: ['400', '500'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: { default: t.app.name, template: `%s · ${t.app.name}` },
  description: t.app.description,
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="data-theme" defaultTheme="dark" enableSystem disableTransitionOnChange>
          {children}
          <Toaster position="bottom-right" theme="system" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
