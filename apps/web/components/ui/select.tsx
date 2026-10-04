'use client';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './button';
import { Popover } from './popover';
export type SelectOption = {
  value: string | number;
  label: string;
  icon?: ReactNode;
};
export function Select({
  value,
  options,
  onValueChange,
  disabled,
  'aria-label': label,
}: {
  value: string | number;
  options: SelectOption[];
  onValueChange: (value: string) => void;
  disabled?: boolean;
  'aria-label'?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const id = useId();
  const selected = options.findIndex(
    (option) => String(option.value) === String(value),
  );
  function close() {
    setOpen(false);
    trigger.current?.focus();
  }
  useEffect(() => {
    if (!open) return;
    list.current?.focus();
    const outside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !list.current?.contains(event.target) &&
        !trigger.current?.contains(event.target)
      )
        setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  return (
    <>
      <span
        ref={(node) => {
          trigger.current = node?.querySelector('button') ?? null;
        }}
        className="ui-select-trigger"
      >
        <Button
          disabled={disabled}
          aria-label={label}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? id : undefined}
          onClick={() => {
            setActive(Math.max(0, selected));
            setOpen(!open);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              setActive(Math.max(0, selected));
              setOpen(true);
            }
          }}
        >
          <span>{options[selected]?.label}</span>
          <span aria-hidden="true">⌃⌄</span>
        </Button>
      </span>
      {open &&
        createPortal(
          <Popover anchor={trigger}>
            <div
              ref={list}
              id={id}
              role="listbox"
              tabIndex={-1}
              aria-label={label}
              aria-activedescendant={`${id}-${active}`}
              onKeyDown={(event) => {
                if (
                  ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)
                ) {
                  event.preventDefault();
                  setActive((index) =>
                    event.key === 'Home'
                      ? 0
                      : event.key === 'End'
                        ? options.length - 1
                        : (index +
                            (event.key === 'ArrowDown' ? 1 : -1) +
                            options.length) %
                          options.length,
                  );
                } else if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  const option = options[active];
                  if (option) onValueChange(String(option.value));
                  close();
                } else if (event.key === 'Escape') {
                  event.preventDefault();
                  event.stopPropagation();
                  close();
                } else if (event.key === 'Tab') setOpen(false);
              }}
            >
              {options.map((option, index) => (
                <div
                  key={option.value}
                  id={`${id}-${index}`}
                  role="option"
                  aria-selected={index === selected}
                  className={`ui-select-option ${index === active ? 'active' : ''}`}
                  onPointerMove={() => setActive(index)}
                  onClick={() => {
                    onValueChange(String(option.value));
                    close();
                  }}
                >
                  {option.icon}
                  <span>{option.label}</span>
                  {index === selected && (
                    <span aria-hidden="true" data-testid="select-check">
                      ✓
                    </span>
                  )}
                </div>
              ))}
            </div>
          </Popover>,
          document.body,
        )}
    </>
  );
}
