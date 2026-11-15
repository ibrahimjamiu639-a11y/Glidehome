import { useEffect, useState } from 'react';
import {
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useAdvancedMarkerRef,
  useMap,
} from '@vis.gl/react-google-maps';
import { Crosshair, LocateFixed, MapPin, Navigation, Radio } from 'lucide-react';
import type { HouseListing } from '../types.ts';
import { formatNaira } from '../data/locations.ts';
import {
  formatDistanceKm,
  GMP_ATTRIBUTION_ID,
  GOOGLE_MAPS_API_KEY,
  haversineKm,
  type UserGeoLocation,
} from '../lib/maps.ts';
import { useTheme } from '../lib/theme.ts';

interface RealTimeHousesMapProps {
  houses: HouseListing[];
  userLocation: UserGeoLocation | null;
  liveTracking: boolean;
  locating: boolean;
  locationError: string;
  onRequestLocation: () => void;
  onToggleLiveTracking: () => void;
  onManualLocation: (address: string) => Promise<void>;
  onOpenHouse: (id: string) => void;
}

const DEFAULT_NIGERIA_CENTER = { lat: 9.082, lng: 8.6753 };

function MapViewportSync({
  houses,
  userLocation,
}: {
  houses: HouseListing[];
  userLocation: UserGeoLocation | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map || typeof google === 'undefined' || !google.maps) return;

    const points: { lat: number; lng: number }[] = [];
    if (userLocation) {
      points.push({ lat: userLocation.lat, lng: userLocation.lng });
    }
    for (const h of houses) {
      if (h.lat != null && h.lng != null) {
        points.push({ lat: h.lat, lng: h.lng });
      }
    }

    if (points.length === 0) return;

    if (points.length === 1) {
      map.setCenter(points[0]);
      map.setZoom(userLocation ? 13 : 12);
      return;
    }

    const bounds = new google.maps.LatLngBounds();
    points.forEach((pt) => bounds.extend(pt));
    map.fitBounds(bounds, 56);
  }, [map, houses, userLocation]);

  return null;
}

function HouseMapMarker({
  house,
  userLocation,
  isSelected,
  onSelect,
  onClose,
  onOpenHouse,
}: {
  house: HouseListing;
  userLocation: UserGeoLocation | null;
  isSelected: boolean;
  onSelect: () => void;
  onClose: () => void;
  onOpenHouse: (id: string) => void;
}) {
  const [markerRef, marker] = useAdvancedMarkerRef();

  if (house.lat == null || house.lng == null) return null;

  const isSold = house.status === 'SOLD OUT';
  const distanceKm =
    house.distanceKm != null
      ? house.distanceKm
      : userLocation
      ? haversineKm(userLocation.lat, userLocation.lng, house.lat, house.lng)
      : null;

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={{ lat: house.lat, lng: house.lng }}
        onClick={onSelect}
        title={`${house.title} (${formatNaira(house.price)})`}
      >
        <Pin
          background={isSold ? '#DC2626' : isSelected ? '#FF7A00' : '#0B7A3E'}
          borderColor={isSold ? '#991B1B' : isSelected ? '#C2410C' : '#064E29'}
          glyphColor="#FFFFFF"
        />
      </AdvancedMarker>

      {isSelected && marker && (
        <InfoWindow anchor={marker} maxWidth={260} onCloseClick={onClose}>
          <div className="p-1 space-y-1.5 text-slate-900">
            <div className="flex items-center justify-between gap-2">
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                  isSold ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-[#0B7A3E]'
                }`}
              >
                {house.status}
              </span>
              {distanceKm != null && (
                <span className="text-[11px] font-bold text-[#FF7A00] tabular-nums">
                  {formatDistanceKm(distanceKm)} away
                </span>
              )}
            </div>

            <p className="font-bold text-sm text-[#0B7A3E] tabular-nums">
              {formatNaira(house.price)}
              <span className="text-[11px] font-normal text-slate-500"> / yr</span>
            </p>
            <p className="font-semibold text-xs text-slate-900 line-clamp-2">{house.title}</p>
            <p className="text-[11px] text-slate-600">
              {house.area}, {house.state}
            </p>
            <button
              type="button"
              onClick={() => onOpenHouse(house.id)}
              className="w-full mt-1 py-1.5 px-3 rounded-lg bg-[#0B7A3E] hover:bg-[#096734] text-white text-xs font-semibold cursor-pointer"
            >
              View House &amp; Route
            </button>
          </div>
        </InfoWindow>
      )}
    </>
  );
}

function UserLocationMarker({ userLocation }: { userLocation: UserGeoLocation }) {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const [open, setOpen] = useState(false);

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={{ lat: userLocation.lat, lng: userLocation.lng }}
        onClick={() => setOpen((v) => !v)}
        title="Your Real-Time Location"
      >
        <div className="relative flex items-center justify-center">
          <span className="w-7 h-7 rounded-full bg-blue-500/25 animate-ping absolute" />
          <span className="w-4 h-4 rounded-full bg-blue-600 border-2 border-white shadow-md relative" />
        </div>
      </AdvancedMarker>
      {open && marker && (
        <InfoWindow anchor={marker} maxWidth={220} onCloseClick={() => setOpen(false)}>
          <div className="p-1 text-xs text-slate-800 space-y-0.5">
            <p className="font-bold text-blue-700">Your Location</p>
            {userLocation.label && <p>{userLocation.label}</p>}
            <p className="font-mono text-[11px] text-slate-500">
              {userLocation.lat.toFixed(5)}, {userLocation.lng.toFixed(5)}
            </p>
            {userLocation.accuracy && (
              <p className="text-[11px] text-slate-500">Accuracy: ±{Math.round(userLocation.accuracy)}m</p>
            )}
          </div>
        </InfoWindow>
      )}
    </>
  );
}

export function RealTimeHousesMap({
  houses,
  userLocation,
  liveTracking,
  locating,
  locationError,
  onRequestLocation,
  onToggleLiveTracking,
  onManualLocation,
  onOpenHouse,
}: RealTimeHousesMapProps) {
  const { resolvedTheme } = useTheme();
  const [selectedHouseId, setSelectedHouseId] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [manualLoading, setManualLoading] = useState(false);
  const [manualErr, setManualErr] = useState('');

  const mappableHouses = houses.filter((h) => h.lat != null && h.lng != null);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    setManualLoading(true);
    setManualErr('');
    try {
      await onManualLocation(manualInput.trim());
      setManualInput('');
    } catch (err) {
      setManualErr(err instanceof Error ? err.message : 'Could not find that location.');
    } finally {
      setManualLoading(false);
    }
  };

  return (
    <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
      {/* Real-time Location Access Toolbar */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-[#0B7A3E]/10 dark:bg-emerald-950/70 text-[#0B7A3E] dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Navigation className="w-4 h-4" aria-hidden="true" />
            </span>
            <div>
              <h3 className="font-display font-bold text-sm text-slate-900 dark:text-slate-100">
                Real-Time Map &amp; Distance (km)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {userLocation
                  ? `Active location: ${
                      userLocation.label || `${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}`
                    }${userLocation.accuracy ? ` (±${Math.round(userLocation.accuracy)}m)` : ''}`
                  : 'Allow GPS location access or type your area to see distances in km.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onRequestLocation}
              disabled={locating}
              className="px-3.5 py-2 rounded-xl bg-[#0B7A3E] hover:bg-[#096734] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
            >
              <Crosshair className="w-3.5 h-3.5" aria-hidden="true" />
              {locating ? 'Accessing GPS...' : userLocation ? 'Refresh Location' : 'Access My Location'}
            </button>

            <button
              type="button"
              onClick={onToggleLiveTracking}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 border transition-colors cursor-pointer ${
                liveTracking
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              <Radio className="w-3.5 h-3.5" aria-hidden="true" />
              {liveTracking ? 'Live Tracking: ON' : 'Live Tracking: OFF'}
            </button>
          </div>
        </div>

        <form onSubmit={handleManualSubmit} className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5">
            <MapPin className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
            <input
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="Or enter your current area/city (e.g. Ikeja, Lagos) to measure km"
              className="w-full text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none bg-transparent py-1"
            />
          </div>
          <button
            type="submit"
            disabled={manualLoading || !manualInput.trim()}
            className="px-4 py-2 rounded-xl bg-[#FF7A00] hover:bg-[#e56d00] disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-semibold whitespace-nowrap cursor-pointer"
          >
            {manualLoading ? 'Locating...' : 'Set My Location'}
          </button>
        </form>

        {(locationError || manualErr) && (
          <p className="text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
            {manualErr || locationError}
          </p>
        )}
      </div>

      {/* Interactive Google Map */}
      {!GOOGLE_MAPS_API_KEY ? (
        <div className="h-[320px] flex flex-col items-center justify-center p-6 text-center bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 space-y-2">
          <LocateFixed className="w-8 h-8 text-slate-400" />
          <p className="text-sm font-semibold">Google Maps is loading configuration...</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Distances in km will calculate once the Google Maps API key is active.
          </p>
        </div>
      ) : (
        <div className="h-[380px] sm:h-[440px] w-full relative">
          <GoogleMap
            mapId="DEMO_MAP_ID"
            colorScheme={resolvedTheme === 'dark' ? 'DARK' : 'LIGHT'}
            internalUsageAttributionIds={[GMP_ATTRIBUTION_ID]}
            defaultCenter={
              userLocation
                ? { lat: userLocation.lat, lng: userLocation.lng }
                : DEFAULT_NIGERIA_CENTER
            }
            defaultZoom={userLocation ? 12 : 6}
            gestureHandling="greedy"
            streetViewControl={false}
            mapTypeControl={false}
            style={{ width: '100%', height: '100%' }}
          >
            <MapViewportSync houses={mappableHouses} userLocation={userLocation} />

            {userLocation && <UserLocationMarker userLocation={userLocation} />}

            {mappableHouses.map((house) => (
              <HouseMapMarker
                key={house.id}
                house={house}
                userLocation={userLocation}
                isSelected={selectedHouseId === house.id}
                onSelect={() => setSelectedHouseId(house.id)}
                onClose={() => setSelectedHouseId(null)}
                onOpenHouse={onOpenHouse}
              />
            ))}
          </GoogleMap>

          <div className="absolute bottom-3 left-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-[11px] font-medium text-slate-700 dark:text-slate-200 shadow-sm flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
              You
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#0B7A3E] inline-block" />
              Houses ({mappableHouses.length})
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
