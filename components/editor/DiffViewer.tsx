'use client';

import * as React from 'react';
import { DiffEditor } from '@monaco-editor/react';

interface DiffViewerProps {
  original: string;
  modified: string;
  language?: string;
  height?: string | number;
  className?: string;
  readOnly?: boolean;
}

export function DiffViewer({
  original,
  modified,
  language = 'json',
  height = '400px',
  className,
  readOnly = true,
}: DiffViewerProps) {
  return (
    <div
      className={className}
      style={{
        height,
        border: '1px solid hsl(var(--border))',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
      }}
    >
      <DiffEditor
        height={height}
        language={language}
        original={original}
        modified={modified}
        theme="vs-dark"
        options={{
          readOnly,
          minimap: { enabled: false },
          fontSize: 13,
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          automaticLayout: true,
          renderSideBySide: true,
          ignoreTrimWhitespace: false,
        }}
      />
    </div>
  );
}
