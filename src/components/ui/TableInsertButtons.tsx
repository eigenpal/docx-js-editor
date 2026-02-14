/**
 * TableInsertButtons - 4 icon buttons for row/column insertion
 *
 * Insert row above, insert row below, insert column left, insert column right.
 */

import React, { useCallback } from 'react';
import { MaterialSymbol } from './MaterialSymbol';
import { Button } from './Button';
import { Tooltip } from './Tooltip';
import { cn } from '../../lib/utils';
import type { TableAction } from './TableToolbar';

export interface TableInsertButtonsProps {
  onAction: (action: TableAction) => void;
  disabled?: boolean;
}

const INSERT_ACTIONS: { action: TableAction; icon: string; label: string; testId: string }[] = [
  {
    action: 'addRowAbove',
    icon: 'keyboard_arrow_up',
    label: 'Insert row above',
    testId: 'toolbar-table-add-row-above',
  },
  {
    action: 'addRowBelow',
    icon: 'keyboard_arrow_down',
    label: 'Insert row below',
    testId: 'toolbar-table-add-row-below',
  },
  {
    action: 'addColumnLeft',
    icon: 'keyboard_arrow_left',
    label: 'Insert column left',
    testId: 'toolbar-table-add-col-left',
  },
  {
    action: 'addColumnRight',
    icon: 'keyboard_arrow_right',
    label: 'Insert column right',
    testId: 'toolbar-table-add-col-right',
  },
];

export function TableInsertButtons({ onAction, disabled = false }: TableInsertButtonsProps) {
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  return (
    <>
      {INSERT_ACTIONS.map(({ action, icon, label, testId }) => (
        <Tooltip key={typeof action === 'string' ? action : action.type} content={label}>
          <Button
            variant="ghost"
            size="icon-sm"
            className={cn(
              'text-slate-500 hover:text-slate-900 hover:bg-slate-100/80',
              disabled && 'opacity-30 cursor-not-allowed'
            )}
            onMouseDown={handleMouseDown}
            onClick={() => !disabled && onAction(action)}
            disabled={disabled}
            aria-label={label}
            data-testid={testId}
          >
            <MaterialSymbol name={icon} size={20} />
          </Button>
        </Tooltip>
      ))}
    </>
  );
}

export default TableInsertButtons;
