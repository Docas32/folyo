'use client';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
export function Modal({
  title,
  onClose,
  busy = false,
  children,
  actions,
  className = '',
}: {
  title: string;
  onClose: () => void;
  busy?: boolean;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const dialog = ref.current;
    if (dialog?.showModal) dialog.showModal();
    else dialog?.setAttribute('open', '');
    return () => {
      dialog?.close?.();
      document.body.style.overflow = overflow;
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);
  if (typeof document === 'undefined') return null;
  return createPortal(
    <dialog
      ref={ref}
      className={`folyo-modal ${className}`}
      aria-labelledby={titleId}
      aria-modal="true"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="folyo-modal-header">
        <h2 id={titleId}>{title}</h2>
      </div>
      {children}
      {actions && <div className="folyo-modal-actions">{actions}</div>}
    </dialog>,
    document.body,
  );
}
