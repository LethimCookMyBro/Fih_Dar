'use client';

import * as React from 'react';
import type { Map as MapLibreMap, Marker as MapLibreMarker } from 'maplibre-gl';

import 'maplibre-gl/dist/maplibre-gl.css';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { INITIAL_VIEW, MAP_STYLE_URL } from '@/features/map/constants';
import { loadMapLibre } from '@/features/map/lib/load-maplibre';
import { applyWaterwayEmphasis } from '@/features/map/lib/waterways';

export interface PickedLocation {
  latitude: number;
  longitude: number;
}

interface LocationPickerProps {
  value: PickedLocation | null;
  onChange: (value: PickedLocation) => void;
  'aria-describedby'?: string;
}

/**
 * Real MapLibre mini-map. Clicking or dragging the pin sets the coordinates —
 * there is no fallback that invents a position when geolocation is refused.
 */
export function LocationPicker({ value, onChange, ...aria }: LocationPickerProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<MapLibreMap | null>(null);
  const markerRef = React.useRef<MapLibreMarker | null>(null);
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;

  const [ready, setReady] = React.useState(false);
  const [geoState, setGeoState] = React.useState<'idle' | 'locating' | 'denied' | 'unavailable'>(
    'idle'
  );

  React.useEffect(() => {
    let cancelled = false;
    let map: MapLibreMap | undefined;

    void loadMapLibre().then(({ Map, Marker, NavigationControl }) => {
      if (cancelled || !containerRef.current) return;

      map = new Map({
        container: containerRef.current,
        style: MAP_STYLE_URL,
        center: INITIAL_VIEW.center,
        zoom: INITIAL_VIEW.zoom
      });
      mapRef.current = map;
      map.addControl(new NavigationControl(), 'top-right');

      const marker = new Marker({ color: '#2A9D8F', draggable: true });
      markerRef.current = marker;
      marker.on('dragend', () => {
        const { lat, lng } = marker.getLngLat();
        onChangeRef.current({ latitude: lat, longitude: lng });
      });

      map.on('click', (event) => {
        onChangeRef.current({ latitude: event.lngLat.lat, longitude: event.lngLat.lng });
      });

      map.on('load', () => {
        if (cancelled || !map) return;
        applyWaterwayEmphasis(map);
        setReady(true);
      });
    });

    return () => {
      cancelled = true;
      markerRef.current?.remove();
      markerRef.current = null;
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  // Keep the pin in sync with the value owned by the form.
  React.useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker || !ready) return;

    if (!value) {
      marker.remove();
      return;
    }
    marker.setLngLat([value.longitude, value.latitude]).addTo(map);
  }, [value, ready]);

  const useCurrentLocation = () => {
    if (!('geolocation' in navigator)) {
      setGeoState('unavailable');
      return;
    }
    setGeoState('locating');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeoState('idle');
        const next = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };
        onChangeRef.current(next);
        mapRef.current?.flyTo({ center: [next.longitude, next.latitude], zoom: 15 });
      },
      () => setGeoState('denied'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className='space-y-2'>
      <div className='flex flex-wrap items-center gap-2'>
        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={useCurrentLocation}
          disabled={geoState === 'locating'}
        >
          {geoState === 'locating' ? <Icons.spinner className='animate-spin' /> : <Icons.locate />}
          ใช้ตำแหน่งปัจจุบัน
        </Button>
        {value && (
          <span className='text-muted-foreground font-mono text-xs'>
            {value.latitude.toFixed(5)}, {value.longitude.toFixed(5)}
          </span>
        )}
      </div>

      {geoState === 'denied' && (
        <p className='text-muted-foreground text-xs'>
          ไม่ได้รับอนุญาตให้เข้าถึงตำแหน่ง — แตะบนแผนที่เพื่อเลือกตำแหน่งเองได้
        </p>
      )}
      {geoState === 'unavailable' && (
        <p className='text-muted-foreground text-xs'>
          เบราว์เซอร์นี้ไม่รองรับการระบุตำแหน่ง — แตะบนแผนที่เพื่อเลือกตำแหน่งเอง
        </p>
      )}

      <div
        ref={containerRef}
        {...aria}
        className='h-64 w-full overflow-hidden rounded-lg border'
        aria-label='เลือกตำแหน่งบนแผนที่'
      />
      <p className='text-muted-foreground text-xs'>แตะบนแผนที่หรือลากหมุดเพื่อปรับตำแหน่งให้ตรงกับจุดที่พบ</p>
    </div>
  );
}
