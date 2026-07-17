export function formatReference(reference?: string): string {
  if (!reference || !/^\d{6}$/.test(reference)) return reference ?? '';
  return `${reference.substring(4, 6)}/${reference.substring(0, 4)}`;
}
