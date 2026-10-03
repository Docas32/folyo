'use client';
import { useEffect, useRef, useState } from 'react';
import { BLOCK_TYPES, type BlockType } from '@folyo/core';
import type { Dictionary } from '../../lib/i18n';
export type EditorDictionary = Dictionary['editor'];
const icons: Record<BlockType, string> = {
  hero: '◉',
  heading: 'H',
  text: '¶',
  image: '▧',
  gallery: '▦',
  button: '↗',
  social: '◎',
  divider: '―',
  spacer: '↕',
};
// Independent of its trigger/insertion position. F3b can reuse this list for '/'.
export function BlockTypeMenu({
  d,
  onSelect,
}: {
  d: EditorDictionary;
  onSelect: (type: BlockType) => void;
}) {
  return (
    <div className="block-type-menu" role="group" aria-label={d.menuLabel}>
      {BLOCK_TYPES.map((type) => (
        <button type="button" key={type} onClick={() => onSelect(type)}>
          <span className="block-icon" aria-hidden="true">
            {icons[type]}
          </span>
          <span>
            <strong>{d.types[type].name}</strong>
            <small>{d.types[type].description}</small>
          </span>
        </button>
      ))}
    </div>
  );
}
export function AddBlock({
  d,
  onSelect,
  disabled,
  quiet = false,
}: {
  d: EditorDictionary;
  onSelect: (type: BlockType) => void;
  disabled: boolean;
  quiet?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    container.current
      ?.querySelector<HTMLButtonElement>('.block-type-menu button')
      ?.focus();
    const outside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !container.current?.contains(event.target)
      )
        setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  function close() {
    setOpen(false);
    trigger.current?.focus();
  }
  return (
    <div
      ref={container}
      className={`block-insert ${quiet ? 'block-insert-quiet' : ''}`}
      onKeyDown={(event) => {
        if (event.key === 'Escape') close();
      }}
    >
      <button
        type="button"
        ref={trigger}
        className="add-block-trigger"
        disabled={disabled}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span aria-hidden="true">＋ </span>
        {d.addBlock}
      </button>
      {open && (
        <div className="block-menu-popover">
          <BlockTypeMenu
            d={d}
            onSelect={(type) => {
              onSelect(type);
              close();
            }}
          />
          <button type="button" onClick={close}>
            {d.closeMenu}
          </button>
        </div>
      )}
    </div>
  );
}
