import { AlertTriangle, Mail, MessageCircle } from 'lucide-react';
import { SUPPORT_EMAIL, SUPPORT_PHONE } from '../data/locations.ts';

export function Anti419Warning() {
  const whatsappHref = `https://wa.me/${SUPPORT_PHONE.replace(/[^\d]/g, '')}?text=${encodeURIComponent(
    'Hello Glide Homes Support, I want to report an issue or get help.'
  )}`;

  return (
    <div
      role="alert"
      className="bg-amber-50 dark:bg-amber-950/45 border border-amber-300 dark:border-amber-800/80 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-950 dark:text-amber-100 shadow-xs"
    >
      <div className="flex items-start gap-3.5">
        <div className="w-9 h-9 rounded-xl bg-amber-200/70 dark:bg-amber-900/60 flex items-center justify-center shrink-0 mt-0.5">
          <AlertTriangle className="w-5 h-5 text-amber-800 dark:text-amber-300" aria-hidden="true" />
        </div>
        <div className="text-sm leading-relaxed space-y-1">
          <p>
            <span className="font-bold">WARNING:</span> Do NOT pay anybody on WhatsApp. Go see house first. Pay
            landlord face to face and collect receipt. Glide Homes does NOT collect rent.
          </p>
          <p className="text-xs font-medium text-amber-900 dark:text-amber-200/90">
            Inspection Acceptance Fee: Renters pay the landlord <span className="font-bold">₦3,000 – ₦5,000</span>{' '}
            face-to-face in real time at the viewing until you find your perfect style. Never transfer inspection fees
            before meeting in person.
          </p>
        </div>
      </div>

      <div className="flex flex-col items-start sm:items-end gap-1.5 shrink-0">
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0B7A3E] hover:bg-[#096734] text-white text-xs font-bold whitespace-nowrap transition-colors"
        >
          <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" />
          <span>WhatsApp Support: {SUPPORT_PHONE}</span>
        </a>
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-amber-900 dark:text-amber-300 hover:underline whitespace-nowrap"
        >
          <Mail className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{SUPPORT_EMAIL}</span>
        </a>
      </div>
    </div>
  );
}
