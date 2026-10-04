'use client';
import { useEffect, useRef, useState } from 'react';
import { MAX_PAGES, type EditorPage } from '@folyo/core';
import type { EditorDictionary } from './block-menu';
type Action =
  { type: 'create' } | { type: 'rename' | 'delete'; page: EditorPage };
export function PageSidebar({
  pages,
  activeId,
  busy,
  d,
  onSwitch,
  onCreate,
  onRename,
  onDelete,
  onReorder,
}: {
  pages: EditorPage[];
  activeId: string;
  busy: boolean;
  d: EditorDictionary;
  onSwitch: (id: string) => void;
  onCreate: (title: string) => Promise<boolean>;
  onRename: (id: string, title: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  onReorder: (ids: string[]) => void;
}) {
  const [action, setAction] = useState<Action | null>(null);
  const [title, setTitle] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const p = d.pages;
  useEffect(() => {
    if (!action) return;
    dialog.current?.showModal();
  }, [action]);
  function close() {
    dialog.current?.close();
    setAction(null);
    trigger.current?.focus();
  }
  function open(next: Action, button: HTMLButtonElement) {
    trigger.current = button;
    setTitle(next.type === 'rename' ? next.page.title : '');
    setAction(next);
  }
  return (
    <aside className="page-sidebar" aria-label={p.label}>
      <h2>{p.label}</h2>
      <ol>
        {pages.map((page, index) => (
          <li key={page.id}>
            <button
              type="button"
              aria-current={page.id === activeId ? 'page' : undefined}
              disabled={busy}
              onClick={() => onSwitch(page.id)}
            >
              {page.title}
            </button>
            <div className="page-controls">
              <button
                type="button"
                disabled={busy || index === 0}
                aria-label={`${p.moveUp}: ${page.title}`}
                onClick={() => {
                  const ids = pages.map((current) => current.id);
                  ids.splice(index - 1, 0, ...ids.splice(index, 1));
                  onReorder(ids);
                }}
              >
                ↑
              </button>
              <button
                type="button"
                disabled={busy || index === pages.length - 1}
                aria-label={`${p.moveDown}: ${page.title}`}
                onClick={() => {
                  const ids = pages.map((current) => current.id);
                  ids.splice(index + 1, 0, ...ids.splice(index, 1));
                  onReorder(ids);
                }}
              >
                ↓
              </button>
              <button
                type="button"
                disabled={busy}
                aria-label={`${p.rename}: ${page.title}`}
                onClick={(event) =>
                  open({ type: 'rename', page }, event.currentTarget)
                }
              >
                {p.rename}
              </button>
              <button
                type="button"
                disabled={busy || pages.length === 1}
                title={pages.length === 1 ? p.onlyPage : p.delete}
                aria-label={`${p.delete}: ${page.title}`}
                onClick={(event) =>
                  open({ type: 'delete', page }, event.currentTarget)
                }
              >
                {p.delete}
              </button>
            </div>
          </li>
        ))}
      </ol>
      <span title={pages.length >= MAX_PAGES ? p.limit : undefined}>
        <button
          type="button"
          disabled={busy || pages.length >= MAX_PAGES}
          onClick={(event) => open({ type: 'create' }, event.currentTarget)}
        >
          {p.newPage}
        </button>
      </span>
      {action && (
        <dialog
          ref={dialog}
          aria-label={
            action.type === 'create'
              ? p.create
              : action.type === 'rename'
                ? p.rename
                : p.delete
          }
          onCancel={(event) => {
            event.preventDefault();
            if (!busy) close();
          }}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void (async () => {
                const ok =
                  action.type === 'create'
                    ? await onCreate(title)
                    : action.type === 'rename'
                      ? await onRename(action.page.id, title)
                      : await onDelete(action.page.id);
                if (ok) close();
              })();
            }}
          >
            {action.type === 'delete' ? (
              <p>{p.confirmDelete.replace('{title}', action.page.title)}</p>
            ) : (
              <label className="block-field">
                <span>{p.title}</span>
                <input
                  autoFocus
                  value={title}
                  required
                  maxLength={120}
                  disabled={busy}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </label>
            )}
            <button
              type="submit"
              disabled={busy || (action.type !== 'delete' && !title.trim())}
            >
              {action.type === 'create'
                ? p.create
                : action.type === 'rename'
                  ? p.save
                  : p.confirm}
            </button>
            <button type="button" disabled={busy} onClick={close}>
              {p.cancel}
            </button>
          </form>
        </dialog>
      )}
    </aside>
  );
}
