import { Compass, LayoutList, MapPin, Plus, ShieldCheck, Tag } from 'lucide-react';
import type { AuthUser } from '../types.ts';

interface BottomNavProps {
  user: AuthUser | null;
  currentPath: string;
  onNavigate: (path: string) => void;
  onScrollHomeSection: (sectionId: 'top' | 'listings-section' | 'map-section') => void;
}

export function BottomNav({
  user,
  currentPath,
  onNavigate,
  onScrollHomeSection,
}: BottomNavProps) {
  const isHome = currentPath === '/' || currentPath === '';

  const handleBrowse = () => {
    onScrollHomeSection('listings-section');
  };

  const handleSecondarySlot = () => {
    if (user?.role === 'agent') {
      if (user.kycStatus === 'approved') {
        onNavigate('/dashboard');
      } else {
        onNavigate('/kyc');
      }
      return;
    }
    onScrollHomeSection('map-section');
  };

  const secondaryLabel =
    user?.role === 'agent'
      ? user.kycStatus === 'approved'
        ? 'Listings'
        : 'KYC'
      : 'Nearby';

  const secondaryActive =
    (user?.role === 'agent' && user.kycStatus === 'approved' && currentPath === '/dashboard') ||
    (user?.role === 'agent' && user.kycStatus !== 'approved' && currentPath === '/kyc');

  return (
    <nav
      aria-label="Primary bottom navigation"
      className="fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 shadow-[0_-4px_20px_rgba(15,23,42,0.08)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.45)]"
    >
      <div className="max-w-3xl mx-auto grid grid-cols-4 items-center h-16 px-1 sm:px-4">
        {/* Slot 1: Browse Homes */}
        <button
          type="button"
          onClick={handleBrowse}
          className={`flex flex-col items-center justify-center min-h-[48px] px-1 rounded-xl transition-colors cursor-pointer ${
            isHome
              ? 'text-[#0B7A3E] dark:text-emerald-400'
              : 'text-slate-600 dark:text-slate-300 hover:text-[#0B7A3E] dark:hover:text-emerald-400'
          }`}
        >
          <Compass className="w-5 h-5 shrink-0" aria-hidden="true" />
          <span className="text-[10px] sm:text-[11px] font-semibold tracking-tight mt-0.5 whitespace-nowrap">
            Browse Homes
          </span>
        </button>

        {/* Slot 2: Nearby Map (or Agent Listings / KYC) */}
        <button
          type="button"
          onClick={handleSecondarySlot}
          className={`flex flex-col items-center justify-center min-h-[48px] px-1 rounded-xl transition-colors cursor-pointer ${
            secondaryActive
              ? 'text-[#0B7A3E] dark:text-emerald-400'
              : 'text-slate-600 dark:text-slate-300 hover:text-[#0B7A3E] dark:hover:text-emerald-400'
          }`}
        >
          {user?.role === 'agent' ? (
            user.kycStatus === 'approved' ? (
              <LayoutList className="w-5 h-5 shrink-0" aria-hidden="true" />
            ) : (
              <ShieldCheck className="w-5 h-5 shrink-0" aria-hidden="true" />
            )
          ) : (
            <MapPin className="w-5 h-5 shrink-0" aria-hidden="true" />
          )}
          <span className="text-[10px] sm:text-[11px] font-semibold tracking-tight mt-0.5 whitespace-nowrap">
            {secondaryLabel}
          </span>
        </button>

        {/* Slot 4: TikTok-style + Upload House */}
        <button
          type="button"
          onClick={() => onNavigate('/upload-house')}
          aria-label="Upload House"
          className="flex flex-col items-center justify-center min-h-[48px] px-1 rounded-xl cursor-pointer group"
        >
          <span className="relative inline-flex items-center justify-center w-12 h-8">
            <span
              aria-hidden="true"
              className="absolute left-0 inset-y-0 w-9 rounded-lg bg-[#0B7A3E] transition-transform group-hover:-translate-x-0.5"
            />
            <span
              aria-hidden="true"
              className="absolute right-0 inset-y-0 w-9 rounded-lg bg-[#FF7A00] transition-transform group-hover:translate-x-0.5"
            />
            <span
              className={`relative z-10 w-10 h-8 rounded-lg flex items-center justify-center shadow-xs transition-colors ${
                currentPath === '/upload-house'
                  ? 'bg-[#FF7A00] text-white'
                  : 'bg-slate-900 dark:bg-slate-800 text-white group-hover:bg-slate-800 dark:group-hover:bg-slate-700'
              }`}
            >
              <Plus className="w-5 h-5 stroke-[2.75]" aria-hidden="true" />
            </span>
          </span>
          <span
            className={`text-[10px] sm:text-[11px] font-bold tracking-tight mt-0.5 whitespace-nowrap ${
              currentPath === '/upload-house' ? 'text-[#FF7A00]' : 'text-slate-700 dark:text-slate-200'
            }`}
          >
            Upload
          </span>
        </button>

        {/* Slot 5: Sell Property */}
        <button
          type="button"
          onClick={() => onNavigate('/sell-property')}
          className={`flex flex-col items-center justify-center min-h-[48px] px-1 rounded-xl transition-colors cursor-pointer ${
            currentPath === '/sell-property'
              ? 'text-[#FF7A00]'
              : 'text-slate-600 dark:text-slate-300 hover:text-[#FF7A00]'
          }`}
        >
          <Tag className="w-5 h-5 shrink-0" aria-hidden="true" />
          <span className="text-[10px] sm:text-[11px] font-semibold tracking-tight mt-0.5 whitespace-nowrap">
            Sell Property
          </span>
        </button>
      </div>
    </nav>
  );
}
