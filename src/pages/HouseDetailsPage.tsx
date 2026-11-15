import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Flag,
  Heart,
  Home as HomeIcon,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import type { AuthUser, HouseListing } from '../types.ts';
import { AMENITY_OPTIONS, formatNaira } from '../data/locations.ts';
import { apiRequest } from '../lib/api.ts';
import { buildHouseWhatsappUrl } from '../lib/whatsapp.ts';
import { Anti419Warning } from '../components/Anti419Warning.tsx';
import { HouseRouteMap } from '../components/HouseRouteMap.tsx';

interface HouseDetailsPageProps {
  houseId: string;
  user: AuthUser | null;
  onBack: () => void;
  onReportUser?: (uid?: string, listingType?: 'general' | 'house' | 'item', listingId?: string) => void;
  isFavorite?: boolean;
  onToggleFavorite?: (houseId: string) => void;
}

export function HouseDetailsPage({
  houseId,
  user,
  onBack,
  onReportUser,
  isFavorite = false,
  onToggleFavorite,
}: HouseDetailsPageProps) {
  const [house, setHouse] = useState<HouseListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeImg, setActiveImg] = useState(0);

  const [editingPrice, setEditingPrice] = useState(false);
  const [draftPrice, setDraftPrice] = useState('');
  const [savingPrice, setSavingPrice] = useState(false);

  const [showBooking, setShowBooking] = useState(false);
  const [buyerName, setBuyerName] = useState(user?.fullName || '');
  const [buyerPhone, setBuyerPhone] = useState(user?.phone || '');
  const [preferredDate, setPreferredDate] = useState('');
  const [preferredTime, setPreferredTime] = useState('11:00');
  const [notes, setNotes] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState('');
  const [bookingError, setBookingError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiRequest<{ house: HouseListing }>(`/api/houses/${houseId}`)
      .then((res) => {
        if (active) {
          setHouse(res.house);
          setDraftPrice(String(res.house.price));
          setActiveImg(0);
        }
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'House not found.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [houseId]);

  const handleToggleStatus = async (nextStatus: 'Available' | 'SOLD OUT') => {
    if (!house) return;
    try {
      const res = await apiRequest<{ house: HouseListing }>(`/api/houses/${house.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      setHouse(res.house);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status.');
    }
  };

  const handleSavePrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!house) return;
    const numeric = Number(draftPrice);
    if (!Number.isFinite(numeric) || numeric <= 0) return;
    setSavingPrice(true);
    try {
      const res = await apiRequest<{ house: HouseListing }>(`/api/houses/${house.id}/price`, {
        method: 'PATCH',
        body: JSON.stringify({ price: numeric }),
      });
      setHouse(res.house);
      setEditingPrice(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update price.');
    } finally {
      setSavingPrice(false);
    }
  };

  const handleBookInspection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!house) return;
    setBookingLoading(true);
    setBookingError('');
    setBookingSuccess('');
    try {
      const res = await apiRequest<{ message: string }>(`/api/houses/${house.id}/inspections`, {
        method: 'POST',
        body: JSON.stringify({ buyerName, buyerPhone, preferredDate, preferredTime, notes }),
      });
      setBookingSuccess(res.message);
      setShowBooking(false);
    } catch (err) {
      setBookingError(err instanceof Error ? err.message : 'Could not book inspection.');
    } finally {
      setBookingLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <div className="h-96 bg-white dark:bg-slate-900 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (error || !house) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center space-y-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 shadow-xs border border-slate-100 dark:border-slate-800">
          <h2 className="font-display font-bold text-xl text-slate-900 dark:text-slate-100">Listing Unavailable</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{error || 'This house listing could not be found.'}</p>
          <button
            type="button"
            onClick={onBack}
            className="mt-6 px-5 py-2.5 rounded-xl bg-[#0B7A3E] text-white text-sm font-semibold cursor-pointer"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const isSold = house.status === 'SOLD OUT';
  const isOwner = Boolean(user && user.id === house.agentId);
  const whatsappUrl = buildHouseWhatsappUrl(house, user);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm font-semibold text-[#0B7A3E] dark:text-emerald-400 hover:underline cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        Back to all houses
      </button>

      <Anti419Warning />

      {house.approvalStatus !== 'approved' && (
        <div
          className={`rounded-xl p-4 text-sm font-semibold border ${
            house.approvalStatus === 'pending'
              ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-100'
              : 'bg-red-50 dark:bg-red-950/60 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
          }`}
        >
          {house.approvalStatus === 'pending'
            ? 'This house is currently Pending Admin Approval and is not yet visible on the public Home page.'
            : `This house was rejected by Admin${house.rejectionReason ? `: ${house.rejectionReason}` : '.'}`}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left: Gallery & Description */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden shadow-sm border border-slate-100 dark:border-slate-800">
            <div className="relative aspect-[16/10] bg-slate-200 dark:bg-slate-800">
              {house.images[activeImg] ? (
                <img
                  src={house.images[activeImg]}
                  alt={`${house.title} photo ${activeImg + 1}`}
                  referrerPolicy="no-referrer"
                  className={`w-full h-full object-cover ${isSold ? 'brightness-50 grayscale-[35%]' : ''}`}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-400">
                  <HomeIcon className="w-12 h-12" />
                </div>
              )}

              {isSold && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <span className="px-6 py-2.5 rounded-xl bg-red-600 text-white font-display font-bold text-lg tracking-wider uppercase shadow-lg">
                    SOLD OUT
                  </span>
                </div>
              )}

              <div className="absolute top-4 left-4">
                <span
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-sm ${
                    isSold ? 'bg-red-600 text-white' : 'bg-[#0B7A3E] text-white'
                  }`}
                >
                  {house.status}
                </span>
              </div>
            </div>

            {house.images.length > 1 && (
              <div className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-800 flex gap-2.5 overflow-x-auto">
                {house.images.map((imgUrl, idx) => (
                  <button
                    key={`${imgUrl}-${idx}`}
                    type="button"
                    onClick={() => setActiveImg(idx)}
                    className={`relative w-20 h-16 rounded-lg overflow-hidden shrink-0 border-2 transition-all cursor-pointer ${
                      activeImg === idx ? 'border-[#0B7A3E] ring-2 ring-[#0B7A3E]/25' : 'border-transparent opacity-75 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={imgUrl}
                      alt={`Thumbnail ${idx + 1}`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 space-y-5">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                <span>{house.houseType}</span>
                <span aria-hidden="true">·</span>
                <span>{house.images.length} Verified Photos</span>
                <span aria-hidden="true">·</span>
                <span>{house.country}</span>
              </div>
              <h1 className="mt-2 font-display font-bold text-2xl sm:text-3xl text-slate-900 dark:text-slate-100">
                {house.title}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <p className="text-2xl font-display font-bold text-[#0B7A3E] dark:text-emerald-400 tabular-nums">
                  {formatNaira(house.price)}
                  <span className="text-sm font-sans font-normal text-slate-500 dark:text-slate-400"> / year</span>
                </p>
                {isOwner && !editingPrice && (
                  <button
                    type="button"
                    onClick={() => {
                      setDraftPrice(String(house.price));
                      setEditingPrice(true);
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Adjust Price
                  </button>
                )}
              </div>

              {isOwner && editingPrice && (
                <form onSubmit={handleSavePrice} className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    type="number"
                    min={1000}
                    required
                    value={draftPrice}
                    onChange={(e) => setDraftPrice(e.target.value)}
                    className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-[#0B7A3E]"
                  />
                  <button
                    type="submit"
                    disabled={savingPrice}
                    className="px-4 py-2 rounded-xl bg-[#0B7A3E] text-white text-xs font-semibold cursor-pointer"
                  >
                    {savingPrice ? 'Updating...' : 'Update Price'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingPrice(false)}
                    className="px-3 py-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer"
                  >
                    Cancel
                  </button>
                </form>
              )}
            </div>

            {house.amenities && house.amenities.length > 0 && (
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <h2 className="font-display font-semibold text-sm text-slate-900 dark:text-slate-100 mb-2">Included Amenities</h2>
                <div className="flex flex-wrap gap-2 text-xs text-slate-700 dark:text-slate-200">
                  {house.amenities.map((key) => {
                    const match = AMENITY_OPTIONS.find((a) => a.key === key);
                    return (
                      <span key={key} className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#0B7A3E] dark:text-emerald-400" />
                        {match ? match.label : key}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <h2 className="font-display font-semibold text-sm text-slate-900 dark:text-slate-100 mb-2">Full Property Address</h2>
              <p className="text-sm text-slate-700 dark:text-slate-300 flex items-start gap-2">
                <MapPin className="w-4 h-4 text-[#0B7A3E] dark:text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
                <span>
                  {house.houseNumber} {house.streetName}, {house.area}, {house.state}, {house.country}
                </span>
              </p>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <h2 className="font-display font-semibold text-sm text-slate-900 dark:text-slate-100 mb-2">
                Property Features &amp; Description
              </h2>
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                {house.description}
              </p>
            </div>
          </div>

          <HouseRouteMap house={house} />
        </div>

        {/* Right: Landlord & Contact / Inspection Card */}
        <aside className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Landlord / Agent</p>
                <h2 className="mt-0.5 font-display font-bold text-lg text-slate-900 dark:text-slate-100">
                  {house.agentName}
                </h2>
                {house.agentCode && (
                  <p className="mt-1 inline-block font-mono text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                    UID: {house.agentCode}
                  </p>
                )}
                {house.agentVerified && (
                  <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-[#0B7A3E] dark:text-emerald-400">
                    <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                    Verified KYC Badge
                  </p>
                )}
              </div>
              <span className="w-10 h-10 rounded-full bg-[#0B7A3E]/10 dark:bg-emerald-950/70 text-[#0B7A3E] dark:text-emerald-400 flex items-center justify-center shrink-0">
                <UserCheck className="w-5 h-5" aria-hidden="true" />
              </span>
            </div>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Open WhatsApp with full house details"
              className="text-sm text-slate-700 dark:text-slate-200 flex items-center justify-between gap-2 bg-slate-50 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 border border-slate-200 dark:border-slate-700 hover:border-[#0B7A3E]/40 rounded-xl px-3.5 py-2.5 transition-colors"
            >
              <span className="flex items-center gap-2 min-w-0">
                <Phone className="w-4 h-4 text-[#0B7A3E] dark:text-emerald-400 shrink-0" aria-hidden="true" />
                <span className="font-semibold tabular-nums truncate">{house.phone}</span>
              </span>
              <span className="text-[11px] font-bold text-[#0B7A3E] dark:text-emerald-400 shrink-0">
                WhatsApp →
              </span>
            </a>

            <div className="bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-xl p-3.5 space-y-1">
              <p className="text-xs font-bold text-amber-950 dark:text-amber-200">
                Inspection Acceptance Fee: {formatNaira(house.inspectionFee || 3000)}
              </p>
              <p className="text-xs text-amber-900 dark:text-amber-100/90 leading-relaxed">
                Renters pay ₦3,000–₦5,000 ({formatNaira(house.inspectionFee || 3000)} for this house) in real time{' '}
                <strong className="font-semibold">face-to-face</strong> to the landlord during property viewing until you find the house style you want.
              </p>
            </div>

            {bookingSuccess && (
              <div className="bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3.5 text-xs text-emerald-900 dark:text-emerald-200 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#0B7A3E] dark:text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{bookingSuccess}</span>
              </div>
            )}

            <div className="space-y-3">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 px-4 rounded-xl bg-[#0B7A3E] hover:bg-[#096734] text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
              >
                <MessageCircle className="w-4 h-4" aria-hidden="true" />
                Message Agent on WhatsApp
              </a>

              {onToggleFavorite && (
                <button
                  type="button"
                  onClick={() => onToggleFavorite(house.id)}
                  className={`w-full py-2.5 px-4 rounded-xl border font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                    isFavorite
                      ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/70'
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  <Heart
                    className={`w-4 h-4 ${isFavorite ? 'fill-red-500 text-red-500' : ''}`}
                    aria-hidden="true"
                  />
                  <span>{isFavorite ? 'Saved to Favorites' : 'Favorite Property'}</span>
                </button>
              )}

              <button
                type="button"
                disabled={isSold || house.approvalStatus !== 'approved'}
                onClick={() => setShowBooking((v) => !v)}
                className="w-full py-3 px-4 rounded-xl bg-[#FF7A00] hover:bg-[#e56d00] disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                <Calendar className="w-4 h-4" aria-hidden="true" />
                {isSold ? 'Property Sold Out' : 'Book Inspection'}
              </button>

              {isOwner && (
                <button
                  type="button"
                  onClick={() => handleToggleStatus(isSold ? 'Available' : 'SOLD OUT')}
                  className={`w-full py-2.5 px-4 rounded-xl font-semibold text-sm transition-colors cursor-pointer ${
                    isSold
                      ? 'bg-[#0B7A3E] hover:bg-[#096734] text-white'
                      : 'bg-red-600 hover:bg-red-700 text-white'
                  }`}
                >
                  {isSold ? 'Set House Available' : 'Mark Sold Out'}
                </button>
              )}

              {onReportUser && (
                <button
                  type="button"
                  onClick={() => onReportUser(house.agentCode || '', 'house', house.id)}
                  className="w-full py-2.5 px-4 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/60 hover:bg-red-100 dark:hover:bg-red-900/70 text-red-700 dark:text-red-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Flag className="w-3.5 h-3.5" aria-hidden="true" />
                  Report / Warn User (UID: {house.agentCode || 'Required'})
                </button>
              )}
            </div>

            {showBooking && !isSold && (
              <form onSubmit={handleBookInspection} className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <h3 className="font-display font-semibold text-sm text-slate-900 dark:text-slate-100">Schedule Physical Viewing</h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5">
                  Acceptance fee ({formatNaira(house.inspectionFee || 3000)}, within ₦3,000–₦5,000) is paid face-to-face at the property when the landlord shows you around.
                </p>
                {bookingError && (
                  <p className="text-xs text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-lg p-2.5">{bookingError}</p>
                )}
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Your Full Name</label>
                  <input
                    type="text"
                    required
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    placeholder="e.g. Ibrahim Musa"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7A3E]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Phone / WhatsApp Number</label>
                  <input
                    type="tel"
                    required
                    value={buyerPhone}
                    onChange={(e) => setBuyerPhone(e.target.value)}
                    placeholder="e.g. 08031234567"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7A3E]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Preferred Date</label>
                    <input
                      type="date"
                      required
                      value={preferredDate}
                      onChange={(e) => setPreferredDate(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7A3E]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Time</label>
                    <input
                      type="time"
                      required
                      value={preferredTime}
                      onChange={(e) => setPreferredTime(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7A3E]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Notes (Optional)</label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any questions before viewing..."
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7A3E]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={bookingLoading}
                  className="w-full py-2.5 rounded-xl bg-[#0B7A3E] hover:bg-[#096734] text-white font-semibold text-sm cursor-pointer disabled:opacity-60"
                >
                  {bookingLoading ? 'Confirming...' : 'Confirm Inspection Booking'}
                </button>
              </form>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
