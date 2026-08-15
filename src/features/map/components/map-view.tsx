'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Map as MapLibreMap, MapLayerMouseEvent } from 'maplibre-gl';

import 'maplibre-gl/dist/maplibre-gl.css';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { publicReportsQueryOptions } from '@/features/reports/api/queries';
import type { Report } from '@/features/reports/api/types';
import { INITIAL_VIEW, MAP_STYLE_URL, type QuickPlace } from '@/features/map/constants';
import {
  CLUSTER_COUNT_LAYER,
  CLUSTER_LAYER,
  HEATMAP_LAYER,
  POINT_LAYER,
  SELECTED_LAYER,
  addReportLayers,
  setLayerVisibility,
  setSelectedReport,
  toFeatureCollection,
  updateReportData
} from '@/features/map/lib/report-layers';
import { loadMapLibre } from '@/features/map/lib/load-maplibre';
import { applyWaterwayEmphasis, setWaterwayVisibility } from '@/features/map/lib/waterways';
import { MapControls, MapLegend, type MapFilters, type MapLayerToggles } from './map-controls';
import { ReportPanel } from './report-panel';

const REPORT_LAYERS = [CLUSTER_LAYER, CLUSTER_COUNT_LAYER, POINT_LAYER, SELECTED_LAYER];

function filterReports(reports: Report[], filters: MapFilters): Report[] {
  const cutoff =
    filters.days === 'all' ? null : Date.now() - Number(filters.days) * 24 * 60 * 60 * 1000;

  return reports.filter((report) => {
    if (filters.province !== 'all' && report.province !== filters.province) return false;
    if (cutoff !== null && new Date(report.observedAt).getTime() < cutoff) return false;
    return true;
  });
}

export function MapView() {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<MapLibreMap | null>(null);
  const [mapReady, setMapReady] = React.useState(false);
  const [mapError, setMapError] = React.useState<string | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [filters, setFilters] = React.useState<MapFilters>({ province: 'all', days: 'all' });
  const [layers, setLayers] = React.useState<MapLayerToggles>({
    reports: true,
    waterways: true,
    heatmap: false
  });

  const { data, isPending, isError, refetch, isFetching } = useQuery(publicReportsQueryOptions());
  const reports = React.useMemo(() => filterReports(data?.reports ?? [], filters), [data, filters]);
  const selected = reports.find((report) => report.id === selectedId) ?? null;

  // --- map lifecycle ------------------------------------------------------
  React.useEffect(() => {
    let map: MapLibreMap | undefined;
    let cancelled = false;

    // maplibre-gl touches `window` at import time, so it is only pulled in
    // once the component is actually mounted in the browser.
    void loadMapLibre()
      .then(({ AttributionControl, GeolocateControl, Map, NavigationControl, ScaleControl }) => {
        if (cancelled || !containerRef.current) return;

        map = new Map({
          container: containerRef.current,
          style: MAP_STYLE_URL,
          center: INITIAL_VIEW.center,
          zoom: INITIAL_VIEW.zoom,
          attributionControl: false
        });
        mapRef.current = map;

        map.addControl(new NavigationControl({ visualizePitch: false }), 'bottom-right');
        map.addControl(
          new GeolocateControl({ trackUserLocation: false, showAccuracyCircle: true }),
          'bottom-right'
        );
        // bottom-right, not bottom-left: the legend owns the bottom-left corner
        // and the scale bar rendered underneath it.
        map.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-right');
        map.addControl(new AttributionControl({ compact: true }), 'bottom-right');

        map.on('error', (event) => {
          if (cancelled) return;
          setMapError(event.error?.message ?? 'ไม่สามารถโหลดแผนที่ได้');
        });

        map.on('load', () => {
          if (cancelled || !map) return;
          applyWaterwayEmphasis(map);
          addReportLayers(map, toFeatureCollection([]));
          setMapReady(true);
        });
      })
      .catch(() => {
        if (!cancelled) setMapError('ไม่สามารถโหลดไลบรารีแผนที่ได้');
      });

    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  // --- interaction --------------------------------------------------------
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const onPointClick = (event: MapLayerMouseEvent) => {
      const id = event.features?.[0]?.properties?.id;
      if (typeof id === 'string') setSelectedId(id);
    };

    const onClusterClick = (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      if (!feature) return;
      map.easeTo({
        center: (feature.geometry as GeoJSON.Point).coordinates as [number, number],
        zoom: map.getZoom() + 2,
        duration: 300
      });
    };

    const pointer = () => (map.getCanvas().style.cursor = 'pointer');
    const resetPointer = () => (map.getCanvas().style.cursor = '');

    map.on('click', POINT_LAYER, onPointClick);
    map.on('click', CLUSTER_LAYER, onClusterClick);
    for (const layer of [POINT_LAYER, CLUSTER_LAYER]) {
      map.on('mouseenter', layer, pointer);
      map.on('mouseleave', layer, resetPointer);
    }

    return () => {
      map.off('click', POINT_LAYER, onPointClick);
      map.off('click', CLUSTER_LAYER, onClusterClick);
      for (const layer of [POINT_LAYER, CLUSTER_LAYER]) {
        map.off('mouseenter', layer, pointer);
        map.off('mouseleave', layer, resetPointer);
      }
    };
  }, [mapReady]);

  // --- data / layer state -------------------------------------------------
  React.useEffect(() => {
    const map = mapRef.current;
    if (map && mapReady) updateReportData(map, toFeatureCollection(reports));
  }, [reports, mapReady]);

  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    setLayerVisibility(map, REPORT_LAYERS, layers.reports);
    setLayerVisibility(map, [HEATMAP_LAYER], layers.heatmap);
    setWaterwayVisibility(map, layers.waterways);
  }, [layers, mapReady]);

  // Highlight the selected report and centre on it.
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    setSelectedReport(map, selectedId);
    if (!selectedId || !selected) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    map.flyTo({
      center: [selected.longitude, selected.latitude],
      zoom: Math.max(map.getZoom(), 12),
      duration: reduceMotion ? 0 : 700
    });
  }, [selectedId, selected, mapReady]);

  const navigateTo = (place: QuickPlace) => {
    const map = mapRef.current;
    if (!map) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    map.flyTo({ center: place.center, zoom: place.zoom, duration: reduceMotion ? 0 : 900 });
  };

  const showEmpty = mapReady && !isPending && !isError && reports.length === 0;

  return (
    <div className='relative isolate size-full overflow-hidden'>
      <div ref={containerRef} className='size-full' aria-label='แผนที่ทางน้ำภาคตะวันออก' />

      {/* Map shell loading: mirror the real layout (control bar + legend) rather
          than a generic spinner, so nothing jumps when the map resolves. */}
      {!mapReady && !mapError && (
        <div
          role='status'
          aria-live='polite'
          className='bg-muted/40 absolute inset-0 z-20 p-3 md:p-4'
        >
          <div className='flex items-center gap-2'>
            <Skeleton className='size-11 rounded-(--nav-radius) md:w-32' />
            <Skeleton className='h-11 w-28 rounded-(--nav-radius)' />
            <Skeleton className='hidden h-11 w-40 rounded-(--nav-radius) md:block' />
          </div>
          <Skeleton className='absolute bottom-3 start-3 size-11 rounded-(--nav-radius) md:h-40 md:w-60 md:rounded-xl' />
          {/* Visible, not just sr-only. Tile loading can take several seconds on
              a slow link, and without this the user stares at a grey void. */}
          <div className='absolute inset-0 flex items-center justify-center'>
            <div className='bg-background border-border text-muted-foreground flex items-center gap-2.5 rounded-full border px-4 py-2.5 text-[0.8125rem] shadow-sm'>
              <Icons.spinner className='size-4 animate-spin' aria-hidden />
              กำลังโหลดแผนที่…
            </div>
          </div>
        </div>
      )}

      {mapError && (
        <div
          role='alert'
          className='bg-background absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 p-6 text-center'
        >
          <span className='bg-destructive/10 text-destructive flex size-12 items-center justify-center rounded-full'>
            <Icons.alertCircle className='size-6' aria-hidden />
          </span>
          <div className='space-y-1'>
            <p className='text-lg font-semibold'>ไม่สามารถแสดงแผนที่ได้</p>
            <p className='text-muted-foreground mx-auto max-w-sm text-[0.9375rem] leading-relaxed'>
              {mapError}
            </p>
          </div>
          <Button
            variant='outline'
            className='h-11 px-5 text-[0.9375rem]'
            onClick={() => window.location.reload()}
          >
            โหลดแผนที่ใหม่
          </Button>
        </div>
      )}

      {mapReady && (
        <>
          <MapControls
            filters={filters}
            onFiltersChange={setFilters}
            layers={layers}
            onLayersChange={setLayers}
            onNavigate={navigateTo}
          />
          <MapLegend count={reports.length} />
          <ReportPanel report={selected} onClose={() => setSelectedId(null)} />
        </>
      )}

      {/* Data-state stack. One column, centred, offset below the control bar so
          it can never overlap it (the old top-16 sat directly under the 44px
          controls). Only one of these renders at a time. */}
      {mapReady && (
        <div className='pointer-events-none absolute inset-x-0 top-19 z-10 flex justify-center px-3 md:top-21'>
          {/* `!isError` guard: during a retry after a failure both isFetching and
              isError can be true, which rendered the spinner chip and the error
              card side by side. Error wins. */}
          {!isError && (isPending || isFetching) && (
            <div
              role='status'
              aria-live='polite'
              className='bg-background border-border flex items-center gap-2 rounded-full border px-3.5 py-2 text-[0.8125rem] shadow-sm'
            >
              <Icons.spinner className='size-4 animate-spin' aria-hidden />
              กำลังโหลดข้อมูลรายงาน…
            </div>
          )}

          {isError && (
            <div
              role='alert'
              className='bg-background border-border pointer-events-auto flex max-w-sm items-center gap-3 rounded-xl border p-3 shadow-sm'
            >
              <span className='bg-destructive/10 text-destructive flex size-9 shrink-0 items-center justify-center rounded-full'>
                <Icons.alertCircle className='size-5' aria-hidden />
              </span>
              <p className='min-w-0 text-[0.8125rem] leading-snug'>โหลดข้อมูลรายงานไม่สำเร็จ</p>
              <Button
                variant='outline'
                className='h-9 shrink-0 px-3 text-[0.8125rem]'
                onClick={() => void refetch()}
              >
                ลองอีกครั้ง
              </Button>
            </div>
          )}

          {showEmpty && (
            <div className='bg-background border-border max-w-sm rounded-xl border p-4 text-center shadow-sm'>
              <p className='text-[0.9375rem] font-semibold'>ยังไม่มีรายงานในเงื่อนไขนี้</p>
              <p className='text-muted-foreground mt-1 text-[0.8125rem] leading-relaxed'>
                แผนที่แสดงเฉพาะรายงานที่ผ่านการตรวจสอบแล้ว ลองขยายช่วงเวลาหรือเลือกทุกจังหวัด
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
