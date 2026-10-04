'use client';
import { useId, useRef, type InputHTMLAttributes } from 'react';
import { Button } from './button';
export function FileTrigger({
  children,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="file-trigger">
      <label htmlFor={id} className="sr-only">
        {children}
      </label>
      <input {...props} ref={input} id={id} type="file" hidden />
      <Button disabled={props.disabled} onClick={() => input.current?.click()}>
        {children}
      </Button>
    </div>
  );
}
