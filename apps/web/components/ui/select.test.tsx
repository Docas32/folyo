import userEvent from '@testing-library/user-event';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { Select } from './select';
import { FileTrigger } from './file-trigger';
describe('form primitives', () => {
  it('opens, checks the current value, selects with keyboard and closes on Escape', () => {
    const changed = vi.fn();
    function Demo() {
      const [value, setValue] = useState('a');
      return (
        <Select
          aria-label="Style"
          value={value}
          options={[
            { value: 'a', label: 'Alpha' },
            { value: 'b', label: 'Beta' },
          ]}
          onValueChange={(next) => {
            changed(next);
            setValue(next);
          }}
        />
      );
    }
    render(<Demo />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('option', { name: 'Alpha' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByTestId('select-check')).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'ArrowDown' });
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Enter' });
    expect(changed).toHaveBeenCalledWith('b');
    expect(screen.getByRole('button')).toHaveTextContent('Beta');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button'));
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button')).toHaveFocus();
  });
  it('opens the hidden associated file input through a keyboard-focusable button', async () => {
    render(<FileTrigger>Choose image</FileTrigger>);
    const input = screen.getByLabelText('Choose image');
    const click = vi.spyOn(input, 'click');
    const button = screen.getByRole('button', { name: 'Choose image' });
    button.focus();
    expect(button).toHaveFocus();
    fireEvent.click(button);
    expect(click).toHaveBeenCalledOnce();
    await userEvent.setup().keyboard('{Enter}');
    expect(click).toHaveBeenCalledTimes(2);
    expect(input).toHaveAttribute('hidden');
  });
});
