'use client';

import * as React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

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
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue
} from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { QUICK_PLACES, type QuickPlace } from '@/features/map/constants';
import type { MapFilters } from '@/features/map/lib/filters';

export type { MapFilters };

export interface MapLayerToggles {
  events: boolean;
  monitoring: boolean;
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
  events: 'เหตุการณ์ที่เชื่อมโยง (ทดลอง)',
  monitoring: 'รัศมีเฝ้าระวัง 2 กม. (ไม่ใช่พื้นที่ระบาดที่ยืนยัน)',
  reports: 'รายงานจากประชาชน (ยืนยันแล้ว)',
  waterways: 'เส้นทางน้ำ',
  heatmap: 'ความหนาแน่นของรายงานจากประชาชน',
  observations: 'สัญญาณดิบจากแหล่งภายนอก (ยังไม่จัดกลุ่ม)'
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
  provinceOptions: string[];
  layers: MapLayerToggles;
  onLayersChange: (layers: MapLayerToggles) => void;
  onNavigate: (place: QuickPlace) => void;
}

function activeFilterCount(filters: MapFilters) {
  return (filters.provinces.length > 0 ? 1 : 0) + (filters.days !== 'all' ? 1 : 0);
}

// 0 selected -> "ทุกจังหวัด"; 1-3 -> the names joined; 4+ -> "N จังหวัด" so the
// trigger never grows to fit an arbitrarily long selection.
function provinceSummaryLabel(selected: string[]): string {
  if (selected.length === 0) return 'ทุกจังหวัด';
  if (selected.length <= 3) return selected.join(', ');
  return `${selected.length} จังหวัด`;
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

function DaysFilter({
  filters,
  onFiltersChange
}: Pick<MapControlsProps, 'filters' | 'onFiltersChange'>) {
  return (
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
  );
}

/** Desktop/tablet: compact trigger + searchable popover, built entirely on
 *  the existing base-ui Combobox (multi-select, filtering, and keyboard nav
 *  all come from the primitive — no hand-rolled listbox logic). */
function ProvinceFilter({
  provinces,
  provinceOptions,
  onChange
}: {
  provinces: string[];
  provinceOptions: string[];
  onChange: (provinces: string[]) => void;
}) {
  return (
    <Combobox items={provinceOptions} multiple value={provinces} onValueChange={onChange}>
      <ComboboxTrigger
        render={
          <Button
            variant='outline'
            aria-label='กรองตามจังหวัด'
            className={cn(
              'h-11 justify-between gap-2 rounded-(--nav-radius) px-3 text-[0.9375rem] md:w-40',
              FLOATING_SURFACE
            )}
          />
        }
      >
        <ComboboxValue placeholder='จังหวัด'>{(value) => provinceSummaryLabel(value)}</ComboboxValue>
      </ComboboxTrigger>
      <ComboboxContent className='w-72'>
        <ComboboxInput placeholder='ค้นหาจังหวัด...' showTrigger={false} showClear />
        <ComboboxEmpty>ไม่พบจังหวัด</ComboboxEmpty>
        <ComboboxList>
          {(province: string) => (
            <ComboboxItem key={province} value={province}>
              {province}
            </ComboboxItem>
          )}
        </ComboboxList>
        <div className='flex items-center justify-between gap-2 border-t border-border p-1'>
          <Button
            variant='ghost'
            size='sm'
            className='h-8 px-2 text-[0.8125rem]'
            onClick={() => onChange(provinceOptions)}
          >
            เลือกทั้งหมด
          </Button>
          <Button
            variant='ghost'
            size='sm'
            className='h-8 px-2 text-[0.8125rem]'
            onClick={() => onChange([])}
          >
            ล้าง
          </Button>
        </div>
      </ComboboxContent>
    </Combobox>
  );
}

/** Mobile: no popover-in-sheet nesting — a plain search input plus the same
 *  44px Checkbox/Label row pattern LayerToggles already uses, scrollable
 *  independently of the sheet body so search + select-all/clear stay put. */
function ProvinceChecklist({
  provinces,
  provinceOptions,
  onChange
}: {
  provinces: string[];
  provinceOptions: string[];
  onChange: (provinces: string[]) => void;
}) {
  const [query, setQuery] = React.useState('');
  const filtered = React.useMemo(
    () => provinceOptions.filter((province) => province.includes(query.trim())),
    [provinceOptions, query]
  );

  function toggle(province: string, checked: boolean) {
    onChange(checked ? [...provinces, province] : provinces.filter((p) => p !== province));
  }

  return (
    <div className='flex flex-col gap-2'>
      <div className='flex items-center justify-between gap-2'>
        <p className='text-muted-foreground text-[0.8125rem]'>
          {provinces.length === 0 ? 'ทุกจังหวัด' : `เลือกแล้ว ${provinces.length} จังหวัด`}
        </p>
        <div className='flex gap-1'>
          <Button
            variant='ghost'
            size='sm'
            className='h-8 px-2 text-[0.8125rem]'
            onClick={() => onChange(provinceOptions)}
          >
            เลือกทั้งหมด
          </Button>
          <Button
            variant='ghost'
            size='sm'
            className='h-8 px-2 text-[0.8125rem]'
            onClick={() => onChange([])}
          >
            ล้าง
          </Button>
        </div>
      </div>
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder='ค้นหาจังหวัด...'
        aria-label='ค้นหาจังหวัด'
      />
      <div className='max-h-56 overflow-y-auto overscroll-contain rounded-(--nav-radius) border border-border'>
        {filtered.length === 0 ? (
          <p className='text-muted-foreground p-3 text-[0.8125rem]'>ไม่พบจังหวัด</p>
        ) : (
          filtered.map((province) => (
            <Label
              key={province}
              htmlFor={`province-${province}`}
              className='hover:bg-accent/60 flex min-h-11 cursor-pointer items-center gap-3 px-2 text-[0.9375rem] leading-snug font-normal transition-colors'
            >
              <Checkbox
                id={`province-${province}`}
                checked={provinces.includes(province)}
                onCheckedChange={(checked) => toggle(province, checked === true)}
              />
              {province}
            </Label>
          ))
        )}
      </div>
    </div>
  );
}

export function MapControls({
  filters,
  onFiltersChange,
  provinceOptions,
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
            <div className='flex max-h-[70vh] flex-col gap-6 overflow-y-auto overscroll-contain px-4 pb-6'>
              <div>
                <p className='text-muted-foreground mb-1 text-[0.8125rem]'>จังหวัด</p>
                <ProvinceChecklist
                  provinces={filters.provinces}
                  provinceOptions={provinceOptions}
                  onChange={(provinces) => onFiltersChange({ ...filters, provinces })}
                />
              </div>
              <div>
                <p className='text-muted-foreground mb-1 text-[0.8125rem]'>ช่วงเวลา</p>
                <DaysFilter filters={filters} onFiltersChange={onFiltersChange} />
              </div>
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

        <div className='flex items-center gap-2'>
          <ProvinceFilter
            provinces={filters.provinces}
            provinceOptions={provinceOptions}
            onChange={(provinces) => onFiltersChange({ ...filters, provinces })}
          />
          <DaysFilter filters={filters} onFiltersChange={onFiltersChange} />
        </div>

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
 * Legend. A single icon button at every breakpoint — collapsed by default on
 * mobile (390px has no room to spare) and expanded by default from md up,
 * decided after mount so the first client render still matches the server's
 * mobile-closed markup (same pattern as Reveal). Always collapsible: on a
 * desktop the panel used to be permanently open with no way to put it away,
 * which is what read as clunky — now it opens/closes with the same restrained
 * opacity + rise used by PriorityPanel/EventPanel elsewhere on this map.
 */
export function MapLegend({
  reportCount,
  eventCount,
  eventsTotal,
  eventsVisible,
  monitoringVisible,
  observationCount,
  observationsVisible
}: {
  reportCount: number;
  eventCount: number;
  eventsTotal: number;
  eventsVisible: boolean;
  monitoringVisible: boolean;
  observationCount: number;
  observationsVisible: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const reduceMotion = useReducedMotion();
  const eventsWithoutCoordinate = eventsTotal - eventCount;
  const visibleMarkerCount =
    reportCount + (eventsVisible ? eventCount : 0) + (observationsVisible ? observationCount : 0);

  React.useEffect(() => {
    const mql = window.matchMedia('(min-width: 768px)');
    setOpen(mql.matches);
  }, []);

  return (
    <div className='absolute bottom-3 start-3 z-10 md:bottom-4 md:start-4'>
      <Button
        variant='outline'
        size='icon'
        aria-label={open ? 'ซ่อนคำอธิบายสัญลักษณ์' : 'แสดงคำอธิบายสัญลักษณ์'}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={cn('relative size-11 rounded-(--nav-radius)', FLOATING_SURFACE)}
      >
        {open ? <Icons.close /> : <Icons.info />}
        {!open && visibleMarkerCount > 0 && (
          <span className='bg-primary text-primary-foreground absolute -end-1.5 -top-1.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full px-1 text-[0.625rem] font-semibold tabular-nums'>
            {visibleMarkerCount}
          </span>
        )}
      </Button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
            style={{ transformOrigin: 'bottom left' }}
            className={cn('absolute bottom-13 start-0 w-64 rounded-xl p-3', FLOATING_SURFACE)}
          >
            <p className='mb-2 text-[0.8125rem] font-semibold'>คำอธิบายสัญลักษณ์</p>
            <ul className='space-y-2 text-[0.8125rem]'>
              <li className='flex items-center gap-2.5'>
                <span className='bg-primary size-3 shrink-0 rounded-full ring-2 ring-white' />
                รายงานจากประชาชน — ตำแหน่งแน่นอน
              </li>
              <li className='flex items-center gap-2.5'>
                <span className='bg-primary/40 size-4 shrink-0 rounded-full' />
                รายงานจากประชาชน — ตำแหน่งโดยประมาณ (ทราบเพียงแหล่งน้ำ/ตำบล/อำเภอ/จังหวัด)
              </li>
              <li className='flex items-center gap-2.5'>
                <span className='bg-primary ring-primary/40 size-3 shrink-0 rounded-full ring-4' />
                กลุ่มรายงาน / รายงานที่เลือก
              </li>
              <li className='flex items-center gap-2.5'>
                <span
                  className='size-0 shrink-0 border-x-[5px] border-b-[9px] border-x-transparent border-b-destructive'
                  aria-hidden
                />
                เหตุการณ์ที่เชื่อมโยง — สีแสดงลำดับความสำคัญ (แดง สูง · เหลือง ปานกลาง · เทา ต่ำ)
              </li>
              {monitoringVisible && (
                <li className='flex items-start gap-2.5'>
                  <span className='bg-destructive/20 border-destructive/50 mt-0.5 size-3 shrink-0 rounded-full border' />
                  <span>
                    รัศมีเฝ้าระวัง 2 กม. รอบเหตุการณ์ที่มีพิกัดแน่นอน — เป็นพื้นที่แนะนำให้ตรวจสอบ
                    ไม่ใช่หลักฐานการแพร่ระบาดที่ยืนยันแล้ว
                  </span>
                </li>
              )}
              <li className='flex items-center gap-2.5'>
                <span className='bg-primary h-0.5 w-4 shrink-0 rounded' />
                เส้นทางน้ำจากข้อมูลแผนที่
              </li>
              {observationsVisible && (
                <li className='flex items-center gap-2.5'>
                  <span className='bg-brand size-2.5 shrink-0 rotate-45 rounded-[2px] ring-2 ring-white' />
                  สัญญาณดิบจากแหล่งภายนอก (ยังไม่จัดกลุ่มเป็นเหตุการณ์)
                </li>
              )}
            </ul>
            <div className='text-muted-foreground border-border mt-3 space-y-0.5 border-t pt-2 text-[0.8125rem] tabular-nums'>
              <p>แสดง {reportCount} รายงานจากประชาชน</p>
              {eventsVisible && (
                <p>
                  + {eventCount} เหตุการณ์ที่มีพิกัดแน่นอน จาก {eventsTotal} เหตุการณ์ทั้งหมด
                  {eventsWithoutCoordinate > 0 &&
                    ` (อีก ${eventsWithoutCoordinate} รายการดูได้ที่ "อันดับพื้นที่")`}
                </p>
              )}
              {observationsVisible && (
                <p>+ {observationCount} สัญญาณดิบจากแหล่งภายนอก (เฉพาะจุดที่มีพิกัด)</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
