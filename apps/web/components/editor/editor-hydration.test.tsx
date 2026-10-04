import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import { act } from '@testing-library/react';
import type { EditorDocument } from '@folyo/core';
import { Editor } from './editor';
import en from '../../lib/i18n/en';
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
const id = '10000000-0000-4000-8000-000000000001';
const editorDocument: EditorDocument = {
  site: { id, handle: 'test', title: 'Portfolio', status: 'draft' },
  pages: [{ id, siteId: id, title: 'Home', slug: 'home', position: 0 }],
  blocks: [
    { id, pageId: id, type: 'text', content: { text: 'Draft' }, position: 0 },
  ],
};
function tree() {
  return <Editor document={editorDocument} pageId={id} d={en} locale="en" />;
}
describe('editor hydration gate', () => {
  it('renders only the skeleton in SSR, without dnd-kit IDs or editor inputs', () => {
    const html = renderToString(tree());
    expect(html).toContain('editor-skeleton');
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain('DndDescribedBy');
    expect(html).not.toContain('sortable-block');
    expect(html).not.toContain('<textarea');
    expect(html).not.toContain('<header');
  });
  it('hydrates without mismatches and mounts dnd-kit afterward', async () => {
    // Repeated SSR must stay independent of dnd-kit's generated IDs.
    renderToString(tree());
    const container = document.createElement('div');
    container.innerHTML = renderToString(tree());
    document.body.appendChild(container);
    const recoverable = vi.fn();
    const errors = vi.spyOn(console, 'error');
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      await act(async () => {
        root = hydrateRoot(container, tree(), {
          onRecoverableError: recoverable,
        });
      });
      expect(recoverable).not.toHaveBeenCalled();
      expect(errors.mock.calls.flat().join(' ')).not.toMatch(
        /hydration|did not match|didn't match/i,
      );
      expect(container.querySelector('.editor-skeleton')).toBeNull();
      expect(container.querySelector('.sortable-block')).not.toBeNull();
      expect(
        container.querySelector('[aria-describedby^="DndDescribedBy-"]'),
      ).not.toBeNull();
      expect(container.querySelector('textarea')).toBeNull();
      expect(container.querySelector('.site-text')).toHaveTextContent('Draft');
    } finally {
      await act(async () => root?.unmount());
      container.remove();
      errors.mockRestore();
    }
  });
});
