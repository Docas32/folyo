'use client';
import { useEffect, useRef, useState } from 'react';
import {
  buttonContentSchema,
  externalUrlSchema,
  headingContentSchema,
  spacerContentSchema,
  socialPlatformSchema,
  SOCIAL_PLATFORMS,
  createDefaultBlock,
  MAX_GALLERY_ITEMS,
  MAX_SOCIAL_LINKS,
  type EditorBlock,
} from '@folyo/core';
import type { EditorDictionary } from './block-menu';
function Textarea({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = '0px';
      ref.current.style.height = `${ref.current.scrollHeight}px`;
    }
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      rows={3}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
function Field({
  label,
  value,
  onChange,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
}) {
  return (
    <label className="block-field">
      <span>{label}</span>
      {multiline ? (
        <Textarea value={value} onChange={onChange} />
      ) : (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </label>
  );
}
function ImagePreview({
  url,
  alt,
  d,
}: {
  url: string;
  alt: string;
  d: EditorDictionary;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [url]);
  if (!externalUrlSchema.safeParse(url).success) return null;
  return failed ? (
    <p className="preview-error">{d.previewError}</p>
  ) : (
    <img
      className="block-image-preview"
      src={url}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}
export function BlockFields({
  block,
  onChange,
  d,
  locale,
}: {
  block: EditorBlock;
  onChange: (block: EditorBlock) => void;
  d: EditorDictionary;
  locale: string;
}) {
  switch (block.type) {
    case 'hero': {
      const content = block.content;
      return (
        <>
          <Field
            label={d.fields.name}
            value={content.name}
            onChange={(name) =>
              onChange({ ...block, content: { ...content, name } })
            }
          />
          <Field
            label={d.fields.title}
            value={content.title}
            onChange={(title) =>
              onChange({ ...block, content: { ...content, title } })
            }
          />
          <Field
            label={d.fields.subtitle}
            value={content.subtitle ?? ''}
            onChange={(subtitle) =>
              onChange({ ...block, content: { ...content, subtitle } })
            }
          />
          <Field
            label={d.fields.avatarUrl}
            value={content.avatarUrl ?? ''}
            onChange={(avatarUrl) =>
              onChange({
                ...block,
                content: { ...content, avatarUrl: avatarUrl || undefined },
              })
            }
          />
          {content.avatarUrl && (
            <ImagePreview url={content.avatarUrl} alt={content.name} d={d} />
          )}
        </>
      );
    }
    case 'heading':
      return (
        <>
          <Field
            label={d.fields.text}
            value={block.content.text}
            onChange={(text) =>
              onChange({ ...block, content: { ...block.content, text } })
            }
          />
          <label className="block-field">
            <span>{d.fields.level}</span>
            <select
              value={block.content.level}
              onChange={(event) =>
                onChange({
                  ...block,
                  content: {
                    ...block.content,
                    level: headingContentSchema.shape.level.parse(
                      Number(event.target.value),
                    ),
                  },
                })
              }
            >
              {headingContentSchema.shape.level.options.map((level) => (
                <option key={level.value} value={level.value}>
                  {d.levels[level.value]}
                </option>
              ))}
            </select>
          </label>
        </>
      );
    case 'text':
      return (
        <Field
          label={d.fields.text}
          value={block.content.text}
          multiline
          onChange={(text) => onChange({ ...block, content: { text } })}
        />
      );
    case 'image':
      return (
        <>
          <Field
            label={d.fields.url}
            value={block.content.url}
            onChange={(url) =>
              onChange({ ...block, content: { ...block.content, url } })
            }
          />
          <Field
            label={d.fields.alt}
            value={block.content.alt}
            onChange={(alt) =>
              onChange({ ...block, content: { ...block.content, alt } })
            }
          />
          <Field
            label={d.fields.caption}
            value={block.content.caption ?? ''}
            onChange={(caption) =>
              onChange({ ...block, content: { ...block.content, caption } })
            }
          />
          <ImagePreview url={block.content.url} alt={block.content.alt} d={d} />
        </>
      );
    case 'gallery':
      return (
        <>
          {block.content.items.map((item, index) => {
            const update = (patch: Partial<typeof item>) =>
              onChange({
                ...block,
                content: {
                  items: block.content.items.map((current, i) =>
                    i === index ? { ...current, ...patch } : current,
                  ),
                },
              });
            return (
              <div className="block-list-item" key={index}>
                <Field
                  label={d.fields.url}
                  value={item.url}
                  onChange={(url) => update({ url })}
                />
                <Field
                  label={d.fields.alt}
                  value={item.alt}
                  onChange={(alt) => update({ alt })}
                />
                <Field
                  label={d.fields.caption}
                  value={item.caption ?? ''}
                  onChange={(caption) => update({ caption })}
                />
                <ImagePreview url={item.url} alt={item.alt} d={d} />
                <button
                  type="button"
                  className="editor-secondary"
                  onClick={() =>
                    onChange({
                      ...block,
                      content: {
                        items: block.content.items.filter(
                          (_, i) => i !== index,
                        ),
                      },
                    })
                  }
                >
                  {d.removeImage}
                </button>
              </div>
            );
          })}
          <button
            type="button"
            disabled={block.content.items.length >= MAX_GALLERY_ITEMS}
            onClick={() =>
              onChange({
                ...block,
                content: {
                  items: [
                    ...block.content.items,
                    createDefaultBlock('image', locale),
                  ],
                },
              })
            }
          >
            {d.addImage}
          </button>
        </>
      );
    case 'button':
      return (
        <>
          <Field
            label={d.fields.label}
            value={block.content.label}
            onChange={(label) =>
              onChange({ ...block, content: { ...block.content, label } })
            }
          />
          <Field
            label={d.fields.url}
            value={block.content.url}
            onChange={(url) =>
              onChange({ ...block, content: { ...block.content, url } })
            }
          />
          <label className="block-field">
            <span>{d.fields.style}</span>
            <select
              value={block.content.style}
              onChange={(event) =>
                onChange({
                  ...block,
                  content: {
                    ...block.content,
                    style: buttonContentSchema.shape.style.parse(
                      event.target.value,
                    ),
                  },
                })
              }
            >
              {buttonContentSchema.shape.style.options.map((style) => (
                <option key={style} value={style}>
                  {d.styles[style]}
                </option>
              ))}
            </select>
          </label>
        </>
      );
    case 'social':
      return (
        <>
          {block.content.links.map((link, index) => (
            <div className="block-list-item" key={index}>
              <label className="block-field">
                <span>{d.fields.platform}</span>
                <select
                  value={link.platform}
                  onChange={(event) =>
                    onChange({
                      ...block,
                      content: {
                        links: block.content.links.map((current, i) =>
                          i === index
                            ? {
                                ...current,
                                platform: socialPlatformSchema.parse(
                                  event.target.value,
                                ),
                              }
                            : current,
                        ),
                      },
                    })
                  }
                >
                  {SOCIAL_PLATFORMS.map((platform) => (
                    <option key={platform} value={platform}>
                      {d.platforms[platform]}
                    </option>
                  ))}
                </select>
              </label>
              <Field
                label={d.fields.url}
                value={link.url}
                onChange={(url) =>
                  onChange({
                    ...block,
                    content: {
                      links: block.content.links.map((current, i) =>
                        i === index ? { ...current, url } : current,
                      ),
                    },
                  })
                }
              />
              <button
                type="button"
                className="editor-secondary"
                onClick={() =>
                  onChange({
                    ...block,
                    content: {
                      links: block.content.links.filter((_, i) => i !== index),
                    },
                  })
                }
              >
                {d.removeLink}
              </button>
            </div>
          ))}
          <button
            type="button"
            disabled={block.content.links.length >= MAX_SOCIAL_LINKS}
            onClick={() => {
              const link = createDefaultBlock('social', locale).links[0];
              if (link)
                onChange({
                  ...block,
                  content: { links: [...block.content.links, link] },
                });
            }}
          >
            {d.addLink}
          </button>
        </>
      );
    case 'divider':
      return (
        <>
          <hr />
          <p>{d.dividerHint}</p>
        </>
      );
    case 'spacer':
      return (
        <>
          <p>{d.spacerHint}</p>
          <label className="block-field">
            <span>{d.fields.height}</span>
            <select
              value={block.content.height}
              onChange={(event) =>
                onChange({
                  ...block,
                  content: {
                    height: spacerContentSchema.shape.height.parse(
                      event.target.value,
                    ),
                  },
                })
              }
            >
              {spacerContentSchema.shape.height.options.map((height) => (
                <option key={height} value={height}>
                  {d.heights[height]}
                </option>
              ))}
            </select>
          </label>
        </>
      );
  }
}
