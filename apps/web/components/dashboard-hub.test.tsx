import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardHub } from './dashboard-hub';
import en from '../lib/i18n/en';
import pt from '../lib/i18n/pt-BR';
const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
vi.mock('./logout', () => ({ Logout: () => null }));
vi.mock('./template-toast', () => ({ TemplateToast: () => null }));
const props = {
  d: en,
  locale: 'en',
  firstName: 'Maria',
  site: {
    id: '20000000-0000-4000-8000-000000000002',
    handle: 'maria',
    status: 'draft' as const,
    publishedVersion: 0,
    faviconKey: null,
    updatedAt: '2026-10-04T12:00:00.000Z',
    activeTemplate: 'professional' as const,
  },
  url: 'https://maria.folyo.fyi',
  publishedAt: null,
  pages: 3,
  blocks: 12,
  now: '2026-10-04T14:00:00.000Z',
  virgin: false,
};
beforeEach(() => {
  vi.resetAllMocks();
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: {
      configurable: true,
      value: function () {
        this.setAttribute('open', '');
      },
    },
    close: {
      configurable: true,
      value: function () {
        this.removeAttribute('open');
      },
    },
  });
});
describe('dashboard hub', () => {
  it('shows the first name, real domain, active thumbnail and document stats', () => {
    render(<DashboardHub {...props} />);
    expect(screen.getByRole('heading', { name: 'Hello, Maria' })).toBeVisible();
    expect(screen.getByRole('link', { name: en.publicLink })).toHaveTextContent(
      'maria.folyo.fyi',
    );
    expect(
      screen
        .getByRole('img', { name: en.templates.names.professional })
        .querySelector('svg'),
    ).not.toBeNull();
    expect(screen.getByText('Pages').parentElement).toHaveTextContent('3');
    expect(screen.getByText('Blocks').parentElement).toHaveTextContent('12');
    expect(screen.getByText('2 hours ago')).toBeVisible();
    expect(
      screen.getByRole('button', { name: /Professional.*Active style/ }),
    ).toHaveAttribute('aria-pressed', 'true');
  });
  it('confirms a style-only application and treats theme-applied 409 as success', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ appliedTheme: true, contentSkipped: true }),
          { status: 409 },
        ),
      );
    vi.stubGlobal('fetch', fetch);
    render(<DashboardHub {...props} />);
    fireEvent.click(
      screen.getByRole('button', { name: en.templates.names.creative }),
    );
    expect(screen.getByRole('dialog')).toHaveTextContent(
      'Your content will stay',
    );
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole('button', { name: en.dashboardHub.apply }),
    );
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        '/api/site/template',
        expect.objectContaining({
          body: JSON.stringify({ templateId: 'creative', applyContent: false }),
        }),
      ),
    );
    expect(await screen.findByText(en.dashboardHub.applied)).toBeVisible();
    expect(refresh).toHaveBeenCalledOnce();
  });
  it('cancel leaves content/style untouched and localizes the greeting', () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    render(<DashboardHub {...props} d={pt} locale="pt-BR" />);
    expect(screen.getByRole('heading', { name: 'Olá, Maria' })).toBeVisible();
    fireEvent.click(
      screen.getByRole('button', { name: pt.templates.names.creative }),
    );
    fireEvent.click(screen.getByRole('button', { name: pt.cancel }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('shows an active showcase template in the four quick choices', () => {
    render(
      <DashboardHub
        {...props}
        site={{ ...props.site, activeTemplate: 'scientist' }}
      />,
    );
    expect(
      screen.getByRole('button', { name: /Scientist.*Active style/ }),
    ).toHaveAttribute('aria-pressed', 'true');
  });
});
