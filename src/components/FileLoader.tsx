import React, { useState, useCallback } from 'react';
import { Upload } from 'lucide-react';
import { Button } from './ui/Button';

interface FileLoaderProps {
  onFileLoad: (file: File) => void;
  accept?: string;
  disabled?: boolean;
}

export function FileLoader({
  onFileLoad,
  accept = '.docx',
  disabled = false,
}: FileLoaderProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragOver(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (disabled) return;

    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.docx')) {
      onFileLoad(file);
    }
  }, [disabled, onFileLoad]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileLoad(file);
    }
    e.target.value = '';
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        flex flex-col items-center justify-center
        min-h-[300px] p-8
        border-2 border-dashed rounded-lg
        transition-colors cursor-pointer
        ${isDragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary/50'}
      `}
    >
      <Upload className="h-12 w-12 text-muted-foreground mb-4" />
      <p className="text-lg font-medium text-center mb-2">
        Drop a DOCX file here
      </p>
      <p className="text-sm text-muted-foreground mb-4">
        or click to browse
      </p>

      <label>
        <input
          type="file"
          accept={accept}
          onChange={handleFileInput}
          className="hidden"
          disabled={disabled}
        />
        <Button variant="outline" disabled={disabled} asChild>
          <span>Select File</span>
        </Button>
      </label>
    </div>
  );
}
