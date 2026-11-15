import {
  ArrowUpRight,
  Clock,
  Heart,
  Home,
  LogIn,
  LogOut,
  Monitor,
  Moon,
  ShieldCheck,
  Sun,
  UserPlus,
} from 'lucide-react';
import type { AuthUser } from '../types.ts';
import { useTheme } from '../lib/theme.ts';

interface NavbarProps {
  user: AuthUser | null;
  currentPath: string;
  onNavigate: (path: string) => void;
  onLogout: () => void;
  onRequestAgentUpgrade?: () => Promise<void>;
  upgradingAgent?: boolean;
  favoriteCount?: number;
}

export function Navbar({
  user,
  currentPath,
  onNavigate,
  onLogout,
  onRequestAgentUpgrade,
  upgradingAgent,
  favoriteCount = 0,
}: NavbarProps) {
  const isHome = currentPath === '/' || currentPath === '';
  const isDashboard = currentPath === '/dashboard';
  const { mode, cycleMode } = useTheme();

  const themeLabel = mode === 'dark' ? 'Dark' : mode === 'light' ? 'Light' : 'System';

  return (
    <header className="bg-[#0B7A3E] dark:bg-[#08552B] text-white sticky top-0 z-40 shadow-sm border-b border-transparent dark:border-emerald-900/60">
      <div className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-2">
        {/* Top-Left Corner: Home button + Brand wordmark */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className={`inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 min-h-[38px] transition-colors cursor-pointer ${
              isHome
                ? 'bg-white text-[#0B7A3E] shadow-xs'
                : 'bg-white/15 hover:bg-white/25 text-white border border-white/20'
            }`}
          >
            <Home className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Home</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="text-white font-display font-bold text-sm sm:text-xl tracking-tight whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-white rounded-md py-1"
          >
            Glide Homes
          </button>
        </div>

        {/* Top-Right Corner: Theme Switcher + Saved + Register & Login (or Upgrade to Agent, KYC & Logout) */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={cycleMode}
            title={`Theme: ${themeLabel} (click to switch between System, Dark, and Light)`}
            aria-label={`Switch theme, current mode is ${themeLabel}`}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white border border-white/20 text-xs font-semibold whitespace-nowrap shrink-0 min-h-[38px] transition-colors cursor-pointer"
          >
            {mode === 'dark' ? (
              <Moon className="w-3.5 h-3.5 text-amber-200 shrink-0" aria-hidden="true" />
            ) : mode === 'light' ? (
              <Sun className="w-3.5 h-3.5 text-amber-200 shrink-0" aria-hidden="true" />
            ) : (
              <Monitor className="w-3.5 h-3.5 text-emerald-100 shrink-0" aria-hidden="true" />
            )}
            <span className="hidden sm:inline">{themeLabel}</span>
          </button>

          {!user ? (
            <>
              <button
                type="button"
                onClick={() => onNavigate('/login')}
                className={`inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 min-h-[38px] transition-colors cursor-pointer ${
                  currentPath === '/login'
                    ? 'bg-white text-[#0B7A3E]'
                    : 'bg-white/15 hover:bg-white/25 text-white'
                }`}
              >
                <LogIn className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Login</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('/register')}
                className={`inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 min-h-[38px] transition-colors shadow-xs cursor-pointer ${
                  currentPath === '/register'
                    ? 'bg-white text-[#0B7A3E]'
                    : 'bg-emerald-900/50 hover:bg-emerald-900/70 text-white border border-white/20'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Register</span>
              </button>
            </>
          ) : (
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onNavigate('/dashboard?tab=saved')}
                title="View Saved Houses & Dashboard"
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 min-h-[38px] transition-colors cursor-pointer ${
                  isDashboard
                    ? 'bg-white text-[#0B7A3E] shadow-xs'
                    : 'bg-white/15 hover:bg-white/25 text-white border border-white/20'
                }`}
              >
                <Heart
                  className={`w-3.5 h-3.5 shrink-0 ${
                    favoriteCount > 0 ? 'fill-red-400 text-red-400' : ''
                  }`}
                  aria-hidden="true"
                />
                <span>Saved</span>
                {favoriteCount > 0 && (
                  <span
                    className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold tabular-nums ${
                      isDashboard ? 'bg-[#0B7A3E] text-white' : 'bg-white/25 text-white'
                    }`}
                  >
                    {favoriteCount}
                  </span>
                )}
              </button>

              {user.role === 'buyer' && (
                user.agentUpgradeStatus === 'pending' ? (
                  <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-400/20 border border-amber-300/40 text-amber-100 text-xs font-semibold whitespace-nowrap shrink-0 min-h-[38px]">
                    <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>Upgrade Pending</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={upgradingAgent}
                    onClick={() => onRequestAgentUpgrade?.()}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-semibold whitespace-nowrap shrink-0 min-h-[38px] cursor-pointer disabled:opacity-60"
                  >
                    <ArrowUpRight className="w-3.5 h-3.5 text-amber-300 shrink-0" aria-hidden="true" />
                    <span className="hidden md:inline">
                      {upgradingAgent ? 'Sending...' : 'Upgrade to Agent'}
                    </span>
                    <span className="md:hidden">Be Agent</span>
                  </button>
                )
              )}

              {user.role === 'agent' && (
                <button
                  type="button"
                  onClick={() => onNavigate('/kyc')}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-semibold whitespace-nowrap shrink-0 min-h-[38px] cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-200 shrink-0" aria-hidden="true" />
                  <span>{user.kycStatus === 'approved' ? 'Verified' : 'KYC'}</span>
                </button>
              )}

              <span className="inline-flex items-center px-2 sm:px-2.5 py-1.5 rounded-lg bg-white/15 text-[11px] sm:text-xs font-mono font-semibold text-white whitespace-nowrap">
                UID: {user.userCode}
              </span>

              <button
                type="button"
                onClick={onLogout}
                className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-semibold whitespace-nowrap shrink-0 min-h-[38px] cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
