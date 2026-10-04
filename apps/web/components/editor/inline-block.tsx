'use client';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  createDefaultBlock,
  editorBlockSchema,
  MAX_GALLERY_ITEMS,
  type EditorBlock,
  type Theme,
} from '@folyo/core';
import {
  BlockRender,
  HeroRender,
  HeroAvatarRender,
  HeadingRender,
  TextRender,
} from '../render/blocks';
import { Button } from '../ui/button';
import { BlockFields, TextComposer } from './block-fields';
import { ImageUploader } from './image-uploader';
import type { EditorDictionary } from './block-menu';

/** Select popovers use portals. Their aria-controls association keeps them part
 * of the card for blur/outside confirmation without trapping keyboard focus. */
export function ownsCardTarget(root: HTMLElement, target: EventTarget | null) {
  if (!(target instanceof Node)) return false;
  if (root.contains(target)) return true;
  return [...root.querySelectorAll('[aria-controls]')].some((trigger) => {
    const id = trigger.getAttribute('aria-controls');
    return id && document.getElementById(id)?.contains(target);
  });
}
export function InlineBlock({
  block,
  theme,
  editing,
  d,
  locale,
  onBegin,
  onChange,
  onConfirm,
  onCancel,
  onUploadBusyChange,
}: {
  block: EditorBlock;
  theme: Theme;
  editing: boolean;
  d: EditorDictionary;
  locale: string;
  onBegin: () => void;
  onChange: (block: EditorBlock) => void;
  onConfirm: () => void;
  onCancel: () => void;
  onUploadBusyChange: (busy: boolean) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const focusField = useRef('');
  const [itemIndex, setItemIndex] = useState(0);
  const [uploadBusy, setUploadBusy] = useState(false);
  const upload = useCallback(
    (busy: boolean) => {
      setUploadBusy(busy);
      onUploadBusyChange(busy);
    },
    [onUploadBusyChange],
  );
  useEffect(() => {
    if (!editing || !root.current) return;
    const input =
      [
        ...root.current.querySelectorAll<
          HTMLInputElement | HTMLTextAreaElement
        >('input:not([type=file]), textarea'),
      ].find(
        (element) => element.getAttribute('aria-label') === focusField.current,
      ) ??
      root.current.querySelector<HTMLElement>(
        'input:not([type=file]), textarea, .inline-panel button',
      );
    input?.focus();
  }, [editing, block.type]);
  useEffect(() => {
    if (!editing) return;
    const outside = (event: PointerEvent) => {
      if (
        root.current &&
        !ownsCardTarget(
          root.current.closest('article') ?? root.current,
          event.target,
        ) &&
        !uploadBusy
      )
        onConfirm();
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [editing, onConfirm, uploadBusy]);
  const parsed = editorBlockSchema.safeParse(block);
  const issues = parsed.success ? [] : parsed.error.issues;
  const bad = (field: string) =>
    issues.some((issue) => issue.path.includes(field));
  useEffect(() => {
    // Reuse the existing fields/Selects and mark their individual invalid inputs
    // from Zod paths, including the selected gallery item.
    if (!root.current) return;
    root.current
      .querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
        'input:not([type=file]), textarea',
      )
      .forEach((input) => {
        const label =
          input.getAttribute('aria-label') ??
          input.closest('label')?.querySelector('span')?.textContent;
        const field = Object.entries(d.fields).find(
          ([, name]) => name === label,
        )?.[0];
        const invalid =
          field &&
          issues.some(
            (issue) =>
              issue.path.includes(field) &&
              (block.type !== 'gallery' || issue.path.includes(itemIndex)),
          );
        input.setAttribute('aria-invalid', invalid ? 'true' : 'false');
      });
  });
  function input(
    label: string,
    value: string,
    update: (value: string) => void,
    field: string,
  ) {
    return (
      <input
        className="inline-input"
        aria-label={label}
        aria-invalid={bad(field)}
        value={value}
        placeholder={d.inline.emptyField}
        onChange={(event) => update(event.target.value)}
      />
    );
  }
  let rendered: ReactNode;
  if (editing && block.type === 'heading') {
    rendered = (
      <>
        <div
          className="inline-toolbar"
          role="group"
          aria-label={d.fields.level}
        >
          {([1, 2, 3] as const).map((level) => (
            <Button
              key={level}
              variant="ghost"
              title={d.levels[level]}
              aria-pressed={block.content.level === level}
              onClick={() =>
                onChange({ ...block, content: { ...block.content, level } })
              }
            >
              H{level}
            </Button>
          ))}
        </div>
        <HeadingRender
          content={block.content}
          theme={theme}
          slots={{
            text: input(
              d.fields.text,
              block.content.text,
              (text) =>
                onChange({ ...block, content: { ...block.content, text } }),
              'text',
            ),
          }}
        />
      </>
    );
  } else if (editing && block.type === 'text') {
    rendered = (
      <TextRender
        content={block.content}
        theme={theme}
        slots={{
          text: (
            <TextComposer
              block={block}
              onChange={onChange}
              d={d}
              locale={locale}
            />
          ),
        }}
      />
    );
  } else if (editing && block.type === 'hero') {
    const content = block.content;
    rendered = (
      <HeroRender
        content={content}
        theme={theme}
        slots={{
          name: input(
            d.fields.name,
            content.name,
            (name) => onChange({ ...block, content: { ...content, name } }),
            'name',
          ),
          title: input(
            d.fields.title,
            content.title,
            (title) => onChange({ ...block, content: { ...content, title } }),
            'title',
          ),
          subtitle: input(
            d.fields.subtitle,
            content.subtitle ?? '',
            (subtitle) =>
              onChange({ ...block, content: { ...content, subtitle } }),
            'subtitle',
          ),
          avatar: (
            <div className="inline-avatar">
              {content.avatarUrl && <HeroAvatarRender content={content} />}
              <details>
                <summary>{d.inline.changeAvatar}</summary>
                <div className="inline-panel">
                  <ImageUploader
                    d={d}
                    onBusyChange={upload}
                    onUpload={(avatarUrl) =>
                      onChange({ ...block, content: { ...content, avatarUrl } })
                    }
                  />
                  <label className="block-field">
                    <span>{d.fields.avatarUrl}</span>
                    {input(
                      d.fields.avatarUrl,
                      content.avatarUrl ?? '',
                      (avatarUrl) =>
                        onChange({
                          ...block,
                          content: {
                            ...content,
                            avatarUrl: avatarUrl || undefined,
                          },
                        }),
                      'avatarUrl',
                    )}
                  </label>
                </div>
              </details>
            </div>
          ),
        }}
      />
    );
  } else {
    rendered = (
      <BlockRender
        block={block}
        theme={theme}
        slots={
          block.type === 'gallery'
            ? {
                galleryItem: (index, image) => (
                  <div className="inline-gallery-item">
                    {image}
                    <Button
                      className="inline-image-action"
                      variant="ghost"
                      aria-label={`${d.inline.editImage} ${index + 1}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        setItemIndex(index);
                        onBegin();
                      }}
                    >
                      {d.inline.edit}
                    </Button>
                  </div>
                ),
                galleryEnd: (
                  <Button
                    className="inline-gallery-add"
                    variant="ghost"
                    disabled={block.content.items.length >= MAX_GALLERY_ITEMS}
                    onClick={(event) => {
                      event.stopPropagation();
                      onBegin();
                      setItemIndex(block.content.items.length);
                      onChange({
                        ...block,
                        content: {
                          items: [
                            ...block.content.items,
                            createDefaultBlock('image', locale),
                          ],
                        },
                      });
                    }}
                  >
                    + {d.addImage}
                  </Button>
                ),
              }
            : undefined
        }
      />
    );
  }
  const compact = !['hero', 'heading', 'text'].includes(block.type);
  const empty =
    (block.type === 'text' || block.type === 'heading') && !block.content.text;
  return (
    <div
      ref={root}
      className={`inline-block ${editing ? 'is-editing' : ''}`}
      onClick={(event) => {
        if (event.target instanceof Element && event.target.closest('a'))
          event.preventDefault();
        if (editing) return;
        if (event.target instanceof Element) {
          if (block.type === 'hero')
            focusField.current = event.target.closest('h1')
              ? d.fields.name
              : event.target.closest('.site-subtitle')
                ? d.fields.subtitle
                : d.fields.title;
          if (block.type === 'gallery') {
            const image = event.target.closest('.inline-gallery-item');
            if (image)
              setItemIndex(
                [
                  ...root.current!.querySelectorAll('.inline-gallery-item'),
                ].indexOf(image),
              );
          }
        }
        onBegin();
      }}
      onBlur={(event) => {
        if (
          editing &&
          event.relatedTarget &&
          root.current &&
          !ownsCardTarget(
            root.current.closest('article') ?? root.current,
            event.relatedTarget,
          ) &&
          !uploadBusy
        )
          onConfirm();
      }}
      onKeyDown={(event) => {
        if (!editing || event.nativeEvent.isComposing) return;
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          if (!uploadBusy) onCancel();
        }
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
          event.preventDefault();
          if (!uploadBusy) onConfirm();
        }
      }}
    >
      {rendered}
      {!editing && empty && (
        <p className="inline-empty">{d.inline.emptyText}</p>
      )}
      {editing && compact && (
        <div
          className="inline-panel"
          role="group"
          aria-label={d.types[block.type].name}
        >
          <BlockFields
            block={block}
            d={d}
            locale={locale}
            onChange={onChange}
            onUploadBusyChange={upload}
            compact
            onItemIndexChange={setItemIndex}
            itemIndex={
              block.type === 'gallery'
                ? Math.min(itemIndex, block.content.items.length - 1)
                : undefined
            }
          />
        </div>
      )}
      {editing && (
        <div className="inline-edit-actions">
          <Button
            variant="ghost"
            disabled={uploadBusy}
            title={d.inline.confirmHint}
            onClick={(event) => {
              event.stopPropagation();
              onConfirm();
            }}
          >
            {d.inline.done}
          </Button>
          <Button
            variant="ghost"
            disabled={uploadBusy}
            title="Esc"
            onClick={(event) => {
              event.stopPropagation();
              onCancel();
            }}
          >
            {d.inline.cancel}
          </Button>
        </div>
      )}
    </div>
  );
}
