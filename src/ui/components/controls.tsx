/**
 * Form controls. They wrap native elements so keyboard handling, focus and form semantics
 * come from the browser, and only add styling.
 */
import type { ButtonHTMLAttributes, ComponentChildren } from 'preact';
import { useId } from 'preact/hooks';
import type { IconName } from '../icons';
import { Icon } from './Icon';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Name the switch with `label`, or with the id of an element holding its name. */
  label?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
}

/** An on/off switch. */
export function Switch({ checked, onChange, disabled, label, ...aria }: SwitchProps) {
  return (
    <input
      {...aria}
      type="checkbox"
      role="switch"
      class="switch"
      aria-label={label}
      checked={checked}
      disabled={disabled}
      onChange={(event) => onChange(event.currentTarget.checked)}
    />
  );
}

export interface Option<T extends string> {
  value: T;
  label: string;
}

interface SelectProps<T extends string> {
  value: T;
  options: readonly Option<T>[];
  onChange: (value: T) => void;
  label: string;
  disabled?: boolean;
}

export function Select<T extends string>({
  value,
  options,
  onChange,
  label,
  disabled,
}: SelectProps<T>) {
  return (
    <span class="select">
      <select
        aria-label={label}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.value as T)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <Icon name="arrow_drop_down" />
    </span>
  );
}

type ButtonVariant = 'outlined' | 'filled' | 'text' | 'danger';

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'class' | 'icon'> {
  variant?: ButtonVariant;
  icon?: IconName;
  children: ComponentChildren;
}

export function Button({ variant = 'outlined', icon, children, type, ...rest }: ButtonProps) {
  return (
    <button {...rest} type={type ?? 'button'} class={`button button-${variant}`}>
      {icon && <Icon name={icon} size={18} />}
      {children}
    </button>
  );
}

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'class' | 'icon'> {
  icon: IconName;
  label: string;
}

export function IconButton({ icon, label, type, ...rest }: IconButtonProps) {
  return (
    <button {...rest} type={type ?? 'button'} class="icon-button" aria-label={label} title={label}>
      <Icon name={icon} />
    </button>
  );
}

interface TextFieldProps {
  label: string;
  value: string;
  onInput: (value: string) => void;
  placeholder?: string;
  /** Shown below the field; replaced by `error` when there is one. */
  helper?: ComponentChildren;
  error?: string | null;
  autofocus?: boolean;
  type?: 'text' | 'password';
  autocomplete?: string;
}

/** A single-line text field for names and patterns, so spelling help is off. */
export function TextField({
  label,
  value,
  onInput,
  placeholder,
  helper,
  error,
  autofocus,
  type = 'text',
  autocomplete = 'off',
}: TextFieldProps) {
  const inputId = useId();
  const message = error ?? helper;
  return (
    <div class="text-field" data-invalid={error ? '' : undefined}>
      <label class="text-field-label" for={inputId}>
        {label}
      </label>
      <input
        id={inputId}
        // Preact types attributes per input type; text and password share all of these.
        type={type as 'text'}
        value={value}
        placeholder={placeholder}
        autofocus={autofocus}
        spellcheck={false}
        autocomplete={autocomplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={message ? `${inputId}-message` : undefined}
        onInput={(event) => onInput(event.currentTarget.value)}
      />
      {message && (
        <div
          class="text-field-message"
          id={`${inputId}-message`}
          role={error ? 'alert' : undefined}
        >
          {message}
        </div>
      )}
    </div>
  );
}
