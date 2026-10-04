import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
const refresh = vi.fn();
import { PublicationActions } from './publication-actions';
import en from '../lib/i18n/en';
import pt from '../lib/i18n/pt-BR';
const props = {
  status: 'draft' as const,
  version: 0,
  publishedAt: null,
  url: 'https://maria.example.com',
  d: en,
  locale: 'en',
};
beforeEach(() => {
  vi.resetAllMocks();
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: {
      configurable: true,
      value() {
        this.setAttribute('open', '');
      },
    },
    close: {
      configurable: true,
      value() {
        this.removeAttribute('open');
      },
    },
  });
});
it('publishes with loading, link/copy feedback and refreshed status', async () => {
  let resolve!: (response: Response) => void;
  const request = vi.fn<typeof fetch>().mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  vi.stubGlobal('fetch', request);
  render(<PublicationActions {...props} />);
  const user = userEvent.setup();
  await user.click(
    screen.getByRole('button', { name: en.publication.publish }),
  );
  expect(
    screen.getByRole('button', { name: en.publication.publishing }),
  ).toBeDisabled();
  resolve(Response.json({ url: props.url, version: 1 }));
  expect(
    await screen.findByText(en.publication.publishedSuccess),
  ).toBeInTheDocument();
  expect(screen.getByRole('link')).toHaveAttribute('href', props.url);
  expect(screen.getByRole('button', { name: en.copy })).toBeInTheDocument();
  expect(request).toHaveBeenCalledWith('/api/site/publish', { method: 'POST' });
  expect(refresh).toHaveBeenCalledOnce();
});
it('shows clear validation errors and retries publication', async () => {
  const request = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(
      Response.json({ error: 'publishTitleRequired' }, { status: 400 }),
    )
    .mockResolvedValueOnce(Response.json({ url: props.url, version: 1 }));
  vi.stubGlobal('fetch', request);
  render(<PublicationActions {...props} d={pt} locale="pt-BR" />);
  const user = userEvent.setup();
  await user.click(
    screen.getByRole('button', { name: pt.publication.publish }),
  );
  expect(await screen.findByRole('alert')).toHaveTextContent(
    pt.publication.publishTitleRequired,
  );
  await user.click(screen.getByRole('button', { name: pt.publication.retry }));
  expect(
    await screen.findByText(pt.publication.publishedSuccess),
  ).toBeInTheDocument();
  expect(request).toHaveBeenCalledTimes(2);
});
it('shows the explicit missing APP_PUBLIC_URL error in the dashboard toast', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json(
          {
            error: 'publishAppUrlRequired',
            message: 'APP_PUBLIC_URL não configurada',
          },
          { status: 400 },
        ),
      ),
  );
  render(<PublicationActions {...props} d={pt} locale="pt-BR" />);
  await userEvent
    .setup()
    .click(screen.getByRole('button', { name: pt.publication.publish }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'APP_PUBLIC_URL não configurada',
  );
  expect(refresh).not.toHaveBeenCalled();
});
it('shows version/date and requires confirmation before unpublishing', async () => {
  const request = vi
    .fn<typeof fetch>()
    .mockResolvedValue(Response.json({ ok: true }));
  vi.stubGlobal('fetch', request);
  render(
    <PublicationActions
      {...props}
      status="published"
      version={3}
      publishedAt="2026-10-04T12:00:00Z"
    />,
  );
  expect(screen.getByText(/Published · v3/)).toHaveClass('status-published');
  const user = userEvent.setup();
  await user.click(
    screen.getByRole('button', { name: en.publication.unpublish }),
  );
  expect(screen.getByRole('dialog')).toHaveTextContent(
    en.publication.confirmDescription,
  );
  expect(request).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: en.cancel }));
  expect(request).not.toHaveBeenCalled();
  await user.click(
    screen.getByRole('button', { name: en.publication.unpublish }),
  );
  const buttons = screen.getAllByRole('button', {
    name: en.publication.unpublish,
  });
  await user.click(buttons[1]!);
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith('/api/site/unpublish', {
      method: 'POST',
    }),
  );
  expect(
    await screen.findByText(en.publication.unpublishedSuccess),
  ).toBeInTheDocument();
});
