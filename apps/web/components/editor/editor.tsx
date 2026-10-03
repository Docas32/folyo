'use client';
import { Fragment, useEffect, useRef, useState } from 'react';
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
} from '@folyo/core';
import { AutosaveQueue, SaveFailure } from '../../lib/autosave';
import type { Dictionary } from '../../lib/i18n';
import { BlockFields } from './block-fields';
import { AddBlock } from './block-menu';
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
  const [blocks, setBlocks] = useState(document.blocks);
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
  useEffect(() => {
    const unsubscribe = queue.subscribe(setSaveState);
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (queue.snapshot().status !== 'saved') {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      unsubscribe();
      queue.dispose();
      window.removeEventListener('beforeunload', beforeUnload);
      if (undoTimer.current !== null) clearTimeout(undoTimer.current);
    };
  }, [queue]);
  function commit(next: EditorBlock[]) {
    const ordered = next.map((block, position) => ({ ...block, position }));
    blocksRef.current = ordered;
    setBlocks(ordered);
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
      <div className="editor-canvas">
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
        {blocks.map((block, index) => (
          <Fragment key={block.id}>
            <AddBlock
              d={e}
              onSelect={(type) => add(type, index)}
              disabled={blocks.length >= maxBlocks}
              quiet
            />
            <article
              className={`editor-block ${invalid.has(index) ? 'editor-block-invalid' : ''}`}
              aria-label={`${e.types[block.type].name} ${index + 1}`}
            >
              <div className="block-heading">
                <h2>{e.types[block.type].name}</h2>
                <div className="block-controls">
                  <button
                    type="button"
                    disabled={index === 0}
                    aria-label={e.moveUp}
                    title={e.moveUp}
                    onClick={() => move(index, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={index === blocks.length - 1}
                    aria-label={e.moveDown}
                    title={e.moveDown}
                    onClick={() => move(index, 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    aria-label={e.delete}
                    title={e.delete}
                    onClick={() => remove(index)}
                  >
                    ×
                  </button>
                </div>
              </div>
              <div className="block-fields">
                <BlockFields
                  block={block}
                  d={e}
                  locale={locale}
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
            </article>
          </Fragment>
        ))}
        <AddBlock
          d={e}
          onSelect={(type) => add(type, blocks.length)}
          disabled={blocks.length >= maxBlocks}
        />
        {blocks.length >= maxBlocks && (
          <p>{e.limit.replace('{count}', String(maxBlocks))}</p>
        )}
      </div>
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
