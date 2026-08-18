'use client';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
import { useFieldContext, useFieldInvalid, type BaseFieldProps } from '@/lib/form-context';

/**
 * Thai user-facing dates use the Buddhist Era (พ.ศ. = Gregorian + 543) while the
 * stored value stays an unambiguous Gregorian Date — 18 ส.ค. 2569 IS
 * 2026-08-18 internally. The conversion is purely presentational here.
 */
const THAI_DATE = new Intl.DateTimeFormat('th-TH', {
  day: 'numeric',
  month: 'short',
  year: 'numeric'
});

function thaiDisplay(date: Date): string {
  return Number.isNaN(date.getTime()) ? '' : THAI_DATE.format(date);
}

function dropdownYearRange(): { start: Date; end: Date } {
  const year = new Date().getFullYear();
  return {
    start: new Date(year - 5, 0, 1),
    end: new Date(year, 11, 31)
  };
}

/** Single date — Popover + Calendar per the shadcn date-picker pattern. */
export function DatePickerField({
  label,
  description,
  required,
  placeholder = 'Pick a date',
  disabledDates
}: BaseFieldProps & {
  placeholder?: string;
  disabledDates?: (date: Date) => boolean;
}) {
  const field = useFieldContext<Date | undefined>();
  const isInvalid = useFieldInvalid();
  const { start, end } = dropdownYearRange();

  return (
    <Field data-invalid={isInvalid}>
      <FieldLabel htmlFor={field.name}>
        {label}
        {required && ' *'}
      </FieldLabel>
      <Popover>
        <PopoverTrigger
          render={
            <Button
              id={field.name}
              variant='outline'
              aria-invalid={isInvalid}
              aria-describedby={isInvalid ? `${field.name}-error` : undefined}
              className={cn(
                'w-full justify-start text-left font-normal',
                !field.state.value && 'text-muted-foreground'
              )}
            />
          }
        >
          <Icons.calendar className='mr-2 h-4 w-4' />
          {field.state.value ? thaiDisplay(field.state.value) : <span>{placeholder}</span>}
        </PopoverTrigger>
        <PopoverContent className='w-auto p-0' align='start'>
          <Calendar
            mode='single'
            selected={field.state.value}
            onSelect={(date) => field.handleChange(date)}
            disabled={disabledDates}
            autoFocus
            // Direct month AND year selection — no stepping month by month.
            captionLayout='dropdown'
            locale={th}
            defaultMonth={field.state.value ?? new Date()}
            startMonth={start}
            endMonth={end}
            formatters={{
              formatMonthDropdown: (date) => format(date, 'LLL', { locale: th }),
              formatYearDropdown: (date) => String(date.getFullYear() + 543)
            }}
          />
        </PopoverContent>
      </Popover>
      {description && <FieldDescription>{description}</FieldDescription>}
      {isInvalid && <FieldError id={`${field.name}-error`} errors={field.state.meta.errors} />}
    </Field>
  );
}

/** Date range — two-month Calendar in range mode. */
export function DateRangeField({
  label,
  description,
  required,
  placeholder = 'Pick a date range'
}: BaseFieldProps & { placeholder?: string }) {
  const field = useFieldContext<DateRange | undefined>();
  const isInvalid = useFieldInvalid();
  const range = field.state.value;
  const { start, end } = dropdownYearRange();

  return (
    <Field data-invalid={isInvalid}>
      <FieldLabel htmlFor={field.name}>
        {label}
        {required && ' *'}
      </FieldLabel>
      <Popover>
        <PopoverTrigger
          render={
            <Button
              id={field.name}
              variant='outline'
              aria-invalid={isInvalid}
              aria-describedby={isInvalid ? `${field.name}-error` : undefined}
              className={cn(
                'w-full justify-start text-left font-normal',
                !range?.from && 'text-muted-foreground'
              )}
            />
          }
        >
          <Icons.calendar className='mr-2 h-4 w-4' />
          {range?.from ? (
            range.to ? (
              <>
                {thaiDisplay(range.from)} - {thaiDisplay(range.to)}
              </>
            ) : (
              thaiDisplay(range.from)
            )
          ) : (
            <span>{placeholder}</span>
          )}
        </PopoverTrigger>
        <PopoverContent className='w-auto p-0' align='start'>
          <Calendar
            mode='range'
            selected={range}
            onSelect={field.handleChange}
            numberOfMonths={2}
            autoFocus
            captionLayout='dropdown'
            locale={th}
            startMonth={start}
            endMonth={end}
            formatters={{
              formatMonthDropdown: (date) => format(date, 'LLL', { locale: th }),
              formatYearDropdown: (date) => String(date.getFullYear() + 543)
            }}
          />
        </PopoverContent>
      </Popover>
      {description && <FieldDescription>{description}</FieldDescription>}
      {isInvalid && <FieldError id={`${field.name}-error`} errors={field.state.meta.errors} />}
    </Field>
  );
}
