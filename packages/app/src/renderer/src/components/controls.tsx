import { useEffect, useState, type ReactNode } from 'react';
import { threadFromHex, threadToHex, type ThreadColor } from '@embroider-design/engine';

/**
 * Small form controls.
 *
 * The numeric ones keep their own draft text so a half-typed value like "1."
 * or "-" does not get parsed, clamped and written back under the cursor. Every
 * embroidery setting is a number, so this is worth getting right once.
 */

interface FieldProps {
  label: string;
  hint?: string;
  children: ReactNode;
}

export function Field({ label, hint, children }: FieldProps): JSX.Element {
  return (
    <label className="field">
      <span className="field-label">
        {label}
        {hint && <span className="field-hint">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

interface NumberFieldProps {
  label: string;
  value: number;
  onChange(value: number): void;
  min?: number;
  max?: number;
  step?: number;
  /** Shown after the value, e.g. "mm". */
  unit?: string;
  hint?: string;
  decimals?: number;
}

export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  hint,
  decimals = 2,
}: NumberFieldProps): JSX.Element {
  const format = (n: number): string => String(Number(n.toFixed(decimals)));
  const [draft, setDraft] = useState(() => format(value));

  useEffect(() => {
    setDraft(format(value));
    // Only resync when the value genuinely changes elsewhere.
  }, [value]);

  const commit = (text: string): void => {
    const parsed = Number(text);
    if (!Number.isFinite(parsed)) {
      setDraft(format(value));
      return;
    }
    let next = parsed;
    if (min !== undefined) next = Math.max(min, next);
    if (max !== undefined) next = Math.min(max, next);
    onChange(next);
    setDraft(format(next));
  };

  return (
    <Field label={label} hint={hint}>
      <span className="number-input">
        <input
          type="number"
          value={draft}
          step={step}
          min={min}
          max={max}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={(event) => commit(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit((event.target as HTMLInputElement).value);
          }}
        />
        {unit && <span className="unit">{unit}</span>}
      </span>
    </Field>
  );
}

interface SliderFieldProps {
  label: string;
  value: number;
  onChange(value: number): void;
  min: number;
  max: number;
  step?: number;
  format?(value: number): string;
  hint?: string;
}

export function SliderField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  format,
  hint,
}: SliderFieldProps): JSX.Element {
  return (
    <Field label={label} hint={hint}>
      <span className="slider-input">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <span className="slider-value">{format ? format(value) : value}</span>
      </span>
    </Field>
  );
}

interface SelectFieldProps<T extends string> {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange(value: T): void;
  hint?: string;
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  hint,
}: SelectFieldProps<T>): JSX.Element {
  return (
    <Field label={label} hint={hint}>
      <select value={value} onChange={(event) => onChange(event.target.value as T)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

interface ColorFieldProps {
  label: string;
  value: ThreadColor;
  onChange(value: ThreadColor): void;
}

export function ColorField({ label, value, onChange }: ColorFieldProps): JSX.Element {
  return (
    <Field label={label}>
      <span className="color-input">
        <input
          type="color"
          value={threadToHex(value)}
          onChange={(event) => onChange(threadFromHex(event.target.value, value.description))}
        />
        <input
          type="text"
          className="color-name"
          value={value.description ?? ''}
          placeholder="Thread name"
          onChange={(event) => onChange({ ...value, description: event.target.value })}
        />
      </span>
    </Field>
  );
}

interface CheckboxFieldProps {
  label: string;
  checked: boolean;
  onChange(checked: boolean): void;
  hint?: string;
}

export function CheckboxField({ label, checked, onChange, hint }: CheckboxFieldProps): JSX.Element {
  return (
    <label className="checkbox-field">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        {label}
        {hint && <span className="field-hint">{hint}</span>}
      </span>
    </label>
  );
}

export function PanelSection({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}): JSX.Element {
  return (
    <section className="panel-section">
      <header className="panel-section-header">
        <h3>{title}</h3>
        {action}
      </header>
      <div className="panel-section-body">{children}</div>
    </section>
  );
}
