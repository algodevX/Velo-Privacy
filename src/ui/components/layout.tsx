/**
 * Building blocks of a settings page: titled sections holding a card of rows, master
 * switches for whole features, and tiles summarising a feature with a link to its page.
 */
import type { ComponentChildren } from 'preact';
import { useId } from 'preact/hooks';
import type { IconName } from '../icons';
import { Switch } from './controls';
import { Icon } from './Icon';

interface SectionProps {
  title?: string;
  description?: ComponentChildren;
  children: ComponentChildren;
}

/** A heading followed by a card. Omit the title to continue the previous section. */
export function Section({ title, description, children }: SectionProps) {
  return (
    <section class="section">
      {title && (
        <div class="section-header">
          <h2 class="section-title">{title}</h2>
          {description && <p class="section-description">{description}</p>}
        </div>
      )}
      <div class="card">{children}</div>
    </section>
  );
}

interface MasterSwitchProps {
  icon: IconName;
  title: string;
  description: ComponentChildren;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/** The switch for a whole feature, at the top of its page. */
export function MasterSwitch({ icon, title, description, checked, onChange }: MasterSwitchProps) {
  const id = useId();
  return (
    <section class="section">
      <label class="master" data-on={checked ? '' : undefined}>
        <span class="badge badge-large">
          <Icon name={icon} size={28} />
        </span>
        <span class="row-text">
          <span class="master-title" id={`${id}-title`}>
            {title}
          </span>
          <span class="master-description" id={`${id}-description`} style="display:block">
            {description}
          </span>
        </span>
        <Switch
          checked={checked}
          onChange={onChange}
          aria-labelledby={`${id}-title`}
          aria-describedby={`${id}-description`}
        />
      </label>
    </section>
  );
}

interface FeatureTileProps {
  icon: IconName;
  title: string;
  status: string;
  href: string;
  /** A switch for the feature; without it the tile is only a link. */
  checked?: boolean;
  onChange?: (checked: boolean) => void;
}

/** A feature on the overview: its state at a glance, a link to its page and its switch. */
export function FeatureTile({ icon, title, status, href, checked, onChange }: FeatureTileProps) {
  const on = checked ?? true;
  return (
    <div class="tile">
      <span class="badge" data-on={on ? '' : undefined}>
        <Icon name={icon} />
      </span>
      {/* The link covers the whole tile; the switch sits above it. */}
      <a class="tile-title tile-link" href={href}>
        {title}
      </a>
      <span class="tile-status">{status}</span>
      {checked === undefined || onChange === undefined ? (
        <Icon name="chevron_right" class="row-trailing-icon" />
      ) : (
        <Switch checked={checked} onChange={onChange} label={title} />
      )}
    </div>
  );
}

export interface Segment<T extends string> {
  value: T;
  label: string;
}

interface SegmentedProps<T extends string> {
  label: string;
  value: T | undefined;
  segments: readonly Segment<T>[];
  onChange: (value: T) => void;
}

/** A single choice among two to four options, as connected buttons. */
export function Segmented<T extends string>({
  label,
  value,
  segments,
  onChange,
}: SegmentedProps<T>) {
  return (
    <div class="segmented" role="radiogroup" aria-label={label}>
      {segments.map((segment) => (
        <button
          key={segment.value}
          type="button"
          class="segment"
          role="radio"
          aria-checked={segment.value === value}
          onClick={() => onChange(segment.value)}
        >
          {segment.value === value && <Icon name="check" size={18} />}
          {segment.label}
        </button>
      ))}
    </div>
  );
}

interface SubpageProps {
  title: string;
  /** Where the back arrow goes, as a URL hash. */
  back: string;
  children: ComponentChildren;
}

/** A page reached from a link row; its card starts with a back arrow and title. */
export function Subpage({ title, back, children }: SubpageProps) {
  return (
    <section class="section">
      <div class="card">
        <div class="subpage-header">
          <a class="icon-button" href={back} aria-label="Back" title="Back">
            <Icon name="arrow_back" />
          </a>
          <h2 class="subpage-title">{title}</h2>
        </div>
        {children}
      </div>
    </section>
  );
}

interface RowProps {
  title: ComponentChildren;
  description?: ComponentChildren;
  /** A Material Symbols icon in front of the text, or any other element via `leading`. */
  icon?: IconName;
  leading?: ComponentChildren;
  children?: ComponentChildren;
}

function Leading({ icon, leading }: Pick<RowProps, 'icon' | 'leading'>) {
  if (leading !== undefined) return <>{leading}</>;
  return icon === undefined ? null : <Icon name={icon} class="row-icon" />;
}

/** A setting: label and explanation on the left, its control on the right. */
export function Row({ title, description, icon, leading, children }: RowProps) {
  return (
    <div class="row">
      <Leading icon={icon} leading={leading} />
      <RowText title={title} description={description} />
      {children !== undefined && <div class="row-control">{children}</div>}
    </div>
  );
}

interface RowTextProps extends Pick<RowProps, 'title' | 'description'> {
  /** Prefix for the ids of the title and description, for controls that refer to them. */
  id?: string;
}

function RowText({ title, description, id }: RowTextProps) {
  return (
    <div class="row-text">
      <div class="row-title" id={id && `${id}-title`}>
        {title}
      </div>
      {description && (
        <div class="row-description" id={id && `${id}-description`}>
          {description}
        </div>
      )}
    </div>
  );
}

/** ARIA attributes naming a control after a row's title and describing it by its description. */
function describedBy(id: string, description: ComponentChildren) {
  return {
    'aria-labelledby': `${id}-title`,
    'aria-describedby': description ? `${id}-description` : undefined,
  };
}

interface SwitchRowProps extends Omit<RowProps, 'children' | 'title'> {
  title: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

/** A row whose control is a switch. The whole row toggles it. */
export function SwitchRow({
  title,
  description,
  icon,
  leading,
  checked,
  onChange,
  disabled,
}: SwitchRowProps) {
  const id = useId();
  return (
    <label class="row row-interactive" data-disabled={disabled ? '' : undefined}>
      <Leading icon={icon} leading={leading} />
      <RowText id={id} title={title} description={description} />
      <div class="row-control">
        <Switch
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          {...describedBy(id, description)}
        />
      </div>
    </label>
  );
}

interface LinkRowProps extends Omit<RowProps, 'children'> {
  href: string;
  /** Opens outside the settings page, with an "open in new" icon. */
  external?: boolean;
  onClick?: (event: MouseEvent) => void;
}

/** A row that leads somewhere else. */
export function LinkRow({
  title,
  description,
  icon,
  leading,
  href,
  external,
  onClick,
}: LinkRowProps) {
  return (
    <a
      class="row row-interactive"
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noreferrer' : undefined}
      onClick={onClick}
    >
      <Leading icon={icon} leading={leading} />
      <RowText title={title} description={description} />
      <div class="row-control">
        <Icon name={external ? 'open_in_new' : 'chevron_right'} class="row-trailing-icon" />
      </div>
    </a>
  );
}

export interface RadioOption<T extends string> {
  value: T;
  label: string;
  description?: ComponentChildren;
}

interface RadioRowsProps<T extends string> {
  name: string;
  label: string;
  value: T | undefined;
  options: readonly RadioOption<T>[];
  onChange: (value: T) => void;
}

/** One row per choice, each with a radio button in front. */
export function RadioRows<T extends string>({
  name,
  label,
  value,
  options,
  onChange,
}: RadioRowsProps<T>) {
  return (
    <div role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <RadioRow
          key={option.value}
          name={name}
          option={option}
          checked={option.value === value}
          onSelect={() => onChange(option.value)}
        />
      ))}
    </div>
  );
}

interface RadioRowProps<T extends string> {
  name: string;
  option: RadioOption<T>;
  checked: boolean;
  onSelect: () => void;
}

function RadioRow<T extends string>({ name, option, checked, onSelect }: RadioRowProps<T>) {
  const id = useId();
  return (
    <label class="row row-interactive row-radio">
      <input
        type="radio"
        class="radio"
        name={name}
        value={option.value}
        checked={checked}
        onChange={onSelect}
        {...describedBy(id, option.description)}
      />
      <RowText id={id} title={option.label} description={option.description} />
    </label>
  );
}

interface NoticeProps {
  kind?: 'info' | 'error';
  children: ComponentChildren;
  action?: ComponentChildren;
}

/** A message that applies to the card it sits in. */
export function Notice({ kind = 'info', children, action }: NoticeProps) {
  return (
    <div class={`notice notice-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      <Icon name={kind === 'error' ? 'error' : 'info'} class="notice-icon" />
      <div class="notice-text">{children}</div>
      {action}
    </div>
  );
}
