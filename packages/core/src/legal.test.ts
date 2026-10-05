import { describe, expect, it } from 'vitest';
import { hasAcceptedCurrentTerms, TERMS_VERSION } from './legal';
describe('terms versions', () => {
  it('requires renewed acceptance for v1 and missing versions', () => {
    for (const termsVersion of ['2026-10-v1', null])
      expect(
        hasAcceptedCurrentTerms({ termsVersion, termsAcceptedAt: new Date() }),
      ).toBe(false);
  });
  it('requires the acceptance timestamp', () =>
    expect(
      hasAcceptedCurrentTerms({
        termsVersion: TERMS_VERSION,
        termsAcceptedAt: null,
      }),
    ).toBe(false));
  it('accepts current and newer versions', () => {
    for (const termsVersion of [TERMS_VERSION, '2026-10-v3'])
      expect(
        hasAcceptedCurrentTerms({ termsVersion, termsAcceptedAt: new Date() }),
      ).toBe(true);
  });
});
