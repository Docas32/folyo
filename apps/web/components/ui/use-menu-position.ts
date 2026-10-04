'use client';
import { useLayoutEffect, useState, type RefObject } from 'react';
import { getMenuPosition } from '@folyo/core';
export function useMenuPosition(
  open: boolean,
  anchor: RefObject<HTMLElement | null>,
  menu: RefObject<HTMLElement | null>,
  placement: 'side' | 'below' = 'side',
) {
  const [position, setPosition] = useState({ top: 0, left: 0, width: 200 });
  useLayoutEffect(() => {
    if (!open) return;
    function reposition() {
      if (!anchor.current || !menu.current) return;
      const triggerRect = anchor.current.getBoundingClientRect();
      const rect = menu.current.getBoundingClientRect();
      const width =
        placement === 'below'
          ? Math.min(Math.max(200, triggerRect.width), window.innerWidth)
          : rect.width;
      const bounded = getMenuPosition(
        placement === 'below'
          ? {
              top: triggerRect.bottom + 4,
              left: triggerRect.left,
              right: triggerRect.left - 8,
            }
          : triggerRect,
        {
          width,
          height: rect.height,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
        },
      );
      setPosition({
        ...bounded,
        top:
          placement === 'below' &&
          triggerRect.bottom + rect.height + 4 > window.innerHeight
            ? Math.max(0, triggerRect.top - rect.height - 4)
            : bounded.top,
        width,
      });
    }
    reposition();
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open, anchor, menu, placement]);
  return position;
}
