'use client';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  blocksSavedSchema,
  blocksSaveErrorSchema,
  editorBlockSchema,
  MAX_BLOCKS,
  createDefaultBlock,
  type EditorBlock,
  type BlockType,
  type EditorDocument,
  editorPageSchema,
  type EditorPage,
} from '@folyo/core';
import { AutosaveQueue, SaveFailure } from '../../lib/autosave';
import type { Dictionary } from '../../lib/i18n';
import { BlockFields } from './block-fields';
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
}: {
  block: EditorBlock;
  index: number;
  children: React.ReactNode;
  d: Dictionary;
  onMove: (index: number, offset: number) => void;
  onDelete: (index: number) => void;
  total: number;
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
      style={style}
      {...attributes}
      className="editor-block sortable-block"
      aria-label={`${d.editor.types[block.type].name} ${index + 1}`}
    >
      <div className="block-heading">
        <button
          type="button"
          className="drag-handle"
          aria-label={d.editor.dragHandle}
          title={d.editor.dragHandle}
          {...listeners}
        >
          ⠿
        </button>
        <h2>{d.editor.types[block.type].name}</h2>
        <div className="block-controls">
          <button
            type="button"
            disabled={index === 0}
            aria-label={d.editor.moveUp}
            title={d.editor.moveUp}
            onClick={() => onMove(index, -1)}
          >
            ↑
          </button>
          <button
            type="button"
            disabled={index === total - 1}
            aria-label={d.editor.moveDown}
            title={d.editor.moveDown}
            onClick={() => onMove(index, 1)}
          >
            ↓
          </button>
          <button
            type="button"
            aria-label={d.editor.delete}
            title={d.editor.delete}
            onClick={() => onDelete(index)}
          >
            ×
          </button>
        </div>
      </div>
      {children}
    </article>
  );
}

export function Editor({
  document,
  pageId,
  d,
  locale,
}: {
  document: EditorDocument;
  pageId: string;
  d: Dictionary;
  locale: string;
}) {
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
      setError(d.editor.pages.error);
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
    <div className="editor-layout">
      <PageSidebar
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
          operation(async () => {
            const page = editorPageSchema.parse(
              await mutate(`/api/pages/${id}`, 'PATCH', { title }),
            );
            setPages((current) =>
              current.map((item) => (item.id === id ? page : item)),
            );
          })
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
      <div className="editor-workspace">
        {error && (
          <div className="editor-page-error" role="alert">
            {error}
          </div>
        )}
        <PageCanvas
          key={activeId}
          document={document}
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
    </div>
  );
}
function PageCanvas({
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

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  useEffect(() => {
    flushRef.current = () => queue.flush();
    const unsubscribe = queue.subscribe(setSaveState);
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (queue.snapshot().status !== 'saved') {
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
  }, [queue, flushRef]);

  function commit(next: EditorBlock[]) {
    const ordered = next.map((block, position) => ({ ...block, position }));
    blocksRef.current = ordered;
    setBlocks(ordered);
    onBlocksChange(ordered);
    queue.update(ordered);
  }

  function add(type: BlockType, index: number) {
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
  }

  function move(index: number, offset: number) {
    const next = [...blocksRef.current];
    const block = next[index];
    if (!block || index + offset < 0 || index + offset >= next.length) return;
    next.splice(index, 1);
    next.splice(index + offset, 0, block);
    commit(next);
  }

  function handleDragEnd(event: DragEndEvent) {
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

  function remove(index: number) {
    const block = blocksRef.current[index];
    if (!block) return;
    commit(blocksRef.current.filter((_, i) => i !== index));
    setRemoved({ block, index });
    if (undoTimer.current !== null) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => {
      setRemoved(null);
      undoTimer.current = null;
    }, 5000);
  }

  function undo() {
    if (!removed || blocksRef.current.length >= maxBlocks) return;
    const next = [...blocksRef.current];
    next.splice(Math.min(removed.index, next.length), 0, removed.block);
    commit(next);
    setRemoved(null);
    if (undoTimer.current !== null) clearTimeout(undoTimer.current);
    undoTimer.current = null;
  }

  const e = d.editor;
  const invalid = new Set(
    blocks.flatMap((block, index) =>
      editorBlockSchema.safeParse(block).success ? [] : [index],
    ),
  );
  if (saveState.status === 'invalid' && saveState.invalidIndex !== null)
    invalid.add(saveState.invalidIndex);
  const status =
    saveState.status === 'saving'
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
    <main className="editor-shell">
      <header className="editor-topbar">
        <div>
          <p className="editor-kicker">{e.heading}</p>
          <h1>{document.site.title || document.site.handle}</h1>
          <span className="editor-status">
            {document.site.status === 'published' ? d.published : d.draft}
          </span>
        </div>
        <div className="editor-save">
          <p
            role="status"
            aria-live="polite"
            className={`save-${saveState.status}`}
          >
            {status}
          </p>
          {saveState.status === 'error' && (
            <button
              type="button"
              onClick={() => {
                void queue.retry();
              }}
            >
              {e.retry}
            </button>
          )}
          <Link
            href="/dashboard"
            onClick={(event) => {
              if (queue.snapshot().status !== 'saved') {
                event.preventDefault();
                void queue.flush().then((saved) => {
                  if (saved) router.push('/dashboard');
                });
              }
            }}
          >
            {d.back}
          </Link>
        </div>
      </header>
      <fieldset className="editor-canvas" disabled={disabled}>
        {blocks.length === 0 && (
          <div className="editor-empty">
            <h2>{e.empty}</h2>
            <button type="button" onClick={() => add('hero', 0)}>
              {e.addHero}
            </button>
            <button type="button" onClick={() => add('text', 0)}>
              {e.addText}
            </button>
          </div>
        )}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={blocks.map((b) => b.id)}
            strategy={verticalListSortingStrategy}
          >
            {blocks.map((block, index) => (
              <Fragment key={block.id}>
                <AddBlock
                  d={e}
                  onSelect={(type) => add(type, index)}
                  disabled={blocks.length >= maxBlocks}
                  quiet
                />
                <SortableBlock
                  block={block}
                  index={index}
                  d={d}
                  onMove={move}
                  onDelete={remove}
                  total={blocks.length}
                >
                  <div className="block-fields">
                    <BlockFields
                      block={block}
                      d={e}
                      locale={locale}
                      onUploadBusyChange={onUploadBusyChange}
                      onChange={(updated) =>
                        commit(
                          blocksRef.current.map((current) =>
                            current.id === updated.id ? updated : current,
                          ),
                        )
                      }
                    />
                  </div>
                  {invalid.has(index) && (
                    <p className="block-error">
                      {e.invalidBlock.replace('{number}', String(index + 1))}
                    </p>
                  )}
                </SortableBlock>
              </Fragment>
            ))}
          </SortableContext>
        </DndContext>
        <AddBlock
          d={e}
          onSelect={(type) => add(type, blocks.length)}
          disabled={blocks.length >= maxBlocks}
        />
        {blocks.length >= maxBlocks && (
          <p>{e.limit.replace('{count}', String(maxBlocks))}</p>
        )}
      </fieldset>
      {removed && (
        <div className="editor-toast" role="status">
          <span>{e.deleted}</span>
          <button
            type="button"
            onClick={undo}
            disabled={blocks.length >= maxBlocks}
          >
            {e.undo}
          </button>
        </div>
      )}
    </main>
  );
}
