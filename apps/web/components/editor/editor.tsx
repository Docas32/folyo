'use client';
import { DesignPanel } from './design-panel';
import { useSiteDesign } from './use-site-design';
import { themeToStyle } from '@folyo/core';
import type { CSSProperties } from 'react';
import { Logo } from '../logo';
import { Button, ButtonLink, PreviewIcon } from '../ui/button';

import {
  Fragment,
  memo,
  useMemo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  blocksSavedSchema,
  blocksSaveErrorSchema,
  editorBlockSchema,
  MAX_BLOCKS,
  createDefaultBlock,
  normalizeBlockLinks,
  type EditorBlock,
  type BlockType,
  type EditorDocument,
  editorPageSchema,
  type EditorPage,
  type Theme,
} from '@folyo/core';
import { AutosaveQueue, SaveFailure } from '../../lib/autosave';
import type { Dictionary } from '../../lib/i18n';
import { InlineBlock } from './inline-block';
import { SiteRender } from '../render/site-render';
import { resolveTheme } from '@folyo/core';
import { PageSidebar } from './page-sidebar';
import { AddBlock } from './block-menu';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { arrayMove } from '@folyo/core';

function SortableBlock({
  block,
  index,
  children,
  d,
  onMove,
  onDelete,
  total,
  editing,
  onEdit,
  onConfirm,
  onCancel,
}: {
  block: EditorBlock;
  index: number;
  children: React.ReactNode;
  d: Dictionary;
  onMove: (index: number, offset: number) => void;
  onDelete: (index: number) => void;
  total: number;
  editing: boolean;
  onEdit: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <article
      ref={setNodeRef}
      data-block-id={block.id}
      onKeyDown={(event) => {
        if (!editing || event.defaultPrevented || event.nativeEvent.isComposing)
          return;
        if (event.key === 'Escape') {
          event.preventDefault();
          onCancel();
        }
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
          event.preventDefault();
          onConfirm();
        }
      }}
      style={style}
      {...attributes}
      className={`editor-block sortable-block wysiwyg-card ${editing ? 'is-editing' : ''}`}
      aria-label={`${d.editor.types[block.type].name} ${index + 1}`}
    >
      <div
        className="block-heading"
        onClick={(event) => event.stopPropagation()}
      >
        <Button
          variant="ghost"
          type="button"
          className="drag-handle"
          aria-label={d.editor.dragHandle}
          title={d.editor.dragHandle}
          {...listeners}
        >
          ⠿
        </Button>
        <h2>{d.editor.types[block.type].name}</h2>
        <div className="block-controls">
          <Button
            variant="ghost"
            title={d.editor.inline.confirmHint}
            onClick={onEdit}
          >
            {d.editor.inline.edit}
          </Button>
          <Button
            variant="ghost"
            type="button"
            disabled={index === 0}
            aria-label={d.editor.moveUp}
            title={d.editor.moveUp}
            onClick={() => onMove(index, -1)}
          >
            ↑
          </Button>
          <Button
            variant="ghost"
            type="button"
            disabled={index === total - 1}
            aria-label={d.editor.moveDown}
            title={d.editor.moveDown}
            onClick={() => onMove(index, 1)}
          >
            ↓
          </Button>
          <Button
            variant="ghost"
            type="button"
            aria-label={d.editor.delete}
            title={d.editor.delete}
            onClick={() => onDelete(index)}
          >
            ×
          </Button>
        </div>
      </div>
      {children}
    </article>
  );
}

type CanvasBlockProps = {
  block: EditorBlock;
  index: number;
  total: number;
  editing: boolean;
  invalid: boolean;
  d: Dictionary;
  locale: string;
  theme: Theme;
  onBegin: (id: string) => void;
  onDraft: (block: EditorBlock) => void;
  onConfirm: () => void;
  onCancel: () => void;
  onMove: (index: number, offset: number) => void;
  onDelete: (index: number) => void;
  onUploadBusyChange: (active: boolean) => void;
};
const CanvasBlock = memo(function CanvasBlock({
  block,
  index,
  total,
  editing,
  invalid,
  d,
  locale,
  theme,
  onBegin,
  onDraft,
  onConfirm,
  onCancel,
  onMove,
  onDelete,
  onUploadBusyChange,
}: CanvasBlockProps) {
  const begin = useCallback(() => onBegin(block.id), [onBegin, block.id]);
  return (
    <SortableBlock
      block={block}
      index={index}
      total={total}
      d={d}
      editing={editing}
      onEdit={begin}
      onConfirm={onConfirm}
      onCancel={onCancel}
      onMove={onMove}
      onDelete={onDelete}
    >
      <InlineBlock
        block={block}
        theme={theme}
        editing={editing}
        d={d.editor}
        locale={locale}
        onUploadBusyChange={onUploadBusyChange}
        onBegin={begin}
        onConfirm={onConfirm}
        onCancel={onCancel}
        onChange={onDraft}
      />
      {invalid && (
        <p className="block-error">
          {d.editor.invalidBlock.replace('{number}', String(index + 1))}
        </p>
      )}
    </SortableBlock>
  );
});

const BlockInsertion = memo(function BlockInsertion({
  index,
  onAdd,
  d,
  disabled,
  quiet = false,
}: {
  index: number;
  onAdd: (type: BlockType, index: number) => void;
  d: Dictionary['editor'];
  disabled: boolean;
  quiet?: boolean;
}) {
  const select = useCallback(
    (type: BlockType) => onAdd(type, index),
    [onAdd, index],
  );
  return <AddBlock d={d} onSelect={select} disabled={disabled} quiet={quiet} />;
});

type EditorProps = {
  document: EditorDocument;
  pageId: string;
  d: Dictionary;
  locale: string;
  theme?: unknown;
  publicUrl?: string;
};

// SSR and the first hydration render share only this skeleton. The dnd-kit
// tree mounts after hydration, so its generated IDs are never compared to SSR.
export function Editor(props: EditorProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted)
    return (
      <div
        className="editor-layout editor-skeleton"
        aria-busy="true"
        aria-label={props.d.busy}
      >
        <div className="sidebar" aria-hidden="true">
          <span className="skeleton-line" />
          <span className="skeleton-line" />
          <span className="skeleton-line" />
        </div>
        <div className="editor-main" aria-hidden="true">
          <div className="editor-topbar">
            <span className="skeleton-line skeleton-heading" />
          </div>
          <div className="editor-canvas-scroll">
            <div className="editor-canvas">
              <div className="editor-block skeleton-card" />
            </div>
          </div>
        </div>
      </div>
    );
  return <MountedEditor {...props} />;
}
function MountedEditor({
  document,
  pageId,
  d,
  locale,
  theme,
  publicUrl,
}: EditorProps) {
  const design = useSiteDesign(theme);
  const [designOpen, setDesignOpen] = useState(false);
  const designToggle = useRef<HTMLButtonElement>(null);
  const closeDesign = () => {
    setDesignOpen(false);
    designToggle.current?.focus();
  };
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const sidebarSlot = useRef<HTMLDivElement>(null);
  const sidebarToggle = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    try {
      setSidebarOpen(localStorage.getItem('folyo.editor.sidebar') !== 'closed');
    } catch {
      /* Storage may be unavailable. Default to open. */
    }
  }, []);
  const toggleSidebar = useCallback(() => {
    if (sidebarSlot.current?.contains(window.document.activeElement))
      sidebarToggle.current?.focus();
    setSidebarOpen((open) => {
      try {
        localStorage.setItem('folyo.editor.sidebar', open ? 'closed' : 'open');
      } catch {
        /* Keep the toggle usable without storage. */
      }
      return !open;
    });
  }, []);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        !event.shiftKey &&
        !event.repeat &&
        !event.isComposing &&
        (event.key === '\\' || event.code === 'Backslash')
      ) {
        event.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, [toggleSidebar]);
  const [viewing, setViewing] = useState(false);
  const [pages, setPages] = useState(document.pages);
  const [activeId, setActiveId] = useState(pageId);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const [uploads, setUploads] = useState(0);
  const onUploadBusyChange = useCallback((active: boolean) => {
    setUploads((count) => count + (active ? 1 : -1));
  }, []);
  const [error, setError] = useState('');
  const flushRef = useRef<(() => Promise<boolean>) | null>(null);
  const pageBlocks = useRef<Record<string, EditorBlock[]>>({});
  const [initial] = useState(() => {
    for (const page of document.pages) pageBlocks.current[page.id] = [];
    for (const { pageId: ownerId, ...block } of document.blocks) {
      pageBlocks.current[ownerId]?.push(block);
    }
    return pageBlocks.current[pageId] ?? [];
  });
  const [activeBlocks, setActiveBlocks] = useState(initial);
  function activate(id: string) {
    setActiveBlocks(pageBlocks.current[id] ?? []);
    setActiveId(id);
  }
  async function operation(
    work: () => Promise<void>,
    flush = false,
    reportError = true,
  ): Promise<boolean> {
    if (locked.current || uploads > 0) return false;
    locked.current = true;
    setBusy(true);
    setError('');
    try {
      if (flush && !(await flushRef.current?.())) {
        setError(d.editor.pages.switchError);
        return false;
      }
      await work();
      return true;
    } catch {
      if (reportError) setError(d.editor.pages.error);
      return false;
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  async function mutate(url: string, method: string, input?: unknown) {
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      ...(input === undefined ? {} : { body: JSON.stringify(input) }),
    });
    if (!response.ok) throw new Error('Page operation failed');
    return response.json() as Promise<unknown>;
  }
  return (
    <div
      className={`editor-layout ${sidebarOpen ? '' : 'is-sidebar-collapsed'} ${designOpen ? 'has-design-panel' : ''}`}
      style={
        {
          '--editor-canvas-width': themeToStyle(design.theme)[
            '--site-content-width'
          ],
        } as CSSProperties
      }
    >
      <div
        id="editor-sidebar"
        ref={sidebarSlot}
        className="sidebar"
        aria-hidden={!sidebarOpen}
        inert={!sidebarOpen}
      >
        <PageSidebar
          visible={sidebarOpen}
          pages={pages}
          activeId={activeId}
          busy={busy || uploads > 0}
          d={d.editor}
          onSwitch={(id) => {
            if (id !== activeId) void operation(async () => activate(id), true);
          }}
          onCreate={(title) =>
            operation(async () => {
              const page = editorPageSchema.parse(
                await mutate('/api/pages', 'POST', { title }),
              );
              setPages((current) => [...current, page]);
              pageBlocks.current[page.id] = [];
              activate(page.id);
            }, true)
          }
          onRename={(id, title) =>
            operation(
              async () => {
                const page = editorPageSchema.parse(
                  await mutate(`/api/pages/${id}`, 'PATCH', { title }),
                );
                setPages((current) =>
                  current.map((item) => (item.id === id ? page : item)),
                );
              },
              false,
              false,
            )
          }
          onDelete={(id) =>
            operation(async () => {
              await mutate(`/api/pages/${id}`, 'DELETE');
              const next = pages.filter((page) => page.id !== id);
              setPages(next);
              delete pageBlocks.current[id];
              if (id === activeId && next[0]) activate(next[0].id);
            }, true)
          }
          onReorder={(ids) => {
            void operation(async () => {
              await mutate('/api/pages/reorder', 'PUT', { pageIds: ids });
              const next: EditorPage[] = [];
              for (const [position, id] of ids.entries()) {
                const page = pages.find((item) => item.id === id);
                if (page) next.push({ ...page, position });
              }
              setPages(next);
            });
          }}
        />
      </div>
      <div className="editor-main">
        {!designOpen && design.status === 'error' && (
          <div className="editor-page-error" role="alert">
            {d.templates.design.error}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDesignOpen(true)}
            >
              {d.templates.design.open}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                void design.flush();
              }}
            >
              {d.editor.retry}
            </Button>
          </div>
        )}
        {error && (
          <div className="editor-page-error" role="alert">
            {error}
          </div>
        )}
        <PageCanvas
          sidebarOpen={sidebarOpen}
          sidebarToggle={sidebarToggle}
          onToggleSidebar={toggleSidebar}
          key={activeId}
          document={document}
          theme={design.theme}
          designOpen={designOpen}
          designToggle={designToggle}
          onToggleDesign={() => {
            if (designOpen) closeDesign();
            else setDesignOpen(true);
          }}
          flushDesign={design.flush}
          designDirty={design.dirty}
          publicUrl={publicUrl}
          pages={pages}
          onPageChange={(id) => {
            if (id !== activeId) void operation(async () => activate(id), true);
          }}
          viewing={viewing}
          onViewChange={setViewing}
          pageId={activeId}
          d={d}
          locale={locale}
          onUploadBusyChange={onUploadBusyChange}
          initialBlocks={activeBlocks}
          disabled={busy}
          flushRef={flushRef}
          onBlocksChange={(blocks) => {
            pageBlocks.current[activeId] = blocks;
          }}
        />
      </div>
      {designOpen && (
        <DesignPanel
          d={d}
          locale={locale}
          theme={design.theme}
          status={design.status}
          onChange={design.update}
          onRetry={() => {
            void design.flush();
          }}
          onClose={closeDesign}
        />
      )}
    </div>
  );
}

function PageCanvas({
  sidebarOpen,
  sidebarToggle,
  onToggleSidebar,
  theme: storedTheme,
  designOpen,
  designToggle,
  onToggleDesign,
  flushDesign,
  designDirty,
  publicUrl,
  pages,
  onPageChange,
  viewing,
  onViewChange,
  document,
  pageId,
  d,
  locale,
  initialBlocks,
  onBlocksChange,
  disabled,
  flushRef,
  onUploadBusyChange,
}: {
  theme: unknown;
  designOpen: boolean;
  designToggle: React.RefObject<HTMLButtonElement | null>;
  onToggleDesign: () => void;
  flushDesign: () => Promise<boolean>;
  designDirty: boolean;
  publicUrl: string | undefined;
  pages: EditorPage[];
  onPageChange: (id: string) => void;
  viewing: boolean;
  onViewChange: (viewing: boolean) => void;
  sidebarOpen: boolean;
  sidebarToggle: React.RefObject<HTMLButtonElement | null>;
  onToggleSidebar: () => void;
  onUploadBusyChange: (busy: boolean) => void;
  initialBlocks: EditorBlock[];
  onBlocksChange: (blocks: EditorBlock[]) => void;
  disabled: boolean;
  flushRef: React.RefObject<(() => Promise<boolean>) | null>;
  document: EditorDocument;
  pageId: string;
  d: Dictionary;
  locale: string;
}) {
  const [blocks, setBlocks] = useState(initialBlocks);
  const blocksRef = useRef(blocks);
  const theme = useMemo(() => resolveTheme(storedTheme), [storedTheme]);
  const changeBlocks = useRef(onBlocksChange);
  changeBlocks.current = onBlocksChange;
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const [editingId, setEditingId] = useState<string | null>(null);
  // A rollback snapshot is not a second editable model. All inputs/renderers
  // read blocks; only confirmation schedules that same list for autosave.
  const editSession = useRef<{ id: string; before: EditorBlock } | null>(null);
  const uploadCount = useRef(0);
  const [viewBusy, setViewBusy] = useState(false);
  const [viewError, setViewError] = useState('');
  const uploadBusyChange = useCallback(
    (active: boolean) => {
      uploadCount.current += active ? 1 : -1;
      onUploadBusyChange(active);
    },
    [onUploadBusyChange],
  );
  const canvasScrollRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [queue] = useState(
    () =>
      new AutosaveQueue(async (incoming) => {
        const response = await fetch(`/api/pages/${pageId}/blocks`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ blocks: incoming }),
        });
        const data: unknown = await response.json();
        if (!response.ok) {
          const parsed = blocksSaveErrorSchema.safeParse(data);
          const path = parsed.success
            ? parsed.data.issues?.find(
                (issue) =>
                  issue.path[0] === 'blocks' &&
                  typeof issue.path[1] === 'number',
              )?.path
            : undefined;
          throw new SaveFailure(typeof path?.[1] === 'number' ? path[1] : null);
        }
        return blocksSavedSchema.parse(data);
      }),
  );
  const [saveState, setSaveState] = useState(queue.snapshot());
  const [removed, setRemoved] = useState<{
    block: EditorBlock;
    index: number;
  } | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxBlocks = MAX_BLOCKS;

  const keyboardSensorOptions = useMemo(
    () => ({ coordinateGetter: sortableKeyboardCoordinates }),
    [],
  );
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, keyboardSensorOptions),
  );

  const updateState = useCallback((next: EditorBlock[]) => {
    blocksRef.current = next;
    setBlocks(next);
    changeBlocks.current(next);
  }, []);
  const updateDraft = useCallback(
    (updated: EditorBlock) => {
      updateState(
        blocksRef.current.map((current) =>
          current.id === updated.id ? updated : current,
        ),
      );
    },
    [updateState],
  );
  const finishEditing = useCallback(() => {
    const session = editSession.current;
    if (!session || uploadCount.current > 0) return;
    const card = window.document.querySelector<HTMLElement>(
      `[data-block-id="${session.id}"]`,
    );
    if (card?.contains(window.document.activeElement))
      card.querySelector<HTMLElement>('.drag-handle')?.focus();
    editSession.current = null;
    setEditingId(null);
    const normalized = blocksRef.current.map(normalizeBlockLinks);
    if (normalized.some((block, i) => block !== blocksRef.current[i]))
      updateState(normalized);
    const current = blocksRef.current.find((block) => block.id === session.id);
    if (
      (current &&
        JSON.stringify(current.content) !==
          JSON.stringify(session.before.content)) ||
      (current && current.type !== session.before.type)
    )
      queue.update(blocksRef.current);
  }, [queue, updateState]);
  const beginEditing = useCallback(
    (id: string) => {
      if (
        editSession.current?.id === id ||
        disabledRef.current ||
        uploadCount.current > 0
      )
        return;
      finishEditing();
      const before = blocksRef.current.find((block) => block.id === id);
      if (before) {
        editSession.current = { id, before };
        setEditingId(id);
      }
    },
    [finishEditing],
  );
  const cancelEditing = useCallback(() => {
    const session = editSession.current;
    if (!session || uploadCount.current > 0) return;
    const card = window.document.querySelector<HTMLElement>(
      `[data-block-id="${session.id}"]`,
    );
    card?.querySelector<HTMLElement>('.drag-handle')?.focus();
    editSession.current = null;
    setEditingId(null);
    updateState(
      blocksRef.current.map((block) =>
        block.id === session.id
          ? { ...session.before, position: block.position }
          : block,
      ),
    );
  }, [updateState]);
  useEffect(() => {
    flushRef.current = () => {
      finishEditing();
      return queue.flush();
    };
    const unsubscribe = queue.subscribe(setSaveState);
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (editSession.current || queue.snapshot().status !== 'saved') {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      flushRef.current = null;
      unsubscribe();
      queue.dispose();
      window.removeEventListener('beforeunload', beforeUnload);
      if (undoTimer.current !== null) clearTimeout(undoTimer.current);
    };
  }, [queue, flushRef, finishEditing]);

  async function toggleView(next: boolean) {
    if (disabled || viewBusy || uploadCount.current > 0) return;
    setViewError('');
    if (!next) {
      onViewChange(false);
      return;
    }
    finishEditing();
    setViewBusy(true);
    try {
      if ((await queue.flush()) && (await flushDesign())) onViewChange(true);
      else setViewError(d.editor.inline.previewError);
    } finally {
      setViewBusy(false);
    }
  }
  const commit = useCallback(
    (next: EditorBlock[]) => {
      editSession.current = null;
      setEditingId(null);
      const ordered = next.map((block, position) => ({
        ...normalizeBlockLinks(block),
        position,
      }));
      blocksRef.current = ordered;
      setBlocks(ordered);
      changeBlocks.current(ordered);
      queue.update(ordered);
    },
    [queue],
  );

  const add = useCallback(
    (type: BlockType, index: number) => {
      if (uploadCount.current > 0) return;
      if (blocksRef.current.length >= maxBlocks) return;
      const block = editorBlockSchema.parse({
        id: crypto.randomUUID(),
        type,
        content: createDefaultBlock(type, locale),
        position: index,
      });
      const next = [...blocksRef.current];
      next.splice(index, 0, block);
      commit(next);
      beginEditing(block.id);
    },
    [maxBlocks, locale, commit, beginEditing],
  );

  const move = useCallback(
    (index: number, offset: number) => {
      if (uploadCount.current > 0) return;
      const next = [...blocksRef.current];
      const block = next[index];
      if (!block || index + offset < 0 || index + offset >= next.length) return;
      next.splice(index, 1);
      next.splice(index + offset, 0, block);
      commit(next);
    },
    [commit],
  );

  function handleDragEnd(event: DragEndEvent) {
    if (uploadCount.current > 0) return;
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = blocksRef.current.findIndex((b) => b.id === active.id);
      const newIndex = blocksRef.current.findIndex((b) => b.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove([...blocksRef.current], oldIndex, newIndex);
        commit(reordered);
      }
    }
  }

  const remove = useCallback(
    (index: number) => {
      if (uploadCount.current > 0) return;
      const block = blocksRef.current[index];
      if (!block) return;
      commit(blocksRef.current.filter((_, i) => i !== index));
      setRemoved({ block, index });
      if (undoTimer.current !== null) clearTimeout(undoTimer.current);
      undoTimer.current = setTimeout(() => {
        setRemoved(null);
        undoTimer.current = null;
      }, 5000);
    },
    [commit],
  );

  function undo() {
    if (uploadCount.current > 0) return;
    if (!removed || blocksRef.current.length >= maxBlocks) return;
    const next = [...blocksRef.current];
    next.splice(Math.min(removed.index, next.length), 0, removed.block);
    commit(next);
    setRemoved(null);
    if (undoTimer.current !== null) clearTimeout(undoTimer.current);
    undoTimer.current = null;
  }

  const idsKey = blocks.map((block) => block.id).join(',');
  const sortableIds = useMemo(
    () => (idsKey ? idsKey.split(',') : []),
    [idsKey],
  );
  const e = d.editor;
  const invalid = new Set(
    blocks.flatMap((block, index) =>
      editorBlockSchema.safeParse(block).success ? [] : [index],
    ),
  );
  if (saveState.status === 'invalid' && saveState.invalidIndex !== null)
    invalid.add(saveState.invalidIndex);
  const activeEdit = editSession.current;
  const editingDirty =
    activeEdit &&
    blocks.some(
      (block) =>
        block.id === activeEdit.id &&
        (block.type !== activeEdit.before.type ||
          JSON.stringify(block.content) !==
            JSON.stringify(activeEdit.before.content)),
    );
  const status =
    invalid.size > 0
      ? e.invalidBlock.replace('{number}', String(Math.min(...invalid) + 1))
      : editingDirty
        ? e.pending
        : saveState.status === 'saving'
          ? e.saving
          : saveState.status === 'dirty'
            ? e.pending
            : saveState.status === 'error'
              ? e.notSaved
              : saveState.status === 'invalid'
                ? e.invalidBlock.replace(
                    '{number}',
                    String((saveState.invalidIndex ?? 0) + 1),
                  )
                : saveState.savedAt
                  ? e.saved.replace(
                      '{time}',
                      new Date(saveState.savedAt).toLocaleTimeString(locale, {
                        hour: '2-digit',
                        minute: '2-digit',
                      }),
                    )
                  : e.ready;

  return (
    <>
      <header className="editor-topbar">
        <div className="editor-topbar-inner">
          <div className="editor-title">
            <Button
              variant="ghost"
              ref={sidebarToggle}
              type="button"
              className="sidebar-toggle"
              aria-expanded={sidebarOpen}
              aria-controls="editor-sidebar"
              aria-label={`${sidebarOpen ? e.hideSidebar : e.showSidebar} (${e.sidebarShortcut})`}
              title={`${sidebarOpen ? e.hideSidebar : e.showSidebar} (${e.sidebarShortcut})`}
              onClick={onToggleSidebar}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                aria-hidden="true"
              >
                <rect x="2" y="3" width="16" height="14" rx="2" />
                <path d="M7 3v14" />
              </svg>
            </Button>
            <Logo />
            <h1 title={document.site.title || document.site.handle}>
              {document.site.title || document.site.handle}
            </h1>
            <span className="editor-status">
              {document.site.status === 'published' ? d.published : d.draft}
            </span>
          </div>
          <div
            className="editor-mode-toggle"
            role="group"
            aria-label={e.inline.mode}
          >
            <Button
              variant="ghost"
              aria-pressed={!viewing}
              disabled={viewBusy || disabled || uploadCount.current > 0}
              onClick={() => void toggleView(false)}
            >
              {e.inline.edit}
            </Button>
            <Button
              variant="ghost"
              aria-pressed={viewing}
              disabled={viewBusy || disabled || uploadCount.current > 0}
              onClick={() => void toggleView(true)}
            >
              {e.inline.view}
            </Button>
          </div>
          <div className="editor-save">
            <Button
              ref={designToggle}
              variant="ghost"
              size="sm"
              aria-expanded={designOpen}
              aria-controls="editor-design-panel"
              onClick={onToggleDesign}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                aria-hidden="true"
              >
                <path d="M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1-4 1.5 1.5 0 0 1 1-3h2a4 4 0 0 0 4-4c0-4-4-7-9-7Z" />
                <circle cx="7" cy="10" r="1" />
                <circle cx="11" cy="7" r="1" />
                <circle cx="16" cy="8" r="1" />
              </svg>
              {d.templates.design.open}
            </Button>
            {document.site.status === 'published' && publicUrl && (
              <ButtonLink
                href={publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                variant="ghost"
                size="sm"
              >
                {d.publicLink} ↗
              </ButtonLink>
            )}
            <ButtonLink
              variant="ghost"
              size="sm"
              href={`/p/${document.site.id}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <PreviewIcon /> {e.preview}
            </ButtonLink>
            <p
              role="status"
              aria-live="polite"
              className={`save-${saveState.status}`}
            >
              {status}
            </p>
            {saveState.status === 'error' && (
              <Button
                variant="ghost"
                type="button"
                onClick={() => {
                  void queue.retry();
                }}
              >
                {e.retry}
              </Button>
            )}
            <Link
              href="/dashboard"
              onClick={(event) => {
                if (
                  editSession.current ||
                  queue.snapshot().status !== 'saved' ||
                  designDirty
                ) {
                  event.preventDefault();
                  finishEditing();
                  void Promise.all([queue.flush(), flushDesign()]).then(
                    ([blocksSaved, designSaved]) => {
                      if (blocksSaved && designSaved) router.push('/dashboard');
                    },
                  );
                }
              }}
            >
              {d.dashboardHub.back}
            </Link>
          </div>
        </div>
      </header>
      {viewError && (
        <p className="editor-page-error" role="alert">
          {viewError}
        </p>
      )}
      <div className="editor-canvas-scroll" ref={canvasScrollRef}>
        <fieldset
          className="editor-canvas wysiwyg-canvas"
          disabled={disabled || viewBusy}
        >
          {viewing ? (
            <SiteRender
              theme={theme}
              locale={locale}
              pages={pages}
              onPageChange={onPageChange}
              activePageId={pageId}
              blocks={blocks}
              basePath={`/p/${document.site.id}`}
              appUrl="/"
              chrome={d.siteChrome}
            />
          ) : (
            <SiteRender
              theme={theme}
              locale={locale}
              pages={pages}
              onPageChange={onPageChange}
              activePageId={pageId}
              blocks={[]}
              basePath={`/p/${document.site.id}`}
              appUrl="/"
              chrome={d.siteChrome}
            >
              <div className="wysiwyg-blocks">
                {blocks.length === 0 && (
                  <div className="editor-empty">
                    <h2>{e.empty}</h2>
                    <Button
                      variant="ghost"
                      type="button"
                      onClick={() => add('hero', 0)}
                    >
                      {e.addHero}
                    </Button>
                    <Button
                      variant="ghost"
                      type="button"
                      onClick={() => add('text', 0)}
                    >
                      {e.addText}
                    </Button>
                  </div>
                )}
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={sortableIds}
                    strategy={verticalListSortingStrategy}
                  >
                    {blocks.map((block, index) => (
                      <Fragment key={block.id}>
                        <BlockInsertion
                          d={e}
                          index={index}
                          onAdd={add}
                          disabled={blocks.length >= maxBlocks}
                          quiet
                        />
                        <CanvasBlock
                          block={block}
                          index={index}
                          total={blocks.length}
                          d={d}
                          locale={locale}
                          theme={theme}
                          editing={editingId === block.id}
                          invalid={invalid.has(index)}
                          onBegin={beginEditing}
                          onDraft={updateDraft}
                          onConfirm={finishEditing}
                          onCancel={cancelEditing}
                          onMove={move}
                          onDelete={remove}
                          onUploadBusyChange={uploadBusyChange}
                        />
                      </Fragment>
                    ))}
                  </SortableContext>
                </DndContext>
                <BlockInsertion
                  d={e}
                  index={blocks.length}
                  onAdd={add}
                  disabled={blocks.length >= maxBlocks}
                />
                {blocks.length >= maxBlocks && (
                  <p>{e.limit.replace('{count}', String(maxBlocks))}</p>
                )}
              </div>
            </SiteRender>
          )}
        </fieldset>
      </div>
      {removed && (
        <div className="editor-toast" role="status">
          <span>{e.deleted}</span>
          <Button
            variant="ghost"
            type="button"
            onClick={undo}
            disabled={blocks.length >= maxBlocks}
          >
            {e.undo}
          </Button>
        </div>
      )}
    </>
  );
}
