import { useCallback, useEffect, useState } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';
import { Megaphone, ShieldAlert, X } from 'lucide-react';
import type { AdminNote, AuthUser } from './types.ts';
import { apiRequest, setStoredUserToken } from './lib/api.ts';
import { geocodeAddressViaServer, GOOGLE_MAPS_API_KEY, type UserGeoLocation } from './lib/maps.ts';
import {
  getBrowserCoordinates,
  inspectBrowserPermissions,
  requestBrowserCameraStream,
} from './lib/permissions.ts';
import { validateFirestoreConnection } from './lib/firebase.ts';
import { useTheme } from './lib/theme.ts';
import { Navbar } from './components/Navbar.tsx';
import { BottomNav } from './components/BottomNav.tsx';
import { PermissionsModal, type PermissionActionFeedback } from './components/PermissionsModal.tsx';
import { Footer } from './components/Footer.tsx';
import { HomePage } from './pages/HomePage.tsx';
import { HouseDetailsPage } from './pages/HouseDetailsPage.tsx';
import { ForgotPasswordPage, LoginPage, RegisterPage, ResetPasswordPage } from './pages/AuthPages.tsx';
import { KycPage } from './pages/KycPage.tsx';
import { UploadHousePage } from './pages/UploadHousePage.tsx';
import { SellPropertyPage } from './pages/SellPropertyPage.tsx';
import { AgentDashboardPage } from './pages/AgentDashboardPage.tsx';
import { AdminPage } from './pages/AdminPage.tsx';
import { ReportUserModal } from './components/ReportUserModal.tsx';

const MAPS_LIBRARIES: ('marker' | 'geometry')[] = ['marker', 'geometry'];

export default function App() {
  useTheme();
  const [locationUrl, setLocationUrl] = useState(
    () => `${window.location.pathname}${window.location.search}`
  );
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [mapsQuotaExceeded, setMapsQuotaExceeded] = useState(false);
  const [userLocation, setUserLocation] = useState<UserGeoLocation | null>(null);
  const [locationGranted, setLocationGranted] = useState(false);
  const [cameraGranted, setCameraGranted] = useState(false);
  const [permissionsModalOpen, setPermissionsModalOpen] = useState(false);
  const [upgradingAgent, setUpgradingAgent] = useState(false);
  const [globalNotice, setGlobalNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [broadcastNotes, setBroadcastNotes] = useState<AdminNote[]>([]);
  const [dismissedBroadcastId, setDismissedBroadcastId] = useState<string | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [reportModal, setReportModal] = useState<{
    open: boolean;
    uid?: string;
    listingType?: 'general' | 'house' | 'item';
    listingId?: string;
  }>({ open: false });

  const openReportModal = useCallback(
    (uid?: string, listingType: 'general' | 'house' | 'item' = 'general', listingId = '') => {
      setReportModal({ open: true, uid, listingType, listingId });
    },
    []
  );

  const refreshBroadcastNotes = useCallback(async () => {
    try {
      const res = await apiRequest<{ notes: AdminNote[] }>('/api/notes/latest');
      setBroadcastNotes(res.notes || []);
    } catch {
      // ignore
    }
  }, []);

  const refreshFavorites = useCallback(async () => {
    try {
      const res = await apiRequest<{ favoriteIds: string[] }>('/api/favorites');
      setFavoriteIds(new Set(res.favoriteIds || []));
    } catch {
      setFavoriteIds(new Set());
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const res = await apiRequest<{ user: AuthUser | null }>('/api/auth/me');
      setUser(res.user);
      if (!res.user) {
        setStoredUserToken(null);
        setFavoriteIds(new Set());
      }
    } catch {
      setUser(null);
      setFavoriteIds(new Set());
    } finally {
      setAuthLoaded(true);
    }
  }, []);

  const navigate = useCallback(
    (to: string) => {
      window.history.pushState({}, '', to);
      setLocationUrl(to);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      refreshUser();
      refreshBroadcastNotes();
    },
    [refreshUser, refreshBroadcastNotes]
  );

  const scrollHomeSection = useCallback(
    (sectionId: 'top' | 'listings-section' | 'map-section') => {
      const currentPathname = window.location.pathname;
      const scrollNow = () => {
        if (sectionId === 'top') {
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
        const el = document.getElementById(sectionId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      };

      if (currentPathname !== '/' && currentPathname !== '') {
        window.history.pushState({}, '', '/');
        setLocationUrl('/');
        refreshUser();
        window.setTimeout(scrollNow, 120);
      } else {
        scrollNow();
      }
    },
    [refreshUser]
  );

  useEffect(() => {
    const onQuotaExceeded = () => setMapsQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuotaExceeded);
  }, []);

  useEffect(() => {
    validateFirestoreConnection();
    refreshUser();
    refreshBroadcastNotes();

    const onPopState = () => {
      setLocationUrl(`${window.location.pathname}${window.location.search}`);
      refreshUser();
      refreshBroadcastNotes();
    };
    const onFocus = () => {
      refreshUser();
      refreshBroadcastNotes();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshUser();
        refreshBroadcastNotes();
      }
    };
    window.addEventListener('popstate', onPopState);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refreshUser, refreshBroadcastNotes]);

  const requestLocationAccess = useCallback(async (): Promise<PermissionActionFeedback> => {
    const res = await getBrowserCoordinates();
    if (!res.ok) {
      if (res.code === 'PERMISSION_DENIED' || res.code === 'POLICY_BLOCKED') {
        const inspected = await inspectBrowserPermissions();
        setLocationGranted(inspected.geoState === 'granted' && !res.code.includes('POLICY'));
      }
      return {
        ok: false,
        policyBlocked: res.code === 'POLICY_BLOCKED',
        message: res.message,
      };
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
      // Keep coordinates even if reverse geocode fails
    }
    setUserLocation(coords);
    setLocationGranted(true);
    return { ok: true };
  }, []);

  const requestCameraAccess = useCallback(async (): Promise<PermissionActionFeedback> => {
    const res = await requestBrowserCameraStream('user');
    if (!res.ok) {
      if (res.code === 'PERMISSION_DENIED' || res.code === 'POLICY_BLOCKED') {
        setCameraGranted(false);
      }
      return {
        ok: false,
        policyBlocked: res.code === 'POLICY_BLOCKED',
        message: res.message,
      };
    }
    res.stream.getTracks().forEach((t) => t.stop());
    setCameraGranted(true);
    return { ok: true };
  }, []);

  const handleManualModalArea = useCallback(async (area: string) => {
    const geo = await geocodeAddressViaServer({ address: area });
    setUserLocation({
      lat: geo.lat,
      lng: geo.lng,
      label: geo.formattedAddress,
      state: geo.state,
    });
  }, []);

  const syncPermissionsFromBrowser = useCallback(async () => {
    const inspected = await inspectBrowserPermissions();
    const hasGeo = inspected.geoState === 'granted' && !inspected.policyBlocksGeo;
    const hasCam = inspected.camState === 'granted' && !inspected.policyBlocksCam;
    setLocationGranted(hasGeo);
    setCameraGranted(hasCam);
    if (hasGeo) {
      requestLocationAccess();
    }
    return { hasGeo, hasCam, inspected };
  }, [requestLocationAccess]);

  const checkAndPromptPermissions = useCallback(
    async (forcePromptIfMissing: boolean) => {
      const { hasGeo, hasCam } = await syncPermissionsFromBrowser();

      if (!hasGeo || !hasCam) {
        if (forcePromptIfMissing) {
          setPermissionsModalOpen(true);
        } else {
          try {
            if (!sessionStorage.getItem('glide_perm_prompted')) {
              sessionStorage.setItem('glide_perm_prompted', '1');
              setPermissionsModalOpen(true);
            }
          } catch {
            setPermissionsModalOpen(true);
          }
        }
      }
    },
    [syncPermissionsFromBrowser]
  );

  useEffect(() => {
    checkAndPromptPermissions(false);

    const onWindowFocus = () => {
      syncPermissionsFromBrowser();
    };
    window.addEventListener('focus', onWindowFocus);

    let geoStatusObj: PermissionStatus | null = null;
    let camStatusObj: PermissionStatus | null = null;
    const onPermChange = () => {
      syncPermissionsFromBrowser();
    };

    if (navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'geolocation' as PermissionName })
        .then((p) => {
          geoStatusObj = p;
          p.addEventListener('change', onPermChange);
        })
        .catch(() => {});
      navigator.permissions
        .query({ name: 'camera' as PermissionName })
        .then((p) => {
          camStatusObj = p;
          p.addEventListener('change', onPermChange);
        })
        .catch(() => {});
    }

    return () => {
      window.removeEventListener('focus', onWindowFocus);
      geoStatusObj?.removeEventListener('change', onPermChange);
      camStatusObj?.removeEventListener('change', onPermChange);
    };
  }, [checkAndPromptPermissions, syncPermissionsFromBrowser]);

  useEffect(() => {
    if (!user) return;
    const needsKycPoll = user.role === 'agent' && user.kycStatus !== 'approved';
    const needsUpgradePoll = user.role === 'buyer' && user.agentUpgradeStatus === 'pending';

    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        refreshBroadcastNotes();
        if (needsKycPoll || needsUpgradePoll) {
          refreshUser();
        }
      }
    }, needsKycPoll || needsUpgradePoll ? 5000 : 15000);
    return () => window.clearInterval(timer);
  }, [user, refreshUser, refreshBroadcastNotes]);

  const handleRequestAgentUpgrade = useCallback(async () => {
    if (!user || user.role !== 'buyer') return;
    setUpgradingAgent(true);
    setGlobalNotice(null);
    try {
      const res = await apiRequest<{ user: AuthUser; message: string }>('/api/auth/request-agent-upgrade', {
        method: 'POST',
        body: JSON.stringify({ note: 'Buyer requested switch to Agent / Landlord' }),
      });
      setUser(res.user);
      setGlobalNotice({ type: 'success', text: res.message });
    } catch (err) {
      setGlobalNotice({
        type: 'error',
        text: err instanceof Error ? err.message : 'Could not send upgrade request.',
      });
    } finally {
      setUpgradingAgent(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setFavoriteIds(new Set());
      return;
    }
    refreshFavorites();
  }, [user, refreshFavorites]);

  const handleToggleFavorite = useCallback(
    async (houseId: string) => {
      if (!user) {
        setGlobalNotice({
          type: 'error',
          text: 'Please login or register to save favorite houses to your Saved list.',
        });
        navigate('/login');
        return;
      }

      const currentlySaved = favoriteIds.has(houseId);
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (currentlySaved) next.delete(houseId);
        else next.add(houseId);
        return next;
      });

      try {
        const res = await apiRequest<{ favorited: boolean; houseId: string }>(
          `/api/favorites/${houseId}/toggle`,
          { method: 'POST' }
        );
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          if (res.favorited) next.add(houseId);
          else next.delete(houseId);
          return next;
        });
      } catch (err) {
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          if (currentlySaved) next.add(houseId);
          else next.delete(houseId);
          return next;
        });
        setGlobalNotice({
          type: 'error',
          text: err instanceof Error ? err.message : 'Could not update saved favorites.',
        });
      }
    },
    [user, favoriteIds, navigate]
  );

  const handleLogout = async () => {
    await apiRequest('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setStoredUserToken(null);
    setUser(null);
    setFavoriteIds(new Set());
    navigate('/');
  };

  const [pathname, searchStr = ''] = locationUrl.split('#')[0].split('?');
  const searchParams = new URLSearchParams(searchStr);

  const renderPage = () => {
    if (pathname === '/' || pathname === '') {
      return (
        <HomePage
          user={user}
          userLocation={userLocation}
          onUpdateUserLocation={setUserLocation}
          onOpenHouse={(id) => navigate(`/house/${id}`)}
          onNavigate={navigate}
          onRequestAgentUpgrade={handleRequestAgentUpgrade}
          upgradingAgent={upgradingAgent}
          onReportUser={openReportModal}
          favoriteIds={favoriteIds}
          onToggleFavorite={handleToggleFavorite}
        />
      );
    }
    if (pathname.startsWith('/house/')) {
      const houseId = pathname.replace('/house/', '').split('/')[0];
      return (
        <HouseDetailsPage
          houseId={houseId}
          user={user}
          onBack={() => navigate('/')}
          onReportUser={openReportModal}
          isFavorite={favoriteIds.has(houseId)}
          onToggleFavorite={handleToggleFavorite}
        />
      );
    }
    if (pathname === '/register') {
      return (
        <RegisterPage
          onSuccess={(loggedInUser) => {
            setUser(loggedInUser);
            setGlobalNotice({
              type: 'success',
              text: `Registration successful! Your UID Number is ${loggedInUser.userCode}. Keep it safe — it appears on all your uploaded houses and property items.`,
            });
            checkAndPromptPermissions(true);
            navigate(loggedInUser.role === 'agent' ? '/kyc' : '/');
          }}
          onNavigate={navigate}
        />
      );
    }
    if (pathname === '/login') {
      return (
        <LoginPage
          onSuccess={(loggedInUser) => {
            setUser(loggedInUser);
            checkAndPromptPermissions(true);
            navigate(loggedInUser.role === 'agent' && loggedInUser.kycStatus !== 'approved' ? '/kyc' : '/');
          }}
          onAdminSuccess={(firstTimeConfigured) => {
            if (firstTimeConfigured) {
              setGlobalNotice({
                type: 'success',
                text: 'Admin password saved permanently. It cannot be changed or reset.',
              });
            }
            navigate('/admin-portal');
          }}
          onNavigate={navigate}
        />
      );
    }
    if (pathname === '/forgot-password') {
      return <ForgotPasswordPage onNavigate={navigate} />;
    }
    if (pathname === '/reset-password') {
      return <ResetPasswordPage token={searchParams.get('token') || ''} onNavigate={navigate} />;
    }
    if (pathname === '/kyc') {
      return <KycPage user={user} onRefreshUser={refreshUser} onNavigate={navigate} />;
    }
    if (pathname === '/upload-house') {
      return (
        <UploadHousePage
          user={user}
          userLocation={userLocation}
          onRefreshUser={refreshUser}
          onRequestAgentUpgrade={handleRequestAgentUpgrade}
          upgradingAgent={upgradingAgent}
          onNavigate={navigate}
        />
      );
    }
    if (pathname === '/sell-property') {
      return <SellPropertyPage user={user} onNavigate={navigate} />;
    }
    if (pathname === '/dashboard') {
      return (
        <AgentDashboardPage
          user={user}
          onRefreshUser={refreshUser}
          onNavigate={navigate}
          initialTab={searchParams.get('tab') === 'saved' ? 'saved' : undefined}
          favoriteIds={favoriteIds}
          onToggleFavorite={handleToggleFavorite}
        />
      );
    }
    if (pathname === '/admin-portal' || pathname === '/mega') {
      return <AdminPage onNavigateHome={() => navigate('/')} />;
    }
    return (
      <HomePage
        user={user}
        userLocation={userLocation}
        onUpdateUserLocation={setUserLocation}
        onOpenHouse={(id) => navigate(`/house/${id}`)}
        onNavigate={navigate}
        onRequestAgentUpgrade={handleRequestAgentUpgrade}
        upgradingAgent={upgradingAgent}
        onReportUser={openReportModal}
        favoriteIds={favoriteIds}
        onToggleFavorite={handleToggleFavorite}
      />
    );
  };

  const showAgentKycBanner =
    authLoaded && user && user.role === 'agent' && user.kycStatus !== 'approved';
  const latestBroadcastId = broadcastNotes[0]?.id ?? null;
  const showUserBroadcastBanner =
    authLoaded &&
    Boolean(user) &&
    pathname !== '/admin-portal' &&
    pathname !== '/mega' &&
    broadcastNotes.length > 0 &&
    dismissedBroadcastId !== latestBroadcastId;

  const shell = (
    <div className="min-h-screen flex flex-col bg-[#F5F7FA] dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {mapsQuotaExceeded && (
        <div className="bg-amber-50 dark:bg-amber-950/80 border-b border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-100 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 dark:text-amber-200 hover:text-amber-800 dark:hover:text-white"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      <Navbar
        user={user}
        currentPath={pathname}
        onNavigate={navigate}
        onLogout={handleLogout}
        onRequestAgentUpgrade={handleRequestAgentUpgrade}
        upgradingAgent={upgradingAgent}
        favoriteCount={favoriteIds.size}
      />

      {globalNotice && (
        <div
          className={`px-4 py-2.5 text-xs sm:text-sm text-center font-medium border-b ${
            globalNotice.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/70 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100'
              : 'bg-red-50 dark:bg-red-950/70 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
          }`}
        >
          <span>{globalNotice.text}</span>
          <button
            type="button"
            onClick={() => setGlobalNotice(null)}
            className="ml-3 underline font-semibold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {showUserBroadcastBanner && (
        <section
          aria-label="Admin Broadcast Message"
          className="bg-gradient-to-r from-[#0B3D22] via-[#0B7A3E] to-[#0B3D22] text-white border-b border-emerald-700 shadow-xs"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0">
              <span className="w-7 h-7 rounded-lg bg-[#FF7A00] text-white flex items-center justify-center shrink-0 mt-0.5">
                <Megaphone className="w-4 h-4" aria-hidden="true" />
              </span>
              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-emerald-100">
                  <span>Admin Broadcast</span>
                  <span className="text-white/70 font-normal normal-case">
                    {new Date(broadcastNotes[0].createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm font-semibold text-white leading-snug break-words">
                  {broadcastNotes[0].message}
                </p>
                {broadcastNotes.length > 1 && (
                  <div className="pt-1 space-y-0.5 border-t border-white/15">
                    {broadcastNotes.slice(1, 3).map((note) => (
                      <p key={note.id} className="text-xs text-emerald-100">
                        • {note.message}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDismissedBroadcastId(latestBroadcastId)}
              aria-label="Dismiss broadcast notice"
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </section>
      )}

      {showAgentKycBanner && (
        <div className="bg-red-600 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-wrap items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2 font-semibold">
              <ShieldAlert className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Update Your KYC To Upload House</span>
            </div>
            <button
              type="button"
              onClick={() => navigate('/kyc')}
              className="px-3.5 py-1 rounded-lg bg-white text-red-700 font-bold text-xs hover:bg-red-50 transition-colors cursor-pointer whitespace-nowrap"
            >
              Verify KYC Now
            </button>
          </div>
        </div>
      )}

      <main className="flex-1">{renderPage()}</main>

      <Footer onReportUser={() => openReportModal('', 'general', '')} />

      <BottomNav
        user={user}
        currentPath={pathname}
        onNavigate={navigate}
        onScrollHomeSection={scrollHomeSection}
      />

      <PermissionsModal
        open={permissionsModalOpen}
        onClose={() => setPermissionsModalOpen(false)}
        locationGranted={locationGranted}
        cameraGranted={cameraGranted}
        onRequestLocation={requestLocationAccess}
        onRequestCamera={requestCameraAccess}
        onManualArea={handleManualModalArea}
      />

      <ReportUserModal
        open={reportModal.open}
        initialUid={reportModal.uid}
        listingType={reportModal.listingType}
        listingId={reportModal.listingId}
        user={user}
        onClose={() => setReportModal({ open: false })}
      />
    </div>
  );

  if (!GOOGLE_MAPS_API_KEY) {
    return shell;
  }

  return (
    <APIProvider
      apiKey={GOOGLE_MAPS_API_KEY}
      language="en"
      region="NG"
      libraries={MAPS_LIBRARIES}
    >
      {shell}
    </APIProvider>
  );
}
