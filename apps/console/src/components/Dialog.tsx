import { useEffect, useId, useRef, type ReactNode } from 'react';

/**
 * A native modal <dialog>: focus is trapped and restored by the browser, Escape closes it, the page behind is
 * inert. It stays mounted so the browser can return focus to the opener; its CONTENT belongs to whatever renders it,
 * so a Seller-scoped dialog disappears with the Seller subtree (dialog-state isolation).
 */
export function Dialog({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  return (
    // The backdrop click is a convenience for pointer users; Escape and the close button serve everyone else.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events
    <dialog
      ref={ref}
      className="dlg"
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="dlg-body">
        <h2 id={titleId}>{title}</h2>
        {open ? children : null}
      </div>
    </dialog>
  );
}
