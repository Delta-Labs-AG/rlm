'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { CodeBlock as CodeBlockType } from '@/lib/types';
import { CodeWithLineNumbers } from './CodeWithLineNumbers';

interface CodeBlockProps {
  block: CodeBlockType;
  index: number;
}

export function CodeBlock({ block, index }: CodeBlockProps) {
  const [isOpen, setIsOpen] = useState(true);
  const hasError = block.result?.stderr && block.result.stderr.length > 0;
  const hasOutput = block.result?.stdout && block.result.stdout.length > 0;
  const executionTime = block.result?.execution_time 
    ? (block.result.execution_time * 1000).toFixed(2) 
    : null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className={cn(
        'border overflow-hidden transition-all',
        hasError 
          ? 'border-[oklch(0.65_0.25_25/0.4)] bg-[oklch(0.65_0.25_25/0.03)]' 
          : 'border-[oklch(0.75_0.2_145/0.3)] bg-[oklch(0.75_0.2_145/0.03)]'
      )}>
        <CollapsibleTrigger asChild>
          <CardHeader className="py-2 px-4 cursor-pointer hover:bg-muted/20 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[oklch(0.75_0.2_145)] font-mono text-sm">
                  {'>'}_
                </span>
                <CardTitle className="text-sm font-medium">
                  Code Block #{index + 1}
                </CardTitle>
              </div>
              <div className="flex items-center gap-2">
                {executionTime && (
                  <Badge variant="outline" className="font-mono text-xs">
                    {executionTime}ms
                  </Badge>
                )}
                {hasError && (
                  <Badge variant="destructive" className="text-xs">
                    Error
                  </Badge>
                )}
                {hasOutput && !hasError && (
                  <Badge className="bg-[oklch(0.75_0.2_145)] text-[oklch(0.1_0.02_260)] text-xs">
                    Output
                  </Badge>
                )}
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                  <span className="text-xs">{isOpen ? '▼' : '▶'}</span>
                </Button>
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="p-0">
            {/* Code */}
            <div className="bg-[oklch(0.06_0.015_260)] border-t border-border">
              <div className="px-3 py-1.5 border-b border-border/50 flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  Python
                </span>
              </div>
              <div className="code-block p-4 overflow-x-auto">
                <CodeWithLineNumbers code={block.code} language="python" />
              </div>
            </div>

            {/* Output */}
            {hasOutput && (
              <div className="border-t border-border bg-[oklch(0.04_0.01_260)]">
                <div className="px-3 py-1.5 border-b border-border/50 flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-wider text-[oklch(0.75_0.2_145)] font-medium">
                    stdout
                  </span>
                </div>
                <pre className="code-block p-4 overflow-x-auto">
                  <code className="text-[oklch(0.75_0.2_145)]">
                    {block.result.stdout}
                  </code>
                </pre>
              </div>
            )}

            {/* Errors */}
            {hasError && (
              <div className="border-t border-border bg-[oklch(0.65_0.25_25/0.05)]">
                <div className="px-3 py-1.5 border-b border-border/50 flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-wider text-[oklch(0.65_0.25_25)] font-medium">
                    stderr
                  </span>
                </div>
                <pre className="code-block p-4 overflow-x-auto">
                  <code className="text-[oklch(0.65_0.25_25)]">
                    {block.result.stderr}
                  </code>
                </pre>
              </div>
            )}

            {/* Locals */}
            {block.result?.locals && Object.keys(block.result.locals).length > 0 && (
              <div className="border-t border-border bg-[oklch(0.08_0.01_260)]">
                <div className="px-3 py-1.5 border-b border-border/50 flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                    Variables
                  </span>
                </div>
                <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-2">
                  {Object.entries(block.result.locals).map(([key, value]) => (
                    <div 
                      key={key} 
                      className="bg-muted/30 rounded px-2 py-1.5 font-mono text-xs overflow-hidden"
                    >
                      <span className="text-[oklch(0.8_0.15_195)]">{key}</span>
                      <span className="text-muted-foreground mx-1">=</span>
                      <span className="text-[oklch(0.9_0.18_90)] truncate">
                        {typeof value === 'string' 
                          ? value.length > 30 ? value.slice(0, 30) + '...' : value
                          : JSON.stringify(value).slice(0, 30)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sub-LM Calls */}
            {block.result?.rlm_calls && block.result.rlm_calls.length > 0 && (
              <div className="border-t border-border bg-[oklch(0.7_0.2_320/0.03)]">
                <div className="px-3 py-1.5 border-b border-border/50 flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-wider text-[oklch(0.7_0.2_320)] font-medium">
                    Sub-LM Calls ({block.result.rlm_calls.length})
                  </span>
                </div>
                <div className="p-4 space-y-3">
                  {block.result.rlm_calls.map((call, i) => (
                    <div 
                      key={i}
                      className="border border-[oklch(0.7_0.2_320/0.3)] rounded-lg p-3 bg-[oklch(0.7_0.2_320/0.02)]"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <Badge className="bg-[oklch(0.7_0.2_320)] text-white text-xs">
                          llm_query #{i + 1}
                        </Badge>
                        <div className="flex gap-2 text-xs text-muted-foreground">
                          <span>{call.prompt_tokens} prompt</span>
                          <span>•</span>
                          <span>{call.completion_tokens} completion</span>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground mb-1">Prompt:</div>
                      <div className="text-sm bg-muted/20 rounded p-2 mb-2 max-h-24 overflow-y-auto">
                        {typeof call.prompt === 'string' 
                          ? call.prompt.slice(0, 500) + (call.prompt.length > 500 ? '...' : '')
                          : JSON.stringify(call.prompt).slice(0, 500)}
                      </div>
                      <div className="text-xs text-muted-foreground mb-1">Response:</div>
                      <div className="text-sm bg-muted/20 rounded p-2 max-h-24 overflow-y-auto">
                        {call.response.slice(0, 500) + (call.response.length > 500 ? '...' : '')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

