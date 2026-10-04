import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { EditorBlock, EditorDocument } from '@folyo/core';
import { Editor } from './editor';
import en from '../../lib/i18n/en';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
afterEach(cleanup);

function mount(text = '') {
  const block: EditorBlock = {
    id: '10000000-0000-4000-8000-000000000001',
    type: 'text',
    content: { text },
    position: 0,
  };
  const document: EditorDocument = {
    site: { id: block.id, handle: 'test', title: null, status: 'draft' },
    pages: [
      { id: block.id, siteId: block.id, title: 'Home', slug: '', position: 0 },
    ],
    blocks: [{ ...block, pageId: block.id }],
  };
  render(<Editor document={document} pageId={block.id} d={en} locale="en" />);
  return screen.getByRole('textbox', { name: en.editor.fields.text });
}

describe('editor composer shortcuts', () => {
  it.each([
    ['# ', '1'],
    ['## ', '2'],
    ['### ', '3'],
  ])('converts %s while typing and keeps focus', async (prefix, level) => {
    const user = userEvent.setup();
    await user.type(mount(), prefix);
    const card = screen.getByLabelText('Heading 1', { selector: 'article' });
    const heading = within(card).getByRole('textbox', {
      name: en.editor.fields.text,
    });
    expect(heading.tagName).toBe('INPUT');
    expect(heading).toHaveValue('');
    expect(heading).toHaveFocus();
    expect(within(card).getByRole('combobox')).toHaveValue(level);
    await user.keyboard('Ola');
    expect(heading).toHaveValue('Ola');
  });

  it('preserves remaining text from paste', async () => {
    const user = userEvent.setup();
    await user.click(mount());
    await user.paste('## Ola');
    expect(
      screen.getByLabelText('Heading 1', { selector: 'article' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('textbox', { name: en.editor.fields.text }),
    ).toHaveValue('Ola');
  });

  it('opens a filtered slash menu inside the card and Escape clears it', async () => {
    const user = userEvent.setup();
    const input = mount();
    await user.type(input, '/ima');
    const card = screen.getByLabelText('Text 1', { selector: 'article' });
    const menu = within(card).getByRole('group', { name: en.editor.menuLabel });
    expect(within(menu).getByText('Image')).toBeInTheDocument();
    expect(within(menu).queryByText('Heading')).not.toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(
      screen.queryByRole('group', { name: en.editor.menuLabel }),
    ).not.toBeInTheDocument();
    expect(input).toHaveValue('');
    expect(input).toHaveFocus();
    await user.type(input, '/');
    expect(
      screen.getByRole('group', { name: en.editor.menuLabel }),
    ).toBeInTheDocument();
  });

  it('converts the current card when a slash command is selected', async () => {
    const user = userEvent.setup();
    await user.type(mount(), '/head');
    await user.click(screen.getByRole('button', { name: /Heading/ }));
    const card = screen.getByLabelText('Heading 1', { selector: 'article' });
    expect(within(card).getByRole('textbox')).toHaveFocus();
    expect(
      screen.getAllByLabelText(/Heading 1/, { selector: 'article' }),
    ).toHaveLength(1);
  });

  it('keeps ordinary text and ignores slash in a nonempty input', async () => {
    const user = userEvent.setup();
    const input = mount('Existing');
    await user.type(input, ' # /');
    expect(input).toHaveValue('Existing # /');
    expect(
      screen.getByLabelText('Text 1', { selector: 'article' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('group', { name: en.editor.menuLabel }),
    ).not.toBeInTheDocument();
  });

  it('re-enables shortcuts after clearing the input', async () => {
    const user = userEvent.setup();
    const input = mount('Existing');
    await user.clear(input);
    await user.type(input, '# ');
    expect(
      screen.getByLabelText('Heading 1', { selector: 'article' }),
    ).toBeInTheDocument();
  });

  it('uses the current DOM value to decide whether slash opens the menu', () => {
    const input = mount('Existing') as HTMLTextAreaElement;
    input.value = '';
    fireEvent.keyDown(input, { key: '/' });
    expect(
      screen.getByRole('group', { name: en.editor.menuLabel }),
    ).toBeInTheDocument();
  });
});
