import { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/** Shared chrome for admin list tables, matching the platform All Tournaments table. */
export const adminListCardClass =
  'rounded-2xl border-border shadow-none gap-0 py-0 overflow-hidden';

export const adminTableHeadRowClass = 'hover:bg-transparent border-border bg-gray-100 dark:bg-muted';
export const adminTableHeadClass = 'h-9 text-xs font-medium text-muted-foreground';
export const adminTableHeadFirstClass = 'h-9 pl-5 text-xs font-medium text-muted-foreground';
export const adminTableHeadLastClass =
  'h-9 pr-5 text-right text-xs font-medium text-muted-foreground';

export function adminTableRowClass(className?: string) {
  return cn('border-border/60 hover:bg-gray-50', className);
}

export const adminTableClass =
  '[&_td]:py-2 [&_td]:text-sm [&_th]:h-9 [&_th]:text-xs [&_th]:font-medium [&_th]:text-muted-foreground [&_td:first-child]:pl-5 [&_th:first-child]:pl-5 [&_td:last-child]:pr-5 [&_th:last-child]:pr-5 [&_th:last-child]:text-right';

export const adminTableCellClass = 'py-2 text-sm';
export const adminTableCellFirstClass = 'pl-5 py-2 text-sm';
export const adminTableCellLastClass = 'pr-5 py-2 text-right';

export const adminFilterInputClass =
  'h-9 rounded-xl border-border bg-card text-sm focus-ring-thin';
export const adminFilterSelectClass = 'h-9 rounded-xl border-border focus-ring-thin';
export const adminIconButtonClass = 'h-7 w-7 p-0 text-muted-foreground hover:text-foreground';
export const adminDangerIconButtonClass =
  'h-7 w-7 p-0 text-rose-500 hover:text-rose-700 hover:bg-rose-50';
export const adminPillBadgeClass = 'rounded-full border font-medium';

export function AdminListCard({
  title,
  subtitle,
  toolbar,
  children,
  className,
  bodyClassName,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  toolbar?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <Card className={cn(adminListCardClass, className)}>
      <div className="flex shrink-0 flex-col gap-4 border-b border-border px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          {subtitle ? <div className="mt-0.5 text-xs text-muted-foreground">{subtitle}</div> : null}
        </div>
        {toolbar ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">{toolbar}</div>
        ) : null}
      </div>
      <div className={cn('min-h-0', bodyClassName)}>{children}</div>
    </Card>
  );
}
