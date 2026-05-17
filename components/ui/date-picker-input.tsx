'use client';

import { useId } from 'react';
import { format, parseISO, isValid } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface DatePickerInputProps {
  id?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

function formatDisplayValue(value: string): string {
  if (!value) return '';
  const parsed = parseISO(value);
  if (!isValid(parsed)) return value;
  return format(parsed, 'MMM d, yyyy');
}

export function DatePickerInput({
  id: idProp,
  label,
  value,
  onChange,
  required,
  disabled,
  className,
  placeholder = 'Pick a date',
}: DatePickerInputProps) {
  const generatedId = useId();
  const id = idProp ?? generatedId;
  const display = formatDisplayValue(value);

  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <Label htmlFor={id}>
          {label}
          {required && ' *'}
        </Label>
      )}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              'h-9 w-full justify-start px-3 font-normal',
              !value && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 shrink-0 opacity-60" />
            {display || placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="z-[100] w-auto p-3" align="start">
          <Input
            type="date"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full min-w-[220px]"
            required={required}
            disabled={disabled}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
