import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { DEFAULT_THEME } from '@folyo/core';
import en from '../lib/i18n/en';
import { AppearanceSettings, TemplateGallery } from './templates';
import { TemplateToast } from './template-toast';
const navigation = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => navigation }));
const fetchMock = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockResolvedValue(
    Response.json({
      theme: DEFAULT_THEME,
      appliedTheme: true,
      contentSkipped: false,
    }),
  );
});
describe('template gallery', () => {
  it('offers eight lightweight thumbnails and sends the selected choice to onboarding', async () => {
    const { container } = render(<TemplateGallery d={en} locale="en" />);
    expect(container.querySelectorAll('svg.template-thumbnail')).toHaveLength(
      8,
    );
    expect(container.querySelector('iframe')).toBeNull();
    const card = screen
      .getByRole('heading', { name: 'Professional' })
      .closest('article')!;
    fireEvent.click(
      within(card).getByRole('button', { name: 'Choose template' }),
    );
    await waitFor(() =>
      expect(navigation.replace).toHaveBeenCalledWith('/dashboard'),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/site/template',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ templateId: 'professional' }),
      }),
    );
    expect(sessionStorage.getItem('folyo-template-toast')).toBe(
      'Portfolio created from Professional',
    );
  });
  it('handles 409 as a successful style application with a clear preservation message', async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        { theme: DEFAULT_THEME, appliedTheme: true, contentSkipped: true },
        { status: 409 },
      ),
    );
    render(<TemplateGallery d={en} locale="en" />);
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Choose template' })[1]!,
    );
    await waitFor(() =>
      expect(navigation.replace).toHaveBeenCalledWith('/dashboard'),
    );
    expect(sessionStorage.getItem('folyo-template-toast')).toBe(
      en.templates.contentSkipped,
    );
  });
  it('keeps the gallery available after a failed application', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    render(<TemplateGallery d={en} locale="en" />);
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Choose template' })[0]!,
    );
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        en.errors.unavailable,
      ),
    );
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(
      screen.getAllByRole('button', { name: 'Choose template' })[0],
    ).toBeEnabled();
  });
  it('disables content for edited sites but applies full template style explicitly', async () => {
    render(<TemplateGallery d={en} locale="en" settings virgin={false} />);
    for (const button of screen.getAllByRole('button', {
      name: 'Apply content',
    }))
      expect(button).toBeDisabled();
    const card = screen
      .getByRole('heading', { name: 'Creative' })
      .closest('article')!;
    expect(
      within(card).getByTitle(en.templates.contentDisabled),
    ).toHaveAttribute('tabindex', '0');
    fireEvent.click(within(card).getByRole('button', { name: 'Apply style' }));
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        en.templates.styleApplied,
      ),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/site/template/style',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ templateId: 'creative' }),
      }),
    );
    expect(navigation.replace).not.toHaveBeenCalled();
  });
  it('disables content after applying a complete non-blank template', async () => {
    render(<TemplateGallery d={en} locale="en" settings virgin />);
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Apply content' })[1]!,
    );
    await waitFor(() =>
      expect(
        screen.getAllByRole('button', { name: 'Apply content' })[1],
      ).toBeDisabled(),
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'Portfolio created from Minimal',
    );
  });
  it('shows the persisted toast on dashboard and consumes it', async () => {
    sessionStorage.setItem(
      'folyo-template-toast',
      en.templates.created.replace('{name}', 'Minimal'),
    );
    render(<TemplateToast />);
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Portfolio created from Minimal',
    );
    expect(sessionStorage.getItem('folyo-template-toast')).toBeNull();
  });
});
describe('appearance settings', () => {
  it('keeps theme controls but removes template selection from settings', () => {
    render(
      <AppearanceSettings
        d={en}
        siteId="site-id"
        initialTheme={DEFAULT_THEME}
      />,
    );
    expect(
      screen.getByRole('heading', { name: en.templates.appearance }),
    ).toBeVisible();
    expect(
      screen.queryByRole('heading', { name: en.templates.section }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: en.templates.applyStyle }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: en.templates.applyContent }),
    ).toBeNull();
  });
  it('saves curated accents and points preview at the same site', async () => {
    fetchMock.mockResolvedValue(
      Response.json({ theme: { ...DEFAULT_THEME, accent: '#7C3AED' } }),
    );
    render(
      <AppearanceSettings
        d={en}
        siteId="site-id"
        initialTheme={DEFAULT_THEME}
      />,
    );
    expect(screen.getByRole('link', { name: en.preview })).toHaveAttribute(
      'href',
      '/p/site-id',
    );
    expect(screen.getAllByRole('radio')).toHaveLength(8);
    fireEvent.click(screen.getByRole('radio', { name: '#7C3AED' }));
    await waitFor(() =>
      expect(screen.getByRole('radio', { name: '#7C3AED' })).toBeChecked(),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/site/theme',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ accent: '#7C3AED' }),
      }),
    );
  });
  it('saves a complete font pair with option previews', async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        theme: {
          ...DEFAULT_THEME,
          headingFont: 'lora',
          bodyFont: 'source-sans',
        },
      }),
    );
    render(
      <AppearanceSettings
        d={en}
        siteId="site-id"
        initialTheme={DEFAULT_THEME}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: en.templates.typography }),
    );
    const option = screen.getByRole('option', { name: /Lora · Source Sans/ });
    expect(option.querySelector('.font-option-preview')).toBeInTheDocument();
    fireEvent.click(option);
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/site/theme',
        expect.objectContaining({
          body: JSON.stringify({
            headingFont: 'lora',
            bodyFont: 'source-sans',
          }),
        }),
      ),
    );
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: en.templates.typography }),
      ).toHaveTextContent('Lora · Source Sans'),
    );
  });
  it('saves hero layout and retains the previous selection on failures', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    render(
      <AppearanceSettings
        d={en}
        siteId="site-id"
        initialTheme={DEFAULT_THEME}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: en.templates.heroLayout }),
    );
    fireEvent.click(screen.getByRole('option', { name: en.templates.left }));
    await waitFor(() =>
      expect(screen.getAllByRole('alert')[0]).toHaveTextContent(
        en.errors.unavailable,
      ),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/site/theme',
      expect.objectContaining({ body: JSON.stringify({ heroLayout: 'left' }) }),
    );
    expect(
      screen.getByRole('button', { name: en.templates.heroLayout }),
    ).toHaveTextContent(en.templates.center);
  });
});
