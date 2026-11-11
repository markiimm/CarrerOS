import type { Config } from 'tailwindcss';

const token = (name: string) => `hsl(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: ['selector', ':root:not([data-theme="light"])'],
  content: ['./app/**/*.{ts,tsx}', './features/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: token('background'),
        foreground: token('foreground'),
        card: { DEFAULT: token('card'), foreground: token('card-foreground') },
        popover: token('popover'),
        muted: { DEFAULT: token('muted'), foreground: token('muted-foreground') },
        border: token('border'),
        input: token('input'),
        ring: token('ring'),
        primary: { DEFAULT: token('primary'), foreground: token('primary-foreground') },
        secondary: token('secondary'),
        accent: token('accent'),
        success: token('success'),
        warning: token('warning'),
        destructive: token('destructive'),
        info: token('info'),
        unknown: token('unknown'),
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        xs: ['0.75rem', '1rem'],
        '13': ['0.8125rem', '1.125rem'],
        sm: ['0.875rem', '1.25rem'],
      },
    },
  },
  plugins: [],
};

export default config;
