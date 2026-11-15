import { useEffect, useState } from 'react';
import { Flag, X } from 'lucide-react';
import type { AuthUser } from '../types.ts';
import { apiRequest } from '../lib/api.ts';

interface ReportUserModalProps {
  open: boolean;
  initialUid?: string;
  listingType?: 'general' | 'house' | 'item';
  listingId?: string;
  user: AuthUser | null;
  onClose: () => void;
}

export function ReportUserModal({
  open,
  initialUid = '',
  listingType = 'general',
  listingId = '',
  user,
  onClose,
}: ReportUserModalProps) {
  const [reportedUid, setReportedUid] = useState(initialUid);
  const [reporterName, setReporterName] = useState(user?.fullName || '');
  const [reporterContact, setReporterContact] = useState(user?.phone || '');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (open) {
      setReportedUid(initialUid);
      setReporterName(user?.fullName || '');
      setReporterContact(user?.phone || '');
      setReason('');
      setError('');
      setSuccess('');
    }
  }, [open, initialUid, user]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);
    try {
      const res = await apiRequest<{ message: string }>('/api/reports', {
        method: 'POST',
        body: JSON.stringify({
          reportedUid: reportedUid.trim(),
          reason: reason.trim(),
          reporterName: reporterName.trim(),
          reporterContact: reporterContact.trim(),
          listingType,
          listingId,
        }),
      });
      setSuccess(res.message);
      setReason('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit report.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
              <Flag className="w-4 h-4" />
            </span>
            <div>
              <h3 className="font-display font-bold text-lg text-slate-900 dark:text-slate-100">
                Report User / Send Warning
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Provide the person&apos;s UID number so Admin can verify and take action.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close report modal"
            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs sm:text-sm rounded-xl p-3">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs sm:text-sm rounded-xl p-3 space-y-2">
            <p className="font-semibold">{success}</p>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-[#0B7A3E] text-white text-xs font-semibold cursor-pointer"
            >
              Done
            </button>
          </div>
        )}

        {!success && (
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Reported Person&apos;s UID Number (Required)
              </label>
              <input
                type="text"
                required
                value={reportedUid}
                onChange={(e) => setReportedUid(e.target.value)}
                placeholder="Enter UID number (e.g. 48291035)"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 px-3.5 py-2.5 text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-[#0B7A3E]"
              />
            </div>

            {!user && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Your Name
                  </label>
                  <input
                    type="text"
                    required
                    value={reporterName}
                    onChange={(e) => setReporterName(e.target.value)}
                    placeholder="Your name"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7A3E]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Your Phone / Email
                  </label>
                  <input
                    type="text"
                    required
                    value={reporterContact}
                    onChange={(e) => setReporterContact(e.target.value)}
                    placeholder="Phone or email"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7A3E]"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Warning / Report Details
              </label>
              <textarea
                required
                rows={3}
                minLength={5}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Describe what happened (e.g. fake listing, advance payment request, harassment)..."
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7A3E]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-semibold cursor-pointer disabled:opacity-60"
              >
                {submitting ? 'Submitting...' : 'Submit Report to Admin'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
