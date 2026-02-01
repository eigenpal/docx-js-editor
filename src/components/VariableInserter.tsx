import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from './ui/Button';

interface VariableInserterProps {
  onInsert?: (variableName: string) => void;
  suggestions?: string[];
  disabled?: boolean;
}

export function VariableInserter({
  onInsert,
  suggestions = [],
  disabled = false,
}: VariableInserterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [variableName, setVariableName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!variableName.trim()) {
      setError('Variable name is required');
      return;
    }

    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(variableName)) {
      setError('Invalid variable name');
      return;
    }

    onInsert?.(variableName.trim());
    setVariableName('');
    setError('');
    setIsOpen(false);
  };

  const handleSuggestionClick = (name: string) => {
    onInsert?.(name);
    setIsOpen(false);
  };

  if (!isOpen) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(true)}
        disabled={disabled}
        title="Insert Variable"
      >
        <Plus className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <div className="relative">
      <div className="absolute right-0 top-full mt-2 w-64 bg-popover border rounded-lg shadow-lg p-3 z-50">
        <form onSubmit={handleSubmit}>
          <label className="block text-sm font-medium mb-1">
            Variable name:
          </label>
          <input
            type="text"
            value={variableName}
            onChange={(e) => {
              setVariableName(e.target.value);
              setError('');
            }}
            placeholder="e.g., clientName"
            className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            autoFocus
          />
          {error && (
            <p className="text-sm text-destructive mt-1">{error}</p>
          )}

          {suggestions.length > 0 && (
            <div className="mt-2">
              <p className="text-xs text-muted-foreground mb-1">Suggestions:</p>
              <div className="flex flex-wrap gap-1">
                {suggestions.slice(0, 5).map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => handleSuggestionClick(name)}
                    className="px-2 py-0.5 text-xs bg-muted rounded hover:bg-muted/80"
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 mt-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsOpen(false);
                setVariableName('');
                setError('');
              }}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm">
              Insert
            </Button>
          </div>
        </form>
      </div>

      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        onClick={() => {
          setIsOpen(false);
          setVariableName('');
          setError('');
        }}
      />
    </div>
  );
}
