import { useEffect, useState } from 'react';
import { Calendar, Heart, Home, LayoutList, Plus, ShieldCheck } from 'lucide-react';
import type { AuthUser, HouseListing, InspectionBooking } from '../types.ts';
import { apiRequest } from '../lib/api.ts';
import { HouseCard } from '../components/HouseCard.tsx';

interface AgentDashboardPageProps {
  user: AuthUser | null;
  onRefreshUser?: () => Promise<void>;
  onNavigate: (path: string) => void;
  initialTab?: 'saved' | 'listings';
  favoriteIds?: Set<string>;
  onToggleFavorite?: (houseId: string) => void;
}

export function AgentDashboardPage({
  user,
  onRefreshUser,
  onNavigate,
  initialTab,
  favoriteIds,
  onToggleFavorite,
}: AgentDashboardPageProps) {
  const [activeTab, setActiveTab] = useState<'saved' | 'listings'>(() => {
    if (initialTab) return initialTab;
    return user?.role === 'agent' ? 'listings' : 'saved';
  });
  const [houses, setHouses] = useState<HouseListing[]>([]);
  const [savedHouses, setSavedHouses] = useState<HouseListing[]>([]);
  const [inspections, setInspections] = useState<InspectionBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    } else if (user?.role === 'buyer') {
      setActiveTab('saved');
    }
  }, [initialTab, user?.role]);

  useEffect(() => {
    if (onRefreshUser) {
      onRefreshUser();
    }
  }, [onRefreshUser]);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    const requests: Promise<unknown>[] = [
      apiRequest<{ houses: HouseListing[] }>('/api/favorites').then((res) => {
        setSavedHouses(res.houses || []);
      }),
    ];

    if (user.role === 'agent') {
      requests.push(
        apiRequest<{ houses: HouseListing[]; inspections: InspectionBooking[] }>('/api/agent/houses').then(
          (res) => {
            setHouses(res.houses || []);
            setInspections(res.inspections || []);
          }
        )
      );
    } else {
      setHouses([]);
      setInspections([]);
    }

    Promise.all(requests)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load dashboard.'))
      .finally(() => setLoading(false));
  }, [user]);

  const handleToggleStatus = async (houseId: string, nextStatus: 'Available' | 'SOLD OUT') => {
    try {
      const res = await apiRequest<{ house: HouseListing }>(`/api/houses/${houseId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      setHouses((prev) => prev.map((h) => (h.id === houseId ? res.house : h)));
      setSavedHouses((prev) => prev.map((h) => (h.id === houseId ? res.house : h)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update house status.');
    }
  };

  const handleAdjustPrice = async (houseId: string, newPrice: number) => {
    try {
      const res = await apiRequest<{ house: HouseListing }>(`/api/houses/${houseId}/price`, {
        method: 'PATCH',
        body: JSON.stringify({ price: newPrice }),
      });
      setHouses((prev) => prev.map((h) => (h.id === houseId ? res.house : h)));
      setSavedHouses((prev) => prev.map((h) => (h.id === houseId ? res.house : h)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to adjust price.');
    }
  };

  const handleDashboardFavoriteToggle = (houseId: string) => {
    onToggleFavorite?.(houseId);
    const currentlySaved = favoriteIds ? favoriteIds.has(houseId) : savedHouses.some((h) => h.id === houseId);
    if (currentlySaved) {
      setSavedHouses((prev) => prev.filter((h) => h.id !== houseId));
    }
  };

  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 shadow-sm border border-slate-100 dark:border-slate-800 space-y-4">
          <h1 className="font-display font-bold text-xl text-slate-900 dark:text-slate-100">Login Required</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Login to view your Saved properties and dashboard.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('/login')}
            className="px-6 py-2.5 rounded-xl bg-[#0B7A3E] text-white text-sm font-semibold cursor-pointer"
          >
            Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-2xl text-slate-900 dark:text-slate-100 flex flex-wrap items-center gap-2.5">
            <span>{user.role === 'agent' ? 'Dashboard & Saved Houses' : 'My Saved Houses'}</span>
            <span className="text-xs font-mono font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-lg">
              UID: {user.userCode}
            </span>
            {user.kycStatus === 'approved' && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#0B7A3E] dark:text-emerald-400">
                <ShieldCheck className="w-4 h-4" /> Verified
              </span>
            )}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
            {user.role === 'agent'
              ? 'View your bookmarked houses, adjust rent prices, or switch your listings between Available and SOLD OUT.'
              : 'Access houses you bookmarked with the Favorite button anytime.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm font-semibold cursor-pointer"
          >
            <Home className="w-4 h-4 text-[#0B7A3E] dark:text-emerald-400" />
            Browse Houses
          </button>
          {user.role === 'agent' && (
            <button
              type="button"
              onClick={() => onNavigate('/upload-house')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FF7A00] hover:bg-[#e56d00] text-white text-sm font-semibold cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Upload New House
            </button>
          )}
        </div>
      </div>

      {/* Dashboard Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('saved')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
            activeTab === 'saved'
              ? 'bg-[#0B7A3E] text-white shadow-xs'
              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          <Heart
            className={`w-4 h-4 ${
              activeTab === 'saved' ? 'fill-white text-white' : 'text-red-500'
            }`}
            aria-hidden="true"
          />
          <span>Saved ({savedHouses.length})</span>
        </button>

        {user.role === 'agent' && (
          <button
            type="button"
            onClick={() => setActiveTab('listings')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
              activeTab === 'listings'
                ? 'bg-[#0B7A3E] text-white shadow-xs'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <LayoutList className="w-4 h-4" aria-hidden="true" />
            <span>My Agent Listings ({houses.length})</span>
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm rounded-xl p-3">
          {error}
        </div>
      )}

      {loading ? (
        <div className="h-48 bg-white dark:bg-slate-900 rounded-2xl animate-pulse" />
      ) : activeTab === 'saved' ? (
        savedHouses.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-10 text-center border border-slate-100 dark:border-slate-800 shadow-xs space-y-3">
            <Heart className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" aria-hidden="true" />
            <p className="font-display font-semibold text-lg text-slate-900 dark:text-slate-100">
              Your Saved list is empty
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Tap the Favorite button on any house listing to bookmark it here for quick comparison.
            </p>
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0B7A3E] hover:bg-[#096734] text-white text-sm font-semibold cursor-pointer"
            >
              Browse Houses
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {savedHouses.map((house) => {
              const isOwner = user.id === house.agentId;
              return (
                <HouseCard
                  key={house.id}
                  house={house}
                  onOpen={(id) => onNavigate(`/house/${id}`)}
                  canManage={isOwner}
                  onToggleStatus={isOwner ? handleToggleStatus : undefined}
                  onAdjustPrice={isOwner ? handleAdjustPrice : undefined}
                  isFavorite={favoriteIds ? favoriteIds.has(house.id) : true}
                  onToggleFavorite={handleDashboardFavoriteToggle}
                />
              );
            })}
          </div>
        )
      ) : (
        <>
          {houses.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-10 text-center border border-slate-100 dark:border-slate-800 shadow-xs space-y-3">
              <p className="font-display font-semibold text-lg text-slate-900 dark:text-slate-100">
                You have not uploaded any houses yet
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {user.kycStatus === 'approved'
                  ? 'Click Upload New House to submit your first rental property for admin approval.'
                  : 'Complete your KYC verification to start publishing houses.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {houses.map((house) => (
                <HouseCard
                  key={house.id}
                  house={house}
                  onOpen={(id) => onNavigate(`/house/${id}`)}
                  canManage
                  onToggleStatus={handleToggleStatus}
                  onAdjustPrice={handleAdjustPrice}
                  isFavorite={Boolean(favoriteIds?.has(house.id))}
                  onToggleFavorite={handleDashboardFavoriteToggle}
                />
              ))}
            </div>
          )}

          {/* Inspection Bookings */}
          <section className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-xs border border-slate-100 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#0B7A3E] dark:text-emerald-400" />
              <h2 className="font-display font-bold text-lg text-slate-900 dark:text-slate-100">
                Incoming Inspection Bookings
              </h2>
            </div>
            {inspections.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">No inspection requests yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className="py-2.5 pr-4">Property</th>
                      <th className="py-2.5 pr-4">Buyer Name</th>
                      <th className="py-2.5 pr-4">Phone</th>
                      <th className="py-2.5 pr-4">Date &amp; Time</th>
                      <th className="py-2.5">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {inspections.map((b) => (
                      <tr key={b.id}>
                        <td className="py-3 pr-4 font-medium text-slate-900 dark:text-slate-100">
                          {b.houseTitle}
                        </td>
                        <td className="py-3 pr-4 text-slate-700 dark:text-slate-300">{b.buyerName}</td>
                        <td className="py-3 pr-4 tabular-nums text-slate-700 dark:text-slate-300">
                          {b.buyerPhone}
                        </td>
                        <td className="py-3 pr-4 tabular-nums text-slate-700 dark:text-slate-300">
                          {b.preferredDate} · {b.preferredTime}
                        </td>
                        <td className="py-3 text-slate-500 dark:text-slate-400">{b.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
