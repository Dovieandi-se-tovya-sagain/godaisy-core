// Map.tsx (client component)
import { useEffect, useRef } from 'react';
import { loadGoogleMaps } from '../lib/googleMaps';

export default function Map() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    loadGoogleMaps().then((g) => {
      if (cancelled || !ref.current) return;

      new g.maps.Map(ref.current, {
        center: { lat: 43.4743, lng: -5.2132 },
        zoom: 12,
        mapId: 'YOUR_MAP_ID', // optional
      });

      // Example: Places Autocomplete
      // const ac = new g.maps.places.Autocomplete(inputRef.current!, { fields: ['geometry', 'name'] });
    });

    return () => { cancelled = true; };
  }, []);

  return <div ref={ref} style={{ height: 400 }} />;
}