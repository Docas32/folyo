'use client';
import { Button } from '../ui/button';

import { useMenuPosition } from '../ui/use-menu-position';
import { useEffect, useRef, useState } from 'react';
import { MAX_PAGES, type EditorPage } from '@folyo/core';
import type { EditorDictionary } from './block-menu';
type Action = { type: 'create' } | { type: 'delete'; page: EditorPage };
type SidebarProps = {
  visible?: boolean;
  pages: EditorPage[];
  activeId: string;
  busy: boolean;
  d: EditorDictionary;
  onSwitch: (id: string) => void;
  onCreate: (title: string) => Promise<boolean>;
  onRename: (id: string, title: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  onReorder: (ids: string[]) => void;
};
function PageRow({
  page,
  index,
  menuOpen,
  onMenuChange,
  onRequestDelete,
  ...props
}: SidebarProps & {
  page: EditorPage;
  index: number;
  menuOpen: boolean;
  onMenuChange: (id: string | null) => void;
  onRequestDelete: (page: EditorPage, restoreFocus: () => void) => void;
}) {
  const { pages, activeId, busy, d, onSwitch, onRename, onReorder } = props;
  const p = d.pages;
  const trigger = useRef<HTMLButtonElement>(null);
  const row = useRef<HTMLButtonElement>(null);
  const container = useRef<HTMLLIElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const restore = useRef<false | 'menu' | 'row'>(false);
  const openAtEnd = useRef(false);
  const renaming = useRef(false);
  const submitting = useRef(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(page.title);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const menuId = `page-menu-${page.id}`;
  const errorId = `page-rename-error-${page.id}`;
  const label = (template: string) => template.replace('{title}', page.title);
  function focusRow() {
    row.current?.focus();
  }
  function restoreRequestedFocus() {
    const target = restore.current;
    restore.current = false;
    if (target === 'menu') trigger.current?.focus();
    else if (target === 'row') focusRow();
  }
  const { top, left } = useMenuPosition(menuOpen, trigger, menu);
  const menuPosition = { top, left };
  function closeMenu(returnFocus = true) {
    restore.current = returnFocus ? 'menu' : false;
    onMenuChange(null);
  }
  useEffect(() => {
    if (!menuOpen) {
      if (restore.current && !busy) {
        restoreRequestedFocus();
      }
      return;
    }
    const items = menu.current?.querySelectorAll<HTMLButtonElement>(
      '[role="menuitem"]:not(:disabled)',
    );
    items?.[openAtEnd.current ? items.length - 1 : 0]?.focus();
    const outside = (event: MouseEvent) => {
      if (
        event.target instanceof Node &&
        !container.current?.contains(event.target)
      )
        closeMenu();
    };
    document.addEventListener('click', outside);
    // The menu is positioned against the viewport, so it cannot follow the
    // canvas scrolling underneath it. Close it instead of leaving it stranded.
    const canvas = document.querySelector('.editor-canvas-scroll');
    const onCanvasScroll = () => closeMenu(false);
    canvas?.addEventListener('scroll', onCanvasScroll, { passive: true });
    return () => {
      document.removeEventListener('click', outside);
      canvas?.removeEventListener('scroll', onCanvasScroll);
    };
  }, [menuOpen, busy]);
  useEffect(() => {
    if (editing) {
      input.current?.focus();
      input.current?.select();
    }
  }, [editing]);
  function startRename() {
    closeMenu(false);
    renaming.current = true;
    setTitle(page.title);
    setError('');
    setEditing(true);
  }
  function cancelRename() {
    if (submitting.current) return;
    renaming.current = false;
    setEditing(false);
    setError('');
    restore.current = 'row';
    focusRow();
  }
  async function confirmRename() {
    if (!renaming.current || submitting.current || busy) return;
    const trimmed = title.trim();
    if (!trimmed) {
      setError(p.titleRequired);
      return;
    }
    if (trimmed === page.title) {
      cancelRename();
      return;
    }
    submitting.current = true;
    setPending(true);
    setError('');
    try {
      if (!(await onRename(page.id, trimmed))) {
        setError(p.renameError);
        return;
      }
      renaming.current = false;
      setEditing(false);
      restore.current = 'row';
    } catch {
      setError(p.renameError);
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }
  // Restore after the input is removed and the parent has released its busy state.
  useEffect(() => {
    if (!editing && !busy && restore.current) {
      restoreRequestedFocus();
    }
  }, [editing, busy, pending]);
  function move(offset: number) {
    const ids = pages.map((current) => current.id);
    ids.splice(index + offset, 0, ...ids.splice(index, 1));
    closeMenu();
    onReorder(ids);
  }
  return (
    <li
      ref={container}
      className={`page-item ${page.id === activeId ? 'is-active' : ''}`}
    >
      <div className="page-row">
        {editing ? (
          <input
            ref={input}
            className="page-rename-input"
            aria-label={label(p.renameLabel)}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : undefined}
            value={title}
            maxLength={120}
            disabled={busy || pending}
            onChange={(event) => {
              setTitle(event.target.value);
              setError('');
            }}
            onBlur={() => {
              void confirmRename();
            }}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing) return;
              if (event.key === 'Enter') {
                event.preventDefault();
                void confirmRename();
              }
              if (event.key === 'Escape') {
                event.preventDefault();
                cancelRename();
              }
            }}
          />
        ) : (
          <>
            <Button
              variant="ghost"
              ref={row}
              type="button"
              className="page-link"
              title={page.title}
              data-page-id={page.id}
              aria-current={page.id === activeId ? 'page' : undefined}
              disabled={busy}
              onClick={() => {
                if (menuOpen) closeMenu(false);
                onSwitch(page.id);
              }}
              onKeyDown={(event) => {
                if (
                  event.key === 'ContextMenu' ||
                  (event.shiftKey && event.key === 'F10')
                ) {
                  event.preventDefault();
                  openAtEnd.current = false;
                  onMenuChange(page.id);
                }
              }}
            >
              <span>{page.title}</span>
            </Button>
            <Button
              variant="ghost"
              type="button"
              ref={trigger}
              className="page-options"
              disabled={busy}
              aria-label={label(p.moreOptions)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-controls={menuOpen ? menuId : undefined}
              onClick={(event) => {
                event.stopPropagation();
                openAtEnd.current = false;
                if (menuOpen) closeMenu();
                else onMenuChange(page.id);
              }}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                  event.preventDefault();
                  event.stopPropagation();
                  openAtEnd.current = event.key === 'ArrowUp';
                  onMenuChange(page.id);
                }
              }}
            >
              <span aria-hidden="true">⋯</span>
            </Button>
          </>
        )}
      </div>
      {error && (
        <p className="page-rename-error" id={errorId}>
          {error}
        </p>
      )}
      {menuOpen && (
        <div
          ref={menu}
          id={menuId}
          role="menu"
          className="page-actions-menu"
          style={menuPosition}
          aria-label={label(p.moreOptions)}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              closeMenu();
            }
            if (event.key === 'Tab') closeMenu(false);
            if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key))
              return;
            event.preventDefault();
            event.stopPropagation();
            const items = [
              ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
                '[role="menuitem"]:not(:disabled)',
              ),
            ];
            const current = items.findIndex(
              (item) => item === document.activeElement,
            );
            const next =
              event.key === 'Home'
                ? 0
                : event.key === 'End'
                  ? items.length - 1
                  : (current +
                      (event.key === 'ArrowDown' ? 1 : -1) +
                      items.length) %
                    items.length;
            items[next]?.focus();
          }}
        >
          <Button
            variant="ghost"
            type="button"
            role="menuitem"
            tabIndex={-1}
            disabled={busy}
            aria-label={label(p.renameLabel)}
            onClick={startRename}
          >
            {p.rename}
          </Button>
          {index > 0 && (
            <Button
              variant="ghost"
              type="button"
              role="menuitem"
              tabIndex={-1}
              disabled={busy}
              aria-label={label(p.moveUpLabel)}
              onClick={() => move(-1)}
            >
              {p.moveUp}
            </Button>
          )}
          {index < pages.length - 1 && (
            <Button
              variant="ghost"
              type="button"
              role="menuitem"
              tabIndex={-1}
              disabled={busy}
              aria-label={label(p.moveDownLabel)}
              onClick={() => move(1)}
            >
              {p.moveDown}
            </Button>
          )}
          <Button
            variant="ghost"
            type="button"
            role="menuitem"
            tabIndex={-1}
            className="page-action-delete"
            disabled={busy || pages.length === 1}
            title={pages.length === 1 ? p.onlyPage : undefined}
            aria-label={label(p.deleteLabel)}
            onClick={() => {
              closeMenu(false);
              onRequestDelete(page, () => trigger.current?.focus());
            }}
          >
            {p.delete}
          </Button>
        </div>
      )}
    </li>
  );
}
export function PageSidebar(props: SidebarProps) {
  const { pages, busy, d, onCreate, onDelete, visible = true } = props;
  const [menuId, setMenuId] = useState<string | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const [title, setTitle] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const restoreFocus = useRef<() => void>(() => {});
  const restoreAfterClose = useRef(false);
  const sidebar = useRef<HTMLElement>(null);
  const p = d.pages;
  useEffect(() => {
    if (!visible) setMenuId(null);
  }, [visible]);
  useEffect(() => {
    if (action) dialog.current?.showModal();
  }, [action]);
  useEffect(() => {
    if (!action && !busy && restoreAfterClose.current) {
      restoreAfterClose.current = false;
      restoreFocus.current();
    }
  }, [action, busy]);
  function close() {
    dialog.current?.close();
    setAction(null);
    restoreAfterClose.current = true;
  }
  return (
    <aside
      ref={sidebar}
      className="page-sidebar"
      aria-label={p.label}
      onKeyDown={(event) => {
        if (
          !(event.target instanceof HTMLElement) ||
          !event.target.classList.contains('page-link')
        )
          return;
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key))
          return;
        event.preventDefault();
        const rows = [
          ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
            '.page-link:not(:disabled)',
          ),
        ];
        const current = rows.indexOf(event.target as HTMLButtonElement);
        const next =
          event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? rows.length - 1
              : (current + (event.key === 'ArrowDown' ? 1 : -1) + rows.length) %
                rows.length;
        rows[next]?.focus();
      }}
    >
      <h2>{p.label}</h2>
      <ol>
        {pages.map((page, index) => (
          <PageRow
            key={page.id}
            {...props}
            page={page}
            index={index}
            menuOpen={visible && menuId === page.id}
            onMenuChange={setMenuId}
            onRequestDelete={(target, focus) => {
              restoreFocus.current = () => {
                if (
                  sidebar.current?.querySelector(
                    `.page-link[data-page-id="${target.id}"]`,
                  )
                )
                  focus();
                else
                  sidebar.current
                    ?.querySelector<HTMLButtonElement>(
                      '.page-link[aria-current="page"]',
                    )
                    ?.focus();
              };
              setAction({ type: 'delete', page: target });
            }}
          />
        ))}
      </ol>
      <footer className="page-sidebar-footer">
        <span title={pages.length >= MAX_PAGES ? p.limit : undefined}>
          <Button
            variant="ghost"
            type="button"
            className="page-add"
            disabled={busy || pages.length >= MAX_PAGES}
            onClick={(event) => {
              const button = event.currentTarget;
              restoreFocus.current = () => {
                if (!button.disabled) button.focus();
                else
                  sidebar.current
                    ?.querySelector<HTMLButtonElement>(
                      '.page-link[aria-current="page"]',
                    )
                    ?.focus();
              };
              setTitle('');
              setAction({ type: 'create' });
            }}
          >
            <span aria-hidden="true">＋ </span>
            {p.newPage}
          </Button>
        </span>
      </footer>
      {action && (
        <dialog
          ref={dialog}
          aria-label={action.type === 'create' ? p.create : p.delete}
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
            <Button
              variant="ghost"
              type="submit"
              disabled={busy || (action.type === 'create' && !title.trim())}
            >
              {action.type === 'create' ? p.create : p.confirm}
            </Button>
            <Button
              variant="ghost"
              type="button"
              disabled={busy}
              onClick={close}
            >
              {p.cancel}
            </Button>
          </form>
        </dialog>
      )}
    </aside>
  );
}
