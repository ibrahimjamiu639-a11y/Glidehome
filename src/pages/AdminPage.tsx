import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Ban,
  Check,
  Eye,
  EyeOff,
  Flag,
  History,
  Home as HomeIcon,
  Lock,
  LogOut,
  Megaphone,
  Package,
  PlayCircle,
  Search,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import type { AdminDashboardData, AuthUser } from '../types.ts';
import { apiRequest, setStoredAdminToken } from '../lib/api.ts';
import { formatNaira } from '../data/locations.ts';

interface AdminPageProps {
  onNavigateHome?: () => void;
}

export function AdminPage({ onNavigateHome }: AdminPageProps) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminEmail, setAdminEmail] = useState<string>('');
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const [dashboard, setDashboard] = useState<AdminDashboardData | null>(null);
  const [tab, setTab] = useState<
    'kyc' | 'upgrades' | 'houses' | 'items' | 'reports' | 'users' | 'logins' | 'notes'
  >('kyc');
  const [houseFilter, setHouseFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [previewImg, setPreviewImg] = useState<string | null>(null);
  const [previewVideo, setPreviewVideo] = useState<string | null>(null);

  const [lookupUid, setLookupUid] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [lookupResult, setLookupResult] = useState<{
    user: AuthUser;
    houseCount: number;
    itemCount: number;
    reportCount: number;
  } | null>(null);

  const [reportUidInput, setReportUidInput] = useState('');
  const [reportReasonInput, setReportReasonInput] = useState('');
  const [reportBlockUser, setReportBlockUser] = useState(false);
  const [submittingAdminReport, setSubmittingAdminReport] = useState(false);

  const [noteText, setNoteText] = useState('');
  const [publishingNote, setPublishingNote] = useState(false);

  const [rejectTarget, setRejectTarget] = useState<{
    type: 'kyc' | 'house' | 'upgrade' | 'item';
    id: string;
  } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const loadDashboard = useCallback(async () => {
    try {
      const data = await apiRequest<AdminDashboardData>('/api/mega/dashboard');
      setDashboard(data);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to load dashboard.');
    }
  }, []);

  useEffect(() => {
    apiRequest<{ isAdmin: boolean; email?: string | null }>('/api/mega/me')
      .then((res) => {
        setIsAdmin(res.isAdmin);
        setAdminEmail(res.email || '');
        if (res.isAdmin) {
          loadDashboard();
        } else {
          setStoredAdminToken(null);
        }
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, [loadDashboard]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setActionSuccess('');
    setLoginLoading(true);
    try {
      const res = await apiRequest<{
        isAdmin: boolean;
        email: string;
        adminToken?: string;
        firstTimeConfigured?: boolean;
      }>('/api/mega/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      if (res.adminToken) {
        setStoredAdminToken(res.adminToken);
      }
      setIsAdmin(true);
      setAdminEmail(res.email);
      setPassword('');
      if (res.firstTimeConfigured) {
        setActionSuccess('Password saved permanently! It cannot be changed or reset.');
      }
      await loadDashboard();
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Login failed.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await apiRequest('/api/mega/logout', { method: 'POST' });
    } finally {
      setStoredAdminToken(null);
      setIsAdmin(false);
      setAdminEmail('');
      setDashboard(null);
      setActionSuccess('');
      onNavigateHome?.();
    }
  };

  const handleApproveKyc = async (id: string) => {
    setActionError('');
    setActionSuccess('');
    try {
      const res = await apiRequest<{ message: string }>(`/api/mega/kyc/${id}/approve`, { method: 'POST' });
      setActionSuccess(res.message || 'KYC approved.');
      await loadDashboard();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to approve KYC.');
    }
  };

  const handleApproveHouse = async (id: string) => {
    setActionError('');
    try {
      await apiRequest(`/api/mega/houses/${id}/approve`, { method: 'POST' });
      await loadDashboard();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to approve house.');
    }
  };

  const handleApproveUpgrade = async (id: string) => {
    setActionError('');
    setActionSuccess('');
    try {
      const res = await apiRequest<{ message: string }>(`/api/mega/upgrades/${id}/approve`, { method: 'POST' });
      setActionSuccess(res.message || 'User upgraded to Agent.');
      await loadDashboard();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to approve upgrade.');
    }
  };

  const handleApproveItem = async (id: string) => {
    setActionError('');
    try {
      await apiRequest(`/api/mega/items/${id}/approve`, { method: 'POST' });
      await loadDashboard();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to approve item.');
    }
  };

  const handleDeleteItem = async (id: string) => {
    setActionError('');
    try {
      await apiRequest(`/api/mega/items/${id}`, { method: 'DELETE' });
      await loadDashboard();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete item.');
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectTarget) return;
    setActionError('');
    try {
      const endpoint =
        rejectTarget.type === 'kyc'
          ? `/api/mega/kyc/${rejectTarget.id}/reject`
          : rejectTarget.type === 'upgrade'
          ? `/api/mega/upgrades/${rejectTarget.id}/reject`
          : rejectTarget.type === 'item'
          ? `/api/mega/items/${rejectTarget.id}/reject`
          : `/api/mega/houses/${rejectTarget.id}/reject`;
      await apiRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify({ reason: rejectReason }),
      });
      setRejectTarget(null);
      setRejectReason('');
      await loadDashboard();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Rejection failed.');
    }
  };

  const handleDeleteHouse = async (id: string) => {
    setActionError('');
    try {
      await apiRequest(`/api/mega/houses/${id}`, { method: 'DELETE' });
      await loadDashboard();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete house.');
    }
  };

  const handleToggleHouseStatus = async (id: string, nextStatus: 'Available' | 'SOLD OUT') => {
    setActionError('');
    setActionSuccess('');
    try {
      await apiRequest(`/api/houses/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      setActionSuccess(`House marked as ${nextStatus}.`);
      await loadDashboard();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update house status.');
    }
  };

  const handleToggleBlockUser = async (id: string, currentlyBlocked: boolean) => {
    setActionError('');
    setActionSuccess('');
    try {
      const res = await apiRequest<{ message: string }>(`/api/mega/users/${id}/block`, {
        method: 'POST',
        body: JSON.stringify({ blocked: !currentlyBlocked }),
      });
      setActionSuccess(res.message);
      await loadDashboard();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update user status.');
    }
  };

  const handlePublishNote = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError('');
    setActionSuccess('');
    setPublishingNote(true);
    try {
      const res = await apiRequest<{ message?: string }>('/api/mega/notes', {
        method: 'POST',
        body: JSON.stringify({ message: noteText }),
      });
      setNoteText('');
      setActionSuccess(
        res.message || 'Broadcast published! All registered users can now see it at the top of their Home page and Dashboard.'
      );
      await loadDashboard();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to publish broadcast.');
    } finally {
      setPublishingNote(false);
    }
  };

  const handleDeleteNote = async (id: string) => {
    await apiRequest(`/api/mega/notes/${id}`, { method: 'DELETE' });
    await loadDashboard();
  };

  const handleClearAllNotes = async () => {
    setActionError('');
    setActionSuccess('');
    try {
      await apiRequest('/api/mega/notes', { method: 'DELETE' });
      setActionSuccess('All broadcast messages cleared.');
      await loadDashboard();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to clear broadcast messages.');
    }
  };

  const handleLookupUid = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUid = lookupUid.trim();
    if (!cleanUid) return;
    setLookupLoading(true);
    setLookupError('');
    setLookupResult(null);
    try {
      const res = await apiRequest<{
        user: AuthUser;
        houseCount: number;
        itemCount: number;
        reportCount: number;
      }>(`/api/mega/users/by-uid/${encodeURIComponent(cleanUid)}`);
      setLookupResult(res);
    } catch (err) {
      setLookupError(err instanceof Error ? err.message : 'No user found with that UID number.');
    } finally {
      setLookupLoading(false);
    }
  };

  const handleAdminSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError('');
    setActionSuccess('');
    setSubmittingAdminReport(true);
    try {
      const res = await apiRequest<{ message: string }>('/api/mega/reports', {
        method: 'POST',
        body: JSON.stringify({
          reportedUid: reportUidInput.trim(),
          reason: reportReasonInput.trim(),
          blockUser: reportBlockUser,
        }),
      });
      setActionSuccess(res.message);
      setReportUidInput('');
      setReportReasonInput('');
      setReportBlockUser(false);
      await loadDashboard();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to record warning / report.');
    } finally {
      setSubmittingAdminReport(false);
    }
  };

  const handleReportAction = async (id: string, action: 'warn' | 'block' | 'resolve') => {
    setActionError('');
    setActionSuccess('');
    try {
      const res = await apiRequest<{ message: string }>(`/api/mega/reports/${id}/action`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      });
      setActionSuccess(res.message);
      await loadDashboard();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to process report action.');
    }
  };

  if (checking) {
    return (
      <div className="max-w-md mx-auto px-4 py-14">
        <div className="h-64 bg-white dark:bg-slate-900 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto px-4 py-12 sm:py-16">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-100 dark:border-slate-800 space-y-5">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-[#0B3D22]/10 dark:bg-emerald-950/70 text-[#0B3D22] dark:text-emerald-400 flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </span>
            <div>
              <h1 className="font-display font-bold text-xl text-slate-900 dark:text-slate-100">Admin Portal Login</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">Authorized administrator sign in only</p>
            </div>
          </div>

          {loginError && (
            <div className="bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 text-sm rounded-xl p-3">
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Admin Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter authorized admin email"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7A3E]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 px-3.5 py-2.5 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7A3E]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-3 rounded-xl bg-[#0B7A3E] hover:bg-[#096734] text-white font-semibold text-sm cursor-pointer disabled:opacity-60"
            >
              {loginLoading ? 'Signing in...' : 'Sign In to Admin Dashboard'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-2xl text-slate-900 dark:text-slate-100">Glide Homes Admin Dashboard</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Signed in as {adminEmail || 'Administrator'} · Password permanently locked
          </p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-semibold text-slate-700 dark:text-slate-200 cursor-pointer self-start sm:self-auto"
        >
          <LogOut className="w-4 h-4" />
          Admin Logout
        </button>
      </div>

      {actionSuccess && (
        <div className="bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-sm rounded-xl p-3">
          {actionSuccess}
        </div>
      )}

      {actionError && (
        <div className="bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 text-sm rounded-xl p-3">
          {actionError}
        </div>
      )}

      {/* KPI Cards */}
      {dashboard && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-xs border border-slate-100 dark:border-slate-800">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Houses</p>
            <p className="mt-1 font-display font-bold text-2xl text-slate-900 dark:text-slate-100 tabular-nums">
              {dashboard.stats.totalHouses}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-xs border border-slate-100 dark:border-slate-800">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Pending Houses</p>
            <p className="mt-1 font-display font-bold text-2xl text-[#FF7A00] tabular-nums">
              {dashboard.stats.pendingHouses}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-xs border border-slate-100 dark:border-slate-800">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Users</p>
            <p className="mt-1 font-display font-bold text-2xl text-slate-900 dark:text-slate-100 tabular-nums">
              {dashboard.stats.totalUsers}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-xs border border-slate-100 dark:border-slate-800">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Agents</p>
            <p className="mt-1 font-display font-bold text-2xl text-[#0B7A3E] dark:text-emerald-400 tabular-nums">
              {dashboard.stats.totalAgents}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-xs border border-slate-100 dark:border-slate-800">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Pending KYC</p>
            <p className="mt-1 font-display font-bold text-2xl text-[#FF7A00] tabular-nums">
              {dashboard.stats.pendingKyc}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-xs border border-slate-100 dark:border-slate-800">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Agent Upgrades</p>
            <p className="mt-1 font-display font-bold text-2xl text-[#FF7A00] tabular-nums">
              {dashboard.stats.pendingUpgrades}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-xs border border-slate-100 dark:border-slate-800">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Home Items</p>
            <p className="mt-1 font-display font-bold text-2xl text-[#0B7A3E] dark:text-emerald-400 tabular-nums">
              {dashboard.stats.totalItems}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-xs border border-slate-100 dark:border-slate-800">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Open Reports</p>
            <p className="mt-1 font-display font-bold text-2xl text-red-600 dark:text-red-400 tabular-nums">
              {dashboard.stats.openReports ?? 0}
            </p>
          </div>
        </div>
      )}

      {/* Quick Find User by UID Number */}
      {dashboard && (
        <section className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 shadow-xs border border-slate-100 dark:border-slate-800 space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <h2 className="font-display font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100">
                Find User by UID Number
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Enter a user&apos;s UID number from a warning, report, house, or item to inspect their profile and take action.
              </p>
            </div>
            <form onSubmit={handleLookupUid} className="flex items-center gap-2 w-full lg:w-auto">
              <div className="relative flex-1 lg:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={lookupUid}
                  onChange={(e) => setLookupUid(e.target.value)}
                  placeholder="Enter UID (e.g. 48291035)"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 pl-9 pr-3 py-2 text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-[#0B7A3E]"
                />
              </div>
              <button
                type="submit"
                disabled={lookupLoading}
                className="px-4 py-2 rounded-xl bg-[#0B7A3E] hover:bg-[#096734] text-white text-xs sm:text-sm font-semibold cursor-pointer disabled:opacity-60 whitespace-nowrap"
              >
                {lookupLoading ? 'Checking...' : 'Find UID'}
              </button>
            </form>
          </div>

          {lookupError && (
            <div className="bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 text-xs sm:text-sm rounded-xl p-3">
              {lookupError}
            </div>
          )}

          {lookupResult && (
            <div className="bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold bg-slate-900 dark:bg-slate-700 text-white px-2.5 py-0.5 rounded">
                    UID: {lookupResult.user.userCode}
                  </span>
                  <span className="font-display font-bold text-base text-slate-900 dark:text-slate-100">
                    {lookupResult.user.fullName}
                  </span>
                  <span className="text-xs font-semibold capitalize px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300">
                    {lookupResult.user.role}
                  </span>
                  {lookupResult.user.isBlocked && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-red-100 dark:bg-red-950/70 text-red-700 dark:text-red-300">
                      BLOCKED
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  {lookupResult.user.email} · {lookupResult.user.phone}
                  {lookupResult.user.state ? ` · ${lookupResult.user.state}` : ''}
                </p>
                <p className="text-xs font-medium text-slate-700 dark:text-slate-200">
                  Houses: {lookupResult.houseCount} · Home Items: {lookupResult.itemCount} · Reports:{' '}
                  <strong className="text-red-600 dark:text-red-400">{lookupResult.reportCount}</strong>
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setReportUidInput(lookupResult.user.userCode);
                    setTab('reports');
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold cursor-pointer"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Warn by UID
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await handleToggleBlockUser(lookupResult.user.id, lookupResult.user.isBlocked);
                    setLookupResult((prev) =>
                      prev
                        ? { ...prev, user: { ...prev.user, isBlocked: !prev.user.isBlocked } }
                        : null
                    );
                  }}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
                    lookupResult.user.isBlocked
                      ? 'bg-[#0B7A3E] text-white'
                      : 'bg-red-600 hover:bg-red-700 text-white'
                  }`}
                >
                  <Ban className="w-3.5 h-3.5" />
                  {lookupResult.user.isBlocked ? 'Unblock User' : 'Block User'}
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 bg-white dark:bg-slate-900 p-1.5 rounded-xl border border-slate-100 dark:border-slate-800 w-fit">
        <button
          type="button"
          onClick={() => setTab('kyc')}
          className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
            tab === 'kyc' ? 'bg-[#0B7A3E] text-white' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          KYC ({dashboard?.kycRequests.length || 0})
        </button>
        <button
          type="button"
          onClick={() => setTab('upgrades')}
          className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
            tab === 'upgrades' ? 'bg-[#0B7A3E] text-white' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <ArrowUpRight className="w-4 h-4" />
          Agent Upgrades ({dashboard?.upgradeRequests?.length || 0})
        </button>
        <button
          type="button"
          onClick={() => setTab('houses')}
          className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
            tab === 'houses' ? 'bg-[#0B7A3E] text-white' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <HomeIcon className="w-4 h-4" />
          Houses ({dashboard?.houses.length || 0})
        </button>
        <button
          type="button"
          onClick={() => setTab('items')}
          className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
            tab === 'items' ? 'bg-[#0B7A3E] text-white' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Package className="w-4 h-4" />
          Home Items ({dashboard?.homeItems?.length || 0})
        </button>
        <button
          type="button"
          onClick={() => setTab('reports')}
          className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
            tab === 'reports' ? 'bg-red-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Flag className="w-4 h-4" />
          Reports &amp; Warnings ({dashboard?.reports?.length || 0})
        </button>
        <button
          type="button"
          onClick={() => setTab('users')}
          className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
            tab === 'users' ? 'bg-[#0B7A3E] text-white' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          Users ({dashboard?.users.length || 0})
        </button>
        <button
          type="button"
          onClick={() => setTab('logins')}
          className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
            tab === 'logins' ? 'bg-[#0B7A3E] text-white' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <History className="w-4 h-4" />
          Logins ({dashboard?.loginLogs.length || 0})
        </button>
        <button
          type="button"
          onClick={() => setTab('notes')}
          className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
            tab === 'notes' ? 'bg-[#0B7A3E] text-white' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Megaphone className="w-4 h-4" />
          Broadcast ({dashboard?.notes.length || 0})
        </button>
      </div>

      {/* KYC Requests Tab */}
      {dashboard && tab === 'kyc' && (
        <div className="space-y-4">
          {dashboard.kycRequests.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 text-center text-sm text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-slate-800">
              No KYC submissions yet.
            </div>
          ) : (
            dashboard.kycRequests.map((req) => (
              <div
                key={req.id}
                className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 shadow-xs border border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-6"
              >
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display font-bold text-base text-slate-900 dark:text-slate-100">{req.userFullName}</h3>
                    {req.userCode && (
                      <span className="font-mono text-xs text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                        UID: {req.userCode}
                      </span>
                    )}
                    <span
                      className={`text-xs font-bold px-2.5 py-0.5 rounded-md ${
                        req.status === 'approved'
                          ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300'
                          : req.status === 'rejected'
                          ? 'bg-red-100 dark:bg-red-950/70 text-red-800 dark:text-red-300'
                          : 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300'
                      }`}
                    >
                      {req.status.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    {req.userEmail} · {req.userPhone}{req.userState ? ` · ${req.userState}` : ''}
                  </p>
                  <p className="text-sm font-mono font-semibold text-slate-800 dark:text-slate-200">
                    {req.idType}: {req.idNumber}
                  </p>
                  {req.rejectionReason && (
                    <p className="text-xs text-red-600 dark:text-red-400">Rejection reason: {req.rejectionReason}</p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {req.idCardUrl && req.idCardUrl.trim().length > 0 && (
                    <button
                      type="button"
                      onClick={() => setPreviewImg(req.idCardUrl!)}
                      className="relative w-28 h-20 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 cursor-pointer"
                    >
                      <img src={req.idCardUrl} alt="ID Card" className="w-full h-full object-cover" />
                      <span className="absolute bottom-0 inset-x-0 bg-black/65 text-white text-[10px] py-0.5 text-center">
                        ID Card
                      </span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setPreviewImg(req.selfieUrl)}
                    className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-[#0B7A3E] bg-slate-100 cursor-pointer"
                  >
                    <img src={req.selfieUrl} alt="Captured Face" className="w-full h-full object-cover" />
                    <span className="absolute bottom-0 inset-x-0 bg-black/65 text-white text-[10px] py-0.5 text-center">
                      Captured Face
                    </span>
                  </button>
                  {req.livenessVideoUrl && (
                    <button
                      type="button"
                      onClick={() => setPreviewVideo(req.livenessVideoUrl!)}
                      className="relative w-32 h-20 rounded-xl overflow-hidden border-2 border-[#0B7A3E] bg-slate-900 text-white flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-slate-800"
                    >
                      <PlayCircle className="w-6 h-6 text-[#FF7A00]" />
                      <span className="text-[10px] font-semibold">Liveness Video</span>
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                  {req.status !== 'approved' && (
                    <button
                      type="button"
                      onClick={() => handleApproveKyc(req.id)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0B7A3E] hover:bg-[#096734] text-white text-xs font-semibold cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      Verify KYC
                    </button>
                  )}
                  {req.status !== 'rejected' && (
                    <button
                      type="button"
                      onClick={() => {
                        setRejectTarget({ type: 'kyc', id: req.id });
                        setRejectReason('');
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                      Reject
                    </button>
                  )}
                  {(() => {
                    const matchedUser = dashboard.users.find((u) => u.id === req.userId);
                    if (!matchedUser) return null;
                    return (
                      <button
                        type="button"
                        onClick={() => handleToggleBlockUser(matchedUser.id, matchedUser.isBlocked)}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
                          matchedUser.isBlocked
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 hover:bg-[#0B7A3E] text-[#0B7A3E] dark:text-emerald-300 hover:text-white'
                            : 'bg-slate-100 dark:bg-slate-800 hover:bg-red-600 text-slate-700 dark:text-slate-200 hover:text-white'
                        }`}
                      >
                        <Ban className="w-3.5 h-3.5" />
                        {matchedUser.isBlocked ? 'Unblock User' : 'Block User'}
                      </button>
                    );
                  })()}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Buyer -> Agent Upgrades Tab */}
      {dashboard && tab === 'upgrades' && (
        <div className="space-y-4">
          {!dashboard.upgradeRequests || dashboard.upgradeRequests.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 text-center text-sm text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-slate-800">
              No Buyer-to-Agent upgrade requests yet.
            </div>
          ) : (
            dashboard.upgradeRequests.map((req) => (
              <div
                key={req.id}
                className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-xs border border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display font-bold text-base text-slate-900 dark:text-slate-100">{req.userFullName}</h3>
                    {req.userCode && (
                      <span className="font-mono text-xs text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                        UID: {req.userCode}
                      </span>
                    )}
                    <span
                      className={`text-xs font-bold px-2.5 py-0.5 rounded-md ${
                        req.status === 'approved'
                          ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300'
                          : req.status === 'rejected'
                          ? 'bg-red-100 dark:bg-red-950/70 text-red-800 dark:text-red-300'
                          : 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300'
                      }`}
                    >
                      {req.status.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    {req.userEmail} · {req.userPhone}
                    {req.userState ? ` · ${req.userState}` : ''}
                  </p>
                  {req.note && <p className="text-xs text-slate-700 dark:text-slate-200">{req.note}</p>}
                  {req.rejectionReason && (
                    <p className="text-xs text-red-600 dark:text-red-400">Rejection reason: {req.rejectionReason}</p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {req.status !== 'approved' && (
                    <button
                      type="button"
                      onClick={() => handleApproveUpgrade(req.id)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0B7A3E] hover:bg-[#096734] text-white text-xs font-semibold cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      Accept Agent Upgrade
                    </button>
                  )}
                  {req.status !== 'rejected' && (
                    <button
                      type="button"
                      onClick={() => {
                        setRejectTarget({ type: 'upgrade', id: req.id });
                        setRejectReason('');
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                      Reject
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Houses Approval & Management Tab */}
      {dashboard && tab === 'houses' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="font-display font-bold text-base text-slate-900 dark:text-slate-100">
                Review &amp; Approve House Listings
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                New houses uploaded by verified agents start as Pending until you approve or reject them.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'all', label: `All (${dashboard.houses.length})` },
                  { id: 'pending', label: `Pending (${dashboard.stats.pendingHouses})` },
                  {
                    id: 'approved',
                    label: `Approved (${dashboard.houses.filter((h) => h.approvalStatus === 'approved').length})`,
                  },
                  {
                    id: 'rejected',
                    label: `Rejected (${dashboard.houses.filter((h) => h.approvalStatus === 'rejected').length})`,
                  },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setHouseFilter(f.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                    houseFilter === f.id
                      ? 'bg-[#0B7A3E] text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {(() => {
            const filteredHouses =
              houseFilter === 'all'
                ? dashboard.houses
                : dashboard.houses.filter((h) => h.approvalStatus === houseFilter);

            if (filteredHouses.length === 0) {
              return (
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 text-center text-sm text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-slate-800">
                  {houseFilter === 'all'
                    ? 'No houses uploaded yet.'
                    : `No ${houseFilter} houses right now.`}
                </div>
              );
            }

            return filteredHouses.map((h) => (
              <div
                key={h.id}
                className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-xs border border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-5"
              >
                <div className="flex items-start gap-4">
                  <button
                    type="button"
                    onClick={() => h.images[0] && setPreviewImg(h.images[0])}
                    className="w-28 h-20 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0 cursor-pointer"
                  >
                    {h.images[0] && (
                      <img src={h.images[0]} alt={h.title} className="w-full h-full object-cover" />
                    )}
                  </button>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display font-bold text-base text-slate-900 dark:text-slate-100">{h.title}</h3>
                      <span
                        className={`text-xs font-bold px-2.5 py-0.5 rounded-md ${
                          h.approvalStatus === 'approved'
                            ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300'
                            : h.approvalStatus === 'rejected'
                            ? 'bg-red-100 dark:bg-red-950/70 text-red-800 dark:text-red-300'
                            : 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300'
                        }`}
                      >
                        {h.approvalStatus.toUpperCase()}
                      </span>
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">· {h.status}</span>
                    </div>
                    <p className="text-sm font-bold text-[#0B7A3E] dark:text-emerald-400 tabular-nums">
                      {formatNaira(h.price)} / yr · Inspection Fee: {formatNaira(h.inspectionFee)}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      {h.houseNumber} {h.streetName}, {h.area}, {h.state}, {h.country}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Agent: {h.agentName} {h.agentCode ? `(UID: ${h.agentCode})` : ''} · {h.phone} · {h.images.length} photos
                    </p>
                    {h.rejectionReason && (
                      <p className="text-xs text-red-600 dark:text-red-400">Rejection reason: {h.rejectionReason}</p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {h.approvalStatus !== 'approved' && (
                    <button
                      type="button"
                      onClick={() => handleApproveHouse(h.id)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0B7A3E] hover:bg-[#096734] text-white text-xs font-semibold cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      Approve House
                    </button>
                  )}
                  {h.approvalStatus !== 'rejected' && (
                    <button
                      type="button"
                      onClick={() => {
                        setRejectTarget({ type: 'house', id: h.id });
                        setRejectReason('');
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                      Reject
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      handleToggleHouseStatus(h.id, h.status === 'SOLD OUT' ? 'Available' : 'SOLD OUT')
                    }
                    className={`inline-flex items-center gap-1 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                      h.status === 'SOLD OUT'
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 hover:bg-[#0B7A3E] text-[#0B7A3E] dark:text-emerald-300 hover:text-white'
                        : 'bg-slate-100 dark:bg-slate-800 hover:bg-red-600 text-slate-700 dark:text-slate-200 hover:text-white'
                    }`}
                  >
                    {h.status === 'SOLD OUT' ? 'Set Available' : 'Mark Sold Out'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteHouse(h.id)}
                    className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-red-50 dark:bg-red-950/60 hover:bg-red-600 text-red-700 dark:text-red-300 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                </div>
              </div>
            ));
          })()}
        </div>
      )}

      {/* Home Property Items Tab */}
      {dashboard && tab === 'items' && (
        <div className="space-y-4">
          {!dashboard.homeItems || dashboard.homeItems.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 text-center text-sm text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-slate-800">
              No home property items (TV, Gas, Fan, Furniture) posted yet.
            </div>
          ) : (
            dashboard.homeItems.map((item) => (
              <div
                key={item.id}
                className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-xs border border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-4">
                  <button
                    type="button"
                    onClick={() => item.images[0] && setPreviewImg(item.images[0])}
                    className="w-24 h-20 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0 cursor-pointer"
                  >
                    {item.images[0] && (
                      <img src={item.images[0]} alt={item.title} className="w-full h-full object-cover" />
                    )}
                  </button>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display font-bold text-base text-slate-900 dark:text-slate-100">{item.title}</h3>
                      <span
                        className={`text-xs font-bold px-2.5 py-0.5 rounded-md ${
                          item.approvalStatus === 'approved'
                            ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300'
                            : item.approvalStatus === 'rejected'
                            ? 'bg-red-100 dark:bg-red-950/70 text-red-800 dark:text-red-300'
                            : 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300'
                        }`}
                      >
                        {item.approvalStatus.toUpperCase()}
                      </span>
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">· {item.status}</span>
                    </div>
                    <p className="text-sm font-bold text-[#0B7A3E] dark:text-emerald-400 tabular-nums">
                      {formatNaira(item.price)} · {item.category} · {item.condition}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Seller: {item.sellerName} {item.sellerCode ? `(UID: ${item.sellerCode})` : ''} · {item.phone} · {item.area}, {item.state}
                    </p>
                    {item.rejectionReason && (
                      <p className="text-xs text-red-600 dark:text-red-400">Rejection reason: {item.rejectionReason}</p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {item.approvalStatus !== 'approved' && (
                    <button
                      type="button"
                      onClick={() => handleApproveItem(item.id)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0B7A3E] hover:bg-[#096734] text-white text-xs font-semibold cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      Approve Item
                    </button>
                  )}
                  {item.approvalStatus !== 'rejected' && (
                    <button
                      type="button"
                      onClick={() => {
                        setRejectTarget({ type: 'item', id: item.id });
                        setRejectReason('');
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                      Reject
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDeleteItem(item.id)}
                    className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-red-50 dark:bg-red-950/60 hover:bg-red-600 text-red-700 dark:text-red-300 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Reports & Warnings Tab (UID Required) */}
      {dashboard && tab === 'reports' && (
        <div className="space-y-6">
          <form
            onSubmit={handleAdminSubmitReport}
            className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-xs border border-slate-100 dark:border-slate-800 space-y-4"
          >
            <div>
              <h2 className="font-display font-bold text-lg text-slate-900 dark:text-slate-100">
                Record Warning or Report by UID Number
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Whenever you receive a warning or report about a user (from WhatsApp, Gmail, or inspection disputes), enter their UID number below to log the warning or block the account.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  User UID Number (Required)
                </label>
                <input
                  type="text"
                  required
                  value={reportUidInput}
                  onChange={(e) => setReportUidInput(e.target.value)}
                  placeholder="e.g. 48291035"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 px-3.5 py-2.5 text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-[#0B7A3E]"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Warning / Report Reason
                </label>
                <input
                  type="text"
                  required
                  minLength={3}
                  value={reportReasonInput}
                  onChange={(e) => setReportReasonInput(e.target.value)}
                  placeholder="Describe the warning or report received..."
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7A3E]"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={reportBlockUser}
                  onChange={(e) => setReportBlockUser(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-red-600 focus:ring-red-600"
                />
                <span>Block this user account immediately</span>
              </label>
              <button
                type="submit"
                disabled={submittingAdminReport}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-semibold cursor-pointer disabled:opacity-60"
              >
                {submittingAdminReport ? 'Saving Warning...' : 'Save Warning / Report'}
              </button>
            </div>
          </form>

          <div className="space-y-3">
            {!dashboard.reports || dashboard.reports.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 text-center text-sm text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-slate-800">
                No warnings or user reports submitted yet.
              </div>
            ) : (
              dashboard.reports.map((rep) => (
                <div
                  key={rep.id}
                  className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-xs border border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold bg-slate-900 dark:bg-slate-700 text-white px-2.5 py-0.5 rounded">
                        UID: {rep.reportedUid}
                      </span>
                      <h3 className="font-display font-bold text-base text-slate-900 dark:text-slate-100">
                        {rep.reportedUserName}
                      </h3>
                      <span
                        className={`text-xs font-bold px-2.5 py-0.5 rounded-md ${
                          rep.status === 'resolved'
                            ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300'
                            : rep.status === 'warned'
                            ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-300'
                            : 'bg-red-100 dark:bg-red-950/70 text-red-800 dark:text-red-300'
                        }`}
                      >
                        {rep.status.toUpperCase()}
                      </span>
                      {rep.reportedUserBlocked && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-red-600 text-white">
                          ACCOUNT BLOCKED
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      {rep.reportedUserEmail || 'No email'} · {rep.reportedUserPhone || 'No phone'}
                      {rep.reportedUserRole ? ` · ${rep.reportedUserRole}` : ''} · Type: {rep.listingType}
                    </p>
                    <p className="text-sm text-slate-800 dark:text-slate-200 font-medium">{rep.reason}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Reported by: {rep.reporterName}
                      {rep.reporterContact ? ` (${rep.reporterContact})` : ''} ·{' '}
                      {new Date(rep.createdAt).toLocaleString()}
                    </p>
                    {rep.adminActionNote && (
                      <p className="text-xs text-[#0B7A3E] dark:text-emerald-400 font-semibold">
                        Admin Note: {rep.adminActionNote}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleReportAction(rep.id, 'warn')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold cursor-pointer"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Issue Warning
                    </button>
                    {!rep.reportedUserBlocked && rep.reportedUserId && (
                      <button
                        type="button"
                        onClick={() => handleReportAction(rep.id, 'block')}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold cursor-pointer"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        Block User
                      </button>
                    )}
                    {rep.status !== 'resolved' && (
                      <button
                        type="button"
                        onClick={() => handleReportAction(rep.id, 'resolve')}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0B7A3E] hover:bg-[#096734] text-white text-xs font-semibold cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Resolve
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Users Tab (Block / Unblock) */}
      {dashboard && tab === 'users' && (
        <div className="space-y-3">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-xs border border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100">
              All Registered Users &amp; UID Numbers
            </p>
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                placeholder="Filter by UID, name, email, or phone..."
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 pl-9 pr-3 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7A3E]"
              />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xs border border-slate-100 dark:border-slate-800 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/70">
                <tr>
                  <th className="py-3 px-4">UID Number</th>
                  <th className="py-3 px-4">Full Name</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Phone</th>
                  <th className="py-3 px-4">State</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">KYC Status</th>
                  <th className="py-3 px-4">Account</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {(() => {
                  const q = userSearchQuery.trim().toLowerCase();
                  const filteredUsers = q
                    ? dashboard.users.filter((u) =>
                        `${u.userCode} ${u.fullName} ${u.email} ${u.phone}`.toLowerCase().includes(q)
                      )
                    : dashboard.users;

                  if (filteredUsers.length === 0) {
                    return (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-slate-500 dark:text-slate-400">
                          {q ? 'No registered user matches that UID or search query.' : 'No registered users yet.'}
                        </td>
                      </tr>
                    );
                  }

                  return filteredUsers.map((u) => (
                    <tr key={u.id}>
                      <td className="py-3 px-4 font-mono text-xs font-bold text-slate-800 dark:text-slate-200">{u.userCode}</td>
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">{u.fullName}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{u.email}</td>
                      <td className="py-3 px-4 tabular-nums text-slate-600 dark:text-slate-300">{u.phone}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{u.state || '—'}</td>
                      <td className="py-3 px-4 capitalize text-slate-700 dark:text-slate-200">{u.role}</td>
                      <td className="py-3 px-4 text-xs font-semibold capitalize text-slate-700 dark:text-slate-200">
                        {u.role === 'buyer' ? 'N/A' : u.kycStatus}
                      </td>
                      <td className="py-3 px-4 text-xs font-bold">
                        {u.isBlocked ? (
                          <span className="text-red-600 dark:text-red-400">Blocked</span>
                        ) : (
                          <span className="text-[#0B7A3E] dark:text-emerald-400">Active</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleToggleBlockUser(u.id, u.isBlocked)}
                          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                            u.isBlocked
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 hover:bg-[#0B7A3E] text-[#0B7A3E] dark:text-emerald-300 hover:text-white'
                              : 'bg-red-50 dark:bg-red-950/60 hover:bg-red-600 text-red-700 dark:text-red-300 hover:text-white'
                          }`}
                        >
                          <Ban className="w-3.5 h-3.5" />
                          {u.isBlocked ? 'Unblock' : 'Block'}
                        </button>
                      </td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Login History Tab */}
      {dashboard && tab === 'logins' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xs border border-slate-100 dark:border-slate-800 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/70">
              <tr>
                <th className="py-3 px-4">UID Number</th>
                <th className="py-3 px-4">Full Name</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Signed In At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {dashboard.loginLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500 dark:text-slate-400">
                    No login events recorded yet.
                  </td>
                </tr>
              ) : (
                dashboard.loginLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-700 dark:text-slate-200">{log.userCode}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">{log.fullName}</td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{log.email}</td>
                    <td className="py-3 px-4 capitalize text-slate-700 dark:text-slate-200">{log.role}</td>
                    <td className="py-3 px-4 tabular-nums text-xs text-slate-500 dark:text-slate-400">
                      {new Date(log.loggedInAt).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Admin Broadcast / Note Tab */}
      {dashboard && tab === 'notes' && (
        <div className="space-y-6">
          <form onSubmit={handlePublishNote} className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-xs border border-slate-100 dark:border-slate-800 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-display font-bold text-lg text-slate-900 dark:text-slate-100">
                  Write Broadcast Message / Admin Note
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Any broadcast message you publish here appears immediately at the top of the Home page and Dashboard for all registered users.
                </p>
              </div>
              {dashboard.notes.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAllNotes}
                  className="px-3.5 py-2 rounded-xl bg-red-50 dark:bg-red-950/60 hover:bg-red-600 text-red-700 dark:text-red-300 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  Clear All Broadcasts
                </button>
              )}
            </div>
            <textarea
              required
              rows={3}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Write a broadcast message, announcement, or safety notice for all registered users..."
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7A3E]"
            />
            <button
              type="submit"
              disabled={publishingNote}
              className="px-5 py-2.5 rounded-xl bg-[#0B7A3E] hover:bg-[#096734] text-white text-sm font-semibold cursor-pointer disabled:opacity-60"
            >
              {publishingNote ? 'Publishing Broadcast...' : 'Publish Broadcast to All Users'}
            </button>
          </form>

          <div className="space-y-3">
            {dashboard.notes.map((n) => (
              <div
                key={n.id}
                className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-xs border border-slate-100 dark:border-slate-800 flex items-start justify-between gap-4"
              >
                <div>
                  <p className="text-sm text-slate-800 dark:text-slate-200">{n.message}</p>
                  <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{new Date(n.createdAt).toLocaleString()}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteNote(n.id)}
                  className="p-2 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/60 cursor-pointer"
                  aria-label="Delete broadcast"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reject Reason Modal */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleRejectSubmit}
            className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4"
          >
            <h3 className="font-display font-bold text-lg text-slate-900 dark:text-slate-100">
              {rejectTarget.type === 'kyc'
                ? 'Reject KYC Submission'
                : rejectTarget.type === 'upgrade'
                ? 'Reject Agent Upgrade Request'
                : rejectTarget.type === 'item'
                ? 'Reject Home Property Item'
                : 'Reject House Upload'}
            </h3>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Reason shown to User / Seller
              </label>
              <textarea
                required
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Explain clearly what needs to be corrected..."
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7A3E]"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectTarget(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold cursor-pointer"
              >
                Confirm Rejection
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Enlarged Image Preview Modal */}
      {previewImg && (
        <div
          onClick={() => setPreviewImg(null)}
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 cursor-pointer"
        >
          <img
            src={previewImg}
            alt="Enlarged preview"
            className="max-w-full max-h-[85vh] rounded-xl object-contain bg-white dark:bg-slate-900"
          />
        </div>
      )}

      {/* Enlarged Liveness Video Modal */}
      {previewVideo && (
        <div
          onClick={() => setPreviewVideo(null)}
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-950 rounded-2xl p-4 max-w-xl w-full space-y-3 border border-slate-800 shadow-2xl"
          >
            <div className="flex items-center justify-between text-white">
              <span className="font-display font-bold text-sm">KYC Face Liveness Video</span>
              <button
                type="button"
                onClick={() => setPreviewVideo(null)}
                aria-label="Close video preview"
                className="p-1.5 rounded-lg hover:bg-white/10 text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <video
              src={previewVideo}
              controls
              autoPlay
              playsInline
              className="w-full max-h-[70vh] rounded-xl bg-black"
            />
          </div>
        </div>
      )}
    </div>
  );
}
