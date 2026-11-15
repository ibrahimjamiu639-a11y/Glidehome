import { useEffect, useState } from 'react';
import { AdvancedMarker, Map as GoogleMap, Pin, useMap } from '@vis.gl/react-google-maps';
import { Crosshair, MapPin, Search, Sparkles } from 'lucide-react';
import {
  geocodeAddressViaServer,
  GMP_ATTRIBUTION_ID,
  GOOGLE_MAPS_API_KEY,
  type UserGeoLocation,
} from '../lib/maps.ts';
import { getBrowserCoordinates } from '../lib/permissions.ts';
import { useTheme } from '../lib/theme.ts';

export interface ResolvedPinAddress {
  formattedAddress: string;
  state?: string;
  area?: string;
  country?: string;
}

interface LocationPickerMapProps {
  addressQuery: string;
  lat: number | null;
  lng: number | null;
  userLocation?: UserGeoLocation | null;
  onChangeCoords: (lat: number, lng: number) => void;
  onApplyResolvedAddress?: (resolved: ResolvedPinAddress) => void;
}

const NIGERIA_CENTER = { lat: 9.082, lng: 8.6753 };

function CenterMapOnPin({ coords }: { coords: { lat: number; lng: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !coords) return;
    map.panTo(coords);
    const z = map.getZoom();
    if (!z || z < 13) {
      map.setZoom(15);
    }
  }, [map, coords]);
  return null;
}

export function LocationPickerMap({
  addressQuery,
  lat,
  lng,
  userLocation,
  onChangeCoords,
  onApplyResolvedAddress,
}: LocationPickerMapProps) {
  const { resolvedTheme } = useTheme();
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState('');
  const [customLocationInput, setCustomLocationInput] = useState('');
  const [resolvedAddress, setResolvedAddress] = useState<ResolvedPinAddress | null>(null);

  const runAddressGeocode = async (query: string) => {
    if (!query.trim()) {
      setNotice('Please type a location, street, estate, or landmark first.');
      return;
    }
    setLocating(true);
    setNotice('');
    try {
      const res = await geocodeAddressViaServer({ address: query.trim() });
      onChangeCoords(res.lat, res.lng);
      const resolved: ResolvedPinAddress = {
        formattedAddress: res.formattedAddress,
        state: res.state,
        area: res.area,
        country: res.country,
      };
      setResolvedAddress(resolved);
      setNotice(`Pinned: ${res.formattedAddress}`);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Could not find that location on the map.');
    } finally {
      setLocating(false);
    }
  };

  const handleReverseGeocode = async (targetLat: number, targetLng: number, prefix: string) => {
    onChangeCoords(targetLat, targetLng);
    setNotice(`${prefix} Pin updated (${targetLat.toFixed(5)}, ${targetLng.toFixed(5)}).`);
    try {
      const rev = await geocodeAddressViaServer({ lat: targetLat, lng: targetLng });
      const resolved: ResolvedPinAddress = {
        formattedAddress: rev.formattedAddress,
        state: rev.state,
        area: rev.area,
        country: rev.country,
      };
      setResolvedAddress(resolved);
      setNotice(`${prefix} Pinned: ${rev.formattedAddress}`);
    } catch {
      // Keep coordinates even if reverse geocoding fails
    }
  };

  const handleUseCurrentGps = async () => {
    setNotice('');
    if (userLocation) {
      await handleReverseGeocode(userLocation.lat, userLocation.lng, 'Using your live location.');
      return;
    }
    setLocating(true);
    const res = await getBrowserCoordinates();
    if (!res.ok) {
      setLocating(false);
      setNotice(res.message);
      return;
    }
    await handleReverseGeocode(res.lat, res.lng, 'Using your current GPS.');
    setLocating(false);
  };

  const coords = lat !== null && lng !== null ? { lat, lng } : null;
  const fallbackCenter = coords || (userLocation ? { lat: userLocation.lat, lng: userLocation.lng } : NIGERIA_CENTER);

  return (
    <div className="bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-[#0B7A3E] dark:text-emerald-400" aria-hidden="true" />
            <span>Pin House Location or Input New Location</span>
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Search any new street/area below, use your GPS location, or tap anywhere on the Google Map.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => runAddressGeocode(addressQuery)}
            disabled={locating}
            className="px-3 py-1.5 rounded-lg bg-[#0B7A3E] hover:bg-[#096734] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
          >
            <Search className="w-3.5 h-3.5" aria-hidden="true" />
            {locating ? 'Locating...' : 'Pin Form Address'}
          </button>
          <button
            type="button"
            onClick={handleUseCurrentGps}
            disabled={locating}
            className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
          >
            <Crosshair className="w-3.5 h-3.5" aria-hidden="true" />
            Use My GPS
          </button>
        </div>
      </div>

      {/* Input New Location Search Bar */}
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={customLocationInput}
          onChange={(e) => setCustomLocationInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              runAddressGeocode(customLocationInput);
            }
          }}
          placeholder="Input new location (e.g. Banana Island, Lekki Phase 1, Wuse 2 Abuja)"
          className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B7A3E]"
        />
        <button
          type="button"
          onClick={() => runAddressGeocode(customLocationInput)}
          disabled={locating || !customLocationInput.trim()}
          className="px-4 py-2 rounded-xl bg-[#FF7A00] hover:bg-[#e56d00] disabled:bg-slate-200 dark:disabled:bg-slate-700 disabled:text-slate-500 dark:disabled:text-slate-400 text-white text-xs font-semibold whitespace-nowrap cursor-pointer"
        >
          Pin New Location
        </button>
      </div>

      {notice && (
        <div className="text-xs text-[#0B3D22] dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-lg px-3 py-2 flex flex-wrap items-center justify-between gap-2">
          <span>{notice}</span>
          {resolvedAddress && onApplyResolvedAddress && (
            <button
              type="button"
              onClick={() => onApplyResolvedAddress(resolvedAddress)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#0B7A3E] text-white font-semibold text-[11px] hover:bg-[#096734] cursor-pointer"
            >
              <Sparkles className="w-3 h-3" />
              Fill Address Fields
            </button>
          )}
        </div>
      )}

      {GOOGLE_MAPS_API_KEY && (
        <div className="h-[280px] w-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
          <GoogleMap
            mapId="DEMO_MAP_ID"
            colorScheme={resolvedTheme === 'dark' ? 'DARK' : 'LIGHT'}
            internalUsageAttributionIds={[GMP_ATTRIBUTION_ID]}
            defaultCenter={fallbackCenter}
            defaultZoom={coords || userLocation ? 14 : 6}
            gestureHandling="greedy"
            streetViewControl={false}
            mapTypeControl={false}
            onClick={(ev) => {
              if (ev.detail?.latLng) {
                handleReverseGeocode(ev.detail.latLng.lat, ev.detail.latLng.lng, 'Map tapped.');
              }
            }}
            style={{ width: '100%', height: '100%' }}
          >
            <CenterMapOnPin coords={coords} />
            {userLocation && (
              <AdvancedMarker
                position={{ lat: userLocation.lat, lng: userLocation.lng }}
                title="Your Live Location"
              >
                <div className="w-3.5 h-3.5 rounded-full bg-blue-600 border-2 border-white shadow-md" />
              </AdvancedMarker>
            )}
            {coords && (
              <AdvancedMarker position={coords} title="Property Location">
                <Pin background="#0B7A3E" borderColor="#064E29" glyphColor="#FFFFFF" />
              </AdvancedMarker>
            )}
          </GoogleMap>
        </div>
      )}

      {coords && (
        <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
          Selected Coordinates: {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
        </p>
      )}
    </div>
  );
}
