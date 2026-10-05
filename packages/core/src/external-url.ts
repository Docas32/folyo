/** Canonical external navigation URL, or undefined for incomplete/unsafe input.
 * Preserve paths/case; only the scheme is lowercased. Never accept executable,
 * app-relative, credential-bearing or protocol-relative navigation.
 */
export function normalizeExternalUrl(input: string): string | undefined {
  const value = input.trim();
  if (
    !value ||
    /[\s\\]/.test(value) ||
    [...value].some(
      (char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127,
    ) ||
    /^[/?#]/.test(value)
  )
    return undefined;
  const scheme = value.match(/^([a-z][a-z0-9+.-]*):/i);
  if (scheme && !['http', 'https', 'mailto'].includes(scheme[1]!.toLowerCase()))
    return undefined;
  const normalized = scheme
    ? scheme[1]!.toLowerCase() + value.slice(scheme[1]!.length)
    : `https://${value}`;
  try {
    const url = new URL(normalized);
    if (url.protocol === 'mailto:')
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(url.pathname)
        ? normalized
        : undefined;
    if (!/^https?:\/\//.test(normalized)) return undefined;
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      (!scheme && !url.hostname.includes('.'))
    )
      return undefined;
    return normalized;
  } catch {
    return undefined;
  }
}
