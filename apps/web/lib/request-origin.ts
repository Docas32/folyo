/** Browser Origin must match the request's public Host, even when Next builds
 * request.url from its internal 0.0.0.0 listener. Forwarded hosts are not trusted. */
export function hasSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin || origin === 'null') return false;
  try {
    const internal = new URL(request.url);
    const host = request.headers.get('host');
    if (host !== null && (!host || /[\s/\\?#@]/.test(host))) return false;
    const expected =
      host === null
        ? internal.origin
        : new URL(`${internal.protocol}//${host}`).origin;
    // Origin headers contain exactly an origin, without paths or credentials.
    return origin === new URL(origin).origin && origin === expected;
  } catch {
    return false;
  }
}
