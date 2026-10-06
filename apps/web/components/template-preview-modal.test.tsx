import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { DEFAULT_THEME, TEMPLATE_IDS } from '@folyo/core';
import en from '../lib/i18n/en';
import pt from '../lib/i18n/pt-BR';
import { TemplateGallery } from './templates';
import { TemplatePreviewModal } from './template-preview-modal';
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
describe('real template preview', () => {
  it.each(TEMPLATE_IDS)(
    'opens %s locally with real render blocks and footer',
    async (id) => {
      const use = vi.fn();
      render(
        <TemplatePreviewModal
          templateId={id}
          locale="pt-BR"
          d={pt}
          onClose={vi.fn()}
          onUse={use}
        />,
      );
      const modal = screen.getByRole('dialog');
      expect(
        await within(modal).findByRole('heading', { level: 1 }),
      ).toBeInTheDocument();
      expect(
        within(modal).getByRole('link', { name: 'Feito com Folyo' }),
      ).toBeInTheDocument();
      expect(modal.querySelector('.folyo-site')).toBeInTheDocument();
      expect(fetchMock).not.toHaveBeenCalled();
      expect(use).not.toHaveBeenCalled();
    },
  );
  it('navigates pages inside the modal without changing location or applying the template', async () => {
    const use = vi.fn();
    const initial = location.href;
    render(
      <TemplatePreviewModal
        templateId="minimal"
        locale="en"
        d={en}
        onClose={vi.fn()}
        onUse={use}
      />,
    );
    const modal = screen.getByRole('dialog');
    expect(
      await within(modal).findByRole('heading', { name: 'Alex Morgan' }),
    ).toBeInTheDocument();
    fireEvent.click(within(modal).getByRole('link', { name: 'About' }));
    expect(
      within(modal).getByRole('heading', { name: 'About' }),
    ).toBeInTheDocument();
    expect(within(modal).getByRole('link', { name: 'About' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(modal).queryByText('Alex Morgan')).toBeNull();
    fireEvent.click(within(modal).getByRole('link', { name: 'Home' }));
    expect(
      within(modal).getByRole('heading', { name: 'Alex Morgan' }),
    ).toBeInTheDocument();
    expect(location.href).toBe(initial);
    expect(use).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('loads the local template artwork through the real renders', async () => {
    render(
      <TemplatePreviewModal
        templateId="creative"
        locale="en"
        d={en}
        onClose={vi.fn()}
        onUse={vi.fn()}
      />,
    );
    const modal = screen.getByRole('dialog');
    expect(
      await within(modal).findByRole('img', { name: 'Alex Morgan' }),
    ).toHaveAttribute('src', '/template-assets/studio-6.svg');
    expect(modal.querySelectorAll('.site-gallery img')).toHaveLength(3);
    expect(modal.querySelector('.site-gallery img')).toHaveAttribute(
      'src',
      '/template-assets/studio-1.svg',
    );
  });
  it('Close restores focus to the gallery without any API call', async () => {
    render(<TemplateGallery d={en} locale="en" />);
    const trigger = screen.getAllByRole('button', {
      name: en.templates.viewExample,
    })[0]!;
    trigger.focus();
    fireEvent.click(trigger);
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: en.templates.closePreview,
      }),
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger).toHaveFocus();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(document.body.style.overflow).not.toBe('hidden');
  });
  it('Use applies the selected template through the existing API and follows onboarding', async () => {
    render(<TemplateGallery d={en} locale="en" />);
    const card = screen
      .getByRole('heading', { name: 'Professional' })
      .closest('article')!;
    fireEvent.click(
      within(card).getByRole('button', { name: en.templates.viewExample }),
    );
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: en.templates.useTemplate,
      }),
    );
    await waitFor(() =>
      expect(navigation.replace).toHaveBeenCalledWith('/dashboard'),
    );
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/site/template',
      expect.objectContaining({
        body: JSON.stringify({ templateId: 'professional' }),
      }),
    );
  });
  it('handles non-virgin 409 from Use with the existing preservation toast', async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        { theme: DEFAULT_THEME, appliedTheme: true, contentSkipped: true },
        { status: 409 },
      ),
    );
    render(<TemplateGallery d={en} locale="en" />);
    fireEvent.click(
      screen.getAllByRole('button', { name: en.templates.viewExample })[1]!,
    );
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: en.templates.useTemplate,
      }),
    );
    await waitFor(() =>
      expect(navigation.replace).toHaveBeenCalledWith('/dashboard'),
    );
    expect(sessionStorage.getItem('folyo-template-toast')).toBe(
      en.templates.contentSkipped,
    );
  });
  it('keeps an unsuccessful application open with a clear error for retry', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    render(<TemplateGallery d={en} locale="en" />);
    fireEvent.click(
      screen.getAllByRole('button', { name: en.templates.viewExample })[0]!,
    );
    const modal = screen.getByRole('dialog');
    fireEvent.click(
      within(modal).getByRole('button', { name: en.templates.useTemplate }),
    );
    await waitFor(() =>
      expect(within(modal).getByRole('alert')).toHaveTextContent(
        en.errors.unavailable,
      ),
    );
    expect(modal).toBeInTheDocument();
    expect(navigation.replace).not.toHaveBeenCalled();
  });
});
