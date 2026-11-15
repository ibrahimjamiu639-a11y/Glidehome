import { useEffect, useState } from 'react';
import { Camera, CheckCircle2, ExternalLink, MapPin, ShieldCheck, X } from 'lucide-react';

export type PermState = 'prompt' | 'granted' | 'denied';

export interface PermissionActionFeedback {
  ok: boolean;
  policyBlocked?: boolean;
  message?: string;
}

interface PermissionsModalProps {
  open: boolean;
  onClose: () => void;
  locationGranted: boolean;
  cameraGranted: boolean;
  onRequestLocation: () => Promise<PermissionActionFeedback>;
  onRequestCamera: () => Promise<PermissionActionFeedback>;
  onManualArea?: (area: string) => Promise<void>;
}

export function PermissionsModal({
  open,
  onClose,
  locationGranted,
  cameraGranted,
  onRequestLocation,
  onRequestCamera,
  onManualArea,
}: PermissionsModalProps) {
  const [locStatus, setLocStatus] = useState<PermState>(locationGranted ? 'granted' : 'prompt');
  const [camStatus, setCamStatus] = useState<PermState>(cameraGranted ? 'granted' : 'prompt');
  const [busy, setBusy] = useState<'none' | 'location' | 'camera' | 'both'>('none');
  const [feedback, setFeedback] = useState('');
  const [policyBlocked, setPolicyBlocked] = useState(false);
  const [areaInput, setAreaInput] = useState('');
  const [savingArea, setSavingArea] = useState(false);

  useEffect(() => {
    setLocStatus(locationGranted ? 'granted' : 'prompt');
  }, [locationGranted]);

  useEffect(() => {
    setCamStatus(cameraGranted ? 'granted' : 'prompt');
  }, [cameraGranted]);

  if (!open) return null;

  const handleAllowLocation = async () => {
    setFeedback('');
    setPolicyBlocked(false);
    setBusy('location');
    const res = await onRequestLocation();
    setLocStatus(res.ok ? 'granted' : 'denied');
    if (!res.ok) {
      setFeedback(
        res.message ||
          'Location access was not received. Check your browser site settings or open Glide Homes in a full tab.'
      );
      if (res.policyBlocked) setPolicyBlocked(true);
    }
    setBusy('none');
    if (res.ok && camStatus === 'granted') {
      onClose();
    }
  };

  const handleAllowCamera = async () => {
    setFeedback('');
    setPolicyBlocked(false);
    setBusy('camera');
    const res = await onRequestCamera();
    setCamStatus(res.ok ? 'granted' : 'denied');
    if (!res.ok) {
      setFeedback(
        res.message ||
          'Camera access was not received. Check your browser site settings or open Glide Homes in a full tab.'
      );
      if (res.policyBlocked) setPolicyBlocked(true);
    }
    setBusy('none');
    if (res.ok && locStatus === 'granted') {
      onClose();
    }
  };

  const handleAllowBoth = async () => {
    setFeedback('');
    setPolicyBlocked(false);
    setBusy('both');
    const locRes = locStatus === 'granted' ? { ok: true } : await onRequestLocation();
    setLocStatus(locRes.ok ? 'granted' : 'denied');
    const camRes = camStatus === 'granted' ? { ok: true } : await onRequestCamera();
    setCamStatus(camRes.ok ? 'granted' : 'denied');
    setBusy('none');

    if (locRes.ok && camRes.ok) {
      onClose();
      return;
    }

    const blockedByFrame = Boolean(locRes.policyBlocked || camRes.policyBlocked);
    setPolicyBlocked(blockedByFrame);
    setFeedback(
      locRes.message ||
        camRes.message ||
        'Please allow Location and Camera in your browser settings, or open Glide Homes in a full browser tab.'
    );
  };

  const handleSetArea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onManualArea || !areaInput.trim()) return;
    setSavingArea(true);
    setFeedback('');
    try {
      await onManualArea(areaInput.trim());
      setLocStatus('granted');
      onClose();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Could not find that location.');
    } finally {
      setSavingArea(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="permissions-modal-title"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 dark:border-slate-800 space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="w-10 h-10 rounded-xl bg-[#0B7A3E]/10 dark:bg-emerald-950/70 text-[#0B7A3E] dark:text-emerald-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" aria-hidden="true" />
            </span>
            <div>
              <h2 id="permissions-modal-title" className="font-display font-bold text-lg text-slate-900 dark:text-slate-100">
                Allow Location &amp; Camera Access
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Needed for live house maps (km) and live camera verification
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close permissions popup"
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          {/* Location Permission Row */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 p-3.5 flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <MapPin className="w-5 h-5 text-[#0B7A3E] dark:text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="space-y-0.5">
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Access Location</p>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Shows your real-time position on the Google Map and calculates km distances to houses.
                </p>
              </div>
            </div>
            {locStatus === 'granted' ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950/70 text-[#0B7A3E] dark:text-emerald-300 text-xs font-bold shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Allowed
              </span>
            ) : (
              <button
                type="button"
                disabled={busy !== 'none'}
                onClick={handleAllowLocation}
                className="px-3 py-1.5 rounded-lg bg-[#0B7A3E] hover:bg-[#096734] text-white text-xs font-semibold shrink-0 cursor-pointer disabled:opacity-60 min-h-[36px]"
              >
                {busy === 'location' ? 'Checking...' : 'Allow'}
              </button>
            )}
          </div>

          {/* Camera Permission Row */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 p-3.5 flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <Camera className="w-5 h-5 text-[#FF7A00] shrink-0 mt-0.5" aria-hidden="true" />
              <div className="space-y-0.5">
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Allow Camera</p>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Lets you capture live ID cards, record face liveness KYC video, and snap house photos directly.
                </p>
              </div>
            </div>
            {camStatus === 'granted' ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950/70 text-[#0B7A3E] dark:text-emerald-300 text-xs font-bold shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Allowed
              </span>
            ) : (
              <button
                type="button"
                disabled={busy !== 'none'}
                onClick={handleAllowCamera}
                className="px-3 py-1.5 rounded-lg bg-[#FF7A00] hover:bg-[#e56d00] text-white text-xs font-semibold shrink-0 cursor-pointer disabled:opacity-60 min-h-[36px]"
              >
                {busy === 'camera' ? 'Checking...' : 'Allow'}
              </button>
            )}
          </div>
        </div>

        {feedback && (
          <div className="bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-950 dark:text-amber-100 text-xs rounded-xl p-3 space-y-2.5">
            <p>{feedback}</p>
            {policyBlocked && (
              <a
                href={window.location.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0B7A3E] hover:bg-[#096734] text-white font-semibold text-xs"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open in Full Browser Tab
              </a>
            )}
          </div>
        )}

        {onManualArea && locStatus !== 'granted' && (
          <form onSubmit={handleSetArea} className="space-y-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
              Or type your area to pin your location on the map right away:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={areaInput}
                onChange={(e) => setAreaInput(e.target.value)}
                placeholder="e.g. Ikeja, Lagos"
                className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#0B7A3E]"
              />
              <button
                type="submit"
                disabled={savingArea || !areaInput.trim()}
                className="px-3 py-2 rounded-lg bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 dark:hover:bg-slate-600 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-semibold cursor-pointer"
              >
                {savingArea ? 'Setting...' : 'Pin'}
              </button>
            </div>
          </form>
        )}

        <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
          <button
            type="button"
            disabled={busy !== 'none'}
            onClick={handleAllowBoth}
            className="flex-1 py-3 px-4 rounded-xl bg-[#0B7A3E] hover:bg-[#096734] text-white text-sm font-semibold cursor-pointer disabled:opacity-60 min-h-[44px]"
          >
            {busy === 'both'
              ? 'Connecting...'
              : locStatus === 'granted' && camStatus === 'granted'
              ? 'Continue'
              : 'Allow Location & Camera'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-semibold cursor-pointer min-h-[44px]"
          >
            Not Now
          </button>
        </div>
      </div>
    </div>
  );
}
