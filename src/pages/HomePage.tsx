import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Search,
  SlidersHorizontal,
  Home as HomeIcon,
  RotateCcw,
  Megaphone,
  ChevronDown,
  ChevronUp,
  Navigation,
  MapPin,
  Map as MapIcon,
  LayoutGrid,
  Tag,
  ArrowUpRight,
  Check,
  Clock,
  Flag,
  MessageCircle,
  Package,
  X,
} from 'lucide-react';
import type { AdminNote, AuthUser, HomePropertyItem, HouseListing } from '../types.ts';
import {
  ALL_COUNTRIES,
  AMENITY_OPTIONS,
  HOME_PROPERTY_CATEGORIES,
  HOME_PROPERTY_CONDITIONS,
  HOUSE_TYPES,
  NIGERIAN_STATES,
  formatNaira,
} from '../data/locations.ts';
import { apiRequest } from '../lib/api.ts';
import { geocodeAddressViaServer, type UserGeoLocation } from '../lib/maps.ts';
import { getBrowserCoordinates } from '../lib/permissions.ts';
import { buildItemWhatsappUrl } from '../lib/whatsapp.ts';
import { Anti419Warning } from '../components/Anti419Warning.tsx';
import { HouseCard } from '../components/HouseCard.tsx';
import { RealTimeHousesMap } from '../components/RealTimeHousesMap.tsx';

interface HomePageProps {
  user: AuthUser | null;
  userLocation: UserGeoLocation | null;
  onUpdateUserLocation: (loc: UserGeoLocation | null) => void;
  onOpenHouse: (id: string) => void;
  onNavigate: (path: string) => void;
  onRequestAgentUpgrade?: () => Promise<void>;
  upgradingAgent?: boolean;
  onReportUser?: (uid?: string, listingType?: 'general' | 'house' | 'item', listingId?: string) => void;
  favoriteIds?: Set<string>;
  onToggleFavorite?: (houseId: string) => void;
}

const PRICE_RANGES = [
  { label: 'Any Price', min: 0, max: 0 },
  { label: 'Under ₦1,000,000', min: 0, max: 1000000 },
  { label: '₦1,000,000 – ₦3,000,000', min: 1000000, max: 3000000 },
  { label: '₦3,000,000 – ₦6,000,000', min: 3000000, max: 6000000 },
  { label: 'Above ₦6,000,000', min: 6000000, max: 0 },
];

const DISTANCE_OPTIONS = [
  { label: 'Any Distance', maxKm: 0 },
  { label: 'Within 5 km', maxKm: 5 },
  { label: 'Within 10 km', maxKm: 10 },
  { label: 'Within 25 km', maxKm: 25 },
  { label: 'Within 50 km', maxKm: 50 },
];

export function HomePage({
  user,
  userLocation,
  onUpdateUserLocation,
  onOpenHouse,
  onNavigate,
  onRequestAgentUpgrade,
  upgradingAgent,
  onReportUser,
  favoriteIds,
  onToggleFavorite,
}: HomePageProps) {
  const [marketTab, setMarketTab] = useState<'houses' | 'items'>('houses');
  const [houses, setHouses] = useState<HouseListing[]>([]);
  const [homeItems, setHomeItems] = useState<HomePropertyItem[]>([]);
  const [itemCategory, setItemCategory] = useState('All');
  const [itemCondition, setItemCondition] = useState('All');
  const [loadingItems, setLoadingItems] = useState(false);

  const [adminNotes, setAdminNotes] = useState<AdminNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'price_asc' | 'price_desc' | 'nearest'>('newest');
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [houseType, setHouseType] = useState('All');
  const [stateFilter, setStateFilter] = useState('All');
  const [countryFilter, setCountryFilter] = useState('All');
  const [priceRangeIdx, setPriceRangeIdx] = useState(0);
  const [maxKm, setMaxKm] = useState(0);

  const [viewMode, setViewMode] = useState<'split' | 'map' | 'list'>('split');
  const [liveTracking, setLiveTracking] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [nearbyNotice, setNearbyNotice] = useState('');
  const watchIdRef = useRef<number | null>(null);
  const userLocationRef = useRef<UserGeoLocation | null>(userLocation);
  userLocationRef.current = userLocation;

  const fetchHouses = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const range = PRICE_RANGES[priceRangeIdx] || PRICE_RANGES[0];
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set('q', searchQuery.trim());
      if (sortOrder !== 'newest') params.set('sort', sortOrder);
      if (selectedAmenities.length > 0) params.set('amenities', selectedAmenities.join(','));
      if (houseType !== 'All') params.set('houseType', houseType);
      if (stateFilter !== 'All') params.set('state', stateFilter);
      if (countryFilter !== 'All') params.set('country', countryFilter);
      if (range.min > 0) params.set('minPrice', String(range.min));
      if (range.max > 0) params.set('maxPrice', String(range.max));
      if (userLocation) {
        params.set('userLat', String(userLocation.lat));
        params.set('userLng', String(userLocation.lng));
        if (maxKm > 0) params.set('maxKm', String(maxKm));
      }

      const res = await apiRequest<{ houses: HouseListing[] }>(`/api/houses?${params.toString()}`);
      setHouses(res.houses);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load houses right now.');
    } finally {
      setLoading(false);
    }
  }, [
    searchQuery,
    sortOrder,
    selectedAmenities,
    houseType,
    stateFilter,
    countryFilter,
    priceRangeIdx,
    userLocation,
    maxKm,
  ]);

  const fetchHomeItems = useCallback(async () => {
    setLoadingItems(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set('q', searchQuery.trim());
      if (itemCategory !== 'All') params.set('category', itemCategory);
      if (itemCondition !== 'All') params.set('condition', itemCondition);
      if (stateFilter !== 'All') params.set('state', stateFilter);
      if (countryFilter !== 'All') params.set('country', countryFilter);
      const res = await apiRequest<{ items: HomePropertyItem[] }>(`/api/items?${params.toString()}`);
      setHomeItems(res.items);
    } catch {
      // ignore
    } finally {
      setLoadingItems(false);
    }
  }, [searchQuery, itemCategory, itemCondition, stateFilter, countryFilter]);

  useEffect(() => {
    fetchHouses();
  }, [fetchHouses]);

  useEffect(() => {
    fetchHomeItems();
  }, [fetchHomeItems]);

  useEffect(() => {
    apiRequest<{ notes: AdminNote[] }>('/api/notes/latest')
      .then((res) => setAdminNotes(res.notes))
      .catch(() => {});
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
      setLocationError('Live GPS tracking is not supported on this device.');
      setLiveTracking(false);
      return;
    }

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const prev = userLocationRef.current;
        onUpdateUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          label: prev?.label,
          state: prev?.state,
        });
        setLocationError('');
      },
      () => {
        setLocationError('Live GPS tracking stopped. Check browser location permissions or set your area manually.');
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 12000 }
    );
    watchIdRef.current = id;

    return () => {
      navigator.geolocation.clearWatch(id);
      watchIdRef.current = null;
    };
  }, [liveTracking, onUpdateUserLocation]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchHouses();
  };

  const toggleAmenity = (key: string) => {
    setMarketTab('houses');
    setSelectedAmenities((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    );
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSortOrder('newest');
    setSelectedAmenities([]);
    setHouseType('All');
    setStateFilter('All');
    setCountryFilter('All');
    setPriceRangeIdx(0);
    setMaxKm(0);
    setNearbyNotice('');
  };

  const requestRealTimeLocation = useCallback(
    async (scrollToListings = false) => {
      setNearbyNotice('');
      setLocationError('');
      setLocating(true);

      const res = await getBrowserCoordinates();
      if (!res.ok) {
        setLocating(false);
        setLocationError(res.message);
        if (scrollToListings) {
          document.getElementById('map-section')?.scrollIntoView({ behavior: 'smooth' });
        }
        return;
      }

      const coords: UserGeoLocation = {
        lat: res.lat,
        lng: res.lng,
        accuracy: res.accuracy,
      };

      try {
        const rev = await geocodeAddressViaServer({ lat: coords.lat, lng: coords.lng });
        coords.label = rev.formattedAddress;
        coords.state = rev.state;
      } catch {
        // Keep coordinates even if reverse geocode fails or quota is reached
      }

      onUpdateUserLocation(coords);
      setSortOrder('nearest');
      setNearbyNotice(
        `Real-time location active${coords.label ? ` (${coords.label})` : ''}. Distances in km are shown below.`
      );
      setLocating(false);
      if (scrollToListings) {
        document.getElementById('map-section')?.scrollIntoView({ behavior: 'smooth' });
      }
    },
    [onUpdateUserLocation]
  );

  const handleManualLocation = async (address: string) => {
    setLocationError('');
    const geo = await geocodeAddressViaServer({ address });
    setLiveTracking(false);
    onUpdateUserLocation({
      lat: geo.lat,
      lng: geo.lng,
      label: geo.formattedAddress,
      state: geo.state,
    });
    setSortOrder('nearest');
    setNearbyNotice(`Location set to ${geo.formattedAddress}. Distances in km updated.`);
  };

  const handleToggleHouseStatus = async (houseId: string, nextStatus: 'Available' | 'SOLD OUT') => {
    try {
      const res = await apiRequest<{ house: HouseListing }>(`/api/houses/${houseId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      setHouses((prev) => prev.map((h) => (h.id === houseId ? res.house : h)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update house status.');
    }
  };

  const handleAdjustPrice = async (houseId: string, newPrice: number) => {
    const res = await apiRequest<{ house: HouseListing }>(`/api/houses/${houseId}/price`, {
      method: 'PATCH',
      body: JSON.stringify({ price: newPrice }),
    });
    setHouses((prev) => prev.map((h) => (h.id === houseId ? res.house : h)));
  };

  const activeFilterCount =
    (houseType !== 'All' ? 1 : 0) +
    (stateFilter !== 'All' ? 1 : 0) +
    (countryFilter !== 'All' ? 1 : 0) +
    (priceRangeIdx > 0 ? 1 : 0) +
    (maxKm > 0 ? 1 : 0) +
    (sortOrder !== 'newest' ? 1 : 0) +
    selectedAmenities.length;

  return (
    <div>
      {/* Hero Section */}
      <section className="relative min-h-[400px] sm:min-h-[450px] flex items-center justify-center overflow-hidden">
        <img
          src="/src/assets/images/hero_nigerian_home_1794704408342.jpg"
          alt="Beautiful modern Nigerian home for rent"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0B3D22]/80 via-[#0B7A3E]/70 to-[#0B3D22]/90" />

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-12 text-center text-white w-full">
          <h1
            style={{ textWrap: 'balance' }}
            className="font-display font-bold text-3xl sm:text-5xl tracking-tight leading-tight"
          >
            Find Your Next House Without Stress
          </h1>
          <p className="mt-3 sm:mt-4 text-base sm:text-lg text-white/90 font-medium max-w-2xl mx-auto">
            Real Pictures. Real Landlords. Verified KYC. Live Map &amp; Distance in km.
          </p>

          <form
            onSubmit={handleSearchSubmit}
            className="mt-8 bg-white dark:bg-slate-900 border border-transparent dark:border-slate-700 rounded-2xl p-2 shadow-xl max-w-2xl mx-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
          >
            <div className="flex-1 flex items-center gap-2.5 px-3">
              <Search className="w-5 h-5 text-slate-400 shrink-0" aria-hidden="true" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by area, state, or country (e.g. Lekki, Abuja, Lagos)"
                className="w-full py-2.5 text-sm sm:text-base text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none bg-transparent"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-2 shrink-0">
              <button
                type="submit"
                className="px-6 py-3 rounded-xl bg-[#0B7A3E] hover:bg-[#096734] text-white font-semibold text-sm whitespace-nowrap transition-colors cursor-pointer"
              >
                Search Houses
              </button>
              <button
                type="button"
                onClick={() => requestRealTimeLocation(true)}
                disabled={locating}
                className="px-4 py-3 rounded-xl bg-[#FF7A00] hover:bg-[#e56d00] text-white font-semibold text-sm whitespace-nowrap inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
              >
                <Navigation className="w-4 h-4" aria-hidden="true" />
                {locating ? 'Locating...' : 'Nearby Houses (km)'}
              </button>
            </div>
          </form>

          {/* Interactive Amenities Quick Filter Chip Group */}
          <div
            role="group"
            aria-label="Filter houses by amenities"
            className="mt-4 max-w-3xl mx-auto flex flex-wrap items-center justify-center gap-2"
          >
            <span className="text-xs font-semibold text-white/90 mr-0.5 whitespace-nowrap">
              Amenities:
            </span>
            {AMENITY_OPTIONS.map((am) => {
              const active = selectedAmenities.includes(am.key);
              return (
                <button
                  key={am.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleAmenity(am.key)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 min-h-[36px] border transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-white ${
                    active
                      ? 'bg-white text-[#0B3D22] border-white shadow-sm font-bold'
                      : 'bg-white/12 hover:bg-white/22 text-white border-white/25 backdrop-blur-xs'
                  }`}
                >
                  {active && <Check className="w-3.5 h-3.5 text-[#0B7A3E] shrink-0" aria-hidden="true" />}
                  <span>{am.shortLabel}</span>
                </button>
              );
            })}
            {selectedAmenities.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedAmenities([])}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 min-h-[36px] bg-black/25 hover:bg-black/40 text-white border border-white/20 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-white"
              >
                <X className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Clear ({selectedAmenities.length})</span>
              </button>
            )}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('/sell-property')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/30 text-white text-xs sm:text-sm font-semibold backdrop-blur-xs transition-colors cursor-pointer"
            >
              <Tag className="w-4 h-4 text-[#FF7A00]" aria-hidden="true" />
              Sell Home Property (TV, Gas, Fan...)
            </button>

            {user?.state && (
              <button
                type="button"
                onClick={() => {
                  setStateFilter(NIGERIAN_STATES.includes(user.state) ? user.state : 'All');
                  if (!NIGERIAN_STATES.includes(user.state)) setSearchQuery(user.state);
                  setNearbyNotice(`Showing nearby houses in ${user.state}.`);
                  document.getElementById('listings-section')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-white/95 hover:text-white underline underline-offset-4 cursor-pointer"
              >
                <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                Quick View: Houses near {user.state}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Buyer -> Agent Upgrade Card */}
        {user && user.role === 'buyer' && (
          <section className="bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900/70 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="font-display font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100">
                {user.agentUpgradeStatus === 'pending'
                  ? 'Agent Upgrade Request Pending Admin Approval'
                  : 'Want to Upload Houses as an Agent or Landlord?'}
              </p>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                {user.agentUpgradeStatus === 'pending'
                  ? 'Your request is under review. As soon as Admin accepts it, your account switches to Agent automatically.'
                  : user.agentUpgradeStatus === 'rejected'
                  ? `Previous upgrade request was declined${user.agentUpgradeReason ? `: ${user.agentUpgradeReason}` : '.'} You can request again anytime.`
                  : 'Switch from Buyer to Agent anytime you want. Click Upgrade to Agent to send your request to Admin.'}
              </p>
            </div>
            {user.agentUpgradeStatus === 'pending' ? (
              <span className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200 text-xs font-bold whitespace-nowrap shrink-0">
                <Clock className="w-4 h-4" />
                Pending Admin Approval
              </span>
            ) : (
              <button
                type="button"
                disabled={upgradingAgent}
                onClick={() => onRequestAgentUpgrade?.()}
                className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#0B7A3E] hover:bg-[#096734] text-white text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
              >
                <ArrowUpRight className="w-4 h-4" />
                {upgradingAgent ? 'Sending...' : 'Upgrade to Agent'}
              </button>
            )}
          </section>
        )}

        {/* Anti-419 Warning Box */}
        <Anti419Warning />

        {/* Public Admin Notes for Visitors (Registered users see the Broadcast Banner right at the top) */}
        {!user && adminNotes.length > 0 && (
          <section className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 sm:p-5 space-y-2.5">
            <div className="flex items-center gap-2 text-[#0B3D22] dark:text-emerald-300 font-display font-bold text-sm">
              <Megaphone className="w-4 h-4 text-[#0B7A3E] dark:text-emerald-400" aria-hidden="true" />
              <span>Notice from Glide Homes Admin</span>
            </div>
            <div className="space-y-2">
              {adminNotes.map((note) => (
                <div key={note.id} className="text-sm text-slate-800 dark:text-slate-100 flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                  <p>{note.message}</p>
                  <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    {new Date(note.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Mobile Filter Toggle Button */}
        <div className="lg:hidden">
          <button
            type="button"
            onClick={() => setMobileFiltersOpen((v) => !v)}
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 flex items-center justify-between text-sm font-semibold text-slate-800 dark:text-slate-100 shadow-xs cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-[#0B7A3E] dark:text-emerald-400" />
              <span>Advanced Filters &amp; Sorting {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}</span>
            </span>
            {mobileFiltersOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* Two-column layout: Advanced Filter Sidebar + Map & Listings */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          {/* Advanced Filter Sidebar */}
          <aside
            className={`lg:col-span-1 bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-xs border border-slate-100 dark:border-slate-800 space-y-5 lg:sticky lg:top-20 ${
              mobileFiltersOpen ? 'block' : 'hidden lg:block'
            }`}
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2 font-display font-bold text-sm text-slate-900 dark:text-slate-100">
                <SlidersHorizontal className="w-4 h-4 text-[#0B7A3E] dark:text-emerald-400" aria-hidden="true" />
                <span>Filter &amp; Sort</span>
              </div>
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#0B7A3E] dark:text-emerald-400 hover:underline cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" aria-hidden="true" />
                Reset
              </button>
            </div>

            {/* Sort by Price / Nearest */}
            <div>
              <label htmlFor="sort-order" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Sort By
              </label>
              <select
                id="sort-order"
                value={sortOrder}
                onChange={(e) =>
                  setSortOrder(e.target.value as 'newest' | 'price_asc' | 'price_desc' | 'nearest')
                }
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0B7A3E]"
              >
                <option value="newest">Newest Listings</option>
                <option value="nearest" disabled={!userLocation}>
                  Nearest Distance (km){!userLocation ? ' — enable GPS' : ''}
                </option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
              </select>
            </div>

            {/* Distance Radius */}
            <div>
              <label htmlFor="filter-distance" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Max Distance (km)
              </label>
              <select
                id="filter-distance"
                value={maxKm}
                disabled={!userLocation}
                onChange={(e) => setMaxKm(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0B7A3E] disabled:opacity-60"
              >
                {DISTANCE_OPTIONS.map((opt) => (
                  <option key={opt.label} value={opt.maxKm}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {!userLocation && (
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  Access location on the map to filter by km.
                </p>
              )}
            </div>

            {/* Price Range */}
            <div>
              <label htmlFor="filter-price" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Price Range
              </label>
              <select
                id="filter-price"
                value={priceRangeIdx}
                onChange={(e) => setPriceRangeIdx(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0B7A3E]"
              >
                {PRICE_RANGES.map((r, i) => (
                  <option key={r.label} value={i}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            {/* House Type */}
            <div>
              <label htmlFor="filter-type" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                House Type
              </label>
              <select
                id="filter-type"
                value={houseType}
                onChange={(e) => setHouseType(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0B7A3E]"
              >
                <option value="All">All House Types</option>
                {HOUSE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            {/* State */}
            <div>
              <label htmlFor="filter-state" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                State
              </label>
              <select
                id="filter-state"
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0B7A3E]"
              >
                <option value="All">All States</option>
                {NIGERIAN_STATES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            {/* Country */}
            <div>
              <label htmlFor="filter-country" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Country
              </label>
              <select
                id="filter-country"
                value={countryFilter}
                onChange={(e) => setCountryFilter(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0B7A3E]"
              >
                <option value="All">All Countries</option>
                {ALL_COUNTRIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Amenities Checkboxes */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2.5">Amenities</p>
              <div className="space-y-2">
                {AMENITY_OPTIONS.map((am) => {
                  const checked = selectedAmenities.includes(am.key);
                  return (
                    <label
                      key={am.key}
                      className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer select-none"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleAmenity(am.key)}
                        className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-[#0B7A3E] focus:ring-[#0B7A3E]"
                      />
                      <span>{am.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </aside>

          {/* Main Listings + Real-Time Map Column */}
          <div id="listings-section" className="lg:col-span-3 space-y-5">
            {/* Switch between Houses for Rent and Home Property Market */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2 flex flex-wrap items-center justify-between gap-2 shadow-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setMarketTab('houses')}
                  className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
                    marketTab === 'houses'
                      ? 'bg-[#0B7A3E] text-white'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <HomeIcon className="w-4 h-4" />
                  Houses for Rent ({houses.length})
                </button>
                <button
                  type="button"
                  onClick={() => setMarketTab('items')}
                  className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
                    marketTab === 'items'
                      ? 'bg-[#0B7A3E] text-white'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Package className="w-4 h-4" />
                  Home Property (TV, Gas, Fan) ({homeItems.length})
                </button>
              </div>

              <button
                type="button"
                onClick={() => onNavigate('/sell-property')}
                className="px-4 py-2 rounded-xl bg-[#FF7A00] hover:bg-[#e56d00] text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Tag className="w-4 h-4" />
                Sell Home Property
              </button>
            </div>

            {marketTab === 'houses' ? (
              <>
                {nearbyNotice && (
                  <div className="bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-xl px-4 py-3 text-sm text-[#0B3D22] dark:text-emerald-200 flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-2 font-medium">
                      <Navigation className="w-4 h-4 text-[#0B7A3E] dark:text-emerald-400 shrink-0" aria-hidden="true" />
                      {nearbyNotice}
                    </span>
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="text-xs font-semibold text-[#0B7A3E] dark:text-emerald-400 hover:underline cursor-pointer"
                    >
                      Reset Filters
                    </button>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="font-display font-bold text-xl sm:text-2xl text-slate-900 dark:text-slate-100">
                    Available Rental Houses
                  </h2>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1">
                      <button
                        type="button"
                        onClick={() => setViewMode('split')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1 cursor-pointer ${
                          viewMode === 'split'
                            ? 'bg-[#0B7A3E] text-white'
                            : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        Map + List
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode('map')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1 cursor-pointer ${
                          viewMode === 'map'
                            ? 'bg-[#0B7A3E] text-white'
                            : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        <MapIcon className="w-3.5 h-3.5" aria-hidden="true" />
                        Map
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode('list')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1 cursor-pointer ${
                          viewMode === 'list'
                            ? 'bg-[#0B7A3E] text-white'
                            : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        <LayoutGrid className="w-3.5 h-3.5" aria-hidden="true" />
                        List
                      </button>
                    </div>

                    <span className="text-sm text-slate-500 dark:text-slate-400 tabular-nums">
                      {houses.length} {houses.length === 1 ? 'listing' : 'listings'}
                    </span>
                  </div>
                </div>

                {viewMode !== 'list' && (
                  <div id="map-section">
                    <RealTimeHousesMap
                      houses={houses}
                      userLocation={userLocation}
                      liveTracking={liveTracking}
                      locating={locating}
                      locationError={locationError}
                      onRequestLocation={() => requestRealTimeLocation(false)}
                      onToggleLiveTracking={() => setLiveTracking((v) => !v)}
                      onManualLocation={handleManualLocation}
                      onOpenHouse={onOpenHouse}
                    />
                  </div>
                )}

                {error && (
                  <div className="bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 rounded-xl p-4 text-sm">
                    {error}
                  </div>
                )}

                {viewMode !== 'map' && (
                  <>
                    {loading ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                        {[1, 2, 3].map((n) => (
                          <div key={n} className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden shadow-xs border border-slate-100 dark:border-slate-800 animate-pulse">
                            <div className="aspect-[4/3] bg-slate-200 dark:bg-slate-800" />
                            <div className="p-5 space-y-3">
                              <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded w-1/2" />
                              <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-4/5" />
                              <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-3/5" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : houses.length === 0 ? (
                      <div className="bg-white dark:bg-slate-900 rounded-2xl p-10 sm:p-12 text-center border border-slate-100 dark:border-slate-800 shadow-xs space-y-3">
                        <HomeIcon className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" aria-hidden="true" />
                        <h3 className="font-display font-semibold text-lg text-slate-900 dark:text-slate-100">
                          {activeFilterCount > 0 || searchQuery.trim()
                            ? 'No houses match your selected filters'
                            : 'No houses published yet'}
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                          {activeFilterCount > 0 || searchQuery.trim()
                            ? 'Try resetting your filters or searching a different area.'
                            : 'Verified landlords and agents can upload new houses for admin approval. Approved houses will appear right here.'}
                        </p>
                        <div className="pt-2 flex flex-wrap justify-center gap-3">
                          {(activeFilterCount > 0 || searchQuery.trim()) && (
                            <button
                              type="button"
                              onClick={handleResetFilters}
                              className="px-5 py-2.5 rounded-xl bg-[#0B7A3E] hover:bg-[#096734] text-white text-sm font-semibold cursor-pointer"
                            >
                              Reset Filters
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onNavigate('/upload-house')}
                            className="px-5 py-2.5 rounded-xl bg-[#FF7A00] hover:bg-[#e56d00] text-white text-sm font-semibold cursor-pointer"
                          >
                            Upload New House
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                        {houses.map((house) => (
                          <HouseCard
                            key={house.id}
                            house={house}
                            onOpen={onOpenHouse}
                            canManage={Boolean(user && user.id === house.agentId)}
                            onToggleStatus={handleToggleHouseStatus}
                            onAdjustPrice={handleAdjustPrice}
                            isFavorite={Boolean(favoriteIds?.has(house.id))}
                            onToggleFavorite={onToggleFavorite}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </>
            ) : (
              /* HOME PROPERTY ITEMS SECTION (TV, Gas, Fan, Fridge, etc.) */
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display font-bold text-xl sm:text-2xl text-slate-900 dark:text-slate-100">
                      Home Property Market (TV, Gas, Fan, Fridge...)
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Buy &amp; sell household electronics, gas cookers, fans, AC, and furniture directly.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={itemCategory}
                      onChange={(e) => setItemCategory(e.target.value)}
                      className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0B7A3E]"
                    >
                      <option value="All">All Categories</option>
                      {HOME_PROPERTY_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                    <select
                      value={itemCondition}
                      onChange={(e) => setItemCondition(e.target.value)}
                      className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0B7A3E]"
                    >
                      <option value="All">Any Condition</option>
                      {HOME_PROPERTY_CONDITIONS.map((cond) => (
                        <option key={cond} value={cond}>
                          {cond}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {loadingItems ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                    {[1, 2, 3].map((n) => (
                      <div key={n} className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden shadow-xs border border-slate-100 dark:border-slate-800 animate-pulse">
                        <div className="aspect-[4/3] bg-slate-200 dark:bg-slate-800" />
                        <div className="p-5 space-y-3">
                          <div className="h-5 bg-slate-200 dark:bg-slate-800 rounded w-1/2" />
                          <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-4/5" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : homeItems.length === 0 ? (
                  <div className="bg-white dark:bg-slate-900 rounded-2xl p-10 sm:p-12 text-center border border-slate-100 dark:border-slate-800 shadow-xs space-y-3">
                    <Package className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
                    <h3 className="font-display font-semibold text-lg text-slate-900 dark:text-slate-100">
                      No Home Property Items Listed Yet
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                      Have a TV, gas cylinder, standing fan, AC, fridge, or furniture to sell? List it right now in under a minute.
                    </p>
                    <button
                      type="button"
                      onClick={() => onNavigate('/sell-property')}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FF7A00] hover:bg-[#e56d00] text-white text-sm font-semibold cursor-pointer"
                    >
                      <Tag className="w-4 h-4" />
                      Sell Home Property Now
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                    {homeItems.map((item) => {
                      const waUrl = buildItemWhatsappUrl(item, user);
                      return (
                        <div
                          key={item.id}
                          className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden shadow-xs border border-slate-100 dark:border-slate-800 flex flex-col justify-between"
                        >
                          <div>
                            <div className="relative aspect-[4/3] bg-slate-100 dark:bg-slate-800">
                              {item.images[0] && (
                                <img
                                  src={item.images[0]}
                                  alt={item.title}
                                  className="w-full h-full object-cover"
                                />
                              )}
                              <span
                                className={`absolute top-3 left-3 px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                                  item.status === 'SOLD'
                                    ? 'bg-red-600 text-white'
                                    : 'bg-[#0B7A3E] text-white'
                                }`}
                              >
                                {item.status}
                              </span>
                              <span className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-black/70 text-white text-[11px] font-semibold">
                                {item.condition}
                              </span>
                            </div>

                            <div className="p-4 space-y-2">
                              <p className="text-[11px] font-bold uppercase tracking-wide text-[#FF7A00]">
                                {item.category}
                              </p>
                              <h3 className="font-display font-bold text-base text-slate-900 dark:text-slate-100 line-clamp-1">
                                {item.title}
                              </h3>
                              <p className="font-display font-bold text-lg text-[#0B7A3E] dark:text-emerald-400 tabular-nums">
                                {formatNaira(item.price)}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5 shrink-0" />
                                {item.area}, {item.state}
                              </p>
                              <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">{item.description}</p>
                            </div>
                          </div>

                          <div className="px-4 pb-4 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <span className="text-xs text-slate-500 dark:text-slate-400 truncate block">
                                Seller: <strong className="text-slate-700 dark:text-slate-200">{item.sellerName}</strong>
                              </span>
                              {item.sellerCode && (
                                <span className="text-[11px] font-mono font-semibold text-slate-600 dark:text-slate-300 block">
                                  UID: {item.sellerCode}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {onReportUser && (
                                <button
                                  type="button"
                                  onClick={() => onReportUser(item.sellerCode || '', 'item', item.id)}
                                  title="Report user by UID"
                                  className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/60 hover:bg-red-100 dark:hover:bg-red-900/70 text-red-700 dark:text-red-300 text-xs font-semibold cursor-pointer"
                                >
                                  <Flag className="w-3.5 h-3.5" />
                                  Report
                                </button>
                              )}
                              <a
                                href={waUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0B7A3E] hover:bg-[#096734] text-white text-xs font-semibold shrink-0"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                                WhatsApp
                              </a>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
