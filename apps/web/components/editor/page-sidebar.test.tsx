import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { EditorPage } from '@folyo/core';
import { PageSidebar } from './page-sidebar';
import en from '../../lib/i18n/en';
import ptBR from '../../lib/i18n/pt-BR';
import { readFileSync } from 'node:fs';
import { URL as NodeURL } from 'node:url';
const styles = readFileSync(
  new NodeURL('../../app/globals.css', import.meta.url),
  'utf8',
);
const pages: EditorPage[] = ['Home', 'Projects', 'About'].map(
  (title, position) => ({
    id: `10000000-0000-4000-8000-00000000000${position + 1}`,
    siteId: '10000000-0000-4000-8000-000000000001',
    title,
    slug: title.toLowerCase(),
    position,
  }),
);
const label = (template: string, title: string) =>
  template.replace('{title}', title);
const p = en.editor.pages;
beforeEach(() => {
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.open = true;
      },
    },
    close: {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.open = false;
      },
    },
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
});
function mount(
  overrides: Partial<React.ComponentProps<typeof PageSidebar>> = {},
) {
  const props = {
    pages,
    activeId: pages[0]!.id,
    busy: false,
    d: en.editor,
    onSwitch: vi.fn(),
    onCreate: vi.fn().mockResolvedValue(true),
    onRename: vi.fn().mockResolvedValue(true),
    onDelete: vi.fn().mockResolvedValue(true),
    onReorder: vi.fn(),
    ...overrides,
  };
  const view = render(<PageSidebar {...props} />);
  return { ...view, props, user: userEvent.setup() };
}
async function open(
  user: ReturnType<typeof userEvent.setup>,
  title = 'Projects',
) {
  const trigger = screen.getByRole('button', {
    name: label(p.moreOptions, title),
  });
  await user.hover(screen.getByRole('button', { name: title }));
  await user.click(trigger);
  return screen.getByRole('menu', { name: label(p.moreOptions, title) });
}
async function rename(
  user: ReturnType<typeof userEvent.setup>,
  title = 'Projects',
) {
  await open(user, title);
  await user.click(
    screen.getByRole('menuitem', { name: label(p.renameLabel, title) }),
  );
  return screen.getByRole('textbox', {
    name: label(p.renameLabel, title),
  }) as HTMLInputElement;
}
describe('calm page sidebar interactions', () => {
  it.each([en, ptBR])(
    'shows every menu action with readable text and content-sized styles',
    async (dictionary) => {
      const style = document.createElement('style');
      style.textContent = styles;
      document.head.appendChild(style);
      try {
        const { user } = mount({
          d: dictionary.editor,
          activeId: pages[1]!.id,
        });
        const localized = dictionary.editor.pages;
        await user.click(
          screen.getByRole('button', {
            name: label(localized.moreOptions, 'Projects'),
          }),
        );
        const menu = screen.getByRole('menu');
        expect(menu).toBeVisible();
        expect(getComputedStyle(menu).position).toBe('fixed');
        expect(getComputedStyle(menu).boxShadow).not.toBe('none');
        expect(getComputedStyle(menu).height).toBe('auto');
        expect(getComputedStyle(menu).minHeight).toBe('0px');
        const items = within(menu).getAllByRole('menuitem');
        expect(items).toHaveLength(4);
        for (const [index, text] of [
          localized.rename,
          localized.moveUp,
          localized.moveDown,
          localized.delete,
        ].entries()) {
          expect(items[index]).toBeVisible();
          expect(getComputedStyle(items[index]!).whiteSpace).toBe('nowrap');
          expect(getComputedStyle(items[index]!).padding).toBe(
            '8px 12px',
          );
          expect(items[index]).toHaveTextContent(text);
          // The global button rule uses white text; menu actions must override it.
          expect(getComputedStyle(items[index]!).color).not.toBe(
            'rgb(255, 255, 255)',
          );
          expect(getComputedStyle(items[index]!).height).toBe('auto');
        }
      } finally {
        style.remove();
      }
    },
  );
  it('measures the trigger/menu and repositions on resize and ancestor scroll', async () => {
    let left = 0;
    let top = 20;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: HTMLElement) {
        const isMenu = this.classList.contains('page-actions-menu');
        return {
          left,
          top,
          right: left + 28,
          bottom: top + 28,
          width: isMenu ? 200 : 28,
          height: isMenu ? 160 : 28,
          x: left,
          y: top,
          toJSON: () => ({}),
        };
      },
    );
    const { user } = mount();
    const menu = await open(user);
    expect(menu).toHaveStyle({ left: '36px', top: '20px' });
    left = window.innerWidth - 28;
    top = window.innerHeight - 10;
    fireEvent.resize(window);
    expect(menu).toHaveStyle({
      left: `${left - 208}px`,
      top: `${window.innerHeight - 160}px`,
    });
    left = 20;
    top = -10;
    fireEvent.scroll(screen.getByRole('complementary'));
    expect(menu).toHaveStyle({ left: '56px', top: '0px' });
  });
  it('renders one compact row per page, with actions only in the requested menu', async () => {
    const { user, props } = mount();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
    const row = screen.getByRole('button', { name: 'Projects' });
    await user.click(row);
    expect(props.onSwitch).toHaveBeenCalledWith(pages[1]!.id);
    await open(user);
    expect(props.onSwitch).toHaveBeenCalledOnce();
    expect(
      screen.getByRole('button', { name: label(p.moreOptions, 'Projects') }),
    ).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: label(p.moreOptions, 'Projects') }),
    ).toHaveFocus();
    await open(user);
    await user.click(screen.getByRole('heading', { name: p.label }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: label(p.moreOptions, 'Projects') }),
    ).toHaveFocus();
  });
  it('omits upward movement on the first page and downward movement on the last', async () => {
    const { user } = mount();
    let menu = await open(user, 'Home');
    expect(
      within(menu).queryByRole('menuitem', {
        name: label(p.moveUpLabel, 'Home'),
      }),
    ).not.toBeInTheDocument();
    expect(
      within(menu).getByRole('menuitem', {
        name: label(p.moveDownLabel, 'Home'),
      }),
    ).toBeInTheDocument();
    await user.keyboard('{Escape}');
    menu = await open(user, 'About');
    expect(
      within(menu).queryByRole('menuitem', {
        name: label(p.moveDownLabel, 'About'),
      }),
    ).not.toBeInTheDocument();
    expect(
      within(menu).getByRole('menuitem', {
        name: label(p.moveUpLabel, 'About'),
      }),
    ).toBeInTheDocument();
  });
  it.each([
    ['moveUpLabel', [1, 0, 2]],
    ['moveDownLabel', [0, 2, 1]],
  ] as const)('invokes the reorder actor for %s', async (action, order) => {
    const { user, props } = mount();
    await open(user);
    await user.click(
      screen.getByRole('menuitem', { name: label(p[action], 'Projects') }),
    );
    expect(props.onReorder).toHaveBeenCalledWith(
      order.map((index) => pages[index]!.id),
    );
    expect(props.onSwitch).not.toHaveBeenCalled();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: label(p.moreOptions, 'Projects') }),
    ).toHaveFocus();
  });
  it('navigates rows and menus by keyboard, executes an action and restores focus', async () => {
    const { user, props } = mount();
    screen.getByRole('button', { name: 'Home' }).focus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('button', { name: 'Projects' })).toHaveFocus();
    await user.keyboard('{Shift>}{F10}{/Shift}');
    expect(
      screen.getByRole('menuitem', { name: label(p.renameLabel, 'Projects') }),
    ).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(
      screen.getByRole('menuitem', { name: label(p.deleteLabel, 'Projects') }),
    ).toHaveFocus();
    await user.keyboard('{Home}{ArrowDown}{Enter}');
    expect(props.onReorder).toHaveBeenCalledWith([
      pages[1]!.id,
      pages[0]!.id,
      pages[2]!.id,
    ]);
    expect(
      screen.getByRole('button', { name: label(p.moreOptions, 'Projects') }),
    ).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(
      screen.getByRole('menuitem', { name: label(p.deleteLabel, 'Projects') }),
    ).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(
      screen.getByRole('button', { name: label(p.moreOptions, 'Projects') }),
    ).toHaveFocus();
  });
  it('focuses/selects the current title and confirms a trimmed rename exactly once with Enter', async () => {
    const { user, props } = mount();
    const input = await rename(user);
    expect(input).toHaveFocus();
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe('Projects'.length);
    await user.keyboard(' New title {Enter}');
    await waitFor(() => expect(props.onRename).toHaveBeenCalledOnce());
    expect(props.onRename).toHaveBeenCalledWith(pages[1]!.id, 'New title');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Projects' })).toHaveFocus();
  });
  it('cancels with Escape without invoking rename or page switch', async () => {
    const { user, props } = mount();
    await rename(user);
    await user.keyboard('Changed{Escape}');
    expect(props.onRename).not.toHaveBeenCalled();
    expect(props.onSwitch).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Projects' })).toHaveFocus();
  });
  it('confirms on blur and shows an inline validation error for an empty title', async () => {
    const { user, props } = mount();
    let input = await rename(user);
    await user.clear(input);
    await user.keyboard('   {Enter}');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(p.titleRequired)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(props.onRename).not.toHaveBeenCalled();
    await user.clear(input);
    await user.keyboard('New title');
    await user.click(screen.getByRole('heading', { name: p.label }));
    await waitFor(() => expect(props.onRename).toHaveBeenCalledOnce());
    expect(props.onRename).toHaveBeenCalledWith(pages[1]!.id, 'New title');
    input = await rename(user);
    await user.keyboard('{Escape}');
    expect(input).not.toBeInTheDocument();
  });
  it.each([false, 'throw'])(
    'keeps the draft and shows inline error when rename fails (%s)',
    async (result) => {
      const handler =
        result === 'throw'
          ? vi.fn().mockRejectedValue(new Error('offline'))
          : vi.fn().mockResolvedValue(false);
      const { user } = mount({ onRename: handler });
      await rename(user);
      await user.keyboard('Draft{Enter}');
      expect(await screen.findByText(p.renameError)).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toHaveValue('Draft');
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    },
  );
  it('requires the existing confirmation modal before invoking delete and restores trigger focus on cancel', async () => {
    const { user, props } = mount();
    await open(user);
    await user.click(
      screen.getByRole('menuitem', { name: label(p.deleteLabel, 'Projects') }),
    );
    expect(screen.getByRole('dialog', { name: p.delete })).toBeInTheDocument();
    expect(props.onDelete).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: p.cancel }));
    expect(
      screen.getByRole('button', { name: label(p.moreOptions, 'Projects') }),
    ).toHaveFocus();
    await open(user);
    await user.click(
      screen.getByRole('menuitem', { name: label(p.deleteLabel, 'Projects') }),
    );
    await user.click(screen.getByRole('button', { name: p.confirm }));
    expect(props.onDelete).toHaveBeenCalledWith(pages[1]!.id);
  });
  it('disables deletion of the sole page and creation at the five-page limit', async () => {
    const { user, rerender, props } = mount({ pages: [pages[0]!] });
    await open(user, 'Home');
    expect(
      screen.getByRole('menuitem', { name: label(p.deleteLabel, 'Home') }),
    ).toBeDisabled();
    await user.keyboard('{Escape}');
    const five = [
      ...pages,
      ...[3, 4].map((position) => ({
        ...pages[0]!,
        id: crypto.randomUUID(),
        title: `Page ${position}`,
        position,
      })),
    ];
    rerender(<PageSidebar {...props} pages={five} />);
    const button = screen.getByRole('button', { name: p.newPage });
    expect(button).toBeDisabled();
    expect(button.parentElement).toHaveAttribute('title', p.limit);
  });
  it('uses localized menu and aria labels in Portuguese', async () => {
    const { user } = mount({ d: ptBR.editor });
    await user.click(
      screen.getByRole('button', {
        name: label(ptBR.editor.pages.moreOptions, 'Projects'),
      }),
    );
    expect(
      screen.getByRole('menuitem', {
        name: label(ptBR.editor.pages.moveUpLabel, 'Projects'),
      }),
    ).toHaveTextContent(ptBR.editor.pages.moveUp);
  });
});
