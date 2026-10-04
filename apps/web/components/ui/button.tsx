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

/** Navigation uses the same primitive styles while retaining anchor semantics. */
export function ButtonLink({
  variant = 'secondary',
  size = 'md',
  className = '',
  ...props
}: ComponentProps<'a'> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
  size?: 'sm' | 'md';
}) {
  return (
    <a
      {...props}
      className={`ui-button ui-button-${variant} ui-button-${size} ${className}`}
    />
  );
}
export function PreviewIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M14 3h7v7M21 3l-11 11M10 3H3v18h18v-7" />
    </svg>
  );
}
