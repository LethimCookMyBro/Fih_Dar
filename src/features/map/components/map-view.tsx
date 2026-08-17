'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Map as MapLibreMap, MapLayerMouseEvent } from 'maplibre-gl';

import 'maplibre-gl/dist/maplibre-gl.css';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { publicReportsQueryOptions } from '@/features/reports/api/queries';
import { REPORT_PROVINCES, type Report } from '@/features/reports/api/types';
import { publicObservationsQueryOptions } from '@/features/observations/api/queries';
import type { ExternalObservation } from '@/features/observations/api/types';
import { PriorityPanel } from '@/features/priority/components/priority-panel';
import { priorityAreasQueryOptions } from '@/features/priority/api/queries';
import type { PriorityArea } from '@/features/priority/api/types';
import {
  INITIAL_VIEW,
  MAP_STYLE_URL,
  MIN_ZOOM,
  THAILAND_BOUNDS,
  type QuickPlace
} from '@/features/map/constants';
import { matchesMapFilters, type MapFilters } from '@/features/map/lib/filters';
import {
  CLUSTER_COUNT_LAYER,
  CLUSTER_LAYER,
  EVENTS_CLUSTER_COUNT_LAYER,
  EVENTS_CLUSTER_LAYER,
  EVENTS_LAYER,
  EVENTS_SELECTED_LAYER,
  HEATMAP_LAYER,
  MONITORING_FILL_LAYER,
  MONITORING_OUTLINE_LAYER,
  OBSERVATIONS_LAYER,
  POINT_LAYER,
  SELECTED_LAYER,
  addEventsLayer,
  addMonitoringLayer,
  addObservationsLayer,
  addReportLayers,
  setLayerVisibility,
  setSelectedEvent,
  setSelectedReport,
  toFeatureCollection,
  updateEventsData,
  updateMonitoringData,
  updateObservationsData,
  updateReportData
} from '@/features/map/lib/report-layers';
import { applyMinimalBasemap } from '@/features/map/lib/basemap';
import { loadMapLibre } from '@/features/map/lib/load-maplibre';
import { applyThailandExtent } from '@/features/map/lib/thailand-extent';
import {
  applyRoadRecession,
  applyWaterwayEmphasis,
  setWaterwayVisibility
} from '@/features/map/lib/waterways';
import { MapControls, MapLegend, type MapLayerToggles } from './map-controls';
import { ReportPanel } from './report-panel';
import { EventPanel } from './event-panel';

const REPORT_LAYERS = [CLUSTER_LAYER, CLUSTER_COUNT_LAYER, POINT_LAYER, SELECTED_LAYER];
const EVENT_LAYERS = [
  EVENTS_CLUSTER_LAYER,
  EVENTS_CLUSTER_COUNT_LAYER,
  EVENTS_LAYER,
  EVENTS_SELECTED_LAYER
];
const MONITORING_LAYERS = [MONITORING_FILL_LAYER, MONITORING_OUTLINE_LAYER];

function filterReports(reports: Report[], filters: MapFilters): Report[] {
  return reports.filter((report) => matchesMapFilters(filters, report.province, report.observedAt));
}

function filterEventAreas(areas: PriorityArea[], filters: MapFilters): PriorityArea[] {
  return areas.filter((area) =>
    matchesMapFilters(filters, area.province, area.eventDate ?? area.mostRecentPublishedAt)
  );
}

function filterObservations(
  observations: ExternalObservation[],
  filters: MapFilters
): ExternalObservation[] {
  return observations.filter((observation) =>
    matchesMapFilters(filters, observation.province, observation.publishedAt)
  );
}

export function MapView() {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<MapLibreMap | null>(null);
  const [mapReady, setMapReady] = React.useState(false);
  const [mapError, setMapError] = React.useState<string | null>(null);
  // Incrementing this remounts the map — the retry path re-runs the whole
  // lifecycle (worker, style, layers) instead of a full page reload.
  const [attempt, setAttempt] = React.useState(0);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [selectedEventSlug, setSelectedEventSlug] = React.useState<string | null>(null);
  const [filters, setFilters] = React.useState<MapFilters>({ provinces: [], days: 'all' });
  const [layers, setLayers] = React.useState<MapLayerToggles>({
    events: true,
    monitoring: true,
    reports: true,
    waterways: true,
    heatmap: false,
    observations: false
  });

  const { data, isPending, isError, refetch, isFetching } = useQuery(publicReportsQueryOptions());
  const reports = React.useMemo(() => filterReports(data?.reports ?? [], filters), [data, filters]);
  const { data: observationData } = useQuery(publicObservationsQueryOptions());
  const observations = React.useMemo(
    () => filterObservations(observationData?.observations ?? [], filters),
    [observationData, filters]
  );
  const placedObservations = React.useMemo(
    () =>
      observations.filter(
        (observation) => observation.latitude !== null && observation.longitude !== null
      ),
    [observations]
  );
  const { data: priorityData } = useQuery(priorityAreasQueryOptions());
  const eventAreas = React.useMemo(
    () => filterEventAreas(priorityData?.areas ?? [], filters),
    [priorityData, filters]
  );
  const placedEventAreas = React.useMemo(
    () => eventAreas.filter((area) => area.coordinate !== null),
    [eventAreas]
  );
  // Every province that could ever appear on the map, not just the three
  // EEC provinces citizen reports are restricted to — events/observations
  // come from a nationwide ingestion pipeline and can land anywhere.
  const provinceOptions = React.useMemo(() => {
    const provinces = new Set<string>(REPORT_PROVINCES);
    for (const report of data?.reports ?? []) provinces.add(report.province);
    for (const area of priorityData?.areas ?? []) if (area.province) provinces.add(area.province);
    for (const observation of observationData?.observations ?? [])
      if (observation.province) provinces.add(observation.province);
    return Array.from(provinces).toSorted((a, b) => a.localeCompare(b, 'th'));
  }, [data, priorityData, observationData]);
  const selected = reports.find((report) => report.id === selectedId) ?? null;
  const selectedEvent = eventAreas.find((area) => area.slug === selectedEventSlug) ?? null;

  // --- map lifecycle ------------------------------------------------------
  React.useEffect(() => {
    let map: MapLibreMap | undefined;
    let cancelled = false;
    let ready = false;

    // Surface a failure only while the map is still loading. Once the map has
    // fired 'load', error events are per-tile / per-resource and non-fatal.
    const fail = (message: string) => {
      if (!cancelled && !ready) setMapError(message);
    };

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
          minZoom: MIN_ZOOM,
          maxBounds: THAILAND_BOUNDS,
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
          fail(event.error?.message ?? 'ไม่สามารถโหลดแผนที่ได้');
        });

        map.on('load', () => {
          if (cancelled || !map) return;
          ready = true;
          // Order matters: trim the basemap first, then emphasise water, recede
          // roads, and finally wash out everything outside Thai jurisdiction —
          // the extent mirrors the waterway emphasis for the sea, so it has to
          // run after it. FihDar's own layers go on top of all of it.
          applyMinimalBasemap(map);
          applyWaterwayEmphasis(map);
          applyRoadRecession(map);
          applyThailandExtent(map);
          addReportLayers(map, toFeatureCollection([]));
          addObservationsLayer(map);
          addEventsLayer(map);
          addMonitoringLayer(map);
          setMapReady(true);
        });
      })
      .catch(() => {
        fail('ไม่สามารถโหลดไลบรารีแผนที่ได้');
      });

    // Fail hard: if the map has not become ready within 30s (blocked style,
    // dead worker URL, missing WebGL, …) transition to the error state rather
    // than spinning on the loading overlay forever.
    const timeoutId = window.setTimeout(() => {
      if (!cancelled && !ready) {
        setMapError('การโหลดแผนที่ใช้เวลานานเกินไป ตรวจสอบการเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่อีกครั้ง');
      }
    }, 30_000);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      map?.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, [attempt]);

  // --- interaction --------------------------------------------------------
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const onPointClick = (event: MapLayerMouseEvent) => {
      const id = event.features?.[0]?.properties?.id;
      if (typeof id === 'string') {
        setSelectedEventSlug(null);
        setSelectedId(id);
      }
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

    const onEventClick = (event: MapLayerMouseEvent) => {
      const slug = event.features?.[0]?.properties?.slug;
      if (typeof slug === 'string') {
        setSelectedId(null);
        setSelectedEventSlug(slug);
      }
    };

    const pointer = () => (map.getCanvas().style.cursor = 'pointer');
    const resetPointer = () => (map.getCanvas().style.cursor = '');
    const clickableLayers = [POINT_LAYER, CLUSTER_LAYER, EVENTS_LAYER, EVENTS_CLUSTER_LAYER];

    map.on('click', POINT_LAYER, onPointClick);
    map.on('click', CLUSTER_LAYER, onClusterClick);
    map.on('click', EVENTS_LAYER, onEventClick);
    map.on('click', EVENTS_CLUSTER_LAYER, onClusterClick);
    for (const layer of clickableLayers) {
      map.on('mouseenter', layer, pointer);
      map.on('mouseleave', layer, resetPointer);
    }

    return () => {
      map.off('click', POINT_LAYER, onPointClick);
      map.off('click', CLUSTER_LAYER, onClusterClick);
      map.off('click', EVENTS_LAYER, onEventClick);
      map.off('click', EVENTS_CLUSTER_LAYER, onClusterClick);
      for (const layer of clickableLayers) {
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
    setLayerVisibility(map, EVENT_LAYERS, layers.events);
    setLayerVisibility(map, MONITORING_LAYERS, layers.monitoring);
    setLayerVisibility(map, [HEATMAP_LAYER], layers.heatmap);
    setLayerVisibility(map, [OBSERVATIONS_LAYER], layers.observations);
    setWaterwayVisibility(map, layers.waterways);
  }, [layers, mapReady]);

  // Feed coordinate-bearing observations into their own layer (kept visually
  // separate from citizen reports; the toggle defaults to off).
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    updateObservationsData(
      map,
      placedObservations.map((observation) => ({
        id: observation.id,
        latitude: observation.latitude as number,
        longitude: observation.longitude as number
      }))
    );
  }, [placedObservations, mapReady]);

  // Feed EventCandidates with an exact coordinate into the events layer —
  // this is the primary operational layer, on by default. The 2km
  // monitoring radius is drawn around the same exact-coordinate set.
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    updateEventsData(map, placedEventAreas);
    updateMonitoringData(map, placedEventAreas);
  }, [placedEventAreas, mapReady]);

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

  // Highlight the selected event and centre on it.
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    setSelectedEvent(map, selectedEventSlug);
    if (!selectedEventSlug || !selectedEvent?.coordinate) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    map.flyTo({
      center: [selectedEvent.coordinate.longitude, selectedEvent.coordinate.latitude],
      zoom: Math.max(map.getZoom(), 12),
      duration: reduceMotion ? 0 : 700
    });
  }, [selectedEventSlug, selectedEvent, mapReady]);

  const navigateTo = (place: QuickPlace) => {
    const map = mapRef.current;
    if (!map) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    map.flyTo({ center: place.center, zoom: place.zoom, duration: reduceMotion ? 0 : 900 });
  };

  const flyToPriorityArea = (area: PriorityArea) => {
    const map = mapRef.current;
    if (!map || !area.coordinate) return;
    setSelectedId(null);
    setSelectedEventSlug(area.slug);
    setLayers((current) => (current.events ? current : { ...current, events: true }));
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    map.flyTo({
      center: [area.coordinate.longitude, area.coordinate.latitude],
      zoom: Math.max(map.getZoom(), 13),
      duration: reduceMotion ? 0 : 900
    });
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
          <Skeleton className='absolute bottom-3 start-3 size-11 rounded-(--nav-radius) md:bottom-4 md:start-4' />
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
            onClick={() => {
              setMapError(null);
              setMapReady(false);
              setAttempt((a) => a + 1);
            }}
          >
            ลองใหม่อีกครั้ง
          </Button>
        </div>
      )}

      {mapReady && (
        <>
          <MapControls
            filters={filters}
            onFiltersChange={setFilters}
            provinceOptions={provinceOptions}
            layers={layers}
            onLayersChange={setLayers}
            onNavigate={navigateTo}
          />
          <MapLegend
            reportCount={reports.length}
            eventCount={placedEventAreas.length}
            eventsTotal={eventAreas.length}
            eventsVisible={layers.events}
            monitoringVisible={layers.monitoring}
            observationCount={placedObservations.length}
            observationsVisible={layers.observations}
          />
          <PriorityPanel filters={filters} onFly={flyToPriorityArea} />
          <ReportPanel report={selected} onClose={() => setSelectedId(null)} />
          <EventPanel event={selectedEvent} onClose={() => setSelectedEventSlug(null)} />
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
