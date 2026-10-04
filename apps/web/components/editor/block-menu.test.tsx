import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BlockTypeMenu } from './block-menu';
import en from '../../lib/i18n/en';

describe('BlockTypeMenu filter', () => {
  it('filters by substring case-insensitively', () => {
    const d = en.editor;
    const onSelect = vi.fn();
    const { rerender } = render(<BlockTypeMenu d={d} onSelect={onSelect} filter="" />);
    expect(screen.getByText('Heading')).toBeInTheDocument();
    rerender(<BlockTypeMenu d={d} onSelect={onSelect} filter="ima" />);
    expect(screen.getByText('Image')).toBeInTheDocument();
    expect(screen.queryByText('Heading')).not.toBeInTheDocument();
  });

  it('matches case-insensitively', () => {
    const d = en.editor;
    const onSelect = vi.fn();
    render(<BlockTypeMenu d={d} onSelect={onSelect} filter="IMA" />);
    expect(screen.getByText('Image')).toBeInTheDocument();
  });
});
