'use client';

import { useEffect, useState } from 'react';

// RLM Architecture ASCII art inspired by the diagram
const RLM_ARCHITECTURE = `
  ┌─────────────────┐                              ┌─────────────────────┐
  │     Prompt      │                              │   Final Response    │
  │  ─────────────  │                              │  ─────────────────  │
  │  You are reading│                              │  From chapter 1...  │
  │  an extremely...│                              │  Bob was the only...│
  └────────┬────────┘                              └──────────▲──────────┘
           │                                                  │
           ▼                                                  │
  ╔════════════════════════════════════════════════════════════════════╗
  ║                        RLM (root / depth=0)                        ║
  ║  ┌──────────────────────────────────────────────────────────────┐  ║
  ║  │                    Language Model (LM)                       │  ║
  ║  └──────────────────────────┬───────────────────────────────────┘  ║
  ║                             │ ↑↓                                   ║
  ║  ┌──────────────────────────▼───────────────────────────────────┐  ║
  ║  │                   Environment (REPL)                         │  ║
  ║  │                      context, llm_query()                    │  ║
  ║  └───────┬─────────────────────────────────────────┬────────────┘  ║
  ╚══════════│═════════════════════════════════════════│═══════════════╝
             │                                         │
    ┌────────▼────────┐                       ┌────────▼────────┐
    │   Sub-Prompt    │                       │   Sub-Prompt    │
    │  "In Chapter 1" │                       │  "Look for the" │
    └────────┬────────┘                       └────────┬────────┘
             │                                         │
   ╔═════════▼═════════╗                     ╔═════════▼═════════╗
   ║  RLM (depth=1)    ║                     ║  RLM (depth=1)    ║
   ║  ┌─────────────┐  ║                     ║  ┌─────────────┐  ║
   ║  │     LM      │  ║                     ║  │     LM      │  ║
   ║  └──────┬──────┘  ║                     ║  └──────┬──────┘  ║
   ║         ↓↑        ║                     ║         ↓↑        ║
   ║  ┌─────────────┐  ║                     ║  ┌─────────────┐  ║
   ║  │    REPL     │  ║                     ║  │    REPL     │  ║
   ║  └─────────────┘  ║                     ║  └──────┬──────┘  ║
   ╚═══════════════════╝                     ╚═════════│═════════╝
             │                                         │
    ┌────────▼────────┐                               ...
    │  Sub-Response   │
    │ "The silver..." │
    └─────────────────┘
`;

// Simplified version for smaller displays - horizontal flow
const RLM_SIMPLE = `
                    ╔══════════════════════════════════════════╗
  ┌──────────┐      ║            RLM (depth=0)                 ║      ┌──────────┐
  │  Prompt  │      ║  ┌────────────────────────────────────┐  ║      │  Answer  │
  │──────────│ ───► ║  │        Language Model (LM)         │  ║ ───► │──────────│
  │ context  │      ║  └─────────────────┬──────────────────┘  ║      │  FINAL() │
  └──────────┘      ║                    ↓↑                    ║      └──────────┘
                    ║  ┌─────────────────▼──────────────────┐  ║
                    ║  │       Environment (REPL)           │  ║
                    ║  │     context · llm_query()          │  ║
                    ║  └──────────┬────────────┬────────────┘  ║
                    ╚═════════════│════════════│═══════════════╝
                                  │            │
                         ┌────────▼────┐  ┌────▼────────┐
                         │ llm_query() │  │ llm_query() │
                         └────────┬────┘  └────┬────────┘
                                  │            │
                         ╔════════▼════╗  ╔════▼════════╗
                         ║ RLM (d=1)   ║  ║ RLM (d=1)   ║
                         ║  LM ↔ REPL  ║  ║  LM ↔ REPL  ║
                         ╚═════════════╝  ╚═════════════╝
`;

export function AsciiRLM() {
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPulse(p => (p + 1) % 4);
    }, 600);
    return () => clearInterval(interval);
  }, []);

  // Colorize the ASCII art
  const colorize = (text: string) => {
    return text.split('\n').map((line, lineIdx) => (
      <div key={lineIdx} className="whitespace-pre">
        {line.split('').map((char, charIdx) => {
          const key = `${lineIdx}-${charIdx}`;
          
          // Box drawing characters - dim
          if ('┌┐└┘├┤┬┴┼─│╔╗╚╝║═'.includes(char)) {
            return <span key={key} className="text-[oklch(0.4_0.05_145)]">{char}</span>;
          }
          // Arrows - green
          if ('▼▲↓↑→←'.includes(char)) {
            const isPulsing = (lineIdx + charIdx + pulse) % 4 === 0;
            return (
              <span 
                key={key} 
                className={isPulsing ? 'text-[oklch(0.8_0.2_145)]' : 'text-[oklch(0.6_0.15_145)]'}
              >
                {char}
              </span>
            );
          }
          // Keywords
          if (line.includes('RLM') && char !== ' ') {
            if ('RLM'.includes(char)) {
              return <span key={key} className="text-[oklch(0.75_0.2_145)] font-bold">{char}</span>;
            }
          }
          if (line.includes('Prompt') || line.includes('Response') || line.includes('Answer')) {
            if (!'[]│─'.includes(char) && char !== ' ') {
              return <span key={key} className="text-[oklch(0.7_0.1_90)]">{char}</span>;
            }
          }
          if (line.includes('Language Model') || line.includes('LM')) {
            if (!'[]│─┌┐└┘'.includes(char) && char !== ' ') {
              return <span key={key} className="text-[oklch(0.65_0.15_220)]">{char}</span>;
            }
          }
          if (line.includes('REPL') || line.includes('Environment') || line.includes('context') || line.includes('llm_query')) {
            if (!'[]│─┌┐└┘'.includes(char) && char !== ' ') {
              return <span key={key} className="text-[oklch(0.7_0.18_145)]">{char}</span>;
            }
          }
          if (line.includes('depth=')) {
            if (!'()'.includes(char) && char !== ' ') {
              return <span key={key} className="text-[oklch(0.55_0.1_260)]">{char}</span>;
            }
          }
          // Default
          return <span key={key} className="text-[oklch(0.45_0.02_260)]">{char}</span>;
        })}
      </div>
    ));
  };

  return (
    <div className="font-mono text-[10px] leading-[1.3] select-none">
      <pre>{colorize(RLM_SIMPLE)}</pre>
    </div>
  );
}

// Compact inline diagram for header
export function AsciiRLMInline() {
  return (
    <div className="font-mono text-[9px] leading-tight select-none text-[oklch(0.5_0.1_145)]">
      <span className="text-[oklch(0.65_0.15_145)]">Prompt</span>
      <span> → </span>
      <span className="text-[oklch(0.7_0.18_145)]">[LM ↔ REPL]</span>
      <span> → </span>
      <span className="text-[oklch(0.65_0.15_90)]">Answer</span>
    </div>
  );
}
