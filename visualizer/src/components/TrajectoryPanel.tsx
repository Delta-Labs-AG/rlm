'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { RLMIteration, extractFinalAnswer } from '@/lib/types';

interface TrajectoryPanelProps {
  iterations: RLMIteration[];
  selectedIteration: number;
  onSelectIteration: (index: number) => void;
}

export function TrajectoryPanel({ 
  iterations, 
  selectedIteration, 
  onSelectIteration 
}: TrajectoryPanelProps) {
  const [viewMode, setViewMode] = useState<'timeline' | 'messages'>('timeline');

  const currentIteration = iterations[selectedIteration];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[oklch(0.8_0.15_195/0.1)] border border-[oklch(0.8_0.15_195/0.3)] flex items-center justify-center">
            <span className="text-[oklch(0.8_0.15_195)] text-sm">◈</span>
          </div>
          <div>
            <h2 className="font-semibold">Trajectory</h2>
            <p className="text-xs text-muted-foreground">
              Root LM conversation flow
            </p>
          </div>
        </div>
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'timeline' | 'messages')}>
          <TabsList className="h-8">
            <TabsTrigger value="timeline" className="text-xs px-3">Timeline</TabsTrigger>
            <TabsTrigger value="messages" className="text-xs px-3">Messages</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        {viewMode === 'timeline' ? (
          <div className="p-4">
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gradient-to-b from-[oklch(0.8_0.15_195/0.5)] via-[oklch(0.7_0.2_320/0.5)] to-[oklch(0.75_0.2_145/0.5)]" />
              
              {/* Iterations */}
              <div className="space-y-4">
                {iterations.map((iter, idx) => {
                  const hasFinal = iter.final_answer !== null;
                  const hasCode = iter.code_blocks.length > 0;
                  const hasError = iter.code_blocks.some(b => b.result?.stderr);
                  
                  return (
                    <div
                      key={idx}
                      onClick={() => onSelectIteration(idx)}
                      className={cn(
                        'relative pl-12 cursor-pointer group transition-all',
                        selectedIteration === idx && 'scale-[1.01]'
                      )}
                    >
                      {/* Timeline dot */}
                      <div 
                        className={cn(
                          'absolute left-3 top-3 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all',
                          selectedIteration === idx
                            ? 'bg-[oklch(0.8_0.15_195)] border-[oklch(0.8_0.15_195)] scale-110 shadow-[0_0_12px_oklch(0.8_0.15_195/0.5)]'
                            : hasFinal
                              ? 'bg-[oklch(0.75_0.2_145)] border-[oklch(0.75_0.2_145)]'
                              : hasError
                                ? 'bg-[oklch(0.65_0.25_25)] border-[oklch(0.65_0.25_25)]'
                                : 'bg-muted border-border group-hover:border-[oklch(0.8_0.15_195/0.5)]'
                        )}
                      >
                        <span className="text-[10px] font-bold text-primary-foreground">
                          {idx + 1}
                        </span>
                      </div>
                      
                      {/* Card */}
                      <Card className={cn(
                        'border transition-all',
                        selectedIteration === idx
                          ? 'border-[oklch(0.8_0.15_195/0.5)] bg-[oklch(0.8_0.15_195/0.05)] shadow-lg shadow-[oklch(0.8_0.15_195/0.1)]'
                          : 'border-border hover:border-[oklch(0.8_0.15_195/0.3)] hover:bg-muted/20'
                      )}>
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className="text-[10px]">
                                Iter {iter.iteration}
                              </Badge>
                              {hasCode && (
                                <Badge className="bg-[oklch(0.75_0.2_145/0.2)] text-[oklch(0.75_0.2_145)] border-[oklch(0.75_0.2_145/0.3)] text-[10px]">
                                  {iter.code_blocks.length} code
                                </Badge>
                              )}
                              {hasFinal && (
                                <Badge className="bg-[oklch(0.9_0.18_90/0.2)] text-[oklch(0.9_0.18_90)] border-[oklch(0.9_0.18_90/0.3)] text-[10px]">
                                  ✓ Final
                                </Badge>
                              )}
                              {hasError && (
                                <Badge variant="destructive" className="text-[10px]">
                                  Error
                                </Badge>
                              )}
                            </div>
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                              {new Date(iter.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {iter.response.slice(0, 150)}
                            {iter.response.length > 150 ? '...' : ''}
                          </p>
                        </CardContent>
                      </Card>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {currentIteration?.prompt.map((msg, idx) => (
              <Card 
                key={idx}
                className={cn(
                  'border',
                  msg.role === 'system' 
                    ? 'border-[oklch(0.7_0.2_320/0.3)] bg-[oklch(0.7_0.2_320/0.03)]'
                    : msg.role === 'assistant'
                      ? 'border-[oklch(0.8_0.15_195/0.3)] bg-[oklch(0.8_0.15_195/0.03)]'
                      : 'border-border'
                )}
              >
                <CardHeader className="py-2 px-3">
                  <CardTitle className="text-xs flex items-center gap-2">
                    <span 
                      className={cn(
                        'w-2 h-2 rounded-full',
                        msg.role === 'system' ? 'bg-[oklch(0.7_0.2_320)]' :
                        msg.role === 'assistant' ? 'bg-[oklch(0.8_0.15_195)]' :
                        'bg-[oklch(0.75_0.2_145)]'
                      )}
                    />
                    {msg.role.charAt(0).toUpperCase() + msg.role.slice(1)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="py-2 px-3">
                  <ScrollArea className="max-h-48">
                    <pre className="text-xs whitespace-pre-wrap font-mono text-muted-foreground">
                      {msg.content.slice(0, 2000)}
                      {msg.content.length > 2000 ? '\n\n... [truncated]' : ''}
                    </pre>
                  </ScrollArea>
                </CardContent>
              </Card>
            ))}
            
            {/* Current response */}
            <Card className="border-[oklch(0.8_0.15_195/0.5)] bg-[oklch(0.8_0.15_195/0.05)]">
              <CardHeader className="py-2 px-3">
                <CardTitle className="text-xs flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[oklch(0.8_0.15_195)]" />
                  Response (Iteration {currentIteration?.iteration})
                </CardTitle>
              </CardHeader>
              <CardContent className="py-2 px-3">
                <ScrollArea className="max-h-64">
                  <pre className="text-xs whitespace-pre-wrap font-mono">
                    {currentIteration?.response || 'No response'}
                  </pre>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Final answer if present */}
            {currentIteration?.final_answer && (
              <Card className="border-[oklch(0.9_0.18_90/0.5)] bg-[oklch(0.9_0.18_90/0.05)]">
                <CardHeader className="py-2 px-3">
                  <CardTitle className="text-xs flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[oklch(0.9_0.18_90)]" />
                    Final Answer
                  </CardTitle>
                </CardHeader>
                <CardContent className="py-2 px-3">
                  <p className="text-sm font-medium text-[oklch(0.9_0.18_90)]">
                    {extractFinalAnswer(currentIteration.final_answer)}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

