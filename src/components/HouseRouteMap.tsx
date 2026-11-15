import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useAdvancedMarkerRef,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import { Car, Crosshair, ExternalLink, Footprints, MapPin, Navigation, Radio, Route as RouteIcon } from 'lucide-react';
import type { HouseListing, RouteResult } from '../types.ts';
import {
  computeRouteViaServer,
  formatDistanceKm,
  geocodeAddressViaServer,
  GMP_ATTRIBUTION_ID,
  GOOGLE_MAPS_API_KEY,
  haversineKm,
  type UserGeoLocation,
} from '../lib/maps.ts';
import { useTheme } from '../lib/theme.ts';

interface HouseRouteMapProps {
  house: HouseListing;
}

function RoutePolylineLayer({
  encodedPolyline,
  origin,
  destination,
}: {
  encodedPolyline: string;
  origin: { lat: number; lng: number } | null;
  destination: { lat: number; lng: number } | null;
}) {
  const map = useMap();
  const geometryLib = useMapsLibrary('geometry');
  const polylineRef = useRef<google.maps.Polyline | null>(null);

  useEffect(() => {
    if (!map || typeof google === 'undefined' || !google.maps) return;

    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }

    if (encodedPolyline && geometryLib?.encoding) {
      const path = geometryLib.encoding.decodePath(encodedPolyline);
      const polyline = new google.maps.Polyline({
        path,
        strokeColor: '#0B7A3E',
        strokeWeight: 5,
        strokeOpacity: 0.9,
        map,
      });
      polylineRef.current = polyline;

      const bounds = new google.maps.LatLngBounds();
      path.forEach((pt) => bounds.extend(pt));
      if (origin) bounds.extend(origin);
      if (destination) bounds.extend(destination);
      map.fitBounds(bounds, 56);
    } else if (origin && destination) {
      const bounds = new google.maps.LatLngBounds();
      bounds.extend(origin);
      bounds.extend(destination);
      map.fitBounds(bounds, 64);
    } else if (destination) {
      map.setCenter(destination);
      map.setZoom(15);
    }

    return () => {
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
        polylineRef.current = null;
      }
    };
  }, [map, geometryLib, encodedPolyline, origin, destination]);

  return null;
}

export function HouseRouteMap({ house }: HouseRouteMapProps) {
  const { resolvedTheme } = useTheme();
  const [houseCoords, setHouseCoords] = useState<{ lat: number; lng: number } | null>(() =>
    house.lat != null && house.lng != null ? { lat: house.lat, lng: house.lng } : null
  );
  const [geocodingHouse, setGeocodingHouse] = useState(false);

  const [userLocation, setUserLocation] = useState<UserGeoLocation | null>(null);
  const [liveTracking, setLiveTracking] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');

  const [manualOrigin, setManualOrigin] = useState('');
  const [travelMode, setTravelMode] = useState<'DRIVE' | 'WALK'>('DRIVE');
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState('');

  const [houseMarkerRef, houseMarker] = useAdvancedMarkerRef();
  const [houseInfoOpen, setHouseInfoOpen] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  // Resolve coordinates if the listing doesn't have lat/lng yet
  useEffect(() => {
    if (house.lat != null && house.lng != null) {
      setHouseCoords({ lat: house.lat, lng: house.lng });
      return;
    }
    let active = true;
    setGeocodingHouse(true);
    const fullAddress = `${house.streetName}, ${house.area}, ${house.state}, ${house.country}`;
    geocodeAddressViaServer({ address: fullAddress, houseId: house.id })
      .then((res) => {
        if (active) setHouseCoords({ lat: res.lat, lng: res.lng });
      })
      .catch(() => {
        // fallback by area + state
        geocodeAddressViaServer({ address: `${house.area}, ${house.state}, ${house.country}`, houseId: house.id })
          .then((res) => {
            if (active) setHouseCoords({ lat: res.lat, lng: res.lng });
          })
          .catch(() => {});
      })
      .finally(() => {
        if (active) setGeocodingHouse(false);
      });
    return () => {
      active = false;
    };
  }, [house]);

  const computeRoute = useCallback(
    async (origin: UserGeoLocation, dest: { lat: number; lng: number }, mode: 'DRIVE' | 'WALK') => {
      setRouteLoading(true);
      setRouteError('');
      try {
        const result = await computeRouteViaServer({
          originLat: origin.lat,
          originLng: origin.lng,
          destLat: dest.lat,
          destLng: dest.lng,
          travelMode: mode,
        });
        setRouteResult(result);
      } catch (err) {
        setRouteError(err instanceof Error ? err.message : 'Unable to calculate driving route.');
      } finally {
        setRouteLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (userLocation && houseCoords) {
      computeRoute(userLocation, houseCoords, travelMode);
    }
  }, [userLocation, houseCoords, travelMode, computeRoute]);

  const requestGpsLocation = useCallback(() => {
    setLocationError('');
    if (!navigator.geolocation) {
      setLocationError('GPS location is not supported on this browser. Enter your starting area below.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords: UserGeoLocation = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        try {
          const rev = await geocodeAddressViaServer({ lat: coords.lat, lng: coords.lng });
          coords.label = rev.formattedAddress;
        } catch {
          // keep coordinates without label
        }
        setUserLocation(coords);
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        if (err.code === err.PERMISSION_DENIED) {
          setLocationError('Location permission was denied. Enable browser location or enter your starting area below.');
        } else {
          setLocationError('Unable to detect live GPS right now. Try again or enter your starting area below.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 }
    );
  }, []);

  useEffect(() => {
    if (!liveTracking) {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }
    if (!navigator.geolocation) {
      setLocationError('Live tracking is not supported in this browser.');
      setLiveTracking(false);
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setUserLocation((prev) => ({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          label: prev?.label,
        }));
        setLocationError('');
      },
      () => {
        setLocationError('Live GPS tracking interrupted. Check device location permissions.');
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 12000 }
    );
    watchIdRef.current = id;
    return () => {
      navigator.geolocation.clearWatch(id);
      watchIdRef.current = null;
    };
  }, [liveTracking]);

  const handleManualOrigin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualOrigin.trim()) return;
    setLocating(true);
    setLocationError('');
    try {
      const geo = await geocodeAddressViaServer({ address: manualOrigin.trim() });
      setLiveTracking(false);
      setUserLocation({
        lat: geo.lat,
        lng: geo.lng,
        label: geo.formattedAddress,
      });
    } catch (err) {
      setLocationError(err instanceof Error ? err.message : 'Could not find that starting point.');
    } finally {
      setLocating(false);
    }
  };

  const directKm =
    userLocation && houseCoords
      ? haversineKm(userLocation.lat, userLocation.lng, houseCoords.lat, houseCoords.lng)
      : null;

  const googleMapsNavUrl = houseCoords
    ? userLocation
      ? `https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${houseCoords.lat},${houseCoords.lng}`
      : `https://www.google.com/maps/search/?api=1&query=${houseCoords.lat},${houseCoords.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `${house.streetName}, ${house.area}, ${house.state}, ${house.country}`
      )}`;

  return (
    <section className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-100 dark:border-slate-800 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display font-bold text-lg text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Navigation className="w-5 h-5 text-[#0B7A3E] dark:text-emerald-400" aria-hidden="true" />
            <span>Real-Time Map, Distance (km) &amp; Route</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Access your real-time GPS location to see exact kilometers and route to this property.
          </p>
        </div>

        <a
          href={googleMapsNavUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0B7A3E] dark:text-emerald-400 hover:underline"
        >
          <span>Open in Google Maps</span>
          <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
        </a>
      </div>

      {/* Location Access & Travel Mode Bar */}
      <div className="bg-slate-50 dark:bg-slate-800/70 rounded-xl p-3.5 border border-slate-200 dark:border-slate-700 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={requestGpsLocation}
              disabled={locating}
              className="px-4 py-2 rounded-xl bg-[#0B7A3E] hover:bg-[#096734] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              <Crosshair className="w-3.5 h-3.5" aria-hidden="true" />
              {locating ? 'Getting Location...' : userLocation ? 'Update My GPS' : 'Access Location & Tell km'}
            </button>

            <button
              type="button"
              onClick={() => setLiveTracking((v) => !v)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 border cursor-pointer ${
                liveTracking
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Radio className="w-3.5 h-3.5" aria-hidden="true" />
              {liveTracking ? 'Live Tracking: ON' : 'Live Tracking: OFF'}
            </button>
          </div>

          <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-1">
            <button
              type="button"
              onClick={() => setTravelMode('DRIVE')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold inline-flex items-center gap-1 cursor-pointer ${
                travelMode === 'DRIVE'
                  ? 'bg-[#0B7A3E] text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Car className="w-3.5 h-3.5" />
              Drive
            </button>
            <button
              type="button"
              onClick={() => setTravelMode('WALK')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold inline-flex items-center gap-1 cursor-pointer ${
                travelMode === 'WALK'
                  ? 'bg-[#0B7A3E] text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Footprints className="w-3.5 h-3.5" />
              Walk
            </button>
          </div>
        </div>

        <form onSubmit={handleManualOrigin} className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5">
            <MapPin className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
            <input
              type="text"
              value={manualOrigin}
              onChange={(e) => setManualOrigin(e.target.value)}
              placeholder="Or enter starting area (e.g. Oshodi, Lagos) to measure km"
              className="w-full text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none bg-transparent py-1"
            />
          </div>
          <button
            type="submit"
            disabled={locating || !manualOrigin.trim()}
            className="px-4 py-2 rounded-xl bg-[#FF7A00] hover:bg-[#e56d00] disabled:bg-slate-200 dark:disabled:bg-slate-700 disabled:text-slate-500 dark:disabled:text-slate-400 text-white text-xs font-semibold whitespace-nowrap cursor-pointer"
          >
            Calculate km
          </button>
        </form>

        {locationError && (
          <p className="text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
            {locationError}
          </p>
        )}
        {routeError && (
          <p className="text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
            {routeError}
          </p>
        )}
      </div>

      {/* Live Distance Readout */}
      {userLocation && houseCoords && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#0B7A3E] dark:text-emerald-400">
              Road Distance (km)
            </p>
            <p className="mt-1 font-display font-bold text-xl text-[#0B3D22] dark:text-emerald-200 tabular-nums">
              {routeLoading
                ? 'Calculating...'
                : routeResult
                ? formatDistanceKm(routeResult.distanceKm)
                : directKm !== null
                ? `~${formatDistanceKm(directKm)}`
                : '—'}
            </p>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Estimated Travel Time
            </p>
            <p className="mt-1 font-display font-bold text-xl text-slate-900 dark:text-slate-100 tabular-nums">
              {routeLoading ? 'Calculating...' : routeResult ? routeResult.durationText : '—'}
            </p>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Direct Distance
            </p>
            <p className="mt-1 font-display font-bold text-xl text-slate-900 dark:text-slate-100 tabular-nums">
              {directKm !== null ? formatDistanceKm(directKm) : '—'}
            </p>
          </div>
        </div>
      )}

      {/* Map Canvas */}
      {!GOOGLE_MAPS_API_KEY ? (
        <div className="h-[320px] rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center p-6 text-center text-slate-600 dark:text-slate-300">
          <RouteIcon className="w-8 h-8 text-slate-400 mb-2" />
          <p className="text-sm font-semibold">Interactive map waiting for Google Maps configuration</p>
        </div>
      ) : geocodingHouse ? (
        <div className="h-[360px] rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse flex items-center justify-center text-sm text-slate-500 dark:text-slate-400">
          Locating property on Google Maps...
        </div>
      ) : houseCoords ? (
        <div className="h-[360px] sm:h-[400px] w-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
          <GoogleMap
            mapId="DEMO_MAP_ID"
            colorScheme={resolvedTheme === 'dark' ? 'DARK' : 'LIGHT'}
            internalUsageAttributionIds={[GMP_ATTRIBUTION_ID]}
            defaultCenter={houseCoords}
            defaultZoom={14}
            gestureHandling="greedy"
            streetViewControl={false}
            mapTypeControl={false}
            style={{ width: '100%', height: '100%' }}
          >
            <RoutePolylineLayer
              encodedPolyline={routeResult?.encodedPolyline || ''}
              origin={userLocation ? { lat: userLocation.lat, lng: userLocation.lng } : null}
              destination={houseCoords}
            />

            <AdvancedMarker
              ref={houseMarkerRef}
              position={houseCoords}
              onClick={() => setHouseInfoOpen((v) => !v)}
              title={house.title}
            >
              <Pin background="#0B7A3E" borderColor="#064E29" glyphColor="#FFFFFF" />
            </AdvancedMarker>

            {houseInfoOpen && houseMarker && (
              <InfoWindow anchor={houseMarker} maxWidth={240} onCloseClick={() => setHouseInfoOpen(false)}>
                <div className="p-1 text-xs space-y-1 text-slate-900">
                  <p className="font-bold text-[#0B7A3E]">{house.title}</p>
                  <p className="text-slate-600">
                    {house.houseNumber} {house.streetName}, {house.area}, {house.state}
                  </p>
                </div>
              </InfoWindow>
            )}

            {userLocation && (
              <AdvancedMarker
                position={{ lat: userLocation.lat, lng: userLocation.lng }}
                title="Your Location"
              >
                <div className="relative flex items-center justify-center">
                  <span className="w-7 h-7 rounded-full bg-blue-500/25 animate-ping absolute" />
                  <span className="w-4 h-4 rounded-full bg-blue-600 border-2 border-white shadow-md relative" />
                </div>
              </AdvancedMarker>
            )}
          </GoogleMap>
        </div>
      ) : (
        <div className="h-[260px] rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center p-6 text-center space-y-2">
          <MapPin className="w-8 h-8 text-slate-400" />
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Exact coordinates for {house.area}, {house.state} could not be resolved automatically.
          </p>
          <a
            href={googleMapsNavUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold text-[#0B7A3E] dark:text-emerald-400 hover:underline"
          >
            Search this address directly on Google Maps →
          </a>
        </div>
      )}
    </section>
  );
}
