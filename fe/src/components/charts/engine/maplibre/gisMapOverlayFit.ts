type MapLibreMap = import("maplibre-gl").Map;

function extendBoundsWithCoordinate(
  lng: number,
  lat: number,
  bounds: { minLng: number; minLat: number; maxLng: number; maxLat: number },
) {
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
  bounds.minLng = Math.min(bounds.minLng, lng);
  bounds.minLat = Math.min(bounds.minLat, lat);
  bounds.maxLng = Math.max(bounds.maxLng, lng);
  bounds.maxLat = Math.max(bounds.maxLat, lat);
}

function extendBoundsWithGeometry(
  geometry: GeoJSON.Geometry | null | undefined,
  bounds: { minLng: number; minLat: number; maxLng: number; maxLat: number },
) {
  if (!geometry) return;
  if (geometry.type === "Point") {
    const [lng, lat] = geometry.coordinates;
    extendBoundsWithCoordinate(lng, lat, bounds);
    return;
  }
  if (geometry.type === "LineString") {
    for (const [lng, lat] of geometry.coordinates) {
      extendBoundsWithCoordinate(lng, lat, bounds);
    }
  }
}

export function computeGeoJsonBounds(
  geoJson: GeoJSON.FeatureCollection | null,
): [number, number, number, number] | null {
  if (!geoJson?.features.length) return null;
  const bounds = {
    minLng: Infinity,
    minLat: Infinity,
    maxLng: -Infinity,
    maxLat: -Infinity,
  };
  for (const feature of geoJson.features) {
    extendBoundsWithGeometry(feature.geometry, bounds);
  }
  if (!Number.isFinite(bounds.minLng)) return null;
  return [bounds.minLng, bounds.minLat, bounds.maxLng, bounds.maxLat];
}

export function mergeGeoJsonBounds(
  collections: Array<GeoJSON.FeatureCollection | null>,
): [number, number, number, number] | null {
  const merged = {
    minLng: Infinity,
    minLat: Infinity,
    maxLng: -Infinity,
    maxLat: -Infinity,
  };
  for (const collection of collections) {
    const bounds = computeGeoJsonBounds(collection);
    if (!bounds) continue;
    extendBoundsWithCoordinate(bounds[0], bounds[1], merged);
    extendBoundsWithCoordinate(bounds[2], bounds[3], merged);
  }
  if (!Number.isFinite(merged.minLng)) return null;
  return [merged.minLng, merged.minLat, merged.maxLng, merged.maxLat];
}

export function buildGeoJsonBoundsKey(
  ...collections: Array<GeoJSON.FeatureCollection | null>
): string | null {
  const bounds = mergeGeoJsonBounds(collections);
  return bounds ? bounds.join(",") : null;
}

export function fitGisOverlayBounds(
  map: MapLibreMap,
  geoJson: GeoJSON.FeatureCollection | GeoJSON.FeatureCollection[] | null,
  options?: { padding?: number; maxZoom?: number; minZoom?: number; duration?: number },
) {
  const collections = geoJson == null ? [] : Array.isArray(geoJson) ? geoJson : [geoJson];
  const bounds = mergeGeoJsonBounds(collections);
  if (!bounds) return false;
  const [minLng, minLat, maxLng, maxLat] = bounds;
  const clampZoom = () => {
    const floor = options?.minZoom;
    if (floor != null && map.getZoom() < floor) {
      map.setZoom(floor);
    }
  };
  if (minLng === maxLng && minLat === maxLat) {
    map.easeTo({
      center: [minLng, minLat],
      zoom: Math.min(options?.maxZoom ?? 10, 8),
      duration: options?.duration ?? 800,
    });
    if (options?.minZoom != null) {
      map.once("moveend", clampZoom);
    }
    return true;
  }
  map.fitBounds(
    [
      [minLng, minLat],
      [maxLng, maxLat],
    ],
    {
      padding: options?.padding ?? 48,
      maxZoom: options?.maxZoom ?? 10,
      duration: options?.duration ?? 800,
    },
  );
  if (options?.minZoom != null) {
    map.once("moveend", clampZoom);
  }
  return true;
}
