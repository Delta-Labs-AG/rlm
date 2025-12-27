'use client';

import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileUploader } from './FileUploader';
import { LogViewer } from './LogViewer';
import { AsciiRLM } from './AsciiGlobe';
import { parseLogFile, extractContextVariable } from '@/lib/parse-logs';
import { RLMLogFile } from '@/lib/types';
import { cn } from '@/lib/utils';

interface DemoLogInfo {
  fileName: string;
  contextPreview: string | null;
  hasFinalAnswer: boolean;
  iterations: number;
}

export function Dashboard() {
  const [logFiles, setLogFiles] = useState<RLMLogFile[]>([]);
  const [selectedLog, setSelectedLog] = useState<RLMLogFile | null>(null);
  const [demoLogs, setDemoLogs] = useState<DemoLogInfo[]>([]);
  const [loadingDemos, setLoadingDemos] = useState(true);

  // Load demo log previews on mount - fetches latest 10 from API
  useEffect(() => {
    async function loadDemoPreviews() {
      try {
        // Fetch list of log files from API
        const listResponse = await fetch('/api/logs');
        if (!listResponse.ok) {
          throw new Error('Failed to fetch log list');
        }
        const { files } = await listResponse.json();
        
        const previews: DemoLogInfo[] = [];
        
        for (const fileName of files) {
          try {
            const response = await fetch(`/logs/${fileName}`);
            if (!response.ok) continue;
            const content = await response.text();
            const parsed = parseLogFile(fileName, content);
            const contextVar = extractContextVariable(parsed.iterations);
            
            previews.push({
              fileName,
              contextPreview: contextVar,
              hasFinalAnswer: !!parsed.metadata.finalAnswer,
              iterations: parsed.metadata.totalIterations,
            });
          } catch (e) {
            console.error('Failed to load demo preview:', fileName, e);
          }
        }
        
        setDemoLogs(previews);
      } catch (e) {
        console.error('Failed to load demo logs:', e);
      } finally {
        setLoadingDemos(false);
      }
    }
    
    loadDemoPreviews();
  }, []);

  const handleFileLoaded = useCallback((fileName: string, content: string) => {
    const parsed = parseLogFile(fileName, content);
    setLogFiles(prev => {
      if (prev.some(f => f.fileName === fileName)) {
        return prev.map(f => f.fileName === fileName ? parsed : f);
      }
      return [...prev, parsed];
    });
    setSelectedLog(parsed);
  }, []);

  const loadDemoLog = useCallback(async (fileName: string) => {
    try {
      const response = await fetch(`/logs/${fileName}`);
      if (!response.ok) throw new Error('Failed to load demo log');
      const content = await response.text();
      handleFileLoaded(fileName, content);
    } catch (error) {
      console.error('Error loading demo log:', error);
      alert('Failed to load demo log. Make sure the log files are in the public/logs folder.');
    }
  }, [handleFileLoaded]);

  if (selectedLog) {
    return (
      <LogViewer 
        logFile={selectedLog} 
        onBack={() => setSelectedLog(null)} 
      />
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background effects - green tinted */}
      <div className="absolute inset-0 grid-pattern opacity-15" />
      <div className="absolute top-0 left-1/3 w-[500px] h-[500px] bg-[oklch(0.5_0.15_145/0.08)] rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[oklch(0.4_0.1_145/0.06)] rounded-full blur-3xl" />
      
      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-[oklch(0.3_0.05_145/0.3)]">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">
                  <span className="text-[oklch(0.7_0.18_145)]">RLM</span>
                  <span className="text-muted-foreground ml-2 font-normal">Visualizer</span>
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Debug recursive language model execution traces
                </p>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-mono">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[oklch(0.7_0.2_145)] animate-pulse" />
                  READY
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-6 py-8">
          <div className="grid lg:grid-cols-2 gap-10">
            {/* Left Column - Upload & ASCII Art */}
            <div className="space-y-8">
              {/* Upload Section */}
              <div>
                <h2 className="text-sm font-medium mb-3 flex items-center gap-2 text-muted-foreground">
                  <span className="text-[oklch(0.7_0.18_145)] font-mono">01</span>
                  Upload Log File
                </h2>
                <FileUploader onFileLoaded={handleFileLoaded} />
              </div>
              
              {/* ASCII Architecture Diagram */}
              <div className="hidden lg:block">
                <h2 className="text-sm font-medium mb-3 flex items-center gap-2 text-muted-foreground">
                  <span className="text-[oklch(0.7_0.18_145)] font-mono">◈</span>
                  RLM Architecture
                </h2>
                <div className="bg-[oklch(0.08_0.01_145/0.5)] border border-[oklch(0.3_0.05_145/0.3)] rounded-lg p-4 overflow-x-auto">
                  <AsciiRLM />
                </div>
              </div>
            </div>

            {/* Right Column - Demo Logs & Loaded Files */}
            <div className="space-y-8">
              {/* Demo Logs Section */}
              <div>
                <h2 className="text-sm font-medium mb-3 flex items-center gap-2 text-muted-foreground">
                  <span className="text-[oklch(0.7_0.18_145)] font-mono">02</span>
                  Recent Traces
                  <span className="text-[10px] text-muted-foreground/60 ml-1">(latest 10)</span>
                </h2>
                
                {loadingDemos ? (
                  <Card className="border-[oklch(0.3_0.05_145/0.3)]">
                    <CardContent className="p-6 text-center">
                      <div className="animate-pulse flex items-center justify-center gap-2 text-muted-foreground text-sm">
                        Loading traces...
                      </div>
                    </CardContent>
                  </Card>
                ) : demoLogs.length === 0 ? (
                  <Card className="border-dashed border-[oklch(0.3_0.05_145/0.3)]">
                    <CardContent className="p-6 text-center text-muted-foreground text-sm">
                      No log files found in /public/logs/
                    </CardContent>
                  </Card>
                ) : (
                  <ScrollArea className="h-[320px]">
                    <div className="space-y-2 pr-4">
                      {demoLogs.map((demo) => (
                        <Card
                          key={demo.fileName}
                          onClick={() => loadDemoLog(demo.fileName)}
                          className={cn(
                            'cursor-pointer transition-all hover:scale-[1.01]',
                            'border-[oklch(0.3_0.05_145/0.3)] hover:border-[oklch(0.5_0.15_145/0.5)]',
                            'hover:bg-[oklch(0.5_0.15_145/0.03)]'
                          )}
                        >
                          <CardContent className="p-3">
                            <div className="flex items-center gap-3">
                              {/* Status indicator */}
                              <div className="relative flex-shrink-0">
                                <div className={cn(
                                  'w-2.5 h-2.5 rounded-full',
                                  demo.hasFinalAnswer 
                                    ? 'bg-[oklch(0.65_0.2_145)]' 
                                    : 'bg-[oklch(0.4_0.05_45)]'
                                )} />
                                {demo.hasFinalAnswer && (
                                  <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-[oklch(0.65_0.2_145)] animate-ping opacity-50" />
                                )}
                              </div>
                              
                              {/* Content */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-mono text-xs text-foreground/80">
                                    {demo.fileName}
                                  </span>
                                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-[oklch(0.3_0.05_145/0.5)]">
                                    {demo.iterations} iter
                                  </Badge>
                                </div>
                                {demo.contextPreview && (
                                  <p className="text-[11px] font-mono text-muted-foreground truncate">
                                    {demo.contextPreview.length > 80 
                                      ? demo.contextPreview.slice(0, 80) + '...'
                                      : demo.contextPreview}
                                  </p>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>

              {/* Loaded Files Section */}
              {logFiles.length > 0 && (
                <div>
                  <h2 className="text-sm font-medium mb-3 flex items-center gap-2 text-muted-foreground">
                    <span className="text-[oklch(0.7_0.18_145)] font-mono">03</span>
                    Loaded Files
                  </h2>
                  <ScrollArea className="h-[200px]">
                    <div className="space-y-2 pr-4">
                      {logFiles.map((log) => (
                        <Card
                          key={log.fileName}
                          className={cn(
                            'cursor-pointer transition-all hover:scale-[1.01]',
                            'border-[oklch(0.3_0.05_145/0.3)] hover:border-[oklch(0.5_0.15_145/0.5)]',
                            'hover:bg-[oklch(0.5_0.15_145/0.03)]'
                          )}
                          onClick={() => setSelectedLog(log)}
                        >
                          <CardContent className="p-3">
                            <div className="flex items-center gap-3">
                              <div className="relative flex-shrink-0">
                                <div className={cn(
                                  'w-2.5 h-2.5 rounded-full',
                                  log.metadata.finalAnswer 
                                    ? 'bg-[oklch(0.65_0.2_145)]' 
                                    : 'bg-[oklch(0.4_0.05_45)]'
                                )} />
                                {log.metadata.finalAnswer && (
                                  <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-[oklch(0.65_0.2_145)] animate-ping opacity-50" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-mono text-xs truncate text-foreground/80">
                                    {log.fileName}
                                  </span>
                                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-[oklch(0.3_0.05_145/0.5)]">
                                    {log.metadata.totalIterations} iter
                                  </Badge>
                                </div>
                                <p className="text-[11px] text-muted-foreground truncate">
                                  {log.metadata.contextQuestion}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-[oklch(0.3_0.05_145/0.3)] mt-8">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <p className="text-[10px] text-muted-foreground font-mono">
              RLM Visualizer • Recursive Language Models
            </p>
            <p className="text-[10px] text-muted-foreground font-mono">
              Prompt → [LM ↔ REPL] → Answer
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
