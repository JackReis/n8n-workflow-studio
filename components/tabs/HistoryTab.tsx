'use client';

import * as React from 'react';
import { useAppStore, HistoryItem } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function HistoryTab() {
  const { history, clearHistory } = useAppStore();

  // Format timestamp
  const formatTime = (timestamp: string | number) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  // Restore from history (would set the JSON in editor)
  const handleRestore = (item: HistoryItem) => {
    // This would be implemented to restore the workflow to the editor
    console.log('Restore:', item);
  };

  // Export history
  const handleExport = () => {
    const data = JSON.stringify(history, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'history-export.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b border-border">
        <Button variant="outline" size="sm" onClick={handleExport} disabled={history.length === 0}>
          Export History
        </Button>
        <Button variant="outline" size="sm" onClick={clearHistory} disabled={history.length === 0}>
          Clear All
        </Button>
      </div>

      {/* History List */}
      <div className="flex-1 overflow-auto">
        {history.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <p className="text-lg font-medium">No history yet</p>
              <p className="text-sm">Your recent operations will appear here</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2 p-4">
            {history.map((item, index) => (
              <Card key={index} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded text-xs font-medium',
                            item.type === 'repair'
                              ? 'bg-blue-500/20 text-blue-400'
                              : 'bg-green-500/20 text-green-400'
                          )}
                        >
                          {item.type === 'repair' ? 'Repair' : 'Generate'}
                        </span>
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded text-xs',
                            item.success
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-red-500/20 text-red-400'
                          )}
                        >
                          {item.success ? 'Success' : 'Failed'}
                        </span>
                        {item.provider && (
                          <span className="text-xs text-muted-foreground">
                            {item.provider} / {item.model}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {formatTime(item.timestamp)}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => handleRestore(item)}>
                      Restore
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
