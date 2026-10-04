import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { EditorDocument } from '@folyo/core';
import { Editor } from './editor';
import en from '../../lib/i18n/en';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const pageId = '10000000-0000-4000-8000-000000000001';

function editorDocument(): EditorDocument {
  return {
    site: { id: pageId, handle: 'test', title: null, status: 'draft' },
    pages: [
      { id: pageId, siteId: pageId, title: 'Home', slug: 'home', position: 0 },
    ],
    blocks: [
      {
        id: pageId,
        pageId,
        type: 'text',
        content: { text: 'Home text' },
        position: 0,
      },
    ],
  };
}

function mount() {
  return render(
    <Editor document={editorDocument()} pageId={pageId} d={en} locale="en" />,
  );
}

describe('editor shell layout', () => {
  it('opens the draft preview in a new tab without flushing autosave', () => {
    mount();
    const preview = screen.getByRole('link', { name: en.editor.preview });
    expect(preview).toHaveAttribute('href', `/p/${pageId}`);
    expect(preview).toHaveAttribute('target', '_blank');
    expect(preview).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('keeps sidebar and topbar outside the single scrollable canvas', () => {
    const { container } = mount();

    const scroller = container.querySelector('.editor-canvas-scroll');
    expect(scroller).not.toBeNull();

    const main = scroller?.closest('.editor-main');
    expect(main).not.toBeNull();
    // The scroll container must belong to the main column, not the window.
    expect(main?.contains(scroller as Node)).toBe(true);
    expect(main?.querySelector('.editor-topbar')).not.toBeNull();
    expect(main?.querySelector('.editor-canvas')).not.toBeNull();

    // The topbar is a sibling of the scroller, so it stays pinned while the
    // canvas scrolls.
    const topbar = main?.querySelector('.editor-topbar');
    expect(scroller?.parentElement).toBe(topbar?.parentElement);
    expect(topbar?.contains(scroller as Node)).toBe(false);
  });

  it('renders the sidebar as a sibling of the main column inside the shell', () => {
    const { container } = mount();

    const shell = container.querySelector('.editor-layout');
    const sidebar = container.querySelector('#editor-sidebar');
    const main = container.querySelector('.editor-main');

    expect(shell).not.toBeNull();
    expect(sidebar).not.toBeNull();
    expect(main).not.toBeNull();
    expect(shell?.contains(sidebar as Node)).toBe(true);
    expect(shell?.contains(main as Node)).toBe(true);
    expect(sidebar?.parentElement).toBe(main?.parentElement);
    // The sidebar scrolls on its own, independently of the canvas.
    expect(main?.contains(sidebar as Node)).toBe(false);
  });

  it('does not let the collapsed sidebar overlap the canvas', () => {
    const { container } = mount();

    fireEvent.click(screen.getByRole('button', { name: /Hide sidebar/ }));

    expect(container.querySelector('.editor-layout')).toHaveClass(
      'is-sidebar-collapsed',
    );
    expect(container.querySelector('#editor-sidebar')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    expect(container.querySelector('.editor-canvas-scroll')).not.toBeNull();
  });

  it('closes an open page menu when the canvas scrolls', () => {
    const { container } = mount();
    const options = en.editor.pages.moreOptions.replace('{title}', 'Home');

    fireEvent.click(screen.getByRole('button', { name: options }));
    expect(screen.getByRole('menu')).toBeVisible();

    const scroller = container.querySelector('.editor-canvas-scroll')!;
    // The menu is viewport-positioned, so it must not survive the canvas
    // scrolling out from under it.
    fireEvent.scroll(scroller);

    expect(screen.queryByRole('menu', { hidden: true })).toBeNull();
  });
});
