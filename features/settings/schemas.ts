import { z } from 'zod';
import { choice } from '@/lib/validation';

export const THEMES = ['dark', 'light', 'system'] as const;
export const DENSITIES = ['comfortable', 'compact'] as const;

export const appearanceSchema = z.object({ theme: choice(THEMES).optional(), density: choice(DENSITIES).optional() });
