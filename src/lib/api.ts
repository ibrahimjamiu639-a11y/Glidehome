const USER_TOKEN_KEY = 'glide_user_token';
const ADMIN_TOKEN_KEY = 'glide_admin_token';

export function getStoredUserToken(): string | null {
  try {
    return localStorage.getItem(USER_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredUserToken(token: string | null) {
  try {
    if (token) localStorage.setItem(USER_TOKEN_KEY, token);
    else localStorage.removeItem(USER_TOKEN_KEY);
  } catch {
    // ignore storage quota errors
  }
}

export function getStoredAdminToken(): string | null {
  try {
    return localStorage.getItem(ADMIN_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredAdminToken(token: string | null) {
  try {
    if (token) localStorage.setItem(ADMIN_TOKEN_KEY, token);
    else localStorage.removeItem(ADMIN_TOKEN_KEY);
  } catch {
    // ignore storage quota errors
  }
}

export async function apiRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const userToken = getStoredUserToken();
  const adminToken = getStoredAdminToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options?.headers as Record<string, string>) || {}),
  };

  if (userToken) {
    headers['Authorization'] = `Bearer ${userToken}`;
  }
  if (adminToken) {
    headers['X-Admin-Token'] = adminToken;
  }

  const res = await fetch(url, {
    credentials: 'include',
    cache: 'no-store',
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Request failed') as Error & {
      status?: number;
      data?: Record<string, unknown>;
    };
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data as T;
}

export async function fileToCompressedDataUrl(file: File, maxWidth = 1400): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file.'));
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const width = Math.round(img.width * scale);
        const height = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export async function uploadImageFile(file: File): Promise<string> {
  const dataUrl = await fileToCompressedDataUrl(file);
  const res = await apiRequest<{ url: string }>('/api/upload', {
    method: 'POST',
    body: JSON.stringify({ dataUrl }),
  });
  return res.url;
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to process recorded media.'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

export async function uploadMediaBlob(blob: Blob): Promise<string> {
  const dataUrl = await blobToDataUrl(blob);
  const res = await apiRequest<{ url: string }>('/api/upload', {
    method: 'POST',
    body: JSON.stringify({ dataUrl }),
  });
  return res.url;
}
