'use client';

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  variant?: 'cyan' | 'magenta' | 'yellow' | 'green' | 'red';
  subtext?: string;
}

const variantStyles = {
  cyan: 'border-[oklch(0.8_0.15_195/0.3)] bg-[oklch(0.8_0.15_195/0.05)]',
  magenta: 'border-[oklch(0.7_0.2_320/0.3)] bg-[oklch(0.7_0.2_320/0.05)]',
  yellow: 'border-[oklch(0.9_0.18_90/0.3)] bg-[oklch(0.9_0.18_90/0.05)]',
  green: 'border-[oklch(0.75_0.2_145/0.3)] bg-[oklch(0.75_0.2_145/0.05)]',
  red: 'border-[oklch(0.65_0.25_25/0.3)] bg-[oklch(0.65_0.25_25/0.05)]',
};

const textStyles = {
  cyan: 'text-[oklch(0.8_0.15_195)]',
  magenta: 'text-[oklch(0.7_0.2_320)]',
  yellow: 'text-[oklch(0.9_0.18_90)]',
  green: 'text-[oklch(0.75_0.2_145)]',
  red: 'text-[oklch(0.65_0.25_25)]',
};

export function StatsCard({ label, value, icon, variant = 'cyan', subtext }: StatsCardProps) {
  return (
    <Card className={cn(
      'border transition-all duration-300 hover:scale-[1.02]',
      variantStyles[variant]
    )}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={cn('text-2xl', textStyles[variant])}>
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
              {label}
            </p>
            <p className={cn('text-2xl font-bold tracking-tight', textStyles[variant])}>
              {value}
            </p>
            {subtext && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {subtext}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

