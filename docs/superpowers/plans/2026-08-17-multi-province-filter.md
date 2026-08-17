# Multi-Province Map Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the map's single-province `<Select>` filter with a multi-province multi-select, so users can filter the map to any combination of provinces at once, and every dataset the map renders (citizen reports, operational events/priority panel, external observations, heatmap, 2km monitoring) stays in sync through the one existing `matchesMapFilters()` chokepoint.

**Architecture:** `MapFilters.province: string` (`'all'` sentinel) becomes `provinces: string[]` (`[]` = all, no ambiguous mixed states). `matchesMapFilters()` switches to an array-membership check. No backend/API changes — every dataset is already fetched in full and filtered client-side through this one function, so changing its signature and the state shape that feeds it is sufficient to propagate the change everywhere. The desktop control reuses `src/components/ui/combobox.tsx` (an already-installed, already-scaffolded, currently-unused base-ui Combobox with built-in multi-select, search-filtering, and keyboard nav) in `multiple` mode. The mobile control reuses the existing `Checkbox`/`Label` row pattern already used for layer toggles, inside the existing bottom Sheet — no popover-in-sheet nesting.

**Tech Stack:** Next.js 16, React, TypeScript, `@base-ui/react` (combobox, checkbox, sheet primitives), Tailwind, Playwright.

## Global Constraints

- Thai is the UI language; comments and identifiers stay English.
- Formatting: single quotes, JSX single quotes, no trailing comma, 2-space indent.
- Icons only from `@/components/icons`, never `@tabler/icons-react` directly (existing shadcn primitive files already import from `@tabler/icons-react` internally — that's pre-existing and out of scope; don't add new direct `@tabler/icons-react` imports in feature code).
- No fake data — provinces come from `provinceOptions`, computed live from real fetched data plus `REPORT_PROVINCES`; never hardcode a province list.
- `province: []` must mean "all provinces" — never introduce an ambiguous state like `['all', 'ชลบุรี']`.
- Keep the citizen-report-submission province enum (`REPORT_PROVINCES`, EEC-only) and the map's nationwide `provinceOptions` conceptually separate — this plan touches only the map filter, never `REPORT_PROVINCES` or the report submission form.
- No new dependencies — this repo has no unit-test runner configured (only Playwright `e2e/` + `tsc --noEmit` + `oxlint`); don't add one for this change. Verification for the pure filter logic is `npm run typecheck` plus the Playwright coverage in Task 2, matching how every other frontend filtering behavior in this repo is verified (there are zero existing `.test.ts` files under `src/`).

---

### Task 1: Multi-province filter — type, logic, and both UI surfaces

**Files:**
- Modify: `src/features/map/lib/filters.ts` (whole file, 25 lines)
- Modify: `src/features/map/components/map-view.tsx:95` (initial filter state)
- Modify: `src/features/map/components/map-controls.tsx` (imports, `activeFilterCount`, replace `FilterFields` with `DaysFilter` + `ProvinceFilter` + `ProvinceChecklist`, wire both into `MapControls`)

**Interfaces:**
- Consumes: existing `Combobox`/`ComboboxTrigger`/`ComboboxValue`/`ComboboxContent`/`ComboboxInput`/`ComboboxEmpty`/`ComboboxList`/`ComboboxItem` from `@/components/ui/combobox` (already built, unused elsewhere); `Input` from `@/components/ui/input`; `Checkbox`/`Label`/`Button` (already imported in this file).
- Produces: `MapFilters { provinces: string[]; days: string }` — the new shape every downstream consumer (`map-view.tsx`'s `filterReports`/`filterEventAreas`/`filterObservations`, all calling `matchesMapFilters`) relies on unchanged in signature (still `matchesMapFilters(filters, province, timestamp): boolean`), only the internal shape of `filters.provinces` is new.

This is one task because all three files must change together for the app to type-check — `map-controls.tsx` and `map-view.tsx` both reference the `MapFilters` shape directly, so there's no compiling intermediate state between them.

- [ ] **Step 1: Rewrite `src/features/map/lib/filters.ts`**

```ts
export interface MapFilters {
  provinces: string[];
  days: string;
}

/**
 * One authoritative province+time check, shared by every map dataset
 * (reports, events, observations, priority panel) so a filter can never
 * apply to one layer while silently missing another.
 *
 * `provinces: []` means "all provinces" — never introduce a mixed state
 * like `['all', 'ชลบุรี']`.
 *
 * A dataset with no timestamp is excluded once a time filter is active —
 * there is no honest way to say it falls inside a range we can't read.
 */
export function matchesMapFilters(
  filters: MapFilters,
  province: string | null,
  timestamp: string | null
): boolean {
  if (filters.provinces.length > 0 && (!province || !filters.provinces.includes(province))) {
    return false;
  }
  if (filters.days === 'all') return true;
  if (!timestamp) return false;
  const cutoff = Date.now() - Number(filters.days) * 24 * 60 * 60 * 1000;
  return new Date(timestamp).getTime() >= cutoff;
}
```

- [ ] **Step 2: Update the initial filter state in `map-view.tsx`**

In `src/features/map/components/map-view.tsx`, find:

```ts
  const [filters, setFilters] = React.useState<MapFilters>({ province: 'all', days: 'all' });
```

Replace with:

```ts
  const [filters, setFilters] = React.useState<MapFilters>({ provinces: [], days: 'all' });
```

No other line in `map-view.tsx` touches `filters.province` directly — `filterReports`, `filterEventAreas`, and `filterObservations` all go through `matchesMapFilters(filters, ...)`, which already changed in Step 1.

- [ ] **Step 3: Run typecheck to confirm the break surfaces only in `map-controls.tsx`**

Run: `npm run typecheck`
Expected: FAIL, errors only in `src/features/map/components/map-controls.tsx` (its `activeFilterCount` and `FilterFields` still reference `filters.province` as a string and pass `provinceOptions` to a `<Select>`).

- [ ] **Step 4: Update imports in `map-controls.tsx`**

Add to the import block (after the existing `Popover`/`Select`/`Sheet` imports, before the `Tooltip` import):

```ts
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
```

Leave every other existing import as-is — `Select`/`SelectContent`/`SelectItem`/`SelectTrigger`/`SelectValue` are still used by the days filter.

- [ ] **Step 5: Replace `activeFilterCount` and add `provinceSummaryLabel`**

Find:

```ts
function activeFilterCount(filters: MapFilters) {
  return (filters.province !== 'all' ? 1 : 0) + (filters.days !== 'all' ? 1 : 0);
}
```

Replace with:

```ts
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
```

- [ ] **Step 6: Replace `FilterFields` with `DaysFilter`, `ProvinceFilter`, and `ProvinceChecklist`**

Find the entire `FilterFields` function (from `function FilterFields({` through its closing `}` — the block that renders the province `<Select>` and the days `<Select>` side by side) and replace it with:

```tsx
function DaysFilter({ filters, onFiltersChange }: Pick<MapControlsProps, 'filters' | 'onFiltersChange'>) {
  return (
    <Select
      value={filters.days}
      onValueChange={(value) => onFiltersChange({ ...filters, days: String(value) })}
    >
      <SelectTrigger
        aria-label='กรองตามช่วงเวลา'
        className={cn('h-11 w-full rounded-(--nav-radius) text-[0.9375rem] md:w-40', FLOATING_SURFACE)}
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
          {(province: string) => <ComboboxItem key={province} value={province}>{province}</ComboboxItem>}
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
          <Button variant='ghost' size='sm' className='h-8 px-2 text-[0.8125rem]' onClick={() => onChange([])}>
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
          <Button variant='ghost' size='sm' className='h-8 px-2 text-[0.8125rem]' onClick={() => onChange([])}>
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
```

- [ ] **Step 7: Wire the new components into `MapControls` — mobile sheet**

Find, inside the mobile `<Sheet>` for filters (the one titled `ตัวกรองและเลเยอร์`):

```tsx
          <SheetContent side='bottom' className='rounded-t-2xl'>
            <SheetHeader className='pb-0'>
              <SheetTitle className='text-lg'>ตัวกรองและเลเยอร์</SheetTitle>
            </SheetHeader>
            <div className='flex flex-col gap-6 px-4 pb-6'>
              <FilterFields
                filters={filters}
                onFiltersChange={onFiltersChange}
                provinceOptions={provinceOptions}
                className='flex flex-col gap-3'
              />
              <div>
                <p className='text-muted-foreground mb-1 text-[0.8125rem]'>เลเยอร์</p>
                <LayerToggles layers={layers} onLayersChange={onLayersChange} />
              </div>
            </div>
          </SheetContent>
```

Replace with:

```tsx
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
```

- [ ] **Step 8: Wire the new components into `MapControls` — desktop bar**

Find:

```tsx
        <FilterFields
          filters={filters}
          onFiltersChange={onFiltersChange}
          provinceOptions={provinceOptions}
          className='flex items-center gap-2'
        />
```

Replace with:

```tsx
        <div className='flex items-center gap-2'>
          <ProvinceFilter
            provinces={filters.provinces}
            provinceOptions={provinceOptions}
            onChange={(provinces) => onFiltersChange({ ...filters, provinces })}
          />
          <DaysFilter filters={filters} onFiltersChange={onFiltersChange} />
        </div>
```

- [ ] **Step 9: Run typecheck and lint**

Run: `npm run typecheck`
Expected: PASS, no errors.

Run: `npm run lint`
Expected: PASS, no errors (fix any formatting oxlint flags — quotes/indent per Global Constraints — before moving on).

- [ ] **Step 10: Manual smoke check**

Run: `npm run dev`, open `/map`, and confirm at both a desktop width (≥768px) and a mobile width (<768px):
- The province control's trigger reads "ทุกจังหวัด" with nothing selected.
- Opening it shows a search box and every province from `provinceOptions` (not just the 3 EEC ones).
- Typing `สมุทร` narrows the list to matching provinces.
- Selecting ชลบุรี narrows the citizen-report count in the legend; selecting ระยอง too shows the union (count goes up, not down further); removing ระยอง drops back to ชลบุรี-only; "ล้าง" restores the original unfiltered count.
- The trigger label updates: 1 selected shows the name, 2–3 shows them joined with commas, 4+ shows "N จังหวัด".
- On mobile, the bottom sheet still scrolls the whole filter/layers sheet, and the province checklist's own list scrolls independently without trapping the page.

Stop the dev server when done.

- [ ] **Step 11: Commit**

```bash
git add src/features/map/lib/filters.ts src/features/map/components/map-view.tsx src/features/map/components/map-controls.tsx
git commit -m "feat(map): support multi-province intelligence filtering"
```

---

### Task 2: Update Playwright coverage for multi-province selection

**Files:**
- Modify: `e2e/map.spec.ts:236-317` (the `/map — province filter` describe block)

**Interfaces:**
- Consumes: the UI built in Task 1 — trigger `aria-label="กรองตามจังหวัด"` (desktop `ProvinceFilter` / mobile filter sheet still reachable via the `ตัวกรอง` button), `role="option"` items inside the popup (base-ui `ComboboxItem` renders `role="option"`, confirmed against `node_modules/@base-ui/react/combobox/item/ComboboxItem.js:125`), and the mobile checklist's checkbox rows (`role="checkbox"`, name = province text, via `Checkbox`).
- Produces: nothing consumed by later tasks — this is the last task in this plan.

The three existing tests in this describe block assert the old single-select `<Select>` semantics (clicking an option auto-closes the dropdown, `role="option"` values include `'ทุกจังหวัด'` as a real selectable clear-all option). Multi-select changes this: selecting an option does **not** close the popup (so more can be picked), and there is no `'ทุกจังหวัด'` option — clearing is a separate "ล้าง" button.

- [ ] **Step 1: Replace the `/map — province filter` describe block**

Find the entire block from `test.describe('/map — province filter', () => {` through its matching closing `});` (currently lines 236-317) and replace it with:

```ts
test.describe('/map — province filter', () => {
  test('the province list is not hardcoded to only the three EEC provinces', async ({ page }) => {
    await page.goto('/map');
    await waitForMapReady(page);

    const isMobile = (page.viewportSize()?.width ?? 1280) < 768;
    if (isMobile) {
      await page.getByRole('button', { name: 'ตัวกรอง' }).click();
    } else {
      await page.getByRole('button', { name: 'กรองตามจังหวัด' }).click();
    }

    // Regression: this list used to reuse REPORT_PROVINCES (the citizen
    // report submission enum, correctly EEC-only), which silently hid any
    // event/observation province the nationwide ingestion pipeline produces.
    const options = isMobile
      ? page.getByRole('checkbox').and(page.locator('[id^="province-"]'))
      : page.getByRole('option');
    const optionCount = await options.count();
    expect(optionCount).toBeGreaterThanOrEqual(3);
    for (const province of ['ฉะเชิงเทรา', 'ชลบุรี', 'ระยอง']) {
      if (isMobile) {
        await expect(page.getByRole('checkbox', { name: province })).toBeVisible();
      } else {
        await expect(page.getByRole('option', { name: province })).toBeVisible();
      }
    }
    if (!isMobile) await page.keyboard.press('Escape');
  });

  test('selecting provinces filters citizen reports with union semantics, and clearing restores them', async ({
    page
  }) => {
    await page.goto('/map');
    await waitForMapReady(page);

    const isMobile = (page.viewportSize()?.width ?? 1280) < 768;
    if (isMobile) {
      await page.getByRole('button', { name: 'แสดงคำอธิบายสัญลักษณ์' }).click();
    }

    const reportLine = page.getByText(/^แสดง \d+ รายงานจากประชาชน$/);
    await expect(reportLine).toBeVisible();
    const initialCount = Number((await reportLine.textContent())?.match(/\d+/)?.[0]);

    async function openProvincePicker() {
      if (isMobile) {
        await page.getByRole('button', { name: 'ตัวกรอง' }).click();
      } else {
        await page.getByRole('button', { name: 'กรองตามจังหวัด' }).click();
      }
    }
    async function selectProvince(name: string) {
      if (isMobile) {
        await page.getByRole('checkbox', { name }).click();
      } else {
        await page.getByRole('option', { name }).click();
      }
    }
    async function closePicker() {
      await page.keyboard.press('Escape');
    }

    // Select Chonburi.
    await openProvincePicker();
    await selectProvince('ชลบุรี');
    await closePicker();
    const chonburiOnlyCount = Number((await reportLine.textContent())?.match(/\d+/)?.[0]);
    expect(chonburiOnlyCount).toBeLessThanOrEqual(initialCount);

    // Add Rayong — union, count can only grow or stay the same.
    await openProvincePicker();
    await selectProvince('ระยอง');
    await closePicker();
    const unionCount = Number((await reportLine.textContent())?.match(/\d+/)?.[0]);
    expect(unionCount).toBeGreaterThanOrEqual(chonburiOnlyCount);
    expect(unionCount).toBeLessThanOrEqual(initialCount);

    // Remove Rayong — back to Chonburi-only.
    await openProvincePicker();
    await selectProvince('ระยอง');
    await closePicker();
    const backToChonburiOnly = Number((await reportLine.textContent())?.match(/\d+/)?.[0]);
    expect(backToChonburiOnly).toBe(chonburiOnlyCount);

    // Clear — full count returns.
    await openProvincePicker();
    if (isMobile) {
      await page.getByRole('button', { name: 'ล้าง' }).click();
    } else {
      await page.getByRole('button', { name: 'ล้าง' }).click();
    }
    await closePicker();
    await expect(reportLine).toHaveText(`แสดง ${initialCount} รายงานจากประชาชน`);
  });

  test('province filter also narrows the priority panel, not just citizen reports', async ({ page }) => {
    await page.goto('/map');
    await waitForMapReady(page);

    await page.getByRole('button', { name: /อันดับพื้นที่/ }).click();
    const dialog = page.getByRole('dialog', { name: /อันดับพื้นที่/ });
    await expect(dialog).toBeVisible();
    const initialCount = await dialog.locator('li').count();
    await page.getByRole('button', { name: 'ปิด', exact: true }).click();

    const isMobile = (page.viewportSize()?.width ?? 1280) < 768;
    if (isMobile) {
      await page.getByRole('button', { name: 'ตัวกรอง' }).click();
      await page.getByRole('checkbox', { name: 'ชลบุรี' }).click();
    } else {
      await page.getByRole('button', { name: 'กรองตามจังหวัด' }).click();
      await page.getByRole('option', { name: 'ชลบุรี' }).click();
    }
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: /อันดับพื้นที่/ }).click();
    await expect(dialog).toBeVisible();
    const filteredCount = await dialog.locator('li').count();
    expect(filteredCount).toBeLessThanOrEqual(initialCount);
  });
});
```

- [ ] **Step 2: Run the map e2e suite**

Run: `npx playwright test e2e/map.spec.ts`
Expected: PASS, all tests in `e2e/map.spec.ts` green (the province-filter tests plus every pre-existing test in the file, unaffected by this change).

If any test flakes on the mobile checkbox locator (`page.getByRole('checkbox').and(page.locator('[id^="province-"]'))` in Step 1's first test), scope it down to the visible sheet content the same way the pre-existing tests in this file already do (`:visible` suffix) rather than adding waits.

- [ ] **Step 3: Run the full verification suite**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: all three PASS.

Run: `npx playwright test`
Expected: PASS. Report the exact total/passed/failed/skipped counts.

- [ ] **Step 4: Commit**

```bash
git add e2e/map.spec.ts
git commit -m "test(map): cover multi-province union/removal/clear semantics"
```
