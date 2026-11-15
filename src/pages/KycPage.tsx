import { useCallback, useEffect, useRef, useState } from 'react';
import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';
import {
  Camera,
  CheckCircle2,
  Clock,
  ExternalLink,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  X,
  XCircle,
} from 'lucide-react';
import type { AuthUser, KycSubmission } from '../types.ts';
import { apiRequest, uploadMediaBlob } from '../lib/api.ts';
import { requestBrowserCameraStream } from '../lib/permissions.ts';

interface KycPageProps {
  user: AuthUser | null;
  onRefreshUser: () => Promise<void>;
  onNavigate: (path: string) => void;
}

function captureVideoFrame(videoEl: HTMLVideoElement, maxWidth = 960): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const vw = videoEl.videoWidth || 640;
    const vh = videoEl.videoHeight || 480;
    const scale = Math.min(1, maxWidth / vw);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(vw * scale);
    canvas.height = Math.round(vh * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Camera snapshot context unavailable.'));
      return;
    }
    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Could not capture photo from camera.'));
          return;
        }
        resolve(blob);
      },
      'image/jpeg',
      0.88
    );
  });
}

export function KycPage({ user, onRefreshUser, onNavigate }: KycPageProps) {
  const [kyc, setKyc] = useState<KycSubmission | null>(null);
  const [loading, setLoading] = useState(true);

  const [idType, setIdType] = useState<'NIN' | 'BVN'>('NIN');
  const [idNumber, setIdNumber] = useState('');

  // Full-Page Face-in-Circle Camera State
  const [faceCameraActive, setFaceCameraActive] = useState(false);
  const [faceStream, setFaceStream] = useState<MediaStream | null>(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [selfieBlob, setSelfieBlob] = useState<Blob | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string>('');

  const faceVideoRef = useRef<HTMLVideoElement | null>(null);
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const submitButtonRef = useRef<HTMLButtonElement | null>(null);

  const [cameraError, setCameraError] = useState('');
  const [cameraPolicyBlocked, setCameraPolicyBlocked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const stopStream = useCallback((stream: MediaStream | null) => {
    if (!stream) return;
    stream.getTracks().forEach((t) => t.stop());
  }, []);

  const closeFaceCamera = useCallback(() => {
    if (animFrameRef.current !== null) {
      window.cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    stopStream(faceStream);
    setFaceStream(null);
    setFaceCameraActive(false);
    setFaceDetected(false);
  }, [faceStream, stopStream]);

  useEffect(() => {
    if (faceVideoRef.current && faceStream) {
      faceVideoRef.current.srcObject = faceStream;
    }
  }, [faceStream, faceCameraActive]);

  useEffect(() => {
    return () => {
      stopStream(faceStream);
      if (animFrameRef.current !== null) {
        window.cancelAnimationFrame(animFrameRef.current);
      }
      if (faceLandmarkerRef.current) {
        try {
          faceLandmarkerRef.current.close();
        } catch {
          // ignore
        }
      }
    };
  }, [faceStream, stopStream]);

  useEffect(() => {
    if (!user || user.role !== 'agent') {
      setLoading(false);
      return;
    }
    let active = true;
    Promise.all([
      onRefreshUser(),
      apiRequest<{ kyc: KycSubmission | null }>('/api/kyc/me').then((res) => {
        if (active) setKyc(res.kyc);
      }),
    ])
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user?.id, user?.role, user?.kycStatus, onRefreshUser]);

  const ensureFaceLandmarker = useCallback(async () => {
    if (faceLandmarkerRef.current) return faceLandmarkerRef.current;
    const vision = await FilesetResolver.forVisionTasks('/mediapipe/wasm');
    try {
      faceLandmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: '/mediapipe/face_landmarker.task',
          delegate: 'GPU',
        },
        outputFaceBlendshapes: false,
        runningMode: 'VIDEO',
        numFaces: 1,
      });
    } catch {
      faceLandmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: '/mediapipe/face_landmarker.task',
          delegate: 'CPU',
        },
        outputFaceBlendshapes: false,
        runningMode: 'VIDEO',
        numFaces: 1,
      });
    }
    return faceLandmarkerRef.current;
  }, []);

  const startFaceCamera = async () => {
    setCameraError('');
    setCameraPolicyBlocked(false);
    setError('');
    stopStream(faceStream);

    const res = await requestBrowserCameraStream('user');
    if (!res.ok) {
      setCameraError(res.message);
      setCameraPolicyBlocked(res.code === 'POLICY_BLOCKED' || res.code === 'UNAVAILABLE');
      return;
    }

    setFaceDetected(false);
    setFaceStream(res.stream);
    setFaceCameraActive(true);
  };

  // Optional visual guide: highlights the circle green when a face is detected inside the viewfinder
  useEffect(() => {
    if (!faceCameraActive || !faceStream) return;

    let cancelled = false;
    let lastVideoTime = -1;

    const startPassiveDetection = async () => {
      try {
        const landmarker = await ensureFaceLandmarker();
        if (cancelled) return;

        const stepFrame = () => {
          if (cancelled) return;
          const videoEl = faceVideoRef.current;
          if (!videoEl || videoEl.readyState < 2 || videoEl.videoWidth === 0) {
            animFrameRef.current = window.requestAnimationFrame(stepFrame);
            return;
          }

          if (videoEl.currentTime !== lastVideoTime) {
            lastVideoTime = videoEl.currentTime;
            try {
              const result = landmarker.detectForVideo(videoEl, performance.now());
              const landmarks = result.faceLandmarks?.[0];
              if (landmarks && landmarks.length > 10) {
                const nose = landmarks[1];
                const centered =
                  nose && nose.x > 0.22 && nose.x < 0.78 && nose.y > 0.18 && nose.y < 0.82;
                setFaceDetected(Boolean(centered));
              } else {
                setFaceDetected(false);
              }
            } catch {
              // Keep capture enabled even if detection frame fails
            }
          }

          animFrameRef.current = window.requestAnimationFrame(stepFrame);
        };

        animFrameRef.current = window.requestAnimationFrame(stepFrame);
      } catch {
        // Fallback: camera capture still works cleanly without WASM face guide
      }
    };

    startPassiveDetection();

    return () => {
      cancelled = true;
      if (animFrameRef.current !== null) {
        window.cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [faceCameraActive, faceStream, ensureFaceLandmarker]);

  const handleCaptureFace = async () => {
    if (!faceVideoRef.current || capturing) return;
    setCapturing(true);
    try {
      const blob = await captureVideoFrame(faceVideoRef.current, 960);
      setSelfieBlob(blob);
      setSelfiePreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });
      closeFaceCamera();
      window.setTimeout(() => {
        submitButtonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 150);
    } catch (err) {
      setCameraError(err instanceof Error ? err.message : 'Failed to capture face photo.');
      closeFaceCamera();
    } finally {
      setCapturing(false);
    }
  };

  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 text-center shadow-sm border border-slate-100 dark:border-slate-800 space-y-4">
          <h1 className="font-display font-bold text-xl text-slate-900 dark:text-slate-100">Agent Login Required</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">Please login to your Agent or Landlord account to verify your KYC.</p>
          <button
            type="button"
            onClick={() => onNavigate('/login')}
            className="px-6 py-2.5 rounded-xl bg-[#0B7A3E] text-white text-sm font-semibold cursor-pointer"
          >
            Login
          </button>
        </div>
      </div>
    );
  }

  if (user.role !== 'agent') {
    return (
      <div className="max-w-lg mx-auto px-4 py-12">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 text-center shadow-sm border border-slate-100 dark:border-slate-800 space-y-4">
          <ShieldCheck className="w-12 h-12 text-[#0B7A3E] dark:text-emerald-400 mx-auto" />
          <h1 className="font-display font-bold text-xl text-slate-900 dark:text-slate-100">Agent Account Required for KYC</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Buyers can browse houses and book inspections immediately. If you want to upload houses as an Agent / Landlord, request an Agent upgrade from the Home page first.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="px-6 py-2.5 rounded-xl bg-[#0B7A3E] text-white text-sm font-semibold cursor-pointer"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!/^\d{11}$/.test(idNumber.trim())) {
      setError(`${idType} must be exactly 11 digits.`);
      return;
    }
    if (!selfieBlob) {
      setError('Please open the camera, place your face inside the circle without glasses or mask, and capture.');
      return;
    }

    setSubmitting(true);
    try {
      const selfieUrl = await uploadMediaBlob(selfieBlob);
      const res = await apiRequest<{ message: string }>('/api/kyc', {
        method: 'POST',
        body: JSON.stringify({
          idType,
          idNumber: idNumber.trim(),
          selfieUrl,
        }),
      });
      setSuccess(res.message);
      await onRefreshUser();
      const refreshed = await apiRequest<{ kyc: KycSubmission | null }>('/api/kyc/me');
      setKyc(refreshed.kyc);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit KYC.');
    } finally {
      setSubmitting(false);
    }
  };

  const status = kyc?.status === 'approved' ? 'approved' : user.kycStatus;
  const readyToSubmit = Boolean(/^\d{11}$/.test(idNumber.trim()) && selfieBlob);

  return (
    <>
      {/* FULL-PAGE FACE-IN-CIRCLE CAMERA OVERLAY */}
      {faceCameraActive && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col justify-between">
          {/* Top Instructions Bar */}
          <div className="px-4 pt-3 pb-4 bg-gradient-to-b from-black/90 via-black/75 to-transparent text-white z-10 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-display font-bold text-base">Face Verification Camera</p>
                <p className="text-xs text-white/80">
                  Remove glasses, hats, and face mask before capturing
                </p>
              </div>
              <button
                type="button"
                onClick={closeFaceCamera}
                aria-label="Close camera"
                className="w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div
              className={`rounded-xl px-4 py-3 border text-center transition-colors ${
                faceDetected
                  ? 'bg-[#0B7A3E] border-emerald-400 text-white'
                  : 'bg-slate-900/90 border-white/30 text-white'
              }`}
            >
              <p className="font-display font-bold text-sm sm:text-base">
                {faceDetected
                  ? 'Face Centered in Circle — Tap Capture Now'
                  : 'Put your face inside the circle without glasses or mask'}
              </p>
            </div>
          </div>

          {/* Centered Circular Camera Guide */}
          <div className="relative flex-1 flex items-center justify-center overflow-hidden">
            <video
              ref={faceVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover -scale-x-100"
            />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div
                className={`w-64 h-64 sm:w-80 sm:h-80 rounded-full border-4 transition-colors shadow-[0_0_0_9999px_rgba(0,0,0,0.58)] ${
                  faceDetected ? 'border-emerald-400' : 'border-white/90'
                }`}
              />
            </div>
          </div>

          {/* Bottom Capture Controls */}
          <div className="px-6 py-5 bg-black/90 flex items-center justify-center gap-4 z-10">
            <button
              type="button"
              onClick={closeFaceCamera}
              className="px-5 py-3.5 rounded-2xl bg-white/15 hover:bg-white/25 text-white text-sm font-semibold cursor-pointer min-h-[52px]"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={capturing}
              onClick={handleCaptureFace}
              className="flex-1 max-w-xs inline-flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl bg-[#0B7A3E] hover:bg-[#096734] text-white font-display font-bold text-base shadow-lg cursor-pointer min-h-[52px] disabled:opacity-60"
            >
              <Camera className="w-5 h-5" />
              {capturing ? 'Capturing...' : 'Capture'}
            </button>
          </div>
        </div>
      )}

      {/* MAIN KYC FORM PAGE */}
      <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12 space-y-6">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-100 dark:border-slate-800 space-y-6">
          <div>
            <h1 className="font-display font-bold text-2xl text-slate-900 dark:text-slate-100">
              Agent &amp; Landlord KYC Verification
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Enter your 11-digit NIN or BVN and capture your face clearly inside the circle (without glasses or face mask), then submit for admin review.
            </p>
          </div>

          {!loading && (
            <div
              className={`rounded-xl p-4 border flex items-start gap-3 ${
                status === 'approved'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-200'
                  : status === 'pending'
                  ? 'bg-amber-50 border-amber-200 text-amber-950 dark:bg-amber-950/60 dark:border-amber-800 dark:text-amber-100'
                  : status === 'rejected'
                  ? 'bg-red-50 border-red-200 text-red-900 dark:bg-red-950/60 dark:border-red-800 dark:text-red-200'
                  : 'bg-slate-50 border-slate-200 text-slate-700 dark:bg-slate-800/70 dark:border-slate-700 dark:text-slate-200'
              }`}
            >
              {status === 'approved' && <CheckCircle2 className="w-5 h-5 text-[#0B7A3E] dark:text-emerald-400 shrink-0 mt-0.5" />}
              {status === 'pending' && <Clock className="w-5 h-5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />}
              {status === 'rejected' && <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />}
              {status === 'unsubmitted' && <ShieldAlert className="w-5 h-5 text-slate-500 dark:text-slate-400 shrink-0 mt-0.5" />}

              <div className="text-sm space-y-1">
                <p className="font-bold">
                  KYC Status:{' '}
                  {status === 'approved'
                    ? 'Approved'
                    : status === 'pending'
                    ? 'Under Review (Pending Admin Approval)'
                    : status === 'rejected'
                    ? 'Rejected'
                    : 'Not Submitted'}
                </p>
                {status === 'approved' && (
                  <p>You now have a Verified Badge and can publish houses immediately.</p>
                )}
                {status === 'pending' && (
                  <p>
                    Our admin team is reviewing your {kyc?.idType} number and captured face photo. Your account unlocks automatically once approved.
                  </p>
                )}
                {status === 'rejected' && (
                  <p>
                    <span className="font-semibold">Reason:</span>{' '}
                    {user.kycRejectionReason || kyc?.rejectionReason || 'Verification face photo or ID number was unclear. Please re-capture and submit.'}
                  </p>
                )}
                {status === 'unsubmitted' && (
                  <p>No ID card upload needed — only your NIN or BVN number and a clear face capture inside the circle.</p>
                )}
              </div>
            </div>
          )}

          {status === 'approved' && (
            <button
              type="button"
              onClick={() => onNavigate('/upload-house')}
              className="w-full py-3 rounded-xl bg-[#FF7A00] hover:bg-[#e56d00] text-white font-semibold text-sm cursor-pointer"
            >
              Upload a House Now
            </button>
          )}

          {(status === 'unsubmitted' || status === 'rejected') && (
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 text-sm rounded-xl p-3">
                  {error}
                </div>
              )}
              {cameraError && (
                <div className="bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-950 dark:text-amber-100 text-sm rounded-xl p-3.5 space-y-2.5">
                  <p>{cameraError}</p>
                  {cameraPolicyBlocked && (
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={window.location.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0B7A3E] hover:bg-[#096734] text-white text-xs font-semibold"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Open in Full Browser Tab
                      </a>
                      <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 text-amber-950 dark:text-amber-200 text-xs font-semibold cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/40">
                        <Camera className="w-3.5 h-3.5" />
                        Snap Face via Device Camera
                        <input
                          type="file"
                          accept="image/*"
                          capture="user"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (!f) return;
                            if (selfiePreview) URL.revokeObjectURL(selfiePreview);
                            setSelfieBlob(f);
                            setSelfiePreview(URL.createObjectURL(f));
                          }}
                        />
                      </label>
                    </div>
                  )}
                </div>
              )}
              {success && (
                <div className="bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-sm rounded-xl p-3">
                  {success}
                </div>
              )}

              {/* Step 1: NIN or BVN Number Only */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 p-4 sm:p-5 space-y-3">
                <div>
                  <h2 className="font-display font-bold text-sm text-slate-900 dark:text-slate-100">
                    1. Enter NIN or BVN Number
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    No ID card picture required — enter your 11-digit NIN or BVN only.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">ID Type</label>
                    <select
                      value={idType}
                      onChange={(e) => setIdType(e.target.value as 'NIN' | 'BVN')}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0B7A3E]"
                    >
                      <option value="NIN">NIN</option>
                      <option value="BVN">BVN</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      11-Digit {idType} Number
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={11}
                      inputMode="numeric"
                      value={idNumber}
                      onChange={(e) => setIdNumber(e.target.value.replace(/\D/g, '').slice(0, 11))}
                      placeholder={`Enter 11-digit ${idType}`}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 text-sm font-mono tabular-nums bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0B7A3E]"
                    />
                  </div>
                </div>
              </div>

              {/* Step 2: Live Face-in-Circle Capture */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 p-4 sm:p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="font-display font-bold text-sm text-slate-900 dark:text-slate-100">
                      2. Capture Your Face Inside the Circle
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Put your face inside the circle on screen without glasses or mask, then tap Capture.
                    </p>
                  </div>
                  {selfieBlob && (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-[#0B7A3E] dark:text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" /> Face Captured
                    </span>
                  )}
                </div>

                {selfiePreview ? (
                  <div className="flex flex-col items-center gap-3 py-2">
                    <div className="w-44 h-44 rounded-full overflow-hidden border-4 border-[#0B7A3E] bg-white dark:bg-slate-900 shadow-sm">
                      <img
                        src={selfiePreview}
                        alt="Captured Face Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={startFaceCamera}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Retake Face Photo
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={startFaceCamera}
                    className="w-full py-7 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-[#0B7A3E] dark:hover:border-emerald-500 bg-white dark:bg-slate-900 flex flex-col items-center justify-center gap-2 text-slate-700 dark:text-slate-200 cursor-pointer transition-colors"
                  >
                    <Camera className="w-8 h-8 text-[#0B7A3E] dark:text-emerald-400" />
                    <span className="text-sm font-semibold">Open Camera to Capture Face</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      No glasses or face mask · Tap Capture to return here
                    </span>
                  </button>
                )}
              </div>

              <button
                ref={submitButtonRef}
                type="submit"
                disabled={submitting}
                className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-colors cursor-pointer disabled:opacity-60 min-h-[48px] ${
                  readyToSubmit
                    ? 'bg-[#0B7A3E] hover:bg-[#096734] text-white shadow-md ring-2 ring-[#0B7A3E]/30'
                    : 'bg-[#0B7A3E] hover:bg-[#096734] text-white'
                }`}
              >
                {submitting ? 'Submitting KYC Verification...' : 'Submit KYC for Review'}
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
