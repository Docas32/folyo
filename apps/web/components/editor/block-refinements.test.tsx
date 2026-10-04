import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import { createDefaultBlock, type EditorBlock } from '@folyo/core';
import { BlockFields } from './block-fields';
import { SocialRender } from '../render/blocks';
import { DEFAULT_THEME } from '@folyo/core';
import en from '../../lib/i18n/en';
it('updates social layout and alignment in preview and preserves them when editing links', async () => {
  function Composer() {
    const [block, setBlock] = useState<
      Extract<EditorBlock, { type: 'social' }>
    >({
      id: crypto.randomUUID(),
      position: 0,
      type: 'social',
      content: createDefaultBlock('social', 'en'),
    });
    return (
      <>
        <BlockFields
          block={block}
          onChange={(updated) => {
            if (updated.type === 'social') setBlock(updated);
          }}
          d={en.editor}
          locale="en"
        />
        <SocialRender content={block.content} theme={DEFAULT_THEME} />
      </>
    );
  }
  const { container } = render(<Composer />);
  const user = userEvent.setup();
  await user.click(
    screen.getByRole('button', { name: en.editor.fields.layout }),
  );
  await user.click(screen.getByRole('option', { name: 'Vertical' }));
  await user.click(
    screen.getByRole('button', { name: en.editor.fields.align }),
  );
  await user.click(screen.getByRole('option', { name: 'Right' }));
  await user.clear(screen.getByRole('textbox', { name: 'URL' }));
  await user.type(screen.getByRole('textbox', { name: 'URL' }), 'https://ok');
  await user.click(screen.getByRole('button', { name: en.editor.addLink }));
  expect(container.querySelector('.site-social')).toHaveStyle({
    flexDirection: 'column',
    alignItems: 'flex-end',
  });
  expect(container.querySelectorAll('.site-social a')).toHaveLength(2);
  expect(container.querySelector('.site-social a')).toHaveAttribute(
    'href',
    'https://ok',
  );
});
