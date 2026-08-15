'use client';

import * as React from 'react';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { REPORT_PROVINCES } from '@/features/reports/api/types';
import { QUICK_PLACES, type QuickPlace } from '@/features/map/constants';

export interface MapFilters {
  province: string;
  days: string;
}

export interface MapLayerToggles {
  reports: boolean;
  waterways: boolean;
  heatmap: boolean;
  observations: boolean;
}

export const DAY_RANGES = [
  { value: 'all', label: 'ทุกช่วงเวลา' },
  { value: '7', label: '7 วันล่าสุด' },
  { value: '30', label: '30 วันล่าสุด' },
  { value: '90', label: '90 วันล่าสุด' },
  { value: '365', label: '1 ปีล่าสุด' }
];

const LAYER_LABELS: Record<keyof MapLayerToggles, string> = {
  reports: 'รายงานที่ยืนยันแล้ว',
  waterways: 'เส้นทางน้ำ',
  heatmap: 'ความหนาแน่นของรายงานที่ยืนยันแล้ว',
  observations: 'ข้อมูลจากแหล่งภายนอก'
};

/** Shared surface for anything floating over the map: one border, one soft
 *  shadow, no glass stack. Keeps controls legible against both land and water.
 *
 *  `dark:bg-background` is not redundant. Both the outline Button variant and
 *  SelectTrigger ship `dark:bg-input/30`, and a dark: variant outranks a plain
 *  utility — so in dark mode these rendered at 30% opacity and map labels read
 *  straight through them. The explicit dark variant is what makes them opaque. */
const FLOATING_SURFACE = 'border border-border bg-background shadow-sm dark:bg-background';

interface MapControlsProps {
  filters: MapFilters;
  onFiltersChange: (filters: MapFilters) => void;
  layers: MapLayerToggles;
  onLayersChange: (layers: MapLayerToggles) => void;
  onNavigate: (place: QuickPlace) => void;
}

function activeFilterCount(filters: MapFilters) {
  return (filters.province !== 'all' ? 1 : 0) + (filters.days !== 'all' ? 1 : 0);
}

function PlaceList({ onNavigate }: { onNavigate: (place: QuickPlace) => void }) {
  return (
    <div className='flex flex-col'>
      <p className='text-muted-foreground px-2 pt-1 pb-2 text-[0.8125rem]'>
        พื้นที่เฝ้าระวังในภาคตะวันออก
      </p>
      {QUICK_PLACES.map((place) => (
        <Button
          key={place.name}
          variant='ghost'
          className='h-11 w-full justify-start gap-3 px-2 text-[0.9375rem] font-normal'
          onClick={() => onNavigate(place)}
        >
          <Icons.mapPin className='text-muted-foreground' />
          {place.name}
        </Button>
      ))}
    </div>
  );
}

function LayerToggles({
  layers,
  onLayersChange
}: Pick<MapControlsProps, 'layers' | 'onLayersChange'>) {
  return (
    <div className='flex flex-col'>
      {(Object.keys(LAYER_LABELS) as (keyof MapLayerToggles)[]).map((key) => (
        <Label
          key={key}
          htmlFor={`layer-${key}`}
          // The whole 44px row is the hit target, not just the 16px box.
          className='hover:bg-accent/60 flex min-h-11 cursor-pointer items-center gap-3 rounded-(--nav-radius) px-2 text-[0.9375rem] leading-snug font-normal transition-colors'
        >
          <Checkbox
            id={`layer-${key}`}
            checked={layers[key]}
            onCheckedChange={(checked) => onLayersChange({ ...layers, [key]: checked === true })}
          />
          {LAYER_LABELS[key]}
        </Label>
      ))}
    </div>
  );
}

function FilterFields({
  filters,
  onFiltersChange,
  className
}: Pick<MapControlsProps, 'filters' | 'onFiltersChange'> & { className?: string }) {
  return (
    <div className={className}>
      <Select
        value={filters.province}
        onValueChange={(value) => onFiltersChange({ ...filters, province: String(value) })}
      >
        {/* The trigger needs the floating surface itself: the base Select
            trigger is bg-transparent, so over the map it rendered as a hole —
            place names and road shields read straight through it. */}
        <SelectTrigger
          aria-label='กรองตามจังหวัด'
          className={cn(
            'h-11 w-full rounded-(--nav-radius) text-[0.9375rem] md:w-40',
            FLOATING_SURFACE
          )}
        >
          {/* Base UI renders the raw value unless given a mapping function, so
              this showed "all" instead of "ทุกจังหวัด". */}
          <SelectValue placeholder='จังหวัด'>
            {(value) => (value === 'all' ? 'ทุกจังหวัด' : String(value))}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value='all'>ทุกจังหวัด</SelectItem>
          {REPORT_PROVINCES.map((province) => (
            <SelectItem key={province} value={province}>
              {province}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.days}
        onValueChange={(value) => onFiltersChange({ ...filters, days: String(value) })}
      >
        <SelectTrigger
          aria-label='กรองตามช่วงเวลา'
          className={cn(
            'h-11 w-full rounded-(--nav-radius) text-[0.9375rem] md:w-40',
            FLOATING_SURFACE
          )}
        >
          <SelectValue placeholder='ช่วงเวลา'>
            {(value) => DAY_RANGES.find((r) => r.value === value)?.label ?? String(value)}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {DAY_RANGES.map((range) => (
            <SelectItem key={range.value} value={range.value}>
              {range.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function MapControls({
  filters,
  onFiltersChange,
  layers,
  onLayersChange,
  onNavigate
}: MapControlsProps) {
  const filterCount = activeFilterCount(filters);

  return (
    <div className='pointer-events-none absolute inset-x-0 top-0 z-10 p-3 md:p-4'>
      {/* ── Mobile: three 44px icon buttons. The map stays the surface;
             filters and layers open in sheets rather than eating the viewport. */}
      <div className='pointer-events-auto flex items-center gap-2 md:hidden'>
        <Sheet>
          <SheetTrigger
            render={
              <Button
                variant='outline'
                size='icon'
                aria-label='ค้นหาพื้นที่'
                className={cn('size-11 rounded-(--nav-radius)', FLOATING_SURFACE)}
              />
            }
          >
            <Icons.search />
          </SheetTrigger>
          <SheetContent side='bottom' className='rounded-t-2xl'>
            <SheetHeader className='pb-0'>
              <SheetTitle className='text-lg'>ค้นหาพื้นที่</SheetTitle>
            </SheetHeader>
            <div className='px-4 pb-6'>
              <PlaceList onNavigate={onNavigate} />
            </div>
          </SheetContent>
        </Sheet>

        <Sheet>
          <SheetTrigger
            render={
              <Button
                variant='outline'
                aria-label={filterCount > 0 ? `ตัวกรอง (ใช้อยู่ ${filterCount})` : 'ตัวกรอง'}
                className={cn(
                  'h-11 gap-2 rounded-(--nav-radius) px-3 text-[0.9375rem]',
                  FLOATING_SURFACE
                )}
              />
            }
          >
            <Icons.adjustments />
            ตัวกรอง
            {filterCount > 0 && (
              <span className='bg-primary text-primary-foreground flex size-5 items-center justify-center rounded-full text-[0.6875rem] font-semibold tabular-nums'>
                {filterCount}
              </span>
            )}
          </SheetTrigger>
          <SheetContent side='bottom' className='rounded-t-2xl'>
            <SheetHeader className='pb-0'>
              <SheetTitle className='text-lg'>ตัวกรองและเลเยอร์</SheetTitle>
            </SheetHeader>
            <div className='flex flex-col gap-6 px-4 pb-6'>
              <FilterFields
                filters={filters}
                onFiltersChange={onFiltersChange}
                className='flex flex-col gap-3'
              />
              <div>
                <p className='text-muted-foreground mb-1 text-[0.8125rem]'>เลเยอร์</p>
                <LayerToggles layers={layers} onLayersChange={onLayersChange} />
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* ── Desktop / tablet: one grouped control bar, left-aligned so it never
             covers the map's centre of interest. */}
      <div className='pointer-events-auto hidden items-center gap-2 md:flex'>
        <Popover>
          <Tooltip>
            <TooltipTrigger
              render={
                <PopoverTrigger
                  render={
                    <Button
                      variant='outline'
                      aria-label='ค้นหาจังหวัด อำเภอ หรือพื้นที่'
                      className={cn(
                        'h-11 gap-2 rounded-(--nav-radius) px-3 text-[0.9375rem]',
                        FLOATING_SURFACE
                      )}
                    />
                  }
                />
              }
            >
              <Icons.search />
              <span className='hidden lg:inline'>ค้นหาพื้นที่</span>
            </TooltipTrigger>
            <TooltipContent side='bottom'>ค้นหาจังหวัด อำเภอ หรือพื้นที่</TooltipContent>
          </Tooltip>
          <PopoverContent align='start' className='w-64 p-1'>
            <PlaceList onNavigate={onNavigate} />
          </PopoverContent>
        </Popover>

        <FilterFields
          filters={filters}
          onFiltersChange={onFiltersChange}
          className='flex items-center gap-2'
        />

        <Popover>
          <Tooltip>
            <TooltipTrigger
              render={
                <PopoverTrigger
                  render={
                    <Button
                      variant='outline'
                      aria-label='เลเยอร์แผนที่'
                      className={cn(
                        'h-11 gap-2 rounded-(--nav-radius) px-3 text-[0.9375rem]',
                        FLOATING_SURFACE
                      )}
                    />
                  }
                />
              }
            >
              <Icons.layers />
              <span className='hidden lg:inline'>เลเยอร์</span>
            </TooltipTrigger>
            <TooltipContent side='bottom'>เลเยอร์แผนที่</TooltipContent>
          </Tooltip>
          <PopoverContent align='start' className='w-72 p-1'>
            <LayerToggles layers={layers} onLayersChange={onLayersChange} />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

/**
 * Legend. Collapsed to a single icon button on mobile so it never competes with
 * the map on a 390px screen; open by default from md up where there is room.
 */
export function MapLegend({ count }: { count: number }) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Button
        variant='outline'
        size='icon'
        aria-label={open ? 'ซ่อนคำอธิบายสัญลักษณ์' : 'แสดงคำอธิบายสัญลักษณ์'}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'absolute bottom-3 start-3 z-10 size-11 rounded-(--nav-radius) md:hidden',
          FLOATING_SURFACE
        )}
      >
        {open ? <Icons.close /> : <Icons.info />}
      </Button>

      <div
        className={cn(
          'absolute bottom-3 start-3 z-10 w-60 rounded-xl p-3 md:bottom-4 md:start-4 md:block',
          FLOATING_SURFACE,
          open ? 'block' : 'hidden'
        )}
      >
        <p className='mb-2 text-[0.8125rem] font-semibold'>คำอธิบายสัญลักษณ์</p>
        <ul className='space-y-2 text-[0.8125rem]'>
          <li className='flex items-center gap-2.5'>
            <span className='bg-primary size-3 shrink-0 rounded-full ring-2 ring-white' />
            รายงานที่ยืนยันแล้ว
          </li>
          <li className='flex items-center gap-2.5'>
            <span className='bg-primary ring-primary/40 size-3 shrink-0 rounded-full ring-4' />
            กลุ่มรายงาน / รายงานที่เลือก
          </li>
          <li className='flex items-center gap-2.5'>
            <span className='bg-primary h-0.5 w-4 shrink-0 rounded' />
            เส้นทางน้ำจากข้อมูลแผนที่
          </li>
          <li className='flex items-center gap-2.5'>
            <span className='bg-brand size-2.5 shrink-0 rotate-45 rounded-[2px] ring-2 ring-white' />
            ข้อมูลจากแหล่งภายนอก
          </li>
        </ul>
        <p className='text-muted-foreground border-border mt-3 border-t pt-2 text-[0.8125rem] tabular-nums'>
          แสดง {count} รายงาน
        </p>
      </div>
    </>
  );
}
