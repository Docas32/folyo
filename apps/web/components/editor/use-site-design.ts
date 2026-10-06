'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { resolveTheme, themeSchema, type Theme } from '@folyo/core';

/** Serialize theme saves and coalesce edits made while a request is in flight.
 * A failed save keeps the local preview and can be retried or flushed on exit. */
export function useSiteDesign(initial: unknown) {
  const [theme, setTheme] = useState(() => resolveTheme(initial));
  const [status, setStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const latest = useRef(theme);
  const revision = useRef(0);
  const saved = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const active = useRef<Promise<boolean> | null>(null);
  const mounted = useRef(true);
  const flush = useCallback((): Promise<boolean> => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (active.current) return active.current;
    if (saved.current === revision.current) return Promise.resolve(true);
    setStatus('saving');
    const request = (async () => {
      try {
        while (saved.current < revision.current) {
          const sending = revision.current;
          const response = await fetch('/api/site/theme', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(latest.current),
          });
          const parsed = z
            .object({ theme: themeSchema })
            .safeParse(await response.json());
          if (!response.ok || !parsed.success)
            throw new Error('Design save failed');
          saved.current = sending;
          if (sending === revision.current) {
            latest.current = parsed.data.theme;
            if (mounted.current) setTheme(parsed.data.theme);
          }
        }
        if (mounted.current) setStatus('saved');
        return true;
      } catch {
        if (mounted.current) setStatus('error');
        return false;
      } finally {
        active.current = null;
      }
    })();
    active.current = request;
    return request;
  }, []);
  const update = useCallback(
    (next: Theme) => {
      latest.current = next;
      revision.current += 1;
      setTheme(next);
      setStatus('saving');
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void flush();
      }, 400);
    },
    [flush],
  );
  useEffect(() => {
    mounted.current = true;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (saved.current !== revision.current) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
      window.removeEventListener('beforeunload', beforeUnload);
    };
  }, []);
  return { theme, status, update, flush, dirty: status !== 'saved' };
}
