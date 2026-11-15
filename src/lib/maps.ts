import type { RouteResult } from '../types.ts';

export const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
export const GMP_ATTRIBUTION_ID = 'gmp_git_agentskills_v1';

export interface UserGeoLocation {
  lat: number;
  lng: number;
  accuracy?: number;
  label?: string;
  state?: string;
}

export interface GeocodeResponse {
  lat: number;
  lng: number;
  formattedAddress: string;
  state?: string;
  area?: string;
  country?: string;
}

export function triggerQuotaExceeded() {
  window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function formatDistanceKm(km: number): string {
  if (!Number.isFinite(km)) return '';
  if (km < 1) {
    return `${km.toFixed(2)} km`;
  }
  if (km < 10) {
    return `${km.toFixed(1)} km`;
  }
  return `${Math.round(km)} km`;
}

function formatDurationSeconds(seconds: number): string {
  const mins = Math.max(1, Math.round(seconds / 60));
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'}`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hrs} hr ${rem} min` : `${hrs} hr`;
}

async function waitForGoogleMaps(timeoutMs = 3500): Promise<boolean> {
  if (typeof window === 'undefined' || !GOOGLE_MAPS_API_KEY) return false;
  if (typeof google !== 'undefined' && google?.maps?.importLibrary) return true;

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 120));
    if (typeof google !== 'undefined' && google?.maps?.importLibrary) {
      return true;
    }
  }
  return false;
}

const CITY_CENTER_COORDS: Array<{ keywords: string[]; lat: number; lng: number; state: string; label: string }> = [
  { keywords: ['lekki', 'ikoyi', 'victoria island', 'vi', 'ajah'], lat: 6.4474, lng: 3.4723, state: 'Lagos', label: 'Lekki, Lagos, Nigeria' },
  { keywords: ['ikeja', 'yaba', 'surulere', 'lagos', 'festac', 'gbagada', 'magodo'], lat: 6.5244, lng: 3.3792, state: 'Lagos', label: 'Lagos, Nigeria' },
  { keywords: ['abuja', 'wuse', 'maitama', 'gwarinpa', 'garki', 'asokoro', 'lugbe', 'fct'], lat: 9.0765, lng: 7.3986, state: 'Abuja (FCT)', label: 'Abuja (FCT), Nigeria' },
  { keywords: ['port harcourt', 'rivers', 'gra', 'eleme'], lat: 4.8156, lng: 7.0498, state: 'Rivers', label: 'Port Harcourt, Rivers, Nigeria' },
  { keywords: ['ibadan', 'oyo', 'bodija', 'akobo'], lat: 7.3775, lng: 3.947, state: 'Oyo', label: 'Ibadan, Oyo, Nigeria' },
  { keywords: ['kano'], lat: 12.0022, lng: 8.592, state: 'Kano', label: 'Kano, Nigeria' },
  { keywords: ['enugu'], lat: 6.4584, lng: 7.5464, state: 'Enugu', label: 'Enugu, Nigeria' },
  { keywords: ['ogun', 'abeokuta', 'mowe', 'sango', 'ota'], lat: 7.1475, lng: 3.3619, state: 'Ogun', label: 'Abeokuta, Ogun, Nigeria' },
  { keywords: ['benin', 'edo'], lat: 6.335, lng: 5.6037, state: 'Edo', label: 'Benin City, Edo, Nigeria' },
  { keywords: ['kaduna'], lat: 10.5105, lng: 7.4165, state: 'Kaduna', label: 'Kaduna, Nigeria' },
];

function fallbackCityGeocode(address?: string): GeocodeResponse | null {
  if (!address) return null;
  const lower = address.toLowerCase();
  const match = CITY_CENTER_COORDS.find((c) => c.keywords.some((kw) => lower.includes(kw)));
  if (!match) return null;
  return {
    lat: match.lat,
    lng: match.lng,
    formattedAddress: address.trim() || match.label,
    state: match.state,
    area: address.split(',')[0]?.trim(),
    country: 'Nigeria',
  };
}

function parseAddressComponents(components: google.maps.GeocoderAddressComponent[] | undefined) {
  let state = '';
  let area = '';
  let country = '';
  if (!components) return { state, area, country };

  for (const comp of components) {
    if (comp.types.includes('administrative_area_level_1')) {
      state = comp.long_name.replace(/\s+State$/i, '');
    }
    if (
      !area &&
      (comp.types.includes('sublocality') ||
        comp.types.includes('neighborhood') ||
        comp.types.includes('locality'))
    ) {
      area = comp.long_name;
    }
    if (comp.types.includes('country')) {
      country = comp.long_name;
    }
  }
  return { state, area, country };
}

export async function geocodeAddressViaServer(params: {
  address?: string;
  lat?: number;
  lng?: number;
  houseId?: string;
}): Promise<GeocodeResponse> {
  const ready = await waitForGoogleMaps();

  if (ready) {
    try {
      const geocodingLib = (await google.maps.importLibrary('geocoding')) as google.maps.GeocodingLibrary;
      const geocoder = new geocodingLib.Geocoder();
      const request: google.maps.GeocoderRequest =
        params.lat != null && params.lng != null
          ? { location: { lat: params.lat, lng: params.lng } }
          : { address: params.address || '' };

      const response = await geocoder.geocode(request);
      const first = response.results?.[0];
      if (first) {
        const loc = first.geometry.location;
        const parsed = parseAddressComponents(first.address_components);
        return {
          lat: loc.lat(),
          lng: loc.lng(),
          formattedAddress: first.formatted_address,
          state: parsed.state,
          area: parsed.area,
          country: parsed.country,
        };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('OVER_QUERY_LIMIT')) {
        triggerQuotaExceeded();
      }
    }
  }

  if (params.lat != null && params.lng != null) {
    return {
      lat: params.lat,
      lng: params.lng,
      formattedAddress: `${params.lat.toFixed(4)}, ${params.lng.toFixed(4)}`,
    };
  }

  const cityFallback = fallbackCityGeocode(params.address);
  if (cityFallback) {
    return cityFallback;
  }

  throw new Error('Could not resolve that location right now. Try pinning on the map or using GPS.');
}

export async function computeRouteViaServer(params: {
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
  travelMode?: 'DRIVE' | 'WALK' | 'TWO_WHEELER';
}): Promise<RouteResult> {
  const ready = await waitForGoogleMaps();
  const modeMap: Record<'DRIVE' | 'WALK' | 'TWO_WHEELER', string> = {
    DRIVE: 'DRIVING',
    WALK: 'WALKING',
    TWO_WHEELER: 'TWO_WHEELER',
  };

  if (ready) {
    try {
      const routesLib = (await google.maps.importLibrary('routes')) as {
        Route?: {
          computeRoutes: (req: Record<string, unknown>) => Promise<{
            routes?: Array<{
              distanceMeters?: number;
              durationMillis?: number;
              path?: google.maps.LatLng[];
            }>;
          }>;
        };
      };

      if (routesLib?.Route?.computeRoutes) {
        const { routes } = await routesLib.Route.computeRoutes({
          origin: { lat: params.originLat, lng: params.originLng },
          destination: { lat: params.destLat, lng: params.destLng },
          travelMode: modeMap[params.travelMode || 'DRIVE'] || 'DRIVING',
          fields: ['path', 'distanceMeters', 'durationMillis'],
          internalUsageAttributionIds: [GMP_ATTRIBUTION_ID],
        });

        const first = routes?.[0];
        if (first) {
          const distanceMeters = Math.round(first.distanceMeters || 0);
          const durationSeconds = Math.round((first.durationMillis || 0) / 1000);
          let encodedPolyline = '';
          if (first.path && first.path.length > 0 && google.maps.geometry?.encoding) {
            encodedPolyline = google.maps.geometry.encoding.encodePath(first.path);
          }
          return {
            distanceMeters,
            distanceKm: Number((distanceMeters / 1000).toFixed(2)),
            durationSeconds,
            durationText: formatDurationSeconds(durationSeconds),
            encodedPolyline,
          };
        }
      }
    } catch {
      // Fall back cleanly to direct distance calculation if Routes API is unavailable
    }
  }

  const directKm = haversineKm(params.originLat, params.originLng, params.destLat, params.destLng);
  const speedKmH = params.travelMode === 'WALK' ? 4.8 : 35;
  const durationSeconds = Math.max(60, Math.round((directKm / speedKmH) * 3600));
  return {
    distanceMeters: Math.round(directKm * 1000),
    distanceKm: Number(directKm.toFixed(2)),
    durationSeconds,
    durationText: formatDurationSeconds(durationSeconds),
    encodedPolyline: '',
  };
}
