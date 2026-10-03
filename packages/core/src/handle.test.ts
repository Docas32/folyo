import { describe, expect, it } from 'vitest';
import { availableHandleSchema, handleSchema, RESERVED_HANDLES } from './index';

describe('handles', () => {
  it.each(['maria', 'ana-silva', 'abc', '123', 'a--b', 'a'.repeat(30)])(
    'accepts %s',
    (handle) => {
      expect(handleSchema.parse(handle)).toBe(handle);
    },
  );
  it.each([
    'ab',
    'a'.repeat(31),
    '-maria',
    'maria-',
    'a_b',
    'ábc',
    'a.b',
    'a b',
    '',
    '<script>',
  ])('rejects %s', (handle) => {
    expect(handleSchema.safeParse(handle).success).toBe(false);
  });
  it('normalizes before validating', () => {
    expect(handleSchema.parse('  Maria-Silva  ')).toBe('maria-silva');
  });
  it.each(RESERVED_HANDLES)('rejects reserved %s', (handle) => {
    expect(
      availableHandleSchema.safeParse(` ${handle.toUpperCase()} `).success,
    ).toBe(false);
  });
});
