import type { ComponentProps } from 'react';
export function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  type = 'button',
  ...props
}: ComponentProps<'button'> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
  size?: 'sm' | 'md';
}) {
  return (
    <button
      {...props}
      type={type}
      className={`ui-button ui-button-${variant} ui-button-${size} ${className}`}
    />
  );
}
