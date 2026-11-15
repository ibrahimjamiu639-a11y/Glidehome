import { useState } from 'react';
import { CheckCircle2, Eye, EyeOff, KeyRound, UserPlus } from 'lucide-react';
import type { AuthUser, UserRole } from '../types.ts';
import { NIGERIAN_STATES } from '../data/locations.ts';
import { apiRequest, setStoredAdminToken, setStoredUserToken } from '../lib/api.ts';

interface RegisterPageProps {
  onSuccess: (user: AuthUser) => void;
  onNavigate: (path: string) => void;
}

export function RegisterPage({ onSuccess, onNavigate }: RegisterPageProps) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [state, setState] = useState('Lagos');
  const [customState, setCustomState] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [role, setRole] = useState<UserRole>('buyer');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanName = fullName.trim();
    const cleanPhone = phone.trim();
    const cleanEmail = email.trim().toLowerCase();
    const finalState = state === 'Other' ? customState.trim() : state;

    if (cleanName.length < 2 || cleanName.length > 120) {
      setError('Please enter your Full Name or Company Name (at least 2 characters).');
      return;
    }
    if (cleanPhone.replace(/[^\d]/g, '').length < 7) {
      setError('Please enter a valid phone number (at least 7 digits).');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!finalState) {
      setError('Please select or enter your State.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await apiRequest<{ user: AuthUser; token: string; message: string }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          fullName: cleanName,
          phone: cleanPhone,
          email: cleanEmail,
          state: finalState,
          password,
          confirmPassword,
          role,
        }),
      });
      setStoredUserToken(res.token);
      onSuccess(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const passwordsEntered = password.length > 0 || confirmPassword.length > 0;
  const passwordsMatch = password.length >= 6 && password === confirmPassword;

  return (
    <div className="max-w-lg mx-auto px-4 py-8 sm:py-12">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3 mb-6">
          <span className="w-11 h-11 rounded-xl bg-[#0B7A3E]/10 dark:bg-emerald-950/70 text-[#0B7A3E] dark:text-emerald-400 flex items-center justify-center shrink-0">
            <UserPlus className="w-5 h-5" aria-hidden="true" />
          </span>
          <div>
            <h1 className="font-display font-bold text-xl text-slate-900 dark:text-slate-100">Create Your Account</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Complete all required details in one place · One account per person
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm rounded-xl p-3">
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Account Role</label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setRole('buyer')}
                className={`min-h-[44px] py-2.5 px-3 rounded-xl border text-sm font-semibold transition-colors cursor-pointer ${
                  role === 'buyer'
                    ? 'border-[#0B7A3E] bg-[#0B7A3E]/10 dark:bg-emerald-950/60 text-[#0B7A3E] dark:text-emerald-300'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                Buyer
              </button>
              <button
                type="button"
                onClick={() => setRole('agent')}
                className={`min-h-[44px] py-2.5 px-3 rounded-xl border text-sm font-semibold transition-colors cursor-pointer ${
                  role === 'agent'
                    ? 'border-[#0B7A3E] bg-[#0B7A3E]/10 dark:bg-emerald-950/60 text-[#0B7A3E] dark:text-emerald-300'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                Agent / Landlord
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="reg-fullname" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Full Name or Company Name <span className="text-red-600 dark:text-red-400">*</span>
            </label>
            <input
              id="reg-fullname"
              type="text"
              required
              minLength={2}
              maxLength={120}
              autoComplete="organization"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Jamiu Akofe or Akofe Properties Ltd"
              className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7A3E]"
            />
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              Your unique 8-digit UID Number will be created automatically and displayed on your listings.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label htmlFor="reg-phone" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Phone Number <span className="text-red-600 dark:text-red-400">*</span>
              </label>
              <input
                id="reg-phone"
                type="tel"
                required
                minLength={7}
                maxLength={30}
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 08031234567"
                className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 px-3.5 py-2.5 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-[#0B7A3E]"
              />
            </div>

            <div>
              <label htmlFor="reg-email" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Email Address <span className="text-red-600 dark:text-red-400">*</span>
              </label>
              <input
                id="reg-email"
                type="email"
                required
                maxLength={180}
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7A3E]"
              />
            </div>
          </div>

          <div className={state === 'Other' ? 'grid grid-cols-1 sm:grid-cols-2 gap-3.5' : ''}>
            <div>
              <label htmlFor="reg-state" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                State / Location <span className="text-red-600 dark:text-red-400">*</span>
              </label>
              <select
                id="reg-state"
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7A3E]"
              >
                {NIGERIAN_STATES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
                <option value="Other">Outside Nigeria / Other</option>
              </select>
            </div>

            {state === 'Other' && (
              <div>
                <label htmlFor="reg-custom-state" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Enter State / Region <span className="text-red-600 dark:text-red-400">*</span>
                </label>
                <input
                  id="reg-custom-state"
                  type="text"
                  required
                  maxLength={80}
                  value={customState}
                  onChange={(e) => setCustomState(e.target.value)}
                  placeholder="e.g. Greater London"
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7A3E]"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label htmlFor="reg-password" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Password <span className="text-red-600 dark:text-red-400">*</span>
              </label>
              <div className="relative">
                <input
                  id="reg-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 px-3.5 py-2.5 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7A3E]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 min-w-[36px] min-h-[36px] flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="reg-confirm-password" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Confirm Password <span className="text-red-600 dark:text-red-400">*</span>
              </label>
              <div className="relative">
                <input
                  id="reg-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat password"
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 px-3.5 py-2.5 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7A3E]"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 min-w-[36px] min-h-[36px] flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {passwordsEntered && (
            <p
              className={`text-xs font-medium ${
                password.length < 6
                  ? 'text-slate-500 dark:text-slate-400'
                  : passwordsMatch
                  ? 'text-[#0B7A3E] dark:text-emerald-400'
                  : confirmPassword.length > 0
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {password.length < 6
                ? 'Password must be at least 6 characters.'
                : confirmPassword.length === 0
                ? 'Now repeat your password to confirm.'
                : passwordsMatch
                ? 'Passwords match.'
                : 'Passwords do not match yet.'}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[46px] py-3 rounded-xl bg-[#0B7A3E] hover:bg-[#096734] text-white font-semibold text-sm transition-colors cursor-pointer disabled:opacity-60"
          >
            {loading ? 'Creating Account...' : 'Create Account & Get UID'}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-slate-600 dark:text-slate-400">
          Already have an account?{' '}
          <button
            type="button"
            onClick={() => onNavigate('/login')}
            className="font-semibold text-[#0B7A3E] dark:text-emerald-400 hover:underline cursor-pointer"
          >
            Login here
          </button>
        </p>
      </div>
    </div>
  );
}

interface LoginPageProps {
  onSuccess: (user: AuthUser) => void;
  onAdminSuccess?: (firstTimeConfigured?: boolean) => void;
  onNavigate: (path: string) => void;
}

export function LoginPage({ onSuccess, onAdminSuccess, onNavigate }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiRequest<{
        user?: AuthUser;
        token?: string;
        isAdmin?: boolean;
        adminToken?: string;
        firstTimeConfigured?: boolean;
      }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      if (res.isAdmin && res.adminToken) {
        setStoredAdminToken(res.adminToken);
        if (onAdminSuccess) {
          onAdminSuccess(res.firstTimeConfigured);
        } else {
          onNavigate('/admin-portal');
        }
        return;
      }
      if (res.user && res.token) {
        setStoredUserToken(res.token);
        onSuccess(res.user);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-10 sm:py-16">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3 mb-6">
          <span className="w-10 h-10 rounded-xl bg-[#0B7A3E]/10 dark:bg-emerald-950/70 text-[#0B7A3E] dark:text-emerald-400 flex items-center justify-center">
            <KeyRound className="w-5 h-5" aria-hidden="true" />
          </span>
          <div>
            <h1 className="font-display font-bold text-xl text-slate-900 dark:text-slate-100">Welcome Back</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Login to your Glide Homes account</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm rounded-xl p-3">{error}</div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Email Address or Phone Number</label>
            <input
              type="text"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com or 08031234567"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7A3E]"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Password</label>
              <button
                type="button"
                onClick={() => onNavigate('/forgot-password')}
                className="text-xs font-semibold text-[#0B7A3E] dark:text-emerald-400 hover:underline cursor-pointer"
              >
                Forget Password?
              </button>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 px-3.5 py-2.5 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7A3E]"
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
            disabled={loading}
            className="w-full py-3 rounded-xl bg-[#0B7A3E] hover:bg-[#096734] text-white font-semibold text-sm transition-colors cursor-pointer disabled:opacity-60"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-slate-600 dark:text-slate-400">
          New to Glide Homes?{' '}
          <button
            type="button"
            onClick={() => onNavigate('/register')}
            className="font-semibold text-[#0B7A3E] dark:text-emerald-400 hover:underline cursor-pointer"
          >
            Create an account
          </button>
        </p>
      </div>
    </div>
  );
}

export function ForgotPasswordPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [devResetPath, setDevResetPath] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const res = await apiRequest<{ message: string; devResetPath?: string }>('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setMessage(res.message);
      setDevResetPath(res.devResetPath || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-100 dark:border-slate-800 space-y-4">
        <h1 className="font-display font-bold text-xl text-slate-900 dark:text-slate-100">Reset Your Password</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">Enter your email address and we will send you a password reset link.</p>

        {error && <div className="bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm rounded-xl p-3">{error}</div>}
        {message && (
          <div className="bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-sm rounded-xl p-3 space-y-2">
            <p>{message}</p>
            {devResetPath && (
              <button
                type="button"
                onClick={() => onNavigate(devResetPath)}
                className="inline-block font-semibold text-[#0B7A3E] dark:text-emerald-400 underline cursor-pointer"
              >
                Open Password Reset Link
              </button>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7A3E]"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-[#0B7A3E] hover:bg-[#096734] text-white font-semibold text-sm cursor-pointer disabled:opacity-60"
          >
            {loading ? 'Sending Reset Link...' : 'Send Reset Link'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => onNavigate('/login')}
          className="w-full text-center text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 cursor-pointer"
        >
          Back to Login
        </button>
      </div>
    </div>
  );
}

export function ResetPasswordPage({ token, onNavigate }: { token: string; onNavigate: (path: string) => void }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await apiRequest('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password, confirmPassword }),
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-100 dark:border-slate-800 space-y-4">
        <h1 className="font-display font-bold text-xl text-slate-900 dark:text-slate-100">Create New Password</h1>
        {done ? (
          <div className="space-y-4">
            <div className="bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-sm rounded-xl p-4 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-[#0B7A3E] dark:text-emerald-400 shrink-0" />
              <span>Your password has been updated successfully.</span>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('/login')}
              className="w-full py-3 rounded-xl bg-[#0B7A3E] text-white font-semibold text-sm cursor-pointer"
            >
              Proceed to Login
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm rounded-xl p-3">{error}</div>}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">New Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3.5 py-2.5 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7A3E]"
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
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Confirm New Password</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3.5 py-2.5 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7A3E]"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-[#0B7A3E] text-white font-semibold text-sm cursor-pointer disabled:opacity-60"
            >
              {loading ? 'Saving Password...' : 'Save New Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
