import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { DEFAULT_THEME, type EditorDocument } from '@folyo/core';
import { Editor } from './editor';
import en from '../../lib/i18n/en';
const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
const pageId = '10000000-0000-4000-8000-000000000001';
const document: EditorDocument = {
  site: { id: pageId, handle: 'marina', title: 'Marina', status: 'draft' },
  pages: [
    { id: pageId, siteId: pageId, title: 'Home', slug: 'home', position: 0 },
  ],
  blocks: [
    {
      id: pageId,
      pageId,
      type: 'text',
      content: { text: 'My own work and story.' },
      position: 0,
    },
  ],
};
const fetchMock = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockImplementation(async (_url, input) =>
    Response.json({ theme: { ...DEFAULT_THEME, ...JSON.parse(input.body) } }),
  );
});
function mount() {
  const result = render(
    <Editor document={document} pageId={pageId} d={en} locale="en" />,
  );
  fireEvent.click(
    screen.getByRole('button', { name: en.templates.design.open }),
  );
  return {
    ...result,
    panel: screen.getByRole('complementary', {
      name: en.templates.design.title,
    }),
  };
}
describe('editor design controls', () => {
  it('previews a custom background immediately and saves it without changing blocks', async () => {
    const { container, panel } = mount();
    fireEvent.change(
      within(panel).getByLabelText(en.templates.design.background),
      { target: { value: '#f2c9dc' } },
    );
    expect(
      (
        container.querySelector('.folyo-site') as HTMLElement
      ).style.getPropertyValue('--site-paper'),
    ).toBe('#f2c9dc');
    expect(screen.getByText('My own work and story.')).toBeVisible();
    await waitFor(
      () =>
        expect(fetchMock).toHaveBeenCalledWith(
          '/api/site/theme',
          expect.objectContaining({
            method: 'PATCH',
            body: expect.stringContaining('"backgroundColor":"#f2c9dc"'),
          }),
        ),
      { timeout: 2500 },
    );
    await waitFor(() =>
      expect(within(panel).getByRole('status')).toHaveTextContent(
        en.templates.design.saved,
      ),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('applies a visual base while preserving the page and its content', async () => {
    const { container, panel } = mount();
    fireEvent.click(
      within(panel).getByRole('button', { name: en.templates.design.base }),
    );
    fireEvent.click(
      screen.getByRole('option', { name: en.templates.names.studio }),
    );
    expect(container.querySelector('.folyo-site')).toHaveAttribute(
      'data-preset',
      'studio',
    );
    expect(screen.getByText('My own work and story.')).toBeVisible();
    expect(
      screen.getByRole('button', {
        name: en.editor.pages.moreOptions.replace('{title}', 'Home'),
      }),
    ).toBeInTheDocument();
    await waitFor(
      () =>
        expect(fetchMock).toHaveBeenCalledWith(
          '/api/site/theme',
          expect.objectContaining({
            body: expect.stringContaining('"preset":"studio"'),
          }),
        ),
      { timeout: 2500 },
    );
    expect(
      fetchMock.mock.calls.every(([url]) => url === '/api/site/theme'),
    ).toBe(true);
  });
  it('keeps failed changes in the preview, blocks exit and offers a retry', async () => {
    fetchMock.mockResolvedValue(
      Response.json({ error: 'unavailable' }, { status: 503 }),
    );
    const { container, panel } = mount();
    fireEvent.change(
      within(panel).getByLabelText(en.templates.design.background),
      { target: { value: '#142138' } },
    );
    fireEvent.click(screen.getByRole('link', { name: en.dashboardHub.back }));
    await waitFor(() =>
      expect(within(panel).getByRole('status')).toHaveTextContent(
        en.templates.design.error,
      ),
    );
    expect(router.push).not.toHaveBeenCalled();
    expect(
      (
        container.querySelector('.folyo-site') as HTMLElement
      ).style.getPropertyValue('--site-paper'),
    ).toBe('#142138');
    fetchMock.mockImplementation(async (_url, input) =>
      Response.json({ theme: JSON.parse(input.body) }),
    );
    fireEvent.click(
      within(panel).getByRole('button', { name: en.editor.retry }),
    );
    await waitFor(() =>
      expect(within(panel).getByRole('status')).toHaveTextContent(
        en.templates.design.saved,
      ),
    );
  });
  it('opens the published site at its Edge URL', () => {
    render(
      <Editor
        document={{
          ...document,
          site: { ...document.site, status: 'published' },
        }}
        pageId={pageId}
        d={en}
        locale="en"
        publicUrl="http://marina.lvh.me:8787"
      />,
    );
    expect(
      screen.getByRole('link', { name: new RegExp(en.publicLink) }),
    ).toHaveAttribute('href', 'http://marina.lvh.me:8787');
  });
});
