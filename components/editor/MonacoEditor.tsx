'use client';

import * as React from 'react';
import Editor, { OnMount, OnChange } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';

export interface ErrorMarker {
  lineNumber: number;
  message: string;
  severity: 'error' | 'warning';
}

interface MonacoEditorProps {
  value: string;
  onChange?: (value: string) => void;
  language?: string;
  readOnly?: boolean;
  errors?: ErrorMarker[];
  height?: string | number;
  className?: string;
}

export function MonacoEditor({
  value,
  onChange,
  language = 'json',
  readOnly = false,
  errors = [],
  height = '400px',
  className,
}: MonacoEditorProps) {
  const editorRef = React.useRef<editor.IStandaloneCodeEditor | null>(null);

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    // Configure JSON validation
    monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
      validate: true,
      schemas: [],
      enableSchemaRequest: false,
    });

    // Set editor options
    editor.updateOptions({
      minimap: { enabled: true },
      fontSize: 13,
      lineNumbers: 'on',
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      automaticLayout: true,
      tabSize: 2,
      formatOnPaste: true,
      formatOnType: true,
    });
  };

  const handleChange: OnChange = (value) => {
    if (onChange && value !== undefined) {
      onChange(value);
    }
  };

  // Update error markers when errors change
  React.useEffect(() => {
    if (editorRef.current) {
      const monaco = (window as unknown as { monaco?: typeof import('monaco-editor') }).monaco;
      if (monaco) {
        const markers = errors.map((error) => ({
          severity:
            error.severity === 'error'
              ? monaco.MarkerSeverity.Error
              : monaco.MarkerSeverity.Warning,
          message: error.message,
          startLineNumber: error.lineNumber,
          startColumn: 1,
          endLineNumber: error.lineNumber,
          endColumn: 1000,
        }));

        const model = editorRef.current.getModel();
        if (model) {
          monaco.editor.setModelMarkers(model, 'n8n-studio', markers);
        }
      }
    }
  }, [errors]);

  return (
    <div className={className} style={{ height, border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)' }}>
      <Editor
        height={height}
        language={language}
        value={value}
        onChange={handleChange}
        onMount={handleEditorMount}
        theme="vs-dark"
        options={{
          readOnly,
          minimap: { enabled: true },
          fontSize: 13,
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          automaticLayout: true,
          tabSize: 2,
        }}
      />
    </div>
  );
}
