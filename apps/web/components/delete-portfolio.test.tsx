import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import en from '../lib/i18n/en';
import { DeletePortfolio } from './delete-portfolio';
const navigation = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => navigation }));
const fetchMock = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockResolvedValue(Response.json({ ok: true, handle: 'maria' }));
});
function setup() {
  render(
    <DeletePortfolio
      d={en}
      handle="maria"
      publicUrl="https://maria.folyo.me"
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: en.siteDeletion.title }));
  return screen.getByRole('dialog');
}
describe('portfolio-only danger zone', () => {
  it('requires both the exact handle and link acknowledgement', () => {
    const modal = setup();
    const confirm = within(modal).getByRole('button', {
      name: en.siteDeletion.confirmButton,
    });
    const checkbox = within(modal).getByRole('checkbox', {
      name: /https:\/\/maria.folyo.me/,
    });
    const input = within(modal).getByRole('textbox');
    expect(confirm).toBeDisabled();
    fireEvent.change(input, { target: { value: 'maria' } });
    expect(confirm).toBeDisabled();
    fireEvent.click(checkbox);
    expect(confirm).toBeEnabled();
    fireEvent.change(input, { target: { value: 'Maria' } });
    expect(confirm).toBeDisabled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('deletes only the portfolio and navigates to handle onboarding with a toast', async () => {
    const modal = setup();
    fireEvent.change(within(modal).getByRole('textbox'), {
      target: { value: 'maria' },
    });
    fireEvent.click(within(modal).getByRole('checkbox'));
    fireEvent.click(
      within(modal).getByRole('button', {
        name: en.siteDeletion.confirmButton,
      }),
    );
    await waitFor(() =>
      expect(navigation.replace).toHaveBeenCalledWith('/onboarding'),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/site',
      expect.objectContaining({
        method: 'DELETE',
        body: JSON.stringify({ handle: 'maria' }),
      }),
    );
    expect(sessionStorage.getItem('folyo-template-toast')).toBe(
      en.siteDeletion.success,
    );
    expect(fetchMock).toHaveBeenCalledOnce();
  });
  it('Cancel closes without deleting and reopening resets the confirmation', () => {
    const modal = setup();
    fireEvent.change(within(modal).getByRole('textbox'), {
      target: { value: 'maria' },
    });
    fireEvent.click(within(modal).getByRole('checkbox'));
    fireEvent.click(within(modal).getByRole('button', { name: en.cancel }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole('button', { name: en.siteDeletion.title }),
    );
    expect(screen.getByRole('textbox')).toHaveValue('');
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });
  it('shows an API failure without leaving settings', async () => {
    fetchMock.mockResolvedValue(
      Response.json({ error: 'publicationBusy' }, { status: 409 }),
    );
    const modal = setup();
    fireEvent.change(within(modal).getByRole('textbox'), {
      target: { value: 'maria' },
    });
    fireEvent.click(within(modal).getByRole('checkbox'));
    fireEvent.click(
      within(modal).getByRole('button', {
        name: en.siteDeletion.confirmButton,
      }),
    );
    await waitFor(() =>
      expect(within(modal).getByRole('alert')).toHaveTextContent(
        en.publication.publicationBusy,
      ),
    );
    expect(navigation.replace).not.toHaveBeenCalled();
  });
});
