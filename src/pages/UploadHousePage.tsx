import { useEffect, useMemo, useRef, useState } from 'react';
import { Calculator, Camera, Check, ImagePlus, ShieldAlert, Trash2, UploadCloud, X } from 'lucide-react';
import type { AuthUser, HouseListing, HouseType } from '../types.ts';
import { ALL_COUNTRIES, AMENITY_OPTIONS, HOUSE_TYPES, NIGERIAN_STATES, formatNaira } from '../data/locations.ts';
import { apiRequest, uploadImageFile } from '../lib/api.ts';
import type { UserGeoLocation } from '../lib/maps.ts';
import { requestBrowserCameraStream } from '../lib/permissions.ts';
import { estimateRecommendedRent } from '../lib/rentEstimator.ts';
import { LocationPickerMap, type ResolvedPinAddress } from '../components/LocationPickerMap.tsx';

interface UploadHousePageProps {
  user: AuthUser | null;
  userLocation?: UserGeoLocation | null;
  onRefreshUser?: () => Promise<void>;
  onRequestAgentUpgrade?: () => Promise<void>;
  upgradingAgent?: boolean;
  onNavigate: (path: string) => void;
}

interface PendingImage {
  file: File;
  preview: string;
}

export function UploadHousePage({
  user,
  userLocation,
  onRefreshUser,
  onRequestAgentUpgrade,
  upgradingAgent,
  onNavigate,
}: UploadHousePageProps) {
  const [title, setTitle] = useState('');
  const [houseNumber, setHouseNumber] = useState('');
  const [streetName, setStreetName] = useState('');
  const [area, setArea] = useState('');
  const [state, setState] = useState(user?.state && NIGERIAN_STATES.includes(user.state) ? user.state : 'Lagos');
  const [country, setCountry] = useState('Nigeria');
  const [price, setPrice] = useState('');
  const [inspectionFee, setInspectionFee] = useState('3000');
  const [houseType, setHouseType] = useState<HouseType>('2 Bedroom');
  const [phone, setPhone] = useState(user?.phone || '');
  const [amenities, setAmenities] = useState<string[]>(['water', 'electricity', 'toilet']);
  const [description, setDescription] = useState('');
  const [pictures, setPictures] = useState<PendingImage[]>([]);
  const [lat, setLat] = useState<number | null>(userLocation?.lat ?? null);
  const [lng, setLng] = useState<number | null>(userLocation?.lng ?? null);

  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (onRefreshUser) {
      onRefreshUser();
    }
  }, [onRefreshUser]);

  useEffect(() => {
    if (cameraVideoRef.current && cameraStream) {
      cameraVideoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream, cameraOpen]);

  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [cameraStream]);

  const rentEstimate = useMemo(
    () =>
      estimateRecommendedRent({
        area,
        state,
        country,
        houseType,
        amenities,
      }),
    [area, state, country, houseType, amenities]
  );

  const numericEnteredPrice = Number(price);
  const hasEnteredPrice = Number.isFinite(numericEnteredPrice) && numericEnteredPrice > 0;
  const priceAlignment = !hasEnteredPrice
    ? null
    : numericEnteredPrice < rentEstimate.minPrice
    ? 'below'
    : numericEnteredPrice > rentEstimate.maxPrice
    ? 'above'
    : 'within';

  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 text-center shadow-sm border border-slate-100 dark:border-slate-800 space-y-4">
          <h1 className="font-display font-bold text-xl text-slate-900 dark:text-slate-100">Sign In to Upload House or Property</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Login or register to upload houses (verified Agents) or sell home items like TV, Gas &amp; Fan.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('/login')}
              className="px-5 py-2.5 rounded-xl bg-[#0B7A3E] text-white text-sm font-semibold cursor-pointer"
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/register')}
              className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-semibold cursor-pointer"
            >
              Register as Agent
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (user.role !== 'agent' || user.kycStatus !== 'approved') {
    const isBuyer = user.role === 'buyer';
    const isUpgradePending = isBuyer && user.agentUpgradeStatus === 'pending';
    const isUpgradeRejected = isBuyer && user.agentUpgradeStatus === 'rejected';

    return (
      <div className="max-w-lg mx-auto px-4 py-12">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 text-center shadow-sm border border-slate-100 dark:border-slate-800 space-y-4">
          <ShieldAlert className="w-12 h-12 text-[#FF7A00] mx-auto" />
          <h1 className="font-display font-bold text-xl text-slate-900 dark:text-slate-100">
            {isBuyer ? 'Upgrade to Agent to Upload Houses' : 'KYC Verification Required'}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {isBuyer
              ? isUpgradePending
                ? 'Your Agent Upgrade request is waiting for Admin approval. Once accepted, your account switches to Agent immediately so you can verify KYC and upload houses.'
                : isUpgradeRejected
                ? `Previous upgrade request was declined${user.agentUpgradeReason ? `: ${user.agentUpgradeReason}` : '.'} You can request again anytime.`
                : 'You are currently a Buyer. Switch to an Agent / Landlord anytime by requesting an Agent Upgrade (requires Admin approval), or sell household items like TV, Gas, or Fan right now!'
              : user.kycStatus === 'pending'
              ? 'Your KYC is currently pending admin approval. Once approved, you can upload houses here.'
              : 'Update and verify your KYC (NIN/BVN, ID Card & Face Liveness Video) before uploading a house.'}
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-1">
            {isBuyer ? (
              <>
                {!isUpgradePending && (
                  <button
                    type="button"
                    disabled={upgradingAgent}
                    onClick={() => onRequestAgentUpgrade?.()}
                    className="px-5 py-2.5 rounded-xl bg-[#0B7A3E] hover:bg-[#096734] text-white text-sm font-semibold cursor-pointer disabled:opacity-60"
                  >
                    {upgradingAgent ? 'Sending Request...' : 'Upgrade to Agent'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onNavigate('/sell-property')}
                  className="px-5 py-2.5 rounded-xl bg-[#FF7A00] hover:bg-[#e56d00] text-white text-sm font-semibold cursor-pointer"
                >
                  Sell Home Property (TV, Gas, Fan)
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate('/kyc')}
                className="px-6 py-2.5 rounded-xl bg-[#0B7A3E] text-white text-sm font-semibold cursor-pointer"
              >
                Go to KYC Page
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const toggleAmenity = (key: string) => {
    setAmenities((prev) => (prev.includes(key) ? prev.filter((a) => a !== key) : [...prev, key]));
  };

  const handleSelectPictures = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setError('');

    const remaining = 10 - pictures.length;
    const toAdd = files.slice(0, remaining).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));

    if (files.length > remaining) {
      setError('Maximum 10 pictures allowed per house listing.');
    }
    setPictures((prev) => [...prev, ...toAdd]);
    e.target.value = '';
  };

  const removePicture = (idx: number) => {
    setPictures((prev) => prev.filter((_, i) => i !== idx));
  };

  const openHouseCamera = async () => {
    setError('');
    const res = await requestBrowserCameraStream('environment');
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setCameraStream(res.stream);
    setCameraOpen(true);
  };

  const closeHouseCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop());
    }
    setCameraStream(null);
    setCameraOpen(false);
  };

  const snapHousePhoto = () => {
    const videoEl = cameraVideoRef.current;
    if (!videoEl || pictures.length >= 10) return;
    const vw = videoEl.videoWidth || 1280;
    const vh = videoEl.videoHeight || 720;
    const canvas = document.createElement('canvas');
    canvas.width = vw;
    canvas.height = vh;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(videoEl, 0, 0, vw, vh);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `house-${Date.now()}.jpg`, { type: 'image/jpeg' });
        const preview = URL.createObjectURL(file);
        setPictures((prev) => [...prev.slice(0, 9), { file, preview }]);
      },
      'image/jpeg',
      0.86
    );
  };

  const handleApplyResolvedAddress = (resolved: ResolvedPinAddress) => {
    if (resolved.area) {
      setArea(resolved.area);
    }
    if (!streetName.trim() && resolved.formattedAddress) {
      setStreetName(resolved.formattedAddress.split(',')[0].trim());
    }
    if (resolved.country && ALL_COUNTRIES.includes(resolved.country)) {
      setCountry(resolved.country);
    }
    if (resolved.state) {
      const matchedState = NIGERIAN_STATES.find(
        (s) => s.toLowerCase() === resolved.state!.toLowerCase().replace(/\s+state$/i, '')
      );
      if (matchedState) {
        setState(matchedState);
      } else {
        setState(resolved.state);
      }
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (pictures.length < 5 || pictures.length > 10) {
      setError('Please upload between 5 and 10 pictures of the house.');
      return;
    }

    const feeNum = Number(inspectionFee);
    if (!Number.isFinite(feeNum) || feeNum < 3000 || feeNum > 5000) {
      setError('Inspection acceptance fee must be between ₦3,000 and ₦5,000 (paid face-to-face during viewing).');
      return;
    }

    setSubmitting(true);
    try {
      const uploadedUrls = await Promise.all(pictures.map((p) => uploadImageFile(p.file)));
      await apiRequest<{ house: HouseListing }>('/api/houses', {
        method: 'POST',
        body: JSON.stringify({
          title,
          houseNumber,
          streetName,
          area,
          state,
          country,
          price: Number(price),
          inspectionFee: feeNum,
          houseType,
          phone,
          images: uploadedUrls,
          amenities,
          description,
          lat,
          lng,
        }),
      });
      onNavigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish house.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:py-10">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-100 dark:border-slate-800 space-y-6">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-[#FF7A00]/15 text-[#FF7A00] flex items-center justify-center">
            <UploadCloud className="w-5 h-5" aria-hidden="true" />
          </span>
          <div>
            <h1 className="font-display font-bold text-2xl text-slate-900 dark:text-slate-100">Upload House Listing</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Submitted properties show as Pending until approved by the Glide Homes Admin.
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 text-sm rounded-xl p-3">
            {error}
          </div>
        )}

        <form onSubmit={handlePublish} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">House Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Clean 2-Bedroom Flat with Prepaid Meter & Borehole"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7A3E]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">House Number</label>
              <input
                type="text"
                required
                value={houseNumber}
                onChange={(e) => setHouseNumber(e.target.value)}
                placeholder="e.g. 14B"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7A3E]"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Street Name</label>
              <input
                type="text"
                required
                value={streetName}
                onChange={(e) => setStreetName(e.target.value)}
                placeholder="e.g. Admiralty Way"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7A3E]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Area / Location</label>
              <input
                type="text"
                required
                value={area}
                onChange={(e) => setArea(e.target.value)}
                placeholder="e.g. Lekki Phase 1"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7A3E]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">State</label>
              {country === 'Nigeria' ? (
                <select
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0B7A3E]"
                >
                  {NIGERIAN_STATES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  required
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="Enter State / Province"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7A3E]"
                />
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Country</label>
              <select
                value={country}
                onChange={(e) => {
                  const nextCountry = e.target.value;
                  setCountry(nextCountry);
                  if (nextCountry === 'Nigeria' && !NIGERIAN_STATES.includes(state)) {
                    setState('Lagos');
                  } else if (nextCountry !== 'Nigeria' && NIGERIAN_STATES.includes(state)) {
                    setState('');
                  }
                }}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0B7A3E]"
              >
                {ALL_COUNTRIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <LocationPickerMap
            addressQuery={[streetName, area, state, country].filter(Boolean).join(', ')}
            lat={lat}
            lng={lng}
            userLocation={userLocation}
            onChangeCoords={(nextLat, nextLng) => {
              setLat(nextLat);
              setLng(nextLng);
            }}
            onApplyResolvedAddress={handleApplyResolvedAddress}
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Annual Rent Price (₦ Naira)</label>
              <input
                type="number"
                required
                min={10000}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder={`e.g. ${rentEstimate.suggestedPrice}`}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 px-3.5 py-2.5 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-[#0B7A3E]"
              />
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums flex items-center justify-between gap-1">
                <span>Est: {formatNaira(rentEstimate.minPrice)} – {formatNaira(rentEstimate.maxPrice)}</span>
                <button
                  type="button"
                  onClick={() => setPrice(String(rentEstimate.suggestedPrice))}
                  className="font-semibold text-[#0B7A3E] dark:text-emerald-400 hover:underline cursor-pointer shrink-0"
                >
                  Apply
                </button>
              </p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">House Type</label>
              <select
                value={houseType}
                onChange={(e) => setHouseType(e.target.value as HouseType)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0B7A3E]"
              >
                {HOUSE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Phone Number (WhatsApp)</label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 08031234567"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7A3E]"
              />
            </div>
          </div>

          <div className="bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-xl p-4 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <label className="block text-xs font-bold text-amber-950 dark:text-amber-100">
                  Physical Inspection Acceptance Fee (₦3,000 – ₦5,000)
                </label>
                <p className="text-xs text-amber-900 dark:text-amber-200">
                  Paid in real time face-to-face by the renter when viewing the house until they find the perfect style.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <select
                  value={inspectionFee}
                  onChange={(e) => setInspectionFee(e.target.value)}
                  className="rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0B7A3E]"
                >
                  <option value="3000">₦3,000</option>
                  <option value="3500">₦3,500</option>
                  <option value="4000">₦4,000</option>
                  <option value="4500">₦4,500</option>
                  <option value="5000">₦5,000</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">Available Amenities</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {AMENITY_OPTIONS.map((am) => (
                <label
                  key={am.key}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                    amenities.includes(am.key)
                      ? 'border-[#0B7A3E] dark:border-emerald-500 bg-[#0B7A3E]/5 dark:bg-emerald-950/50 text-[#0B3D22] dark:text-emerald-200 font-semibold'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={amenities.includes(am.key)}
                    onChange={() => toggleAmenity(am.key)}
                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-[#0B7A3E] focus:ring-[#0B7A3E]"
                  />
                  <span>{am.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Local Rent Range Estimator */}
          <section
            aria-label="Recommended Rent Range Estimator"
            className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/50 p-4 sm:p-5 space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 dark:border-slate-700/80 pb-3">
              <div className="flex items-start gap-2.5">
                <span className="w-8 h-8 rounded-lg bg-[#0B7A3E]/10 dark:bg-emerald-950/80 text-[#0B7A3E] dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Calculator className="w-4 h-4" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="font-display font-bold text-sm text-slate-900 dark:text-slate-100">
                    Recommended Annual Rent Estimator
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {area.trim()
                      ? `Calculated for ${houseType} in ${area.trim()}, ${state} (${rentEstimate.marketTierLabel})`
                      : `Calculated for ${houseType} in ${state} (${rentEstimate.marketTierLabel}) — enter Area above to refine`}
                  </p>
                </div>
              </div>

              {priceAlignment && (
                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded-lg self-start sm:self-center whitespace-nowrap ${
                    priceAlignment === 'within'
                      ? 'bg-emerald-100 dark:bg-emerald-950/70 text-[#0B3D22] dark:text-emerald-300'
                      : priceAlignment === 'below'
                      ? 'bg-sky-100 dark:bg-sky-950/70 text-sky-900 dark:text-sky-200'
                      : 'bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200'
                  }`}
                >
                  {priceAlignment === 'within'
                    ? 'Your price fits range'
                    : priceAlignment === 'below'
                    ? 'Priced below estimate'
                    : 'Priced above estimate'}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-700/80 p-3">
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Recommended Range</p>
                <p className="mt-1 font-display font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100 tabular-nums">
                  {formatNaira(rentEstimate.minPrice)} – {formatNaira(rentEstimate.maxPrice)}
                </p>
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#0B7A3E]/30 dark:border-emerald-700/70 p-3">
                <p className="text-[11px] font-medium text-[#0B7A3E] dark:text-emerald-400">Suggested Target Rent</p>
                <p className="mt-1 font-display font-bold text-base sm:text-lg text-[#0B7A3E] dark:text-emerald-400 tabular-nums">
                  {formatNaira(rentEstimate.suggestedPrice)}
                  <span className="text-xs font-sans font-normal text-slate-500 dark:text-slate-400"> / yr</span>
                </p>
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-700/80 p-3">
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Amenities Uplift</p>
                <p className="mt-1 font-display font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100 tabular-nums">
                  +{rentEstimate.amenityBonusPct}% ({rentEstimate.matchedAmenityLabels.length} selected)
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-slate-600 dark:text-slate-300">
                Base ({houseType}): <strong className="tabular-nums">{formatNaira(rentEstimate.basePrice)}</strong>
                {' · '}Area factor: <strong className="tabular-nums">{rentEstimate.areaMultiplier.toFixed(2)}×</strong>
                {rentEstimate.matchedAmenityLabels.length > 0 && (
                  <>
                    {' · '}Features: {rentEstimate.matchedAmenityLabels.join(', ')}
                  </>
                )}
              </span>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setPrice(String(rentEstimate.minPrice))}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold tabular-nums cursor-pointer whitespace-nowrap"
                >
                  Use Min ({formatNaira(rentEstimate.minPrice)})
                </button>
                <button
                  type="button"
                  onClick={() => setPrice(String(rentEstimate.suggestedPrice))}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#0B7A3E] hover:bg-[#096734] text-white font-semibold tabular-nums cursor-pointer whitespace-nowrap"
                >
                  {numericEnteredPrice === rentEstimate.suggestedPrice && (
                    <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  )}
                  Use Suggested ({formatNaira(rentEstimate.suggestedPrice)})
                </button>
                <button
                  type="button"
                  onClick={() => setPrice(String(rentEstimate.maxPrice))}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold tabular-nums cursor-pointer whitespace-nowrap"
                >
                  Use Max ({formatNaira(rentEstimate.maxPrice)})
                </button>
              </div>
            </div>
          </section>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Upload 5–10 Pictures (Real Photos Only)
              </label>
              <span
                className={`text-xs font-semibold tabular-nums ${
                  pictures.length >= 5 ? 'text-[#0B7A3E] dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'
                }`}
              >
                {pictures.length} / 10 selected (min 5)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-5 hover:border-[#0B7A3E] dark:hover:border-emerald-500 cursor-pointer bg-slate-50 dark:bg-slate-800/70 text-center">
                <ImagePlus className="w-7 h-7 text-[#0B7A3E] dark:text-emerald-400 mb-2" />
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Select Photos (5 to 10)</span>
                <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">JPG, PNG, or WEBP</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleSelectPictures}
                />
              </label>

              <button
                type="button"
                onClick={cameraOpen ? closeHouseCamera : openHouseCamera}
                className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-5 hover:border-[#FF7A00] cursor-pointer bg-slate-50 dark:bg-slate-800/70 text-center"
              >
                <Camera className="w-7 h-7 text-[#FF7A00] mb-2" />
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {cameraOpen ? 'Close House Camera' : 'Take Photo with Camera'}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Snap real house rooms live</span>
              </button>
            </div>

            {cameraOpen && (
              <div className="mt-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-950 p-3 space-y-3">
                <video
                  ref={cameraVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full max-h-64 rounded-xl object-cover"
                />
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    disabled={pictures.length >= 10}
                    onClick={snapHousePhoto}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-[#0B7A3E] hover:bg-[#096734] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Camera className="w-4 h-4" />
                    Snap House Photo ({pictures.length}/10)
                  </button>
                  <button
                    type="button"
                    onClick={closeHouseCamera}
                    className="p-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white cursor-pointer"
                    aria-label="Close camera"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {pictures.length > 0 && (
              <div className="mt-3 grid grid-cols-3 sm:grid-cols-5 gap-3">
                {pictures.map((pic, idx) => (
                  <div key={`${pic.preview}-${idx}`} className="relative aspect-[4/3] rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <img src={pic.preview} alt={`Upload preview ${idx + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removePicture(idx)}
                      aria-label="Remove picture"
                      className="absolute top-1.5 right-1.5 w-7 h-7 rounded-lg bg-black/70 text-white flex items-center justify-center hover:bg-red-600 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Description (Water, Light, Toilet, Compound, Parking, etc.)
            </label>
            <textarea
              required
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe borehole water, Band A light / prepaid meter, tiled rooms, toilet/bath setup, security, and direct landlord terms..."
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7A3E]"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 rounded-xl bg-[#FF7A00] hover:bg-[#e56d00] text-white font-semibold text-sm transition-colors cursor-pointer disabled:opacity-60"
          >
            {submitting ? 'Uploading Pictures & Submitting...' : 'Submit House for Admin Approval'}
          </button>
        </form>
      </div>
    </div>
  );
}
