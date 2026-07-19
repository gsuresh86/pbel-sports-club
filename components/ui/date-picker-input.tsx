'use client';

import { useId } from 'react';
import { format, parseISO, isValid } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface DatePickerInputProps {
  id?: string;
  label?: string;
  /** ISO date string: yyyy-MM-dd (empty string = no date) */
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  /** Extra classes for the trigger button (e.g. error border, compact sizing) */
  triggerClassName?: string;
  placeholder?: string;
  /** Earliest selectable date, yyyy-MM-dd */
  min?: string;
  /** Latest selectable date, yyyy-MM-dd */
  max?: string;
  /** Fired when the popover closes — useful for marking fields touched */
  onBlur?: () => void;
}

function parseDate(value: string): Date | undefined {
  if (!value) return undefined;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : undefined;
}

export function DatePickerInput({
  id: idProp,
  label,
  value,
  onChange,
  required,
  disabled,
  className,
  triggerClassName,
  placeholder = 'Pick a date',
  min,
  max,
  onBlur,
}: DatePickerInputProps) {
  const generatedId = useId();
  const id = idProp ?? generatedId;
  const selected = parseDate(value);
  const minDate = parseDate(min ?? '');
  const maxDate = parseDate(max ?? '');
  const disabledMatchers = [
    ...(minDate ? [{ before: minDate }] : []),
    ...(maxDate ? [{ after: maxDate }] : []),
  ];

  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <Label htmlFor={id}>
          {label}
          {required && ' *'}
        </Label>
      )}
      <Popover onOpenChange={(open) => !open && onBlur?.()}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              'h-9 w-full justify-start px-3 font-normal',
              !value && 'text-muted-foreground',
              triggerClassName
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 shrink-0 opacity-60" />
            {selected ? format(selected, 'PPP') : placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="z-[100] w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected}
            captionLayout="dropdown"
            disabled={disabledMatchers.length ? disabledMatchers : undefined}
            startMonth={minDate ?? new Date(new Date().getFullYear() - 80, 0)}
            endMonth={maxDate ?? new Date(new Date().getFullYear() + 5, 11)}
            onSelect={(date) => onChange(date ? format(date, 'yyyy-MM-dd') : '')}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

interface DateTimePickerInputProps {
  id?: string;
  label?: string;
  /** ISO datetime string: yyyy-MM-ddTHH:mm (empty string = not set) */
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  placeholder?: string;
}

export function DateTimePickerInput({
  id: idProp,
  label,
  value,
  onChange,
  required,
  disabled,
  className,
  triggerClassName,
  placeholder = 'Pick a date',
}: DateTimePickerInputProps) {
  const generatedId = useId();
  const id = idProp ?? generatedId;
  const datePart = value.slice(0, 10);
  const timePart = value.length >= 16 ? value.slice(11, 16) : '';
  const selected = parseDate(datePart);

  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <Label htmlFor={id}>
          {label}
          {required && ' *'}
        </Label>
      )}
      <div className="flex gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              id={id}
              type="button"
              variant="outline"
              disabled={disabled}
              className={cn(
                'h-9 flex-1 justify-start px-3 font-normal',
                !datePart && 'text-muted-foreground',
                triggerClassName
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4 shrink-0 opacity-60" />
              {selected ? format(selected, 'PPP') : placeholder}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="z-[100] w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selected}
              defaultMonth={selected}
              captionLayout="dropdown"
              onSelect={(date) =>
                onChange(
                  date
                    ? `${format(date, 'yyyy-MM-dd')}T${timePart || '00:00'}`
                    : ''
                )
              }
            />
          </PopoverContent>
        </Popover>
        <Input
          type="time"
          step="60"
          value={timePart}
          disabled={disabled || !datePart}
          required={required}
          onChange={(e) =>
            datePart && onChange(`${datePart}T${e.target.value || '00:00'}`)
          }
          className="h-9 w-[110px] shrink-0"
        />
      </div>
    </div>
  );
}
