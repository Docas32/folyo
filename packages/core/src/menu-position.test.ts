import { describe, expect, it } from 'vitest';
import { getMenuPosition } from './menu-position';
const size = {
  width: 220,
  height: 160,
  viewportWidth: 800,
  viewportHeight: 600,
};
describe('getMenuPosition', () => {
  it.each([
    [
      'sidebar at left edge',
      { left: 176, right: 204, top: 80 },
      size,
      { left: 212, top: 80 },
    ],
    [
      'top page',
      { left: 176, right: 204, top: 0 },
      size,
      { left: 212, top: 0 },
    ],
    [
      'last page at viewport bottom',
      { left: 176, right: 204, top: 590 },
      size,
      { left: 212, top: 440 },
    ],
    [
      'narrow window',
      { left: 176, right: 204, top: 590 },
      { ...size, viewportWidth: 240 },
      { left: 0, top: 440 },
    ],
  ] as const)('fits %s', (_name, button, menu, expected) => {
    expect(getMenuPosition(button, menu)).toEqual(expected);
  });
  it('opens to the right of a button on the left edge', () => {
    expect(getMenuPosition({ left: 0, right: 28, top: 20 }, size)).toEqual({
      left: 36,
      top: 20,
    });
  });
  it('flips left at the right edge', () => {
    expect(getMenuPosition({ left: 772, right: 800, top: 20 }, size)).toEqual({
      left: 544,
      top: 20,
    });
  });
  it.each([-20, 0, 590, 700])('clamps vertical position at %s', (top) => {
    const result = getMenuPosition({ left: 100, right: 128, top }, size);
    expect(result.top).toBe(Math.min(Math.max(top, 0), 440));
  });
  it('clamps when neither side has enough room', () => {
    expect(
      getMenuPosition(
        { left: 80, right: 108, top: 50 },
        { ...size, width: 200, viewportWidth: 210 },
      ),
    ).toEqual({ left: 0, top: 50 });
  });
  it('keeps the measured menu inside the viewport across edge combinations', () => {
    for (const viewportWidth of [200, 320, 800]) {
      for (const viewportHeight of [100, 600]) {
        const menuSize = {
          width: Math.min(220, viewportWidth),
          height: Math.min(160, viewportHeight),
          viewportWidth,
          viewportHeight,
        };
        for (const left of [
          -30,
          0,
          150,
          viewportWidth - 28,
          viewportWidth + 30,
        ]) {
          for (const top of [
            -30,
            0,
            viewportHeight - 10,
            viewportHeight + 30,
          ]) {
            const position = getMenuPosition(
              { left, right: left + 28, top },
              menuSize,
            );
            expect(position.left).toBeGreaterThanOrEqual(0);
            expect(position.top).toBeGreaterThanOrEqual(0);
            expect(position.left + menuSize.width).toBeLessThanOrEqual(
              viewportWidth,
            );
            expect(position.top + menuSize.height).toBeLessThanOrEqual(
              viewportHeight,
            );
          }
        }
      }
    }
  });
});
