import * as React from 'react';
import { cn } from '../../lib/utils';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  side?: 'top' | 'bottom' | 'left' | 'right';
  delayMs?: number;
}

export function Tooltip({ content, children, side = 'bottom', delayMs = 400 }: TooltipProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [position, setPosition] = React.useState({ x: 0, y: 0 });
  const triggerRef = React.useRef<HTMLElement>(null);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = React.useCallback(() => {
    timeoutRef.current = setTimeout(() => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = side === 'top' ? rect.top - 8 : rect.bottom + 8;
        setPosition({ x, y });
      }
      setIsOpen(true);
    }, delayMs);
  }, [delayMs, side]);

  const handleMouseLeave = React.useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsOpen(false);
  }, []);

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const child = React.cloneElement(children, {
    ref: triggerRef,
    onMouseEnter: (e: React.MouseEvent) => {
      handleMouseEnter();
      children.props.onMouseEnter?.(e);
    },
    onMouseLeave: (e: React.MouseEvent) => {
      handleMouseLeave();
      children.props.onMouseLeave?.(e);
    },
  });

  return (
    <>
      {child}
      {isOpen && (
        <div
          className={cn(
            'fixed z-50 px-2 py-1 text-xs font-medium text-white bg-slate-900 rounded-md shadow-lg',
            'animate-in fade-in-0 zoom-in-95 duration-150',
            side === 'top' && '-translate-x-1/2 -translate-y-full',
            side === 'bottom' && '-translate-x-1/2'
          )}
          style={{
            left: position.x,
            top: position.y,
            transform:
              side === 'top'
                ? 'translate(-50%, -100%)'
                : side === 'bottom'
                  ? 'translate(-50%, 0)'
                  : undefined,
          }}
        >
          {content}
        </div>
      )}
    </>
  );
}
