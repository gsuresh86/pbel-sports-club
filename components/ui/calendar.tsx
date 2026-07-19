'use client';

import * as React from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

type DateRangeMatcher = { before?: Date; after?: Date };

interface CalendarProps {
  mode?: 'single';
  selected?: Date;
  onSelect?: (date: Date | undefined) => void;
  defaultMonth?: Date;
  /** Dates matching any matcher are not selectable */
  disabled?: DateRangeMatcher[];
  /** Bounds for month navigation and the year dropdown */
  startMonth?: Date;
  endMonth?: Date;
  captionLayout?: 'label' | 'dropdown';
  className?: string;
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function Calendar({
  selected,
  onSelect,
  defaultMonth,
  disabled,
  startMonth,
  endMonth,
  captionLayout = 'label',
  className,
}: CalendarProps) {
  const today = new Date();
  const [month, setMonth] = React.useState<Date>(
    startOfMonth(defaultMonth ?? selected ?? today)
  );

  const minMonth = startOfMonth(startMonth ?? new Date(today.getFullYear() - 80, 0));
  const maxMonth = startOfMonth(endMonth ?? new Date(today.getFullYear() + 5, 11));

  const isDateDisabled = (date: Date) =>
    disabled?.some(
      (m) =>
        (m.before && isBefore(date, startOfDay(m.before))) ||
        (m.after && isAfter(date, startOfDay(m.after)))
    ) ?? false;

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month)),
    end: endOfWeek(endOfMonth(month)),
  });

  const years: number[] = [];
  for (let y = minMonth.getFullYear(); y <= maxMonth.getFullYear(); y++) {
    years.push(y);
  }

  const clampMonth = (next: Date) =>
    isBefore(next, minMonth) ? minMonth : isAfter(next, maxMonth) ? maxMonth : next;

  const selectClasses =
    'h-8 rounded-md border border-input bg-background px-1 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring';

  return (
    <div data-slot="calendar" className={cn('bg-background w-fit p-3', className)}>
      <div className="relative flex items-center justify-center gap-1.5 pb-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute left-0 size-8 p-0"
          disabled={!isAfter(month, minMonth)}
          onClick={() => setMonth(clampMonth(addMonths(month, -1)))}
          aria-label="Previous month"
        >
          <ChevronLeftIcon className="size-4" />
        </Button>
        {captionLayout === 'dropdown' ? (
          <>
            <select
              className={selectClasses}
              value={month.getMonth()}
              aria-label="Month"
              onChange={(e) =>
                setMonth(clampMonth(new Date(month.getFullYear(), Number(e.target.value), 1)))
              }
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i} value={i}>
                  {format(new Date(2000, i, 1), 'MMM')}
                </option>
              ))}
            </select>
            <select
              className={selectClasses}
              value={month.getFullYear()}
              aria-label="Year"
              onChange={(e) =>
                setMonth(clampMonth(new Date(Number(e.target.value), month.getMonth(), 1)))
              }
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </>
        ) : (
          <span className="text-sm font-medium select-none">
            {format(month, 'MMMM yyyy')}
          </span>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-0 size-8 p-0"
          disabled={!isBefore(month, maxMonth)}
          onClick={() => setMonth(clampMonth(addMonths(month, 1)))}
          aria-label="Next month"
        >
          <ChevronRightIcon className="size-4" />
        </Button>
      </div>
      <div className="grid grid-cols-7">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="text-muted-foreground w-8 text-center text-[0.8rem] font-normal select-none"
          >
            {day}
          </div>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-y-1">
        {days.map((day) => {
          const isSelected = selected ? isSameDay(day, selected) : false;
          const dayDisabled = isDateDisabled(day);
          return (
            <Button
              key={day.toISOString()}
              type="button"
              variant="ghost"
              size="icon"
              disabled={dayDisabled}
              onClick={() => onSelect?.(isSelected ? undefined : day)}
              className={cn(
                'size-8 p-0 text-sm font-normal',
                !isSameMonth(day, month) && 'text-muted-foreground opacity-60',
                isToday(day) && !isSelected && 'bg-accent text-accent-foreground',
                isSelected &&
                  'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground',
                dayDisabled && 'text-muted-foreground opacity-50'
              )}
            >
              {format(day, 'd')}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

export { Calendar };
