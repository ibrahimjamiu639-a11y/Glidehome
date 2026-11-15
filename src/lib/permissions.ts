export type BrowserPermissionState = 'granted' | 'denied' | 'prompt';

export interface InspectedPermissions {
  geoState: BrowserPermissionState;
  camState: BrowserPermissionState;
  inIframe: boolean;
  policyBlocksGeo: boolean;
  policyBlocksCam: boolean;
}

export type GeoFetchResult =
  | { ok: true; lat: number; lng: number; accuracy: number }
  | {
      ok: false;
      code: 'PERMISSION_DENIED' | 'POLICY_BLOCKED' | 'TIMEOUT' | 'UNAVAILABLE';
      message: string;
    };

export type CameraOpenResult =
  | { ok: true; stream: MediaStream }
  | {
      ok: false;
      code: 'PERMISSION_DENIED' | 'POLICY_BLOCKED' | 'IN_USE' | 'NO_DEVICE' | 'UNAVAILABLE';
      message: string;
    };

export function isEmbeddedIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export async function inspectBrowserPermissions(): Promise<InspectedPermissions> {
  let geoState: BrowserPermissionState = 'prompt';
  let camState: BrowserPermissionState = 'prompt';
  const inIframe = isEmbeddedIframe();

  const doc = document as unknown as {
    permissionsPolicy?: { allowsFeature?: (name: string) => boolean };
    featurePolicy?: { allowsFeature?: (name: string) => boolean };
  };
  const policyApi = doc.permissionsPolicy || doc.featurePolicy;
  const policyBlocksGeo =
    typeof policyApi?.allowsFeature === 'function' ? !policyApi.allowsFeature('geolocation') : false;
  const policyBlocksCam =
    typeof policyApi?.allowsFeature === 'function' ? !policyApi.allowsFeature('camera') : false;

  if (navigator.permissions?.query) {
    try {
      const geoPerm = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
      if (geoPerm.state === 'granted' || geoPerm.state === 'denied' || geoPerm.state === 'prompt') {
        geoState = geoPerm.state;
      }
    } catch {
      // ignore unsupported permission query
    }
    try {
      const camPerm = await navigator.permissions.query({ name: 'camera' as PermissionName });
      if (camPerm.state === 'granted' || camPerm.state === 'denied' || camPerm.state === 'prompt') {
        camState = camPerm.state;
      }
    } catch {
      // Safari / Firefox throw for 'camera' in permissions.query — inspect enumerateDevices below
    }
  }

  // Fallback camera permission check via device labels (non-empty label means camera access is granted)
  if (camState !== 'granted' && navigator.mediaDevices?.enumerateDevices) {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasLabeledCam = devices.some((d) => d.kind === 'videoinput' && Boolean(d.label));
      if (hasLabeledCam) {
        camState = 'granted';
      }
    } catch {
      // ignore
    }
  }

  return { geoState, camState, inIframe, policyBlocksGeo, policyBlocksCam };
}

function getCurrentPosOnce(options: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

export async function getBrowserCoordinates(): Promise<GeoFetchResult> {
  if (!navigator.geolocation) {
    return {
      ok: false,
      code: 'UNAVAILABLE',
      message: 'GPS geolocation is not supported on this browser.',
    };
  }

  const inspected = await inspectBrowserPermissions();
  if (inspected.policyBlocksGeo) {
    return {
      ok: false,
      code: 'POLICY_BLOCKED',
      message:
        'Your browser allows location, but this embedded preview frame restricts GPS access. Open Glide Homes in a full browser tab or type your area manually.',
    };
  }

  try {
    // Stage 1: Fast network/OS location first so desktop & indoor devices resolve immediately
    const pos = await getCurrentPosOnce({
      enableHighAccuracy: false,
      timeout: 8000,
      maximumAge: 60000,
    });
    return {
      ok: true,
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
    };
  } catch (err1) {
    const geoErr1 = err1 as GeolocationPositionError;
    if (geoErr1?.code === 1) {
      const msg = String(geoErr1.message || '').toLowerCase();
      if (msg.includes('policy') || msg.includes('disallowed') || inspected.geoState === 'granted' || inspected.inIframe) {
        return {
          ok: false,
          code: 'POLICY_BLOCKED',
          message:
            inspected.geoState === 'granted' || msg.includes('policy') || msg.includes('disallowed')
              ? 'Location is allowed in your browser settings, but the embedded preview frame is blocking it. Click "Open in Full Tab" below to allow location directly.'
              : 'Location permission was denied. Please allow Location in your browser site settings or click "Open in Full Tab".',
        };
      }
      return {
        ok: false,
        code: 'PERMISSION_DENIED',
        message: 'Location access was denied. Enable Location in your browser site settings and try again.',
      };
    }

    // Stage 2: Retry with high accuracy / cached position if Stage 1 timed out or was unavailable
    try {
      const pos2 = await getCurrentPosOnce({
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 300000,
      });
      return {
        ok: true,
        lat: pos2.coords.latitude,
        lng: pos2.coords.longitude,
        accuracy: pos2.coords.accuracy,
      };
    } catch (err2) {
      const geoErr2 = err2 as GeolocationPositionError;
      if (geoErr2?.code === 1) {
        return {
          ok: false,
          code: inspected.geoState === 'granted' ? 'POLICY_BLOCKED' : 'PERMISSION_DENIED',
          message:
            inspected.geoState === 'granted'
              ? 'Location is allowed in your browser settings, but blocked inside the embedded frame. Open Glide Homes in a full browser tab.'
              : 'Location access was denied in browser settings.',
        };
      }
      if (geoErr2?.code === 3) {
        return {
          ok: false,
          code: 'TIMEOUT',
          message: 'Location request timed out. Make sure device GPS/Location Services are turned on, or enter your area below.',
        };
      }
      return {
        ok: false,
        code: 'UNAVAILABLE',
        message: 'Location signal is currently unavailable on this device. Enter your area below to pin your position.',
      };
    }
  }
}

function getUserMediaCompat(constraints: MediaStreamConstraints): Promise<MediaStream> {
  if (navigator.mediaDevices?.getUserMedia) {
    return navigator.mediaDevices.getUserMedia(constraints);
  }
  const legacyNav = navigator as unknown as {
    getUserMedia?: (
      c: MediaStreamConstraints,
      ok: (s: MediaStream) => void,
      err: (e: unknown) => void
    ) => void;
    webkitGetUserMedia?: (
      c: MediaStreamConstraints,
      ok: (s: MediaStream) => void,
      err: (e: unknown) => void
    ) => void;
    mozGetUserMedia?: (
      c: MediaStreamConstraints,
      ok: (s: MediaStream) => void,
      err: (e: unknown) => void
    ) => void;
  };
  const legacyFn = legacyNav.getUserMedia || legacyNav.webkitGetUserMedia || legacyNav.mozGetUserMedia;
  if (!legacyFn) {
    return Promise.reject(new Error('CAMERA_UNAVAILABLE'));
  }
  return new Promise((resolve, reject) => {
    legacyFn.call(navigator, constraints, resolve, reject);
  });
}

export async function requestBrowserCameraStream(
  facingMode?: 'user' | 'environment'
): Promise<CameraOpenResult> {
  const hasAnyMediaApi = Boolean(
    navigator.mediaDevices?.getUserMedia ||
      (navigator as unknown as { webkitGetUserMedia?: unknown }).webkitGetUserMedia ||
      (navigator as unknown as { mozGetUserMedia?: unknown }).mozGetUserMedia ||
      (navigator as unknown as { getUserMedia?: unknown }).getUserMedia
  );

  if (!hasAnyMediaApi) {
    return {
      ok: false,
      code: 'UNAVAILABLE',
      message: 'Live camera stream is unavailable in this WebView. Use the device camera snap button below or open in Chrome/Safari.',
    };
  }

  const inspected = await inspectBrowserPermissions();
  if (inspected.policyBlocksCam) {
    return {
      ok: false,
      code: 'POLICY_BLOCKED',
      message:
        'Your browser allows camera access, but this embedded preview frame restricts the camera. Click "Open in Full Tab" or use the native device camera fallback.',
    };
  }

  const attempts: MediaStreamConstraints[] = facingMode
    ? [
        { video: { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
        { video: { facingMode }, audio: false },
        { video: true, audio: false },
      ]
    : [{ video: true, audio: false }];

  let lastErr: unknown = null;
  for (const constraints of attempts) {
    try {
      const stream = await getUserMediaCompat(constraints);
      return { ok: true, stream };
    } catch (err) {
      lastErr = err;
      const domErr = err as DOMException;
      // Fall back on OverconstrainedError, NotFoundError, or generic WebView TypeError
      if (
        domErr?.name &&
        domErr.name !== 'OverconstrainedError' &&
        domErr.name !== 'NotFoundError' &&
        domErr.name !== 'ConstraintNotSatisfiedError' &&
        domErr.name !== 'TypeError'
      ) {
        break;
      }
    }
  }

  const domErr = lastErr as DOMException | undefined;
  const errName = domErr?.name || '';
  const errMsg = String(domErr?.message || '').toLowerCase();

  if (errMsg === 'camera_unavailable') {
    return {
      ok: false,
      code: 'UNAVAILABLE',
      message: 'Camera access requires HTTPS or a supported WebView browser.',
    };
  }

  if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
    return {
      ok: false,
      code: 'NO_DEVICE',
      message: 'No camera was detected on this device.',
    };
  }

  if (errName === 'NotReadableError' || errName === 'TrackStartError' || errName === 'AbortError') {
    return {
      ok: false,
      code: 'IN_USE',
      message: 'Your camera is currently being used by another app or browser tab. Close it and retry.',
    };
  }

  if (
    errMsg.includes('policy') ||
    errMsg.includes('disallowed') ||
    inspected.camState === 'granted' ||
    inspected.inIframe
  ) {
    return {
      ok: false,
      code: 'POLICY_BLOCKED',
      message:
        inspected.camState === 'granted' || errMsg.includes('policy') || errMsg.includes('disallowed')
          ? 'Camera is allowed in your browser settings, but the embedded preview frame is blocking it. Open Glide Homes in a full browser tab to use your camera.'
          : 'Camera permission was denied. Allow Camera in browser settings or open Glide Homes in a full browser tab.',
    };
  }

  return {
    ok: false,
    code: 'PERMISSION_DENIED',
    message: 'Camera permission was denied. Please allow Camera in your browser site settings.',
  };
}
