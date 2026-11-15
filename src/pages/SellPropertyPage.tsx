import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  ImagePlus,
  Package,
  RefreshCw,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import type {
  AuthUser,
  HomePropertyCategory,
  HomePropertyCondition,
  HomePropertyItem,
} from '../types.ts';
import {
  ALL_COUNTRIES,
  HOME_PROPERTY_CATEGORIES,
  HOME_PROPERTY_CONDITIONS,
  NIGERIAN_STATES,
  formatNaira,
} from '../data/locations.ts';
import { apiRequest, uploadImageFile } from '../lib/api.ts';
import { requestBrowserCameraStream } from '../lib/permissions.ts';

interface SellPropertyPageProps {
  user: AuthUser | null;
  onNavigate: (path: string) => void;
}

interface PendingImage {
  file: File;
  preview: string;
}

export function SellPropertyPage({ user, onNavigate }: SellPropertyPageProps) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<HomePropertyCategory>('TV & Electronics');
  const [condition, setCondition] = useState<HomePropertyCondition>('Neatly Used');
  const [price, setPrice] = useState('');
  const [area, setArea] = useState('');
  const [state, setState] = useState(
    user?.state && NIGERIAN_STATES.includes(user.state) ? user.state : 'Lagos'
  );
  const [country, setCountry] = useState('Nigeria');
  const [phone, setPhone] = useState(user?.phone || '');
  const [description, setDescription] = useState('');
  const [pictures, setPictures] = useState<PendingImage[]>([]);

  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);

  const [myItems, setMyItems] = useState<HomePropertyItem[]>([]);
  const [loadingMine, setLoadingMine] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadMyItems = useCallback(async () => {
    if (!user) return;
    setLoadingMine(true);
    try {
      const res = await apiRequest<{ items: HomePropertyItem[] }>('/api/items/mine');
      setMyItems(res.items);
    } catch {
      // ignore
    } finally {
      setLoadingMine(false);
    }
  }, [user]);

  useEffect(() => {
    loadMyItems();
  }, [loadMyItems]);

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

  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 text-center shadow-sm border border-slate-100 dark:border-slate-800 space-y-4">
          <Package className="w-12 h-12 text-[#FF7A00] mx-auto" />
          <h1 className="font-display font-bold text-xl text-slate-900 dark:text-slate-100">
            Sign In to Sell Home Property
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Login or register to sell your TV, Gas Cooker, Fan, AC, Fridge, Generator, or Furniture on Glide Homes.
          </p>
          <div className="flex justify-center gap-3">
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
              className="px-5 py-2.5 rounded-xl bg-[#FF7A00] text-white text-sm font-semibold cursor-pointer"
            >
              Register
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleSelectPictures = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setError('');
    const remaining = 8 - pictures.length;
    const toAdd = files.slice(0, remaining).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    if (files.length > remaining) {
      setError('Maximum 8 pictures allowed per home property item.');
    }
    setPictures((prev) => [...prev, ...toAdd]);
    e.target.value = '';
  };

  const openItemCamera = async () => {
    setError('');
    const res = await requestBrowserCameraStream('environment');
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setCameraStream(res.stream);
    setCameraOpen(true);
  };

  const closeItemCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop());
    }
    setCameraStream(null);
    setCameraOpen(false);
  };

  const snapItemPhoto = () => {
    const videoEl = cameraVideoRef.current;
    if (!videoEl || pictures.length >= 8) return;
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
        const file = new File([blob], `item-${Date.now()}.jpg`, { type: 'image/jpeg' });
        const preview = URL.createObjectURL(file);
        setPictures((prev) => [...prev.slice(0, 7), { file, preview }]);
        closeItemCamera();
      },
      'image/jpeg',
      0.86
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (pictures.length < 1) {
      setError('Please add at least 1 clear photo of the item you want to sell.');
      return;
    }
    const numPrice = Number(price);
    if (!Number.isFinite(numPrice) || numPrice <= 0) {
      setError('Please enter a valid selling price in Naira.');
      return;
    }

    setSubmitting(true);
    try {
      const uploadedUrls = await Promise.all(pictures.map((p) => uploadImageFile(p.file)));
      const res = await apiRequest<{ item: HomePropertyItem; message: string }>('/api/items', {
        method: 'POST',
        body: JSON.stringify({
          title,
          category,
          condition,
          price: numPrice,
          area,
          state,
          country,
          phone,
          images: uploadedUrls,
          description,
        }),
      });
      setSuccess(res.message);
      setTitle('');
      setPrice('');
      setDescription('');
      setPictures([]);
      await loadMyItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to list home property.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleSold = async (item: HomePropertyItem) => {
    const nextStatus = item.status === 'Available' ? 'SOLD' : 'Available';
    try {
      const res = await apiRequest<{ item: HomePropertyItem }>(`/api/items/${item.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      setMyItems((prev) => prev.map((it) => (it.id === item.id ? res.item : it)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status.');
    }
  };

  const handleDeleteItem = async (id: string) => {
    try {
      await apiRequest(`/api/items/${id}`, { method: 'DELETE' });
      setMyItems((prev) => prev.filter((it) => it.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete item.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:py-10 space-y-8">
      {/* Full-Page Camera Overlay for Item Photos */}
      {cameraOpen && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col justify-between">
          <div className="flex items-center justify-between px-4 py-3 bg-black/75 text-white">
            <span className="font-display font-bold text-base">Take Item Photo</span>
            <button
              type="button"
              onClick={closeItemCamera}
              aria-label="Close camera"
              className="w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-hidden flex items-center justify-center">
            <video
              ref={cameraVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          </div>
          <div className="px-6 py-5 bg-black/90 flex justify-center">
            <button
              type="button"
              onClick={snapItemPhoto}
              className="w-full max-w-xs py-3.5 px-6 rounded-2xl bg-[#FF7A00] hover:bg-[#e56d00] text-white font-display font-bold text-base inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <Camera className="w-5 h-5" />
              Capture Photo
            </button>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-100 dark:border-slate-800 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-xl bg-[#FF7A00]/15 text-[#FF7A00] flex items-center justify-center">
              <Tag className="w-5 h-5" />
            </span>
            <div>
              <h1 className="font-display font-bold text-2xl text-slate-900 dark:text-slate-100">Sell Home Property</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Sell TV, Gas Cooker &amp; Cylinder, Standing Fan, AC, Fridge, Generator, or Furniture directly to nearby buyers.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="text-xs font-semibold text-[#0B7A3E] dark:text-emerald-400 hover:underline cursor-pointer"
          >
            Browse Home Market →
          </button>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 text-sm rounded-xl p-3">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-sm rounded-xl p-3.5 flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="w-5 h-5 text-[#0B7A3E] dark:text-emerald-400 shrink-0" />
              {success}
            </span>
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="px-3 py-1.5 rounded-lg bg-[#0B7A3E] text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
            >
              View Live
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Item Name / Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. 43-inch Hisense Smart TV, 12.5kg Gas Cylinder + Burner, or Binatone Standing Fan"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7A3E]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as HomePropertyCategory)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0B7A3E]"
              >
                {HOME_PROPERTY_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Condition</label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value as HomePropertyCondition)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0B7A3E]"
              >
                {HOME_PROPERTY_CONDITIONS.map((cond) => (
                  <option key={cond} value={cond}>
                    {cond}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Selling Price (₦ Naira)
              </label>
              <input
                type="number"
                required
                min={500}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="e.g. 85000"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 px-3.5 py-2.5 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-[#0B7A3E]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Area / Town</label>
              <input
                type="text"
                required
                value={area}
                onChange={(e) => setArea(e.target.value)}
                placeholder="e.g. Ikeja, Lekki, Wuse 2"
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
                  placeholder="State / Region"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7A3E]"
                />
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Country</label>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
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

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              WhatsApp / Call Phone Number
            </label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 08031234567"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7A3E]"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Add Item Photos (1–8 real photos)
              </label>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                {pictures.length} / 8 added
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-5 hover:border-[#0B7A3E] dark:hover:border-emerald-500 cursor-pointer bg-slate-50 dark:bg-slate-800/70 text-center">
                <ImagePlus className="w-7 h-7 text-[#0B7A3E] dark:text-emerald-400 mb-2" />
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Choose Photos</span>
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
                onClick={openItemCamera}
                className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-5 hover:border-[#FF7A00] cursor-pointer bg-slate-50 dark:bg-slate-800/70 text-center"
              >
                <Camera className="w-7 h-7 text-[#FF7A00] mb-2" />
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Open Camera</span>
                <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Snap TV, Gas, Fan live</span>
              </button>
            </div>

            {pictures.length > 0 && (
              <div className="mt-3 grid grid-cols-3 sm:grid-cols-4 gap-3">
                {pictures.map((pic, idx) => (
                  <div
                    key={`${pic.preview}-${idx}`}
                    className="relative aspect-[4/3] rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  >
                    <img
                      src={pic.preview}
                      alt={`Item photo ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setPictures((prev) => prev.filter((_, i) => i !== idx))}
                      aria-label="Remove photo"
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
              Item Details &amp; Condition Notes
            </label>
            <textarea
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe how long it has been used, defects if any, pickup location, and whether price is negotiable..."
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7A3E]"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 rounded-xl bg-[#FF7A00] hover:bg-[#e56d00] text-white font-semibold text-sm transition-colors cursor-pointer disabled:opacity-60"
          >
            {submitting ? 'Publishing Home Property...' : 'Post Home Property for Sale'}
          </button>
        </form>
      </div>

      {/* Seller's Posted Home Property Items */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-lg text-slate-900 dark:text-slate-100">
            My Home Property Listings ({myItems.length})
          </h2>
          <button
            type="button"
            onClick={loadMyItems}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#0B7A3E] dark:text-emerald-400 hover:underline cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>

        {loadingMine ? (
          <div className="h-24 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
        ) : myItems.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">You have not posted any TV, Gas, Fan, or home items yet.</p>
        ) : (
          <div className="space-y-3">
            {myItems.map((item) => (
              <div
                key={item.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-20 h-16 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0">
                    {item.images[0] && (
                      <img src={item.images[0]} alt={item.title} className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display font-bold text-sm text-slate-900 dark:text-slate-100">{item.title}</h3>
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                          item.status === 'SOLD'
                            ? 'bg-red-100 dark:bg-red-950/70 text-red-700 dark:text-red-300'
                            : 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300'
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-[#0B7A3E] dark:text-emerald-400 tabular-nums">{formatNaira(item.price)}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {item.category} · {item.condition} · {item.area}, {item.state}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggleSold(item)}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                  >
                    {item.status === 'Available' ? 'Mark SOLD' : 'Mark Available'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteItem(item.id)}
                    aria-label="Delete item"
                    className="p-2 rounded-xl bg-red-50 dark:bg-red-950/60 hover:bg-red-600 text-red-700 dark:text-red-300 hover:text-white transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
