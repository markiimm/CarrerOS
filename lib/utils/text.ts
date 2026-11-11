/** Mesma normalização de public.careeros_normalize (migration 0001): sem acento, minúsculo, só [a-z0-9]. */
export function normalizeText(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
