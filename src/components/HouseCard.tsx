import { useState } from 'react';
import { Heart, Home, MapPin, Navigation, Pencil, ShieldCheck } from 'lucide-react';
import type { HouseListing } from '../types.ts';
import { formatNaira } from '../data/locations.ts';
import { formatDistanceKm } from '../lib/maps.ts';

interface HouseCardProps {
  house: HouseListing;
  onOpen: (id: string) => void;
  canManage?: boolean;
  onToggleStatus?: (id: string, nextStatus: 'Available' | 'SOLD OUT') => void;
  onAdjustPrice?: (id: string, newPrice: number) => Promise<void>;
  isFavorite?: boolean;
  onToggleFavorite?: (id: string) => void;
}

export function HouseCard({
  house,
  onOpen,
  canManage,
  onToggleStatus,
  onAdjustPrice,
  isFavorite = false,
  onToggleFavorite,
}: HouseCardProps) {
  const [imgError, setImgError] = useState(false);
  const [editingPrice, setEditingPrice] = useState(false);
  const [draftPrice, setDraftPrice] = useState(String(house.price));
  const [savingPrice, setSavingPrice] = useState(false);

  const isSold = house.status === 'SOLD OUT';
  const coverImage = house.images[0] || '';

  const handleSavePrice = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const numeric = Number(draftPrice);
    if (!onAdjustPrice || !Number.isFinite(numeric) || numeric <= 0) return;
    setSavingPrice(true);
    try {
      await onAdjustPrice(house.id, numeric);
      setEditingPrice(false);
    } finally {
      setSavingPrice(false);
    }
  };

  return (
    <article
      onClick={() => onOpen(house.id)}
      className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 overflow-hidden cursor-pointer flex flex-col border border-slate-100 dark:border-slate-800"
    >
      <div className="relative aspect-[4/3] bg-slate-200 dark:bg-slate-800 overflow-hidden">
        {!imgError && coverImage ? (
          <img
            src={coverImage}
            alt={house.title}
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className={`w-full h-full object-cover transition-transform duration-300 ${
              isSold ? 'brightness-50 grayscale-[35%]' : 'hover:scale-[1.03]'
            }`}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-emerald-900/15 to-slate-200 dark:from-emerald-950/50 dark:to-slate-800 flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 p-4 text-center">
            <Home className="w-10 h-10 mb-2 text-[#0B7A3E]/60 dark:text-emerald-400/70" aria-hidden="true" />
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300 line-clamp-1">{house.title}</span>
          </div>
        )}

        {isSold && (
          <div className="absolute inset-0 bg-black/55 flex items-center justify-center pointer-events-none">
            <span className="px-4 py-1.5 rounded-lg bg-red-600 text-white font-display font-bold text-sm tracking-wider uppercase shadow-md">
              SOLD OUT
            </span>
          </div>
        )}

        <div className="absolute top-3 left-3 flex items-center gap-2">
          <span
            className={`inline-block px-3 py-1 rounded-lg text-xs font-bold tracking-wide shadow-xs ${
              isSold ? 'bg-red-600 text-white' : 'bg-[#0B7A3E] text-white'
            }`}
          >
            {isSold ? 'SOLD OUT' : 'Available'}
          </span>

          {canManage && house.approvalStatus !== 'approved' && (
            <span
              className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold shadow-xs ${
                house.approvalStatus === 'pending'
                  ? 'bg-amber-400 text-amber-950'
                  : 'bg-red-100 text-red-800'
              }`}
            >
              {house.approvalStatus === 'pending' ? 'Pending Approval' : 'Rejected'}
            </span>
          )}
        </div>

        {onToggleFavorite && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(house.id);
            }}
            aria-label={isFavorite ? 'Remove house from saved list' : 'Save house to favorites'}
            title={isFavorite ? 'Remove from Saved' : 'Save to Favorites'}
            className={`absolute top-3 right-3 z-10 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-colors cursor-pointer ${
              isFavorite
                ? 'bg-white text-red-600 dark:bg-slate-900 dark:text-red-400'
                : 'bg-slate-900/65 hover:bg-slate-900/85 text-white backdrop-blur-xs'
            }`}
          >
            <Heart
              className={`w-3.5 h-3.5 shrink-0 ${isFavorite ? 'fill-red-500 text-red-500' : ''}`}
              aria-hidden="true"
            />
            <span>{isFavorite ? 'Saved' : 'Favorite'}</span>
          </button>
        )}
      </div>

      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between gap-3">
        <div>
          <p className="text-xl font-display font-bold text-[#0B7A3E] dark:text-emerald-400 tabular-nums">
            {formatNaira(house.price)}
            <span className="text-xs font-sans font-normal text-slate-500 dark:text-slate-400"> / year</span>
          </p>

          <h3 className="mt-1.5 font-display font-semibold text-base text-slate-900 dark:text-slate-100 line-clamp-2 leading-snug">
            {house.title}
          </h3>

          <p className="mt-2 text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
            <span className="truncate">
              {house.area}, {house.state}, {house.country}
            </span>
          </p>

          {house.distanceKm !== null && house.distanceKm !== undefined && (
            <p className="mt-1.5 inline-flex items-center gap-1 text-xs font-bold text-[#0B7A3E] dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-lg tabular-nums">
              <Navigation className="w-3 h-3 shrink-0" aria-hidden="true" />
              <span>{formatDistanceKm(house.distanceKm)} away</span>
            </p>
          )}

          {canManage && house.approvalStatus === 'rejected' && house.rejectionReason && (
            <p className="mt-2 text-xs text-red-600 dark:text-red-400">Reason: {house.rejectionReason}</p>
          )}

          {canManage && editingPrice && (
            <form
              onSubmit={handleSavePrice}
              onClick={(e) => e.stopPropagation()}
              className="mt-3 flex items-center gap-2"
            >
              <input
                type="number"
                min={1000}
                required
                value={draftPrice}
                onChange={(e) => setDraftPrice(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2.5 py-1.5 text-xs tabular-nums focus:outline-none focus:ring-2 focus:ring-[#0B7A3E]"
              />
              <button
                type="submit"
                disabled={savingPrice}
                className="px-3 py-1.5 rounded-lg bg-[#0B7A3E] text-white text-xs font-semibold whitespace-nowrap cursor-pointer"
              >
                {savingPrice ? 'Saving' : 'Save'}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingPrice(false);
                }}
                className="px-2 py-1.5 rounded-lg text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
              >
                Cancel
              </button>
            </form>
          )}
        </div>

        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <span className="truncate font-medium text-slate-700 dark:text-slate-200">
              {house.agentName}
              {house.agentCode && (
                <span className="ml-1.5 font-mono text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-1.5 py-0.5 rounded">
                  UID: {house.agentCode}
                </span>
              )}
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              <span>{house.houseType}</span>
              {house.agentVerified && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1 text-[#0B7A3E] dark:text-emerald-400 font-semibold">
                    <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                    Verified
                  </span>
                </>
              )}
            </div>
          </div>

          {canManage && (
            <div className="flex items-center gap-2 shrink-0">
              {onAdjustPrice && !editingPrice && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDraftPrice(String(house.price));
                    setEditingPrice(true);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Pencil className="w-3 h-3" />
                  Edit Price
                </button>
              )}

              {onToggleStatus && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleStatus(house.id, isSold ? 'Available' : 'SOLD OUT');
                  }}
                  className={`px-2.5 py-1.5 rounded-lg font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                    isSold
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 hover:bg-[#0B7A3E] text-[#0B7A3E] dark:text-emerald-300 hover:text-white'
                      : 'bg-red-50 dark:bg-red-950/60 hover:bg-red-600 text-red-700 dark:text-red-300 hover:text-white'
                  }`}
                >
                  {isSold ? 'Set Available' : 'Mark Sold Out'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
