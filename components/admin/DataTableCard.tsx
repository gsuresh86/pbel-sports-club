'use client';

/**
 * Shared admin table pattern (based on Super Admin → All Tournaments):
 * a rounded card with a title/count header, a toolbar of search + filters
 * on the right, then a full-bleed table with a muted header row and zebra rows.
 */

import * as React from 'react';
import { Search, X, type LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/** Card shell for the table. */
export const dataTableCardClass = 'rounded-2xl border-border shadow-none gap-0 py-0 overflow-hidden';

/** Apply to `<Table>` (or a raw `<table>`) — edge padding + header typography. */
export const dataTableClass =
  '[&_th]:h-11 [&_th]:text-xs [&_th]:font-medium [&_th]:text-muted-foreground ' +
  '[&_td]:py-3.5 [&_td]:text-sm ' +
  '[&_th:first-child]:pl-5 [&_td:first-child]:pl-5 [&_th:last-child]:pr-5 [&_td:last-child]:pr-5';

/** Icon-only row action button (Eye / Edit / Copy …), as in All Tournaments. */
export const dataTableActionClass = 'h-8 w-8 p-0 text-muted-foreground hover:text-foreground';

/** Destructive icon-only row action button. */
export const dataTableDangerActionClass = 'h-8 w-8 p-0 text-rose-500 hover:text-rose-700 hover:bg-rose-50';

/** Positive icon-only row action button (Approve …). */
export const dataTableSuccessActionClass = 'h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50';

/** Apply to the header `<TableRow>` (opaque so sticky headers stay solid). */
export const dataTableHeadRowClass =
  'hover:bg-transparent border-border bg-[color-mix(in_oklab,var(--muted)_60%,var(--card))]';

/** Odd-row tint, opaque so sticky cells (`bg-inherit`) don't show content scrolling underneath. */
const ZEBRA_BG = 'bg-[color-mix(in_oklab,var(--muted)_40%,var(--card))]';

/** Apply to each body `<TableRow>`. */
export function dataTableRowClass(index: number, className?: string) {
  return cn('border-border/60 hover:bg-muted', index % 2 === 1 ? ZEBRA_BG : 'bg-card', className);
}

/** Soft pill badges, as used for status/registration in All Tournaments. */
export const dataTableBadgeTones = {
  sky: 'bg-sky-50 text-sky-700 border-sky-100',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  amber: 'bg-amber-50 text-amber-700 border-amber-100',
  rose: 'bg-rose-50 text-rose-700 border-rose-100',
  slate: 'bg-slate-100 text-muted-foreground border-border',
} as const;

export function dataTableBadgeClass(tone: keyof typeof dataTableBadgeTones, className?: string) {
  return cn('rounded-full border capitalize', dataTableBadgeTones[tone], className);
}

/** Select trigger used in the toolbar. Override width per filter if needed. */
export const dataTableSelectClass = 'h-9 w-full sm:w-36 rounded-xl border-border focus-ring-thin';

/** Outline buttons in the toolbar (Export, Import, …). */
export const dataTableButtonClass = 'h-9 rounded-xl';

interface DataTableCardProps {
  title: React.ReactNode;
  /** Usually "Showing X of Y". */
  description?: React.ReactNode;
  /** Search box, filters, buttons — rendered on the right of the header. */
  toolbar?: React.ReactNode;
  /** Optional content between the header and the table (bulk bars, summaries). */
  subheader?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

export function DataTableCard({
  title,
  description,
  toolbar,
  subheader,
  className,
  children,
}: DataTableCardProps) {
  return (
    <Card className={cn(dataTableCardClass, className)}>
      <div className="flex shrink-0 flex-col gap-4 border-b border-border px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          {description != null && (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        {toolbar && (
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:justify-end">
            {toolbar}
          </div>
        )}
      </div>
      {subheader}
      {children}
    </Card>
  );
}

interface DataTableSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  'aria-label'?: string;
}

export function DataTableSearch({
  value,
  onChange,
  placeholder = 'Search',
  className,
  'aria-label': ariaLabel,
}: DataTableSearchProps) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel ?? placeholder}
        className="h-9 w-full rounded-xl border-border bg-card pl-9 pr-8 text-sm focus-ring-thin sm:w-64"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label="Clear search"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

interface DataTableEmptyProps {
  icon: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function DataTableEmpty({ icon: Icon, title, description, action, className }: DataTableEmptyProps) {
  return (
    <div className={cn('px-5 py-16 text-center', className)}>
      <Icon className="mx-auto mb-3 h-10 w-10 text-muted-foreground/60" />
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
