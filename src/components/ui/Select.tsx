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
        className
      )}
      style={{
        // Inline styles for cross-environment compatibility
        WebkitAppearance: 'none',
        MozAppearance: 'none',
        appearance: 'none',
        paddingRight: '1.5rem',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 -960 960 960' fill='%2364748b'%3E%3Cpath d='M480-360 280-560h400L480-360Z'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
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
  className?: string;
  style?: React.CSSProperties;
  'aria-label'?: string;
}

function Select({
  value,
  defaultValue = '',
  onValueChange,
  disabled,
  children,
  className: selectClassName,
  style: selectStyle,
  'aria-label': ariaLabel,
}: SelectProps) {
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
      const props = child.props as { children?: React.ReactNode };
      items.push(props.children);
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
        aria-label={ariaLabel}
        className={cn(
          'h-8 px-2 py-1 rounded text-sm text-slate-700',
          'bg-transparent hover:bg-slate-100/80 focus:bg-slate-100/80',
          'focus:outline-none cursor-pointer transition-colors duration-150',
          'disabled:cursor-not-allowed disabled:opacity-50',
          selectClassName
        )}
        style={{
          // Inline styles for cross-environment compatibility
          WebkitAppearance: 'none',
          MozAppearance: 'none',
          appearance: 'none',
          paddingRight: '1.5rem',
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 -960 960 960' fill='%2364748b'%3E%3Cpath d='M480-360 280-560h400L480-360Z'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundSize: '1rem',
          backgroundPosition: 'right 0.25rem center',
          ...selectStyle,
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

/**
 * Extract plain text from React children.
 * Native <option> elements can only contain text, not HTML elements.
 */
function extractText(children: React.ReactNode): string {
  if (typeof children === 'string') return children;
  if (typeof children === 'number') return String(children);
  if (Array.isArray(children)) return children.map(extractText).join('');
  if (React.isValidElement(children)) {
    const props = children.props as { children?: React.ReactNode };
    return extractText(props.children);
  }
  return '';
}

function SelectItem({ value, children, style: _style, disabled }: SelectItemProps) {
  // Native <option> can only contain text - extract text from any nested elements
  return (
    <option value={value} disabled={disabled}>
      {extractText(children)}
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
      {extractText(children)}
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
