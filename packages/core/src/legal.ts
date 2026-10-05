export const TERMS_VERSION = '2026-10-v2';
export function hasAcceptedCurrentTerms(user: {
  termsAcceptedAt: unknown;
  termsVersion: string | null;
}) {
  return Boolean(
    user.termsAcceptedAt &&
    user.termsVersion &&
    user.termsVersion >= TERMS_VERSION,
  );
}
