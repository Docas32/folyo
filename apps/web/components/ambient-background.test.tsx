import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AmbientBackground } from './ambient-background';
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function media(reduced = false) {
  const addEventListener = vi.fn(),
    removeEventListener = vi.fn();
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query.includes('reduced-motion') ? reduced : true,
      addEventListener,
      removeEventListener,
    })),
  );
  const frames: FrameRequestCallback[] = [];
  const raf = vi.fn((callback: FrameRequestCallback) => {
    frames.push(callback);
    return frames.length;
  });
  vi.stubGlobal('requestAnimationFrame', raf);
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  return { raf, frames, removeEventListener };
}
describe('ambient background', () => {
  it('reveals and moves on pointer input without intercepting controls, then resets and cleans up', () => {
    const { frames, removeEventListener } = media();
    const view = render(<AmbientBackground />);
    const root = view.container.firstElementChild as HTMLElement;
    expect(root).toHaveAttribute('aria-hidden', 'true');
    fireEvent(
      window,
      new MouseEvent('pointermove', { clientX: 220, clientY: 140 }),
    );
    frames[0]!(0);
    expect(root.style.getPropertyValue('--ambient-x')).toBe('220px');
    expect(root.dataset.active).toBe('true');
    fireEvent.blur(window);
    expect(root.dataset.active).toBe('false');
    view.unmount();
    expect(removeEventListener).toHaveBeenCalledTimes(2);
  });
  it('does not react to pointer movement when reduced motion is requested', () => {
    const { raf } = media(true);
    const view = render(<AmbientBackground />);
    fireEvent(
      window,
      new MouseEvent('pointermove', { clientX: 100, clientY: 100 }),
    );
    expect(raf).not.toHaveBeenCalled();
    expect(view.container.firstElementChild).not.toHaveAttribute(
      'data-active',
      'true',
    );
  });
});
