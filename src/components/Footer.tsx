import { useState } from 'react';
import { Flag, Home, Mail, MessageCircle, Monitor, Moon, Sun, X } from 'lucide-react';
import { SUPPORT_EMAIL, SUPPORT_PHONE } from '../data/locations.ts';
import { useTheme, type ThemeMode } from '../lib/theme.ts';

type ModalTopic = 'About' | 'Contact' | 'Terms' | 'Privacy' | null;

const TOPIC_COPY: Record<Exclude<ModalTopic, null>, { title: string; body: string[] }> = {
  About: {
    title: 'About Glide Homes',
    body: [
      'Glide Homes helps renters find verified houses fast with zero agent wahala. Every landlord and agent must complete NIN or BVN identity verification with an ID card and live selfie, and every house upload is reviewed by our admin before appearing publicly.',
      'Renters pay a face-to-face inspection acceptance fee of ₦3,000 to ₦5,000 directly to the landlord during physical viewing until they find their perfect house style.',
    ],
  },
  Contact: {
    title: 'WhatsApp Support & Report Desk',
    body: [
      `To report a suspicious listing, 419 attempt, or get live support, message our WhatsApp Support team directly on ${SUPPORT_PHONE}.`,
      `Support Gmail: ${SUPPORT_EMAIL}`,
      'Trust & Safety Desk: Monday – Saturday, 8:00 AM – 6:00 PM WAT',
      'Always inspect a property physically and pay face-to-face.',
    ],
  },
  Terms: {
    title: 'Terms & Conditions of Service',
    body: [
      '1. Strictly No Refund: Once you have physically inspected a property, agreed to the terms, and paid rent or the inspection acceptance fee directly to the landlord, there is NO REFUND. Always inspect water, electricity, rooms, and surroundings carefully before paying.',
      '2. Complete Your Year & Pack Out: Every annual rent payment covers the agreed 1-year tenancy duration. Once you use up your paid year without renewing with the landlord, you must vacate and pack out cleanly at the expiration of your tenancy.',
      '3. Face-to-Face Payments Only: Glide Homes does NOT collect rent or inspection fees. Renters pay the ₦3,000 – ₦5,000 inspection acceptance fee face-to-face in real time during property viewing until they find their perfect house style, and pay rent face-to-face with a signed receipt.',
      '4. Property Care & Utility Bills: Tenants must keep the house, plumbing, electrical fittings, and compound in good condition and clear utility bills (electricity, waste, water/security levies) before packing out.',
      '5. No Unauthorized Subletting or Illegal Activity: Tenants may not sublet the property to third parties without the landlord’s written consent, nor use the house for any unlawful activity.',
      '6. Honest Listings & Zero Tolerance for 419: Landlords and agents must upload real photos and accurate prices. Any agent demanding WhatsApp advance transfers or uploading fake listings will be permanently blocked.',
      `7. Reporting & Support: Report suspicious behavior or get help via WhatsApp (${SUPPORT_PHONE}) or Gmail (${SUPPORT_EMAIL}).`,
      '8. Maps & Location Services: Interactive maps, geocoding, and route distance calculations integrate Google Maps Platform features and are subject to Google Maps/Google Earth Additional Terms of Service (https://maps.google.com/help/terms_maps/?utm_campaign=gmp_mcp_codeassist_v1_aistudio).',
    ],
  },
  Privacy: {
    title: 'Privacy Policy',
    body: [
      'Your email, phone number, state, assigned Glide Homes ID, and KYC identity documents (NIN/BVN, ID Card, and Selfie) are used solely for account authentication, security auditing, and landlord verification.',
      'Sensitive KYC documents are never displayed publicly to buyers and are reviewed strictly by authorized Glide Homes administrators.',
      'Real-Time Location Access: GPS coordinates used to measure property distances in km and display routes are accessed only with your explicit browser permission and can be disabled or cleared at any time. Use of Google Maps features is governed by the Google Privacy Policy (https://policies.google.com/privacy?utm_campaign=gmp_mcp_codeassist_v1_aistudio).',
    ],
  },
};

interface FooterProps {
  onReportUser?: () => void;
}

export function Footer({ onReportUser }: FooterProps) {
  const [topic, setTopic] = useState<ModalTopic>(null);
  const { mode, setMode } = useTheme();
  const whatsappUrl = `https://wa.me/${SUPPORT_PHONE.replace(/[^\d]/g, '')}?text=${encodeURIComponent(
    'Hello Glide Homes WhatsApp Support, I need assistance.'
  )}`;

  const themeOptions: { value: ThemeMode; label: string; Icon: typeof Sun }[] = [
    { value: 'light', label: 'Light', Icon: Sun },
    { value: 'dark', label: 'Dark', Icon: Moon },
    { value: 'system', label: 'System', Icon: Monitor },
  ];

  return (
    <footer className="bg-[#0B3D22] dark:bg-slate-900 border-t border-transparent dark:border-slate-800 text-white mt-16 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
            <Home className="w-4 h-4 text-white" aria-hidden="true" />
          </span>
          <div>
            <p className="font-display font-bold text-base">Glide Homes</p>
            <p className="text-xs text-white/75">Find House Fast, No Agent Wahala.</p>
          </div>
        </div>

        <nav className="flex flex-wrap items-center justify-center gap-6 text-sm text-white/90">
          {(['About', 'Contact', 'Terms', 'Privacy'] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTopic(item)}
              className="hover:text-white hover:underline underline-offset-4 cursor-pointer whitespace-nowrap"
            >
              {item === 'Terms' ? 'Terms & Service' : item}
            </button>
          ))}
        </nav>

        <div className="text-xs text-white/80 text-center md:text-right space-y-2">
          <div className="flex flex-wrap items-center justify-center md:justify-end gap-2">
            <div
              role="group"
              aria-label="Color theme mode"
              className="inline-flex items-center p-1 rounded-lg bg-white/10 border border-white/15"
            >
              {themeOptions.map(({ value, label, Icon }) => {
                const active = mode === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setMode(value)}
                    aria-pressed={active}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                      active
                        ? 'bg-white text-[#0B3D22] shadow-xs'
                        : 'text-white/85 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <Icon className="w-3 h-3 shrink-0" aria-hidden="true" />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
            {onReportUser && (
              <button
                type="button"
                onClick={onReportUser}
                className="inline-flex items-center justify-center md:justify-end gap-1.5 px-3 py-1.5 rounded-lg bg-red-600/90 hover:bg-red-500 text-white font-semibold text-xs cursor-pointer"
              >
                <Flag className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Report User / Submit Warning (UID)</span>
              </button>
            )}
          </div>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center md:justify-end gap-1.5 font-semibold text-white hover:underline"
          >
            <MessageCircle className="w-3.5 h-3.5 text-emerald-300" aria-hidden="true" />
            <span>WhatsApp Support / Report: {SUPPORT_PHONE}</span>
          </a>
          <div>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="inline-flex items-center justify-center md:justify-end gap-1.5 text-white/90 hover:text-white hover:underline"
            >
              <Mail className="w-3.5 h-3.5 text-emerald-300" aria-hidden="true" />
              <span>Support Gmail: {SUPPORT_EMAIL}</span>
            </a>
          </div>
          <p className="text-white/70">© {new Date().getFullYear()} Glide Homes. All rights reserved.</p>
        </div>
      </div>

      {topic && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-100 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-lg text-[#0B3D22] dark:text-emerald-400">
                {TOPIC_COPY[topic].title}
              </h3>
              <button
                type="button"
                onClick={() => setTopic(null)}
                aria-label="Close modal"
                className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-h-[60vh] overflow-y-auto pr-1">
              {TOPIC_COPY[topic].body.map((paragraph, idx) => (
                <p key={idx}>{paragraph}</p>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-4">
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0B7A3E] dark:text-emerald-400 hover:underline"
                >
                  <MessageCircle className="w-4 h-4" />
                  Chat on WhatsApp ({SUPPORT_PHONE})
                </a>
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0B7A3E] dark:text-emerald-400 hover:underline"
                >
                  <Mail className="w-4 h-4" />
                  {SUPPORT_EMAIL}
                </a>
              </div>
              <button
                type="button"
                onClick={() => setTopic(null)}
                className="px-5 py-2.5 rounded-lg bg-[#0B7A3E] text-white text-sm font-semibold hover:bg-[#096734] cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </footer>
  );
}
