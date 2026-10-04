import { render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  BLOCK_TYPES,
  DEFAULT_THEME,
  createDefaultBlock,
  type BlockContent,
} from '@folyo/core';
import {
  BlockRender,
  ButtonRender,
  GalleryRender,
  HeadingRender,
  HeroRender,
  ImageRender,
  SocialRender,
  SpacerRender,
  TextRender,
} from './blocks';
const theme = DEFAULT_THEME;
describe('pure block rendering', () => {
  it.each(BLOCK_TYPES)('renders the %s block as static HTML', (type) => {
    const block = {
      type,
      content: createDefaultBlock(type, 'en'),
    } as BlockContent;
    const html = renderToStaticMarkup(
      <BlockRender block={block} theme={theme} />,
    );
    expect(html).not.toBe('');
    expect(html).not.toContain('<script');
  });
  it('renders a centered semantic hero with photo and optional subtitle', () => {
    render(
      <HeroRender
        content={{
          name: 'Ada',
          title: 'Designer',
          subtitle: 'Independent',
          avatarUrl: '/api/assets/assets/avatar.webp',
        }}
        theme={theme}
      />,
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Ada');
    expect(screen.getByRole('img', { name: 'Ada' })).toHaveClass('site-avatar');
    expect(screen.getByText('Designer')).toBeInTheDocument();
    expect(screen.getByText('Independent')).toBeInTheDocument();
  });
  it.each([1, 2, 3] as const)('uses h%s for headings', (level) => {
    render(<HeadingRender content={{ level, text: 'Work' }} theme={theme} />);
    expect(screen.getByRole('heading', { level })).toHaveTextContent('Work');
  });
  it('parses paragraphs, lists, quotes, strong and emphasis without rendering raw HTML', () => {
    const { container } = render(
      <TextRender
        content={{
          text: 'First **bold** and *italic*.\nSecond line\n\nNext paragraph\n- One\n- Two\n> Quote\n> More\n\n<script>alert(1)</script>\n<img src=x onerror=alert(1)>',
        }}
        theme={theme}
      />,
    );
    expect(container.querySelectorAll('p')).toHaveLength(3);
    expect(container.querySelector('strong')).toHaveTextContent('bold');
    expect(container.querySelector('em')).toHaveTextContent('italic');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(container.querySelector('blockquote')).toHaveTextContent(
      'QuoteMore',
    );
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('<script>alert(1)</script>');
    expect(container.textContent).toContain('<img src=x onerror=alert(1)>');
  });
  it('renders safe inline links in lists and escapes labels and URL attributes', () => {
    const { container } = render(
      <TextRender
        theme={theme}
        content={{
          text: '- [**bold** *italic*](https://ok)\n[x](javascript:alert(1))\n[<img src=x>](https://ok/"onclick="evil)',
        }}
      />,
    );
    const link = container.querySelector('li a');
    expect(link).toHaveAttribute('href', 'https://ok');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link?.querySelector('strong')).toHaveTextContent('bold');
    expect(link?.querySelector('em')).toHaveTextContent('italic');
    expect(container.textContent).toContain('[x](javascript:alert(1))');
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('[onclick]')).toBeNull();
  });
  it.each(['row', 'column'] as const)(
    'renders social %s with each alignment',
    (layout) => {
      for (const align of ['start', 'center', 'end'] as const) {
        const { container, unmount } = render(
          <SocialRender
            theme={theme}
            content={{
              layout,
              align,
              links: [{ platform: 'site', url: 'https://ok' }],
            }}
          />,
        );
        expect(container.querySelector('ul')).toHaveStyle({
          display: 'flex',
          flexDirection: layout,
          gap: '12px',
          justifyContent: {
            start: 'flex-start',
            center: 'center',
            end: 'flex-end',
          }[align],
          flexWrap: layout === 'row' ? 'wrap' : 'nowrap',
        });
        expect(container.querySelector('a')).toHaveAttribute(
          'target',
          '_blank',
        );
        expect(container.querySelector('a')).toHaveAttribute(
          'rel',
          'noopener noreferrer',
        );
        unmount();
      }
    },
  );
  it('renders image alt/caption and lazy loading', () => {
    render(
      <ImageRender
        content={{
          url: '/api/assets/assets/image.webp',
          alt: 'Portrait',
          caption: '2026',
        }}
        theme={theme}
      />,
    );
    expect(screen.getByRole('img')).toHaveAttribute('alt', 'Portrait');
    expect(screen.getByRole('img')).toHaveAttribute('loading', 'lazy');
    expect(screen.getByText('2026').tagName).toBe('FIGCAPTION');
  });
  it('renders all gallery images and selects the three-column grid', () => {
    const { container } = render(
      <GalleryRender
        content={{
          items: [1, 2, 3].map((index) => ({
            url: `https://example.com/${index}.png`,
            alt: `Image ${index}`,
          })),
        }}
        theme={theme}
      />,
    );
    expect(screen.getAllByRole('img')).toHaveLength(3);
    expect(container.firstChild).toHaveClass('site-gallery-three');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
  it.each(['primary', 'outline'] as const)('renders a %s link', (style) => {
    render(
      <ButtonRender
        content={{ label: 'Contact', url: 'https://example.com', style }}
        theme={theme}
      />,
    );
    expect(screen.getByRole('link')).toHaveClass(`site-button-${style}`);
  });
  it('renders every supported social platform with accessible SVG links', () => {
    const platforms = [
      'linkedin',
      'instagram',
      'github',
      'x',
      'tiktok',
      'youtube',
      'whatsapp',
      'email',
      'site',
    ] as const;
    const { container } = render(
      <SocialRender
        content={{
          layout: 'row',
          align: 'start',
          links: platforms.map((platform) => ({
            platform,
            url:
              platform === 'email'
                ? 'mailto:ada@example.com'
                : 'https://example.com',
          })),
        }}
        theme={theme}
      />,
    );
    expect(screen.getAllByRole('link')).toHaveLength(9);
    expect(screen.getByRole('link', { name: 'GitHub' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Email' })).toHaveAttribute(
      'href',
      'mailto:ada@example.com',
    );
    expect(container.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(
      9,
    );
  });
  it.each([
    'javascript:alert(1)',
    'data:text/html,<script>x</script>',
    'mailto:ada@example.com',
  ])('does not activate unsafe/inapplicable URL %s', (url) => {
    const { container } = render(
      <SocialRender
        content={{
          layout: 'row',
          align: 'start',
          links: [{ platform: 'github', url }],
        }}
        theme={theme}
      />,
    );
    expect(container.querySelector('a')).not.toHaveAttribute('href');
  });
  it.each([
    ['sm', 24],
    ['md', 48],
    ['lg', 96],
  ] as const)('renders spacer %s at %s px', (height, pixels) => {
    const { container } = render(
      <SpacerRender content={{ height }} theme={theme} />,
    );
    expect(container.firstChild).toHaveStyle({ height: `${pixels}px` });
  });
  it('escapes malicious text and attribute values across all content-bearing renders', () => {
    const malicious = '<script>alert(1)</script><img onerror="alert(1)">';
    const blocks: BlockContent[] = [
      {
        type: 'hero',
        content: { name: malicious, title: malicious, subtitle: malicious },
      },
      { type: 'heading', content: { text: malicious, level: 2 } },
      {
        type: 'image',
        content: {
          url: 'https://example.com/x.png',
          alt: malicious,
          caption: malicious,
        },
      },
      {
        type: 'gallery',
        content: {
          items: [
            {
              url: 'https://example.com/x.png',
              alt: malicious,
              caption: malicious,
            },
          ],
        },
      },
      {
        type: 'button',
        content: {
          label: malicious,
          url: 'javascript:alert(1)',
          style: 'primary',
        },
      },
    ];
    for (const block of blocks) {
      const html = renderToStaticMarkup(
        <BlockRender block={block} theme={theme} />,
      );
      const element = document.createElement('div');
      element.innerHTML = html;
      expect(element.querySelector('script')).toBeNull();
      expect(element.querySelector('[onerror]')).toBeNull();
      expect(html).toContain('&lt;script&gt;');
      expect(element.querySelector('a[href^="javascript:"]')).toBeNull();
    }
  });
});
