import {
  normalizeExternalUrl,
  templateAssetUrlSchema,
  parseInlineMarkdown,
  type InlineToken,
} from '@folyo/core';
import type { ReactNode } from 'react';
import type {
  BlockContent,
  BlockType,
  ContentByType,
  Theme,
} from '@folyo/core';
// Optional editor slots keep layout and safe rendering shared; defaults stay static.
export type RenderSlots = {
  name?: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  avatar?: ReactNode;
  text?: ReactNode;
  galleryItem?: (index: number, image: ReactNode) => ReactNode;
  galleryEnd?: ReactNode;
};
export type RenderProps<T extends BlockType> = {
  content: ContentByType[T];
  theme: Theme;
  slots?: RenderSlots | undefined;
};

/** Never turn untrusted URLs into executable links. Social schemas intentionally
 * permit free text; validate protocols at this shared rendering boundary. */
export function safeLink(value: string, platform?: string): string | undefined {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' || url.protocol === 'http:') return value;
    if (platform === 'email' && url.protocol === 'mailto:') return value;
  } catch {
    /* Incomplete draft URL: show the icon without a link. */
  }
  return undefined;
}
function safeImage(value: string): string | undefined {
  if (templateAssetUrlSchema.safeParse(value).success) return value;
  return value.startsWith('/api/assets/') && !/[\s\\]/.test(value)
    ? value
    : safeLink(value);
}
export function HeroAvatarRender({
  content,
}: Pick<RenderProps<'hero'>, 'content'>) {
  return content.avatarUrl && safeImage(content.avatarUrl) ? (
    <img
      className="site-avatar"
      src={safeImage(content.avatarUrl)}
      alt={content.name}
    />
  ) : null;
}
export function HeroRender({ content, theme, slots }: RenderProps<'hero'>) {
  return (
    <section className={`site-hero site-hero-${theme.heroLayout}`}>
      {slots?.avatar ?? <HeroAvatarRender content={content} />}
      <h1>{slots?.name ?? content.name}</h1>
      <p className="site-profession">{slots?.title ?? content.title}</p>
      {(slots?.subtitle || content.subtitle) && (
        <p className="site-subtitle">{slots?.subtitle ?? content.subtitle}</p>
      )}
    </section>
  );
}
export function HeadingRender({ content, slots }: RenderProps<'heading'>) {
  const Tag = content.level === 1 ? 'h1' : content.level === 2 ? 'h2' : 'h3';
  return <Tag className="site-heading">{slots?.text ?? content.text}</Tag>;
}
function renderTokens(tokens: InlineToken[]): ReactNode[] {
  return tokens.map((token, key) => {
    if (token.type === 'text') return token.text;
    if (token.type === 'link')
      return (
        <a key={key} href={token.url} target="_blank" rel="noopener noreferrer">
          {renderTokens(token.children)}
        </a>
      );
    if (token.type === 'strong')
      return <strong key={key}>{renderTokens(token.children)}</strong>;
    return <em key={key}>{renderTokens(token.children)}</em>;
  });
}
function inline(text: string): ReactNode[] {
  return renderTokens(parseInlineMarkdown(text));
}
export function TextRender({ content, slots }: RenderProps<'text'>) {
  if (slots?.text) return <div className="site-text">{slots.text}</div>;
  const output: ReactNode[] = [];
  let lines: string[] = [];
  let kind: 'paragraph' | 'list' | 'quote' | undefined;
  function flush() {
    if (!lines.length) return;
    const key = output.length;
    if (kind === 'list')
      output.push(
        <ul key={key}>
          {lines.map((line, index) => (
            <li key={index}>{inline(line)}</li>
          ))}
        </ul>,
      );
    else {
      const text = lines.map((line, index) => (
        <span key={index}>
          {index > 0 && <br />}
          {inline(line)}
        </span>
      ));
      output.push(
        kind === 'quote' ? (
          <blockquote key={key}>{text}</blockquote>
        ) : (
          <p key={key}>{text}</p>
        ),
      );
    }
    lines = [];
  }
  for (const line of content.text.replace(/\r\n?/g, '\n').split('\n')) {
    if (!line.trim()) {
      flush();
      kind = undefined;
      continue;
    }
    const next = line.startsWith('- ')
      ? 'list'
      : line.startsWith('> ')
        ? 'quote'
        : 'paragraph';
    if (kind !== next) flush();
    kind = next;
    lines.push(next === 'paragraph' ? line : line.slice(2));
  }
  flush();
  return <div className="site-text">{output}</div>;
}
export function ImageRender({ content }: RenderProps<'image'>) {
  return (
    <figure className="site-image">
      <img src={safeImage(content.url)} alt={content.alt} loading="lazy" />
      {content.caption && <figcaption>{content.caption}</figcaption>}
    </figure>
  );
}
export function GalleryRender({
  content,
  theme,
  slots,
}: RenderProps<'gallery'>) {
  // F5: optional lightbox can be added without changing the static content contract.
  return (
    <div
      className={`site-gallery site-gallery-${content.items.length < 3 ? 'two' : 'three'}`}
    >
      {content.items.map((item, index) =>
        slots?.galleryItem ? (
          <div key={index}>
            {slots.galleryItem(
              index,
              <ImageRender content={item} theme={theme} />,
            )}
          </div>
        ) : (
          <ImageRender key={index} content={item} theme={theme} />
        ),
      )}
      {slots?.galleryEnd}
    </div>
  );
}
export function ButtonRender({ content }: RenderProps<'button'>) {
  return (
    <a
      className={`site-button site-button-${content.style}`}
      href={
        content.url.trim() === '#'
          ? '#'
          : safeLink(normalizeExternalUrl(content.url) ?? '', 'email')
      }
    >
      {content.label}
    </a>
  );
}
const socialNames = {
  linkedin: 'LinkedIn',
  instagram: 'Instagram',
  github: 'GitHub',
  x: 'X',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  whatsapp: 'WhatsApp',
  email: 'Email',
  site: 'Site',
};
const socialPaths = {
  linkedin: 'M4 9v11M4 4v1M9 20V9h5v2c3-4 6-1 6 3v6M9 11h5v9',
  instagram:
    'M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0M17 7h.01',
  github:
    'M8 21v-4c-4 1-5-2-5-2M16 21v-4c0-1-1-2-1-2 4-1 5-3 5-6 0-2-1-3-1-3V3l-4 2H9L5 3v3C3 10 4 14 9 15c-1 1-1 2-1 2',
  x: 'M4 3l16 18h-5L4 3h5l11 18M20 3L4 21',
  tiktok: 'M14 3v13a5 5 0 1 1-5-5M14 3c1 4 3 5 7 5',
  youtube:
    'M5 5h14a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3M10 9l5 3-5 3Z',
  whatsapp: 'M4 20l1-4a9 9 0 1 1 3 3ZM8 7c0 5 4 9 9 9l1-3-3-1-1 1-3-3 1-1-1-3Z',
  email: 'M3 5h18v14H3ZM3 5l9 8 9-8',
  site: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M3 12h18M12 3c-5 5-5 13 0 18 5-5 5-13 0-18',
};
export function SocialRender({ content }: RenderProps<'social'>) {
  return (
    <ul
      className="site-social"
      style={{
        display: 'flex',
        flexDirection: content.layout ?? 'row',
        flexWrap: content.layout === 'column' ? 'nowrap' : 'wrap',
        gap: 12,
        justifyContent: {
          start: 'flex-start',
          center: 'center',
          end: 'flex-end',
        }[content.align ?? 'start'],
        alignItems:
          content.layout === 'column'
            ? { start: 'flex-start', center: 'center', end: 'flex-end' }[
                content.align ?? 'start'
              ]
            : undefined,
      }}
    >
      {content.links.map((link, index) => (
        <li key={index}>
          <a
            href={safeLink(normalizeExternalUrl(link.url) ?? '', link.platform)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={socialNames[link.platform]}
          >
            <svg
              viewBox="0 0 24 24"
              width="24"
              height="24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d={socialPaths[link.platform]} />
            </svg>
          </a>
        </li>
      ))}
    </ul>
  );
}
export function DividerRender(props: RenderProps<'divider'>) {
  void props;
  return <hr className="site-divider" />;
}
export function SpacerRender({ content }: RenderProps<'spacer'>) {
  return (
    <div
      className="site-spacer"
      aria-hidden="true"
      style={{ height: { sm: 24, md: 48, lg: 96 }[content.height] }}
    />
  );
}
export function BlockRender({
  block,
  theme,
  slots,
}: {
  block: BlockContent;
  theme: Theme;
  slots?: RenderSlots | undefined;
}) {
  switch (block.type) {
    case 'hero':
      return <HeroRender content={block.content} theme={theme} slots={slots} />;
    case 'heading':
      return (
        <HeadingRender content={block.content} theme={theme} slots={slots} />
      );
    case 'text':
      return <TextRender content={block.content} theme={theme} slots={slots} />;
    case 'image':
      return (
        <ImageRender content={block.content} theme={theme} slots={slots} />
      );
    case 'gallery':
      return (
        <GalleryRender content={block.content} theme={theme} slots={slots} />
      );
    case 'button':
      return (
        <ButtonRender content={block.content} theme={theme} slots={slots} />
      );
    case 'social':
      return (
        <SocialRender content={block.content} theme={theme} slots={slots} />
      );
    case 'divider':
      return (
        <DividerRender content={block.content} theme={theme} slots={slots} />
      );
    case 'spacer':
      return (
        <SpacerRender content={block.content} theme={theme} slots={slots} />
      );
  }
}
