'use client';
import { useEffect, useRef } from 'react';

/** Decorative, compositor-led motion. Pointer updates never re-render the page. */
export function AmbientBackground() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = root.current;
    if (!element || typeof window.matchMedia !== 'function') return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const pointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    let frame = 0;
    function move(event: PointerEvent) {
      if (reduced.matches || !pointer.matches || event.pointerType === 'touch')
        return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        element!.style.setProperty('--ambient-x', `${event.clientX}px`);
        element!.style.setProperty('--ambient-y', `${event.clientY}px`);
        element!.style.setProperty(
          '--ambient-dx',
          `${(event.clientX / window.innerWidth - 0.5) * 24}px`,
        );
        element!.style.setProperty(
          '--ambient-dy',
          `${(event.clientY / window.innerHeight - 0.5) * 24}px`,
        );
        element!.dataset.active = 'true';
      });
    }
    function reset() {
      cancelAnimationFrame(frame);
      element!.dataset.active = 'false';
    }
    function leave(event: PointerEvent) {
      if (!event.relatedTarget) reset();
    }
    function visibility() {
      element!.dataset.paused = String(document.hidden);
      if (document.hidden) reset();
    }
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerout', leave);
    window.addEventListener('blur', reset);
    document.addEventListener('visibilitychange', visibility);
    reduced.addEventListener('change', reset);
    pointer.addEventListener('change', reset);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerout', leave);
      window.removeEventListener('blur', reset);
      document.removeEventListener('visibilitychange', visibility);
      reduced.removeEventListener('change', reset);
      pointer.removeEventListener('change', reset);
    };
  }, []);
  return (
    <div className="ambient-background" ref={root} aria-hidden="true">
      {['soft', 'sharp'].map((layer) => (
        <div className={`ambient-layer ambient-${layer}`} key={layer}>
          {[1, 2, 3].map((orb) => (
            <span className={`ambient-orb ambient-orb-${orb}`} key={orb} />
          ))}
        </div>
      ))}
    </div>
  );
}
