'use client';
import { useRef, type ReactNode, type RefObject } from 'react';
import { useMenuPosition } from './use-menu-position';
export function Popover({
  anchor,
  children,
}: {
  anchor: RefObject<HTMLElement | null>;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const position = useMenuPosition(true, anchor, ref, 'below');
  return (
    <div
      ref={ref}
      className="ui-popover"
      style={{ position: 'fixed', ...position }}
    >
      {children}
    </div>
  );
}
