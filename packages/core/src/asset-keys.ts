/** Only same-origin asset paths count; external URLs never own storage keys. */
export function extractAssetKeys(blocks: readonly unknown[]): Set<string> {
  const keys = new Set<string>();
  function visit(value: unknown) {
    if (typeof value === 'string') {
      if (value.startsWith('/api/assets/') && value.length > 12)
        keys.add(value.slice('/api/assets/'.length));
    } else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object')
      Object.values(value).forEach(visit);
  }
  blocks.forEach(visit);
  return keys;
}
