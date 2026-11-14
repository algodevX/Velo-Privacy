/**
 * Menus and dialogs, built on the popover attribute and <dialog> so the browser handles
 * the top layer, focus, Escape and clicks outside.
 */
import type { ComponentChildren } from 'preact';
import { useEffect, useId, useRef, useState } from 'preact/hooks';
import type { IconName } from '../icons';
import { Button, IconButton } from './controls';
import { Icon } from './Icon';

export interface MenuItem {
  label: string;
  onSelect: () => void;
  /** Marks the current choice when the menu offers alternatives. */
  checked?: boolean;
}

interface MenuButtonProps {
  label: string;
  items: readonly MenuItem[];
  icon?: IconName;
}

/** An icon button that opens a menu of actions below it. */
export function MenuButton({ label, items, icon = 'more_vert' }: MenuButtonProps) {
  const menu = useRef<HTMLDivElement>(null);
  const hasChoices = items.some((item) => item.checked !== undefined);

  const open = (event: MouseEvent) => {
    const popover = menu.current;
    if (popover === null) return;
    popover.showPopover();
    placeBelow(popover, (event.currentTarget as HTMLElement).getBoundingClientRect());
    popover.querySelector<HTMLButtonElement>('button')?.focus();
  };

  const select = (item: MenuItem) => {
    menu.current?.hidePopover();
    item.onSelect();
  };

  return (
    <>
      <IconButton icon={icon} label={label} aria-haspopup="menu" onClick={open} />
      <div class="menu" role="menu" popover="auto" ref={menu} onKeyDown={moveFocus}>
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            role={hasChoices ? 'menuitemradio' : 'menuitem'}
            aria-checked={hasChoices ? (item.checked ?? false) : undefined}
            class="menu-item"
            onClick={() => select(item)}
          >
            {hasChoices && (
              <span class="menu-check">{item.checked && <Icon name="check" size={18} />}</span>
            )}
            {item.label}
          </button>
        ))}
      </div>
    </>
  );
}

/** Arrow keys, Home and End move between menu items, as in native menus. */
function moveFocus(event: KeyboardEvent): void {
  const items = [...(event.currentTarget as HTMLElement).querySelectorAll('button')];
  const current = items.indexOf(document.activeElement as HTMLButtonElement);
  const last = items.length - 1;
  const next = {
    ArrowDown: current === last ? 0 : current + 1,
    ArrowUp: current <= 0 ? last : current - 1,
    Home: 0,
    End: last,
  }[event.key];
  if (next === undefined) return;
  event.preventDefault();
  items[next]?.focus();
}

/** Aligns the menu's right edge with the anchor, flipping above it near the bottom. */
function placeBelow(popover: HTMLElement, anchor: DOMRect): void {
  const margin = 8;
  const { width, height } = popover.getBoundingClientRect();
  const left = Math.max(margin, Math.min(anchor.right - width, innerWidth - width - margin));
  const fitsBelow = anchor.bottom + height + margin <= innerHeight;
  popover.style.left = `${left}px`;
  popover.style.top = `${fitsBelow ? anchor.bottom : Math.max(margin, anchor.top - height)}px`;
}

interface DialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ComponentChildren;
  /** Label of the confirming button. The dialog is a form; submitting it calls onSubmit. */
  submitLabel: string;
  onSubmit: () => void;
  submitDisabled?: boolean;
  danger?: boolean;
}

/** A modal dialog with Cancel and one confirming action. */
export function Dialog({
  open,
  title,
  onClose,
  children,
  submitLabel,
  onSubmit,
  submitDisabled,
  danger,
}: DialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const element = dialog.current;
    if (element === null) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  return (
    <dialog class="dialog" ref={dialog} aria-labelledby={titleId} onClose={onClose}>
      <form
        method="dialog"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <h2 class="dialog-title" id={titleId}>
          {title}
        </h2>
        <div class="dialog-body">{children}</div>
        <div class="dialog-actions">
          <Button variant="text" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant={danger ? 'danger' : 'filled'} disabled={submitDisabled}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </dialog>
  );
}

/** State for a dialog that edits one value: closed, adding a new one, or editing one. */
export function useEditor<T>() {
  const [state, setState] = useState<{ editing: T | null } | null>(null);
  return {
    isOpen: state !== null,
    editing: state?.editing ?? null,
    add: () => setState({ editing: null }),
    edit: (value: T) => setState({ editing: value }),
    close: () => setState(null),
  };
}
