/**
 * Editable lists of sites or words, in the style of the browser's own site exception
 * lists: a heading row with an Add button, one row per entry with a menu, and a dialog
 * for adding and editing.
 */
import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { parseSitePattern, type PatternKind } from '../../shared/patterns';
import { Button, TextField } from './controls';
import { SiteIcon } from './Icon';
import { Dialog, MenuButton, useEditor, type MenuItem } from './overlays';

/** Checks a new or edited entry. Returns the value to store, or an error to show. */
export type Validate = (
  value: string,
  editing: string | null,
) => { ok: true; value: string } | { ok: false; error: string };

interface EditableListProps {
  title: string;
  description?: ComponentChildren;
  items: readonly string[];
  onChange: (items: string[]) => void;
  validate: Validate;
  emptyText: string;
  /** Labels for the add/edit dialog. */
  noun: string;
  fieldLabel: string;
  placeholder?: string;
  helper?: ComponentChildren;
  /** Show the site's icon in front of each entry. */
  sites?: boolean;
  /** More menu entries for an item, shown above Edit and Remove. */
  menuItems?: (item: string) => MenuItem[];
  disabled?: boolean;
}

export function EditableList({
  title,
  description,
  items,
  onChange,
  validate,
  emptyText,
  noun,
  fieldLabel,
  placeholder,
  helper,
  sites = false,
  menuItems,
  disabled = false,
}: EditableListProps) {
  const editor = useEditor<string>();

  const save = (value: string) => {
    const { editing } = editor;
    onChange(editing === null ? [...items, value] : items.map((i) => (i === editing ? value : i)));
    editor.close();
  };

  return (
    <div class="list">
      <div class="list-header">
        <div class="row-text">
          <h3 class="list-title">{title}</h3>
          {description && <div class="row-description">{description}</div>}
        </div>
        <Button onClick={editor.add} disabled={disabled}>
          Add
        </Button>
      </div>
      {items.length === 0 ? (
        <div class="list-empty">{emptyText}</div>
      ) : (
        <ul class="list-items">
          {items.map((item) => (
            <li key={item} class="list-item">
              {sites && <SiteIcon host={hostOfPattern(item)} />}
              <span class="list-item-text">{item}</span>
              <MenuButton
                label={`More actions for ${item}`}
                items={[
                  ...(menuItems?.(item) ?? []),
                  { label: 'Edit', onSelect: () => editor.edit(item) },
                  { label: 'Remove', onSelect: () => onChange(items.filter((i) => i !== item)) },
                ]}
              />
            </li>
          ))}
        </ul>
      )}
      <EntryDialog
        open={editor.isOpen}
        editing={editor.editing}
        title={editor.editing === null ? `Add ${noun}` : `Edit ${noun}`}
        fieldLabel={fieldLabel}
        placeholder={placeholder}
        helper={helper}
        validate={validate}
        onSave={save}
        onClose={editor.close}
      />
    </div>
  );
}

interface EntryDialogProps {
  open: boolean;
  editing: string | null;
  title: string;
  fieldLabel: string;
  placeholder?: string;
  helper?: ComponentChildren;
  validate: Validate;
  onSave: (value: string) => void;
  onClose: () => void;
}

function EntryDialog(props: EntryDialogProps) {
  const { open, editing, validate, onSave } = props;
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setValue(editing ?? '');
    setError(null);
  }, [open, editing]);

  const submit = () => {
    const result = validate(value.trim(), editing);
    if (result.ok) onSave(result.value);
    else setError(result.error);
  };

  return (
    <Dialog
      open={open}
      title={props.title}
      submitLabel={editing === null ? 'Add' : 'Save'}
      submitDisabled={value.trim() === ''}
      onSubmit={submit}
      onClose={props.onClose}
    >
      <TextField
        label={props.fieldLabel}
        value={value}
        placeholder={props.placeholder}
        helper={props.helper}
        error={error}
        autofocus
        onInput={(next) => {
          setValue(next);
          setError(null);
        }}
      />
    </Dialog>
  );
}

/** Validates site patterns of the given kinds and rejects ones already in `taken`. */
export function sitePatternValidator(
  taken: readonly string[],
  kinds?: readonly PatternKind[],
  takenMessage = 'This site is already in the list',
): Validate {
  return (value, editing) => {
    const parsed = parseSitePattern(value, kinds);
    if (!parsed.ok) return parsed;
    const source = parsed.pattern.source;
    if (source !== editing && taken.includes(source)) return { ok: false, error: takenMessage };
    return { ok: true, value: source };
  };
}

/** Validates plain words, compared without case. */
export function wordValidator(taken: readonly string[]): Validate {
  return (value, editing) => {
    const lower = value.toLowerCase();
    const duplicate = taken.some((word) => word !== editing && word.toLowerCase() === lower);
    return duplicate ? { ok: false, error: 'Already in the list' } : { ok: true, value };
  };
}

/** The host to show an icon for, if the pattern names one. */
function hostOfPattern(pattern: string): string | null {
  if (pattern.startsWith('/')) return null;
  const host = pattern.replace(/^\*\./, '');
  return host.includes('*') ? null : host;
}
