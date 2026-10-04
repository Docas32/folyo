import {
  createDefaultBlock,
  getBlockPlaceholders,
  resolveTheme,
  type BlockContent,
  type TemplateDefinition,
  type TemplateId,
} from '@folyo/core';
import { getDictionary } from './i18n';
export function buildTemplate(
  id: TemplateId,
  locale: string,
): TemplateDefinition {
  const c = getDictionary(locale).templates.content;
  const text = (value: string): BlockContent => ({
    type: 'text',
    content: { text: value },
  });
  const heading = (value: string): BlockContent => ({
    type: 'heading',
    content: { text: value, level: 2 },
  });
  const button = (label: string, url: string): BlockContent => ({
    type: 'button',
    content: { label, url, style: 'primary' },
  });
  const hero = (
    title: string,
    subtitle: string,
    avatar = false,
  ): BlockContent => ({
    type: 'hero',
    content: {
      name: c.name,
      title,
      subtitle,
      ...(avatar
        ? { avatarUrl: 'https://placehold.co/240x240/FFE5DC/16161D.png' }
        : {}),
    },
  });
  const social = (
    layout: 'row' | 'column',
    align: 'start' | 'center',
  ): BlockContent => ({
    type: 'social',
    content: {
      layout,
      align,
      links: [
        { platform: 'linkedin', url: 'https://www.linkedin.com/' },
        { platform: 'email', url: `mailto:${c.email}` },
      ],
    },
  });
  const gallery = (count: number): BlockContent => ({
    type: 'gallery',
    content: {
      items: c.galleryAlts.slice(0, count).map((alt, i) => ({
        url: `https://placehold.co/1200x900/${['FFE5DC', 'DDE8FA', 'DDF0E8', 'EAE0FA', 'F7EACB', 'F7DDE6'][i]}/16161D.png`,
        alt,
      })),
    },
  });
  const page = (title: string, slug: string, blocks: BlockContent[]) => ({
    title,
    slug,
    blocks,
  });
  if (
    id === 'executive' ||
    id === 'studio' ||
    id === 'scientist' ||
    id === 'developer'
  )
    return buildShowcaseTemplate(id, locale);
  switch (id) {
    case 'blank': {
      const p = getBlockPlaceholders(locale);
      return {
        theme: resolveTheme({ preset: id }),
        pages: [
          page(p.pageTitle, p.pageSlug, [
            { type: 'hero', content: createDefaultBlock('hero', locale) },
          ]),
        ],
      };
    }
    case 'minimal':
      return {
        theme: resolveTheme({
          preset: id,
          accent: '#16161D',
          headingFont: 'playfair',
          bodyFont: 'inter',
          heroLayout: 'center',
        }),
        pages: [
          page(c.home, c.homeSlug, [
            hero(c.minimalTitle, c.minimalSubtitle),
            text(c.minimalText),
            social('column', 'center'),
          ]),
          page(c.about, c.aboutSlug, [heading(c.about), text(c.aboutText)]),
        ],
      };
    case 'professional':
      return {
        theme: resolveTheme({
          preset: id,
          accent: '#1E5AA8',
          headingFont: 'space-grotesk',
          heroLayout: 'left',
        }),
        pages: [
          page(c.home, c.homeSlug, [
            hero(c.professionalTitle, c.professionalSubtitle),
            text(c.professionalText),
            button(c.cv, '#'),
            social('row', 'start'),
          ]),
          page(c.experience, c.experienceSlug, [
            heading(c.experience),
            text(c.experienceText),
          ]),
          page(c.contact, c.contactSlug, [
            heading(c.contact),
            text(c.contactText),
            button(c.emailButton, `mailto:${c.email}`),
          ]),
        ],
      };
    case 'creative':
      return {
        theme: resolveTheme({
          preset: id,
          accent: '#FF5C38',
          headingFont: 'lora',
          bodyFont: 'source-sans',
          heroLayout: 'center',
        }),
        pages: [
          page(c.home, c.homeSlug, [
            hero(c.creativeTitle, c.creativeSubtitle, true),
            gallery(3),
            social('row', 'center'),
          ]),
          page(c.work, c.workSlug, [gallery(6), text(c.workText)]),
          page(c.contact, c.contactSlug, [
            heading(c.contact),
            text(c.creativeContact),
            button(c.emailButton, `mailto:${c.email}`),
          ]),
        ],
      };
  }
}
/** Compare semantic JSON, not property order; any extra or changed field is an edit. */
export function sameContent(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const aa = a as Record<string, unknown>,
    bb = b as Record<string, unknown>;
  return (
    Object.keys(aa).length === Object.keys(bb).length &&
    Object.keys(aa).every((key) => sameContent(aa[key], bb[key]))
  );
}
export function isVirginSite(
  site: {
    title: string | null;
    description: string | null;
    faviconKey?: string | null;
    status?: string;
  },
  pages: { title: string; slug: string; position?: number }[],
  blocks: { type: string; content: unknown; position?: number }[],
): boolean {
  if (
    site.title ||
    site.description ||
    site.faviconKey ||
    site.status === 'published' ||
    pages.length > 1
  )
    return false;
  if (!pages.length) return blocks.length === 0;
  if (blocks.length !== 1 || blocks[0]!.type !== 'hero') return false;
  if (
    (pages[0]!.position !== undefined && pages[0]!.position !== 0) ||
    (blocks[0]!.position !== undefined && blocks[0]!.position !== 0)
  )
    return false;

  return ['pt-BR', 'en'].some((locale) => {
    const p = getBlockPlaceholders(locale);
    return (
      pages[0]!.title === p.pageTitle &&
      pages[0]!.slug === p.pageSlug &&
      sameContent(blocks[0]!.content, createDefaultBlock('hero', locale))
    );
  });
}

export const SHOWCASE_IDS = [
  'executive',
  'studio',
  'scientist',
  'developer',
] as const;
export function buildShowcaseTemplate(
  id: (typeof SHOWCASE_IDS)[number],
  locale: string,
): TemplateDefinition {
  const d = getDictionary(locale).templates;
  const c = d.showcase[id];
  const heading = (text: string, level: 1 | 2 | 3 = 2): BlockContent => ({
    type: 'heading',
    content: { text, level },
  });
  const text = (text: string): BlockContent => ({
    type: 'text',
    content: { text },
  });
  const divider = (): BlockContent => ({ type: 'divider', content: {} });
  const spacer = (): BlockContent => ({
    type: 'spacer',
    content: { height: 'md' },
  });
  const button = (
    label: string,
    style: 'primary' | 'outline' = 'primary',
  ): BlockContent => ({
    type: 'button',
    content: { label, url: `mailto:${c.email}`, style },
  });
  const image = (cover: boolean): BlockContent => ({
    type: 'image',
    content: {
      url: `/template-assets/${id}-${cover ? 'cover' : '1'}.svg`,
      alt: c.imageAlts[0]!,
      caption: cover ? undefined : c.captions[0]!,
    },
  });
  const gallery = (count: number): BlockContent => ({
    type: 'gallery',
    content: {
      items: Array.from({ length: count }, (_, i) => ({
        url: `/template-assets/${id}-${i + 1}.svg`,
        alt: c.imageAlts[i]!,
        caption: c.captions[i]!,
      })),
    },
  });
  const social: BlockContent = {
    type: 'social',
    content: {
      layout: 'row',
      align: id === 'studio' ? 'center' : 'start',
      links: [
        {
          platform:
            id === 'developer'
              ? 'github'
              : id === 'studio'
                ? 'instagram'
                : 'linkedin',
          url:
            id === 'developer'
              ? 'https://github.com/'
              : id === 'studio'
                ? 'https://www.instagram.com/'
                : 'https://www.linkedin.com/',
        },
        { platform: 'email', url: `mailto:${c.email}` },
      ],
    },
  };
  const themes = {
    executive: {
      accent: '#16161D',
      headingFont: 'playfair',
      bodyFont: 'inter',
      heroLayout: 'left',
    },
    studio: {
      accent: '#7C3AED',
      headingFont: 'lora',
      bodyFont: 'source-sans',
      heroLayout: 'center',
    },
    scientist: {
      accent: '#0F766E',
      headingFont: 'space-grotesk',
      bodyFont: 'inter',
      heroLayout: 'left',
    },
    developer: {
      accent: '#1E5AA8',
      headingFont: 'space-grotesk',
      bodyFont: 'inter',
      heroLayout: 'left',
    },
  };
  const identity: BlockContent = {
    type: 'hero',
    content: { name: c.name, title: c.role, subtitle: c.subtitle },
  };
  const homeBlocks: Record<(typeof SHOWCASE_IDS)[number], BlockContent[]> = {
    executive: [
      identity,
      text(c.intro),
      button(d.showcase.contactButton),
      spacer(),
      image(true),
      spacer(),
      heading(c.focus),
      text(c.homeText),
      divider(),
      heading(d.showcase.selected),
      text(d.showcase.selectedText),
      gallery(3),
      social,
    ],
    studio: [
      identity,
      image(true),
      spacer(),
      heading(d.showcase.selected),
      gallery(3),
      text(c.intro),
      divider(),
      heading(c.focus),
      text(c.homeText),
      button(d.showcase.contactButton, 'outline'),
      social,
    ],
    scientist: [
      identity,
      text(c.intro),
      divider(),
      heading(c.focus),
      text(c.homeText),
      image(true),
      spacer(),
      heading(c.projectPage),
      text(d.showcase.selectedText),
      gallery(3),
      button(d.showcase.contactButton, 'outline'),
      social,
    ],
    developer: [
      identity,
      text(c.intro),
      button(d.showcase.contactButton),
      image(true),
      spacer(),
      heading(d.showcase.selected),
      text(d.showcase.selectedText),
      gallery(3),
      divider(),
      heading(c.focus),
      text(c.homeText),
      social,
    ],
  };
  return {
    theme: resolveTheme({ preset: id, ...themes[id] }),
    pages: [
      {
        title: d.content.home,
        slug: d.content.homeSlug,
        blocks: homeBlocks[id],
      },
      {
        title: c.projectPage,
        slug: c.projectSlug,
        blocks: [
          heading(c.projectTitle, 1),
          text(c.projectText),
          spacer(),
          image(false),
          divider(),
          gallery(6),
          text(c.projectConclusion),
          button(d.showcase.contactButton, 'outline'),
        ],
      },
      {
        title: c.extraPage,
        slug: c.extraSlug,
        blocks: [
          heading(c.extraTitle, 1),
          text(c.extraText),
          spacer(),
          image(true),
          divider(),
          heading(d.showcase.approach),
          text(c.projectConclusion),
          button(d.showcase.contactButton),
        ],
      },
      {
        title: c.aboutPage,
        slug: c.aboutSlug,
        blocks: [
          heading(c.aboutTitle, 1),
          text(c.aboutText),
          divider(),
          social,
          text(d.showcase.exampleNote),
        ],
      },
      {
        title: d.showcase.contact,
        slug: d.showcase.contactSlug,
        blocks: [
          heading(d.showcase.contactTitle, 1),
          text(c.contactText),
          spacer(),
          button(d.showcase.contactButton),
          social,
        ],
      },
    ],
  };
}
