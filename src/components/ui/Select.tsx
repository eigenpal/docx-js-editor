/**
 * Select Component (Native HTML)
 *
 * A minimal, accessible select using native HTML.
 * Replaces Radix UI to avoid React 19 compose-refs issues.
 */

import * as React from 'react';
import { cn } from '../../lib/utils';

// ============================================================================
// SIMPLE SELECT (recommended)
// ============================================================================

export interface SimpleSelectProps extends Omit<
  React.SelectHTMLAttributes<HTMLSelectElement>,
  'onChange'
> {
  value?: string;
  onValueChange?: (value: string) => void;
  options: { value: string; label: string; style?: React.CSSProperties }[];
  placeholder?: string;
}

export function SimpleSelect({
  value,
  onValueChange,
  options,
  placeholder,
  className,
  disabled,
  ...props
}: SimpleSelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onValueChange?.(e.target.value)}
      disabled={disabled}
      className={cn(
        'h-8 px-2 py-1 rounded text-sm text-slate-700',
        'bg-transparent hover:bg-slate-100/80 focus:bg-slate-100/80',
        'focus:outline-none cursor-pointer transition-colors duration-150',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'appearance-none bg-no-repeat bg-right pr-6',
        className
      )}
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%2394a3b8'%3E%3Cpath fill-rule='evenodd' d='M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z' clip-rule='evenodd'/%3E%3C/svg%3E")`,
        backgroundSize: '1rem',
        backgroundPosition: 'right 0.25rem center',
      }}
      {...props}
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value} style={opt.style}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

// ============================================================================
// RADIX-COMPATIBLE API (for existing consumers)
// ============================================================================

interface SelectContextValue {
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
}

const SelectContext = React.createContext<SelectContextValue | null>(null);

interface SelectProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
}

function Select({ value, defaultValue = '', onValueChange, disabled, children }: SelectProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue);
  const currentValue = value ?? internalValue;

  const handleValueChange = React.useCallback(
    (newValue: string) => {
      if (value === undefined) {
        setInternalValue(newValue);
      }
      onValueChange?.(newValue);
    },
    [value, onValueChange]
  );

  // Extract SelectContent children to render inside native select
  const items: React.ReactNode[] = [];
  React.Children.forEach(children, (child) => {
    if (React.isValidElement(child) && child.type === SelectContent) {
      items.push(child.props.children);
    }
  });

  return (
    <SelectContext.Provider
      value={{ value: currentValue, onValueChange: handleValueChange, disabled }}
    >
      <select
        value={currentValue}
        onChange={(e) => handleValueChange(e.target.value)}
        disabled={disabled}
        className={cn(
          'h-8 px-2 py-1 rounded text-sm text-slate-700',
          'bg-transparent hover:bg-slate-100/80 focus:bg-slate-100/80',
          'focus:outline-none cursor-pointer transition-colors duration-150',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'appearance-none bg-no-repeat bg-right pr-6'
        )}
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%2394a3b8'%3E%3Cpath fill-rule='evenodd' d='M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z' clip-rule='evenodd'/%3E%3C/svg%3E")`,
          backgroundSize: '1rem',
          backgroundPosition: 'right 0.25rem center',
        }}
      >
        {items}
      </select>
    </SelectContext.Provider>
  );
}

// These components are for API compatibility but don't render anything special
interface SelectTriggerProps {
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  'aria-label'?: string;
}

function SelectTrigger(_props: SelectTriggerProps) {
  // Not used in native implementation - select is always visible
  return null;
}

interface SelectValueProps {
  placeholder?: string;
  children?: React.ReactNode;
}

function SelectValue(_props: SelectValueProps) {
  // Not used - native select shows value automatically
  return null;
}

interface SelectContentProps {
  children: React.ReactNode;
  className?: string;
}

function SelectContent({ children }: SelectContentProps) {
  // This is extracted by Select parent and rendered inside native select
  return <>{children}</>;
}

interface SelectItemProps {
  value: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
  disabled?: boolean;
}

function SelectItem({ value, children, style, disabled }: SelectItemProps) {
  return (
    <option value={value} style={style} disabled={disabled}>
      {children}
    </option>
  );
}

interface SelectGroupProps {
  children: React.ReactNode;
}

function SelectGroup({ children }: SelectGroupProps) {
  return <>{children}</>;
}

interface SelectLabelProps {
  children?: React.ReactNode;
  className?: string;
}

function SelectLabel({ children }: SelectLabelProps) {
  // Render as disabled option to act as group label
  return (
    <option disabled style={{ fontWeight: 500, color: '#64748b' }}>
      {children}
    </option>
  );
}

function SelectSeparator() {
  // Native select doesn't support visual separators
  return null;
}

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
};
