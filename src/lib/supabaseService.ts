import type { User as SupabaseAuthUser } from '@supabase/supabase-js';
import type {
  AdminDashboardData,
  AdminNote,
  AgentUpgradeRequest,
  AuthUser,
  HomePropertyCategory,
  HomePropertyCondition,
  HomePropertyItem,
  HouseApprovalStatus,
  HouseListing,
  HouseStatus,
  HouseType,
  InspectionBooking,
  KycStatus,
  KycSubmission,
  LoginLogEntry,
  UserReport,
  UserRole,
} from '../types.ts';
import { ADMIN_EMAIL, supabase } from './supabase.ts';
import { haversineKm } from './maps.ts';

interface SupabaseErrorLike {
  code?: string;
  message?: string;
  details?: string;
}

function isMissingTableError(err: unknown): boolean {
  const e = err as SupabaseErrorLike | null;
  if (!e) return false;
  const msg = (e.message || '').toLowerCase();
  return (
    e.code === 'PGRST205' ||
    e.code === '42P01' ||
    msg.includes('could not find the table') ||
    msg.includes('does not exist')
  );
}

function isMissingColumnError(err: unknown): boolean {
  const e = err as SupabaseErrorLike | null;
  if (!e) return false;
  const msg = (e.message || '').toLowerCase();
  return (
    e.code === '42703' ||
    e.code === 'PGRST204' ||
    msg.includes('could not find the') ||
    (msg.includes('column') && msg.includes('does not exist'))
  );
}

function deterministic8DigitFromId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  const num = 10000000 + (hash % 89999999);
  return String(num);
}

export function generateRandom8DigitCode(): string {
  return String(Math.floor(10000000 + Math.random() * 89999999));
}

function parseLocationParts(locationStr: string): { area: string; state: string; country: string } {
  const parts = String(locationStr || '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return { area: '', state: 'Lagos', country: 'Nigeria' };
  if (parts.length === 1) return { area: parts[0], state: parts[0], country: 'Nigeria' };
  if (parts.length === 2) return { area: parts[0], state: parts[1], country: 'Nigeria' };
  return {
    area: parts.slice(0, parts.length - 2).join(', '),
    state: parts[parts.length - 2],
    country: parts[parts.length - 1],
  };
}

function bedroomsFromHouseType(houseType: HouseType): number {
  if (houseType === '1 Bedroom') return 1;
  if (houseType === '2 Bedroom') return 2;
  if (houseType === '3 Bedroom') return 3;
  if (houseType === 'Duplex') return 4;
  return 1;
}

function houseTypeFromRow(row: Record<string, unknown>): HouseType {
  if (typeof row.house_type === 'string' && row.house_type.trim()) {
    return row.house_type as HouseType;
  }
  const bedrooms = Number(row.bedrooms);
  if (bedrooms === 1) return '1 Bedroom';
  if (bedrooms === 2) return '2 Bedroom';
  if (bedrooms === 3) return '3 Bedroom';
  if (bedrooms >= 4) return 'Duplex';
  return 'Self-Contain';
}

function mapProfileRow(
  row: Record<string, unknown> | null,
  authUser?: SupabaseAuthUser | null
): AuthUser {
  const id = String(row?.id || authUser?.id || '');
  const meta = (authUser?.user_metadata || {}) as Record<string, unknown>;
  const email = String(row?.email || authUser?.email || '').toLowerCase();
  const roleRaw = String(row?.role || meta.role || 'buyer');
  const role: UserRole = roleRaw === 'agent' ? 'agent' : 'buyer';
  const kycStatusRaw = String(row?.kyc_status || 'unsubmitted');
  const kycStatus: KycStatus =
    kycStatusRaw === 'approved' || kycStatusRaw === 'pending' || kycStatusRaw === 'rejected'
      ? kycStatusRaw
      : 'unsubmitted';

  return {
    id,
    userCode: String(row?.user_code || meta.user_code || deterministic8DigitFromId(id || email)),
    fullName: String(row?.full_name || meta.full_name || email.split('@')[0] || 'User'),
    phone: String(row?.phone || meta.phone || ''),
    email,
    state: String(row?.state || meta.state || ''),
    role,
    isVerified: Boolean(row?.is_verified || kycStatus === 'approved'),
    isBlocked: Boolean(row?.is_blocked),
    kycStatus,
    kycRejectionReason: (row?.kyc_rejection_reason as string | null) ?? null,
    agentUpgradeStatus:
      (row?.agent_upgrade_status as AuthUser['agentUpgradeStatus']) || 'none',
    agentUpgradeReason: (row?.agent_upgrade_reason as string | null) ?? null,
    isAdmin: email === ADMIN_EMAIL || Boolean(row?.is_admin),
    createdAt: String(row?.created_at || authUser?.created_at || new Date().toISOString()),
  };
}

function mapHouseRow(
  row: Record<string, unknown>,
  profilesById: Map<string, AuthUser>
): HouseListing {
  const id = String(row.id || '');
  const agentId = row.agent_id ? String(row.agent_id) : '';
  const agent = agentId ? profilesById.get(agentId) : undefined;
  const locParsed = parseLocationParts(String(row.location || ''));

  const rawImages = Array.isArray(row.images)
    ? (row.images as unknown[]).map(String).filter(Boolean)
    : [];
  const primaryImage = typeof row.image_url === 'string' && row.image_url.trim() ? row.image_url.trim() : '';
  const images = rawImages.length > 0 ? rawImages : primaryImage ? [primaryImage] : [];

  const amenities = Array.isArray(row.amenities)
    ? (row.amenities as unknown[]).map(String).filter(Boolean)
    : [];

  const rawStatus = String(row.status || 'Available');
  const status: HouseStatus = rawStatus === 'SOLD OUT' ? 'SOLD OUT' : 'Available';

  const rawApproval = row.approval_status ? String(row.approval_status) : 'approved';
  const approvalStatus: HouseApprovalStatus =
    rawApproval === 'pending' || rawApproval === 'rejected' ? rawApproval : 'approved';

  return {
    id,
    agentId,
    agentCode: String(row.agent_code || agent?.userCode || ''),
    agentName: String(row.agent_name || agent?.fullName || 'Verified Landlord'),
    agentVerified: Boolean(row.agent_verified ?? agent?.isVerified ?? false),
    title: String(row.title || 'Rental Property'),
    houseNumber: String(row.house_number || ''),
    streetName: String(row.street_name || ''),
    area: String(row.area || locParsed.area),
    state: String(row.state || locParsed.state),
    country: String(row.country || locParsed.country || 'Nigeria'),
    price: Number(row.price || 0),
    inspectionFee: Number(row.inspection_fee || 3000),
    houseType: houseTypeFromRow(row),
    phone: String(row.phone || agent?.phone || ''),
    images,
    amenities,
    description: String(row.description || ''),
    status,
    approvalStatus,
    rejectionReason: (row.rejection_reason as string | null) ?? null,
    lat: row.lat != null ? Number(row.lat) : null,
    lng: row.lng != null ? Number(row.lng) : null,
    distanceKm: null,
    createdAt: String(row.created_at || new Date().toISOString()),
  };
}

function mapBookingRow(
  row: Record<string, unknown>,
  housesById: Map<string, { title: string; location: string }>
): InspectionBooking {
  const houseId = String(row.house_id || '');
  const houseInfo = housesById.get(houseId);
  return {
    id: String(row.id || ''),
    houseId,
    houseTitle: String(row.house_title || houseInfo?.title || 'House Listing'),
    houseLocation: houseInfo?.location || '',
    userId: row.user_id ? String(row.user_id) : null,
    buyerName: String(row.name || row.buyer_name || 'Guest'),
    buyerPhone: String(row.phone || row.buyer_phone || ''),
    preferredDate: String(row.preferred_date || row.check_in || ''),
    preferredTime: String(row.preferred_time || ''),
    notes: String(row.notes || ''),
    status: String(row.status || 'pending'),
    createdAt: String(row.created_at || new Date().toISOString()),
  };
}

function mapItemRow(row: Record<string, unknown>): HomePropertyItem {
  const rawImages = Array.isArray(row.images) ? (row.images as unknown[]).map(String) : [];
  const rawApproval = String(row.approval_status || 'approved');
  const approvalStatus: HouseApprovalStatus =
    rawApproval === 'pending' || rawApproval === 'rejected' ? rawApproval : 'approved';
  return {
    id: String(row.id || ''),
    sellerId: String(row.seller_id || ''),
    sellerName: String(row.seller_name || 'Seller'),
    sellerCode: String(row.seller_code || ''),
    title: String(row.title || ''),
    category: (row.category as HomePropertyCategory) || 'Other Home Property',
    condition: (row.condition as HomePropertyCondition) || 'Neatly Used',
    price: Number(row.price || 0),
    area: String(row.area || ''),
    state: String(row.state || ''),
    country: String(row.country || 'Nigeria'),
    phone: String(row.phone || ''),
    images: rawImages,
    description: String(row.description || ''),
    status: row.status === 'SOLD' ? 'SOLD' : 'Available',
    approvalStatus,
    rejectionReason: (row.rejection_reason as string | null) ?? null,
    createdAt: String(row.created_at || new Date().toISOString()),
  };
}

async function fetchProfilesMap(): Promise<Map<string, AuthUser>> {
  const map = new Map<string, AuthUser>();
  const { data, error } = await supabase.from('profiles').select('*');
  if (error || !data) return map;
  for (const row of data as Record<string, unknown>[]) {
    const mapped = mapProfileRow(row);
    if (mapped.id) map.set(mapped.id, mapped);
  }
  return map;
}

async function ensureProfileRow(
  authUser: SupabaseAuthUser,
  overrides?: Partial<{
    fullName: string;
    phone: string;
    state: string;
    role: UserRole;
    userCode: string;
  }>
): Promise<AuthUser> {
  const meta = (authUser.user_metadata || {}) as Record<string, unknown>;
  const email = (authUser.email || '').toLowerCase();
  const fullName = overrides?.fullName || String(meta.full_name || email.split('@')[0] || '');
  const phone = overrides?.phone || String(meta.phone || '');
  const state = overrides?.state || String(meta.state || '');
  const role: UserRole =
    overrides?.role || (meta.role === 'agent' ? 'agent' : 'buyer');
  const userCode =
    overrides?.userCode || String(meta.user_code || deterministic8DigitFromId(authUser.id));

  const { data: existing } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authUser.id)
    .maybeSingle();

  if (existing) {
    return mapProfileRow(existing as Record<string, unknown>, authUser);
  }

  const extendedPayload = {
    id: authUser.id,
    email,
    full_name: fullName,
    phone,
    role,
    state,
    user_code: userCode,
    kyc_status: 'unsubmitted',
    agent_upgrade_status: 'none',
    is_verified: false,
    is_blocked: false,
    is_admin: email === ADMIN_EMAIL,
  };

  const { data: insertedExt, error: extErr } = await supabase
    .from('profiles')
    .upsert(extendedPayload, { onConflict: 'id' })
    .select('*')
    .maybeSingle();

  if (!extErr && insertedExt) {
    return mapProfileRow(insertedExt as Record<string, unknown>, authUser);
  }

  if (extErr && isMissingColumnError(extErr)) {
    const corePayload = {
      id: authUser.id,
      email,
      full_name: fullName,
      phone,
      role,
    };
    const { data: insertedCore, error: coreErr } = await supabase
      .from('profiles')
      .upsert(corePayload, { onConflict: 'id' })
      .select('*')
      .maybeSingle();
    if (!coreErr && insertedCore) {
      return mapProfileRow(insertedCore as Record<string, unknown>, authUser);
    }
  }

  return mapProfileRow(null, authUser);
}

async function recordLoginLog(user: AuthUser) {
  try {
    const { error } = await supabase.from('login_logs').insert({
      user_id: user.id,
      user_code: user.userCode,
      full_name: user.fullName,
      email: user.email,
      role: user.role,
    });
    if (error && !isMissingTableError(error)) {
      // non-fatal
    }
  } catch {
    // non-fatal
  }
}

// ==========================================
// AUTHENTICATION
// ==========================================

export async function getCurrentAuthUser(): Promise<AuthUser | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return null;

  const profile = await ensureProfileRow(session.user);
  if (profile.isBlocked) {
    await supabase.auth.signOut();
    return null;
  }
  return profile;
}

export async function registerWithSupabase(params: {
  fullName: string;
  phone: string;
  email: string;
  state: string;
  password: string;
  role: UserRole;
}): Promise<{ user: AuthUser | null; confirmationRequired: boolean; message: string }> {
  const cleanEmail = params.email.trim().toLowerCase();
  const userCode = generateRandom8DigitCode();

  const { data, error } = await supabase.auth.signUp({
    email: cleanEmail,
    password: params.password,
    options: {
      emailRedirectTo: `${window.location.origin}/login`,
      data: {
        full_name: params.fullName.trim(),
        phone: params.phone.trim(),
        state: params.state.trim(),
        role: params.role,
        user_code: userCode,
      },
    },
  });

  if (error) {
    throw new Error(error.message || 'Registration failed.');
  }
  if (!data.user) {
    throw new Error('Could not create account. Please try again.');
  }

  // Create row in public.profiles (handles both full and core schema gracefully)
  let mappedUser: AuthUser | null = null;
  try {
    const { error: extErr } = await supabase.from('profiles').upsert(
      {
        id: data.user.id,
        email: cleanEmail,
        full_name: params.fullName.trim(),
        phone: params.phone.trim(),
        role: params.role,
        state: params.state.trim(),
        user_code: userCode,
      },
      { onConflict: 'id' }
    );

    if (extErr && isMissingColumnError(extErr)) {
      await supabase.from('profiles').upsert(
        {
          id: data.user.id,
          email: cleanEmail,
          full_name: params.fullName.trim(),
          phone: params.phone.trim(),
          role: params.role,
        },
        { onConflict: 'id' }
      );
    }
  } catch {
    // If RLS blocks before email confirmation, trigger or first sign-in creates it
  }

  if (!data.session) {
    return {
      user: null,
      confirmationRequired: true,
      message:
        'Account created! Please check your email inbox to confirm your email address, then log in.',
    };
  }

  mappedUser = await ensureProfileRow(data.user, {
    fullName: params.fullName.trim(),
    phone: params.phone.trim(),
    state: params.state.trim(),
    role: params.role,
    userCode,
  });
  await recordLoginLog(mappedUser);

  return {
    user: mappedUser,
    confirmationRequired: false,
    message: `Registration successful! Your UID Number is ${mappedUser.userCode}.`,
  };
}

export async function loginWithSupabase(params: {
  emailOrPhone: string;
  password: string;
}): Promise<{ user: AuthUser; isAdmin: boolean }> {
  const identifier = params.emailOrPhone.trim();
  let targetEmail = identifier.toLowerCase();

  if (!identifier.includes('@')) {
    const digits = identifier.replace(/\D/g, '');
    const { data: matches } = await supabase
      .from('profiles')
      .select('email, phone')
      .or(`phone.eq.${identifier},phone.ilike.%${digits.slice(-8)}%`)
      .limit(1);

    const matchedEmail = (matches as Array<{ email?: string }> | null)?.[0]?.email;
    if (!matchedEmail) {
      throw new Error(
        'No account matched that phone number. Please sign in with your registered email address.'
      );
    }
    targetEmail = matchedEmail.toLowerCase();
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: targetEmail,
    password: params.password,
  });

  if (error || !data.user) {
    throw new Error(error?.message || 'Invalid email or password.');
  }

  const user = await ensureProfileRow(data.user);
  if (user.isBlocked) {
    await supabase.auth.signOut();
    throw new Error('Your account has been blocked by the administrator.');
  }

  await recordLoginLog(user);
  const isAdmin = user.email === ADMIN_EMAIL || Boolean(user.isAdmin);
  return { user, isAdmin };
}

export async function loginAdminWithSupabase(params: {
  email: string;
  password: string;
}): Promise<{ email: string }> {
  const cleanEmail = params.email.trim().toLowerCase();
  if (cleanEmail !== ADMIN_EMAIL) {
    throw new Error(`Only the authorized administrator (${ADMIN_EMAIL}) can sign in here.`);
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: cleanEmail,
    password: params.password,
  });

  if (error || !data.user) {
    throw new Error(error?.message || 'Invalid administrator email or password.');
  }

  await ensureProfileRow(data.user);
  return { email: cleanEmail };
}

export async function checkAdminSession(): Promise<{ isAdmin: boolean; email: string }> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return { isAdmin: false, email: '' };

  const email = (session.user.email || '').toLowerCase();
  if (email === ADMIN_EMAIL) {
    return { isAdmin: true, email };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', session.user.id)
    .maybeSingle();

  if (profile && (profile as { is_admin?: boolean }).is_admin) {
    return { isAdmin: true, email };
  }

  return { isAdmin: false, email: '' };
}

export async function logoutFromSupabase(): Promise<void> {
  await supabase.auth.signOut();
}

export async function requestPasswordResetWithSupabase(email: string): Promise<string> {
  const cleanEmail = email.trim().toLowerCase();
  const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) {
    throw new Error(error.message || 'Could not send password reset email.');
  }
  return `Password reset email sent to ${cleanEmail}. Check your inbox and open the link to set a new password.`;
}

export async function updatePasswordWithSupabase(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    throw new Error(error.message || 'Could not update password. Please open the reset link again.');
  }
}

// ==========================================
// MEDIA UPLOAD (SUPABASE STORAGE + COMPRESSED FALLBACK)
// ==========================================

export async function fileToCompressedDataUrl(file: File, maxWidth = 1280): Promise<string> {
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
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to process recorded media.'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

async function uploadBlobToStorage(blob: Blob, folder: string, ext: string): Promise<string | null> {
  try {
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;
    const { error } = await supabase.storage.from('media').upload(path, blob, {
      contentType: blob.type || 'image/jpeg',
      upsert: false,
    });
    if (error) return null;
    const { data } = supabase.storage.from('media').getPublicUrl(path);
    return data.publicUrl || null;
  } catch {
    return null;
  }
}

export async function uploadImageFile(file: File): Promise<string> {
  const dataUrl = await fileToCompressedDataUrl(file);
  const res = await fetch(dataUrl);
  const compressedBlob = await res.blob();
  const storageUrl = await uploadBlobToStorage(compressedBlob, 'listings', 'jpg');
  return storageUrl || dataUrl;
}

export async function uploadMediaBlob(blob: Blob): Promise<string> {
  const ext = blob.type.includes('webm') ? 'webm' : 'jpg';
  const storageUrl = await uploadBlobToStorage(blob, 'kyc', ext);
  if (storageUrl) return storageUrl;
  return blobToDataUrl(blob);
}

// ==========================================
// HOUSES (public.houses)
// ==========================================

export async function fetchApprovedHouses(filters: {
  q?: string;
  sort?: 'newest' | 'price_asc' | 'price_desc' | 'nearest';
  amenities?: string[];
  houseType?: string;
  state?: string;
  country?: string;
  minPrice?: number;
  maxPrice?: number;
  userLat?: number;
  userLng?: number;
  maxKm?: number;
}): Promise<HouseListing[]> {
  const [housesRes, profilesMap] = await Promise.all([
    supabase.from('houses').select('*').order('created_at', { ascending: false }),
    fetchProfilesMap(),
  ]);

  if (housesRes.error) {
    throw new Error(housesRes.error.message || 'Unable to load houses from Supabase.');
  }

  let items = ((housesRes.data || []) as Record<string, unknown>[])
    .map((row) => mapHouseRow(row, profilesMap))
    .filter((h) => h.approvalStatus === 'approved')
    .filter((h) => {
      const owner = h.agentId ? profilesMap.get(h.agentId) : undefined;
      return !owner?.isBlocked;
    });

  if (filters.q?.trim()) {
    const q = filters.q.trim().toLowerCase();
    items = items.filter((h) =>
      `${h.title} ${h.area} ${h.streetName} ${h.state} ${h.country} ${h.houseType} ${h.description} ${h.agentName}`
        .toLowerCase()
        .includes(q)
    );
  }

  if (filters.houseType && filters.houseType !== 'All') {
    items = items.filter((h) => h.houseType === filters.houseType);
  }
  if (filters.state && filters.state !== 'All') {
    items = items.filter((h) => h.state.toLowerCase().includes(filters.state!.toLowerCase()));
  }
  if (filters.country && filters.country !== 'All') {
    items = items.filter((h) => h.country.toLowerCase() === filters.country!.toLowerCase());
  }
  if (filters.minPrice && filters.minPrice > 0) {
    items = items.filter((h) => h.price >= filters.minPrice!);
  }
  if (filters.maxPrice && filters.maxPrice > 0) {
    items = items.filter((h) => h.price <= filters.maxPrice!);
  }
  if (filters.amenities && filters.amenities.length > 0) {
    items = items.filter((h) =>
      filters.amenities!.every((reqAm) => {
        if (h.amenities.includes(reqAm)) return true;
        const haystack = `${h.title} ${h.description}`.toLowerCase();
        if (reqAm === 'generator') return haystack.includes('generator') || haystack.includes('inverter') || haystack.includes('24/7 power');
        if (reqAm === 'parking') return haystack.includes('parking') || haystack.includes('compound');
        if (reqAm === 'security') return haystack.includes('security') || haystack.includes('gated');
        if (reqAm === 'water') return haystack.includes('water') || haystack.includes('borehole');
        if (reqAm === 'electricity') return haystack.includes('light') || haystack.includes('power') || haystack.includes('prepaid');
        return false;
      })
    );
  }

  if (filters.userLat != null && filters.userLng != null) {
    items = items.map((h) => ({
      ...h,
      distanceKm:
        h.lat != null && h.lng != null
          ? haversineKm(filters.userLat!, filters.userLng!, h.lat, h.lng)
          : null,
    }));

    if (filters.maxKm && filters.maxKm > 0) {
      items = items.filter((h) => h.distanceKm != null && h.distanceKm <= filters.maxKm!);
    }
  }

  if (filters.sort === 'price_asc') {
    items.sort((a, b) => a.price - b.price);
  } else if (filters.sort === 'price_desc') {
    items.sort((a, b) => b.price - a.price);
  } else if (filters.sort === 'nearest' && filters.userLat != null && filters.userLng != null) {
    items.sort((a, b) => {
      if (a.distanceKm == null && b.distanceKm == null) return 0;
      if (a.distanceKm == null) return 1;
      if (b.distanceKm == null) return -1;
      return a.distanceKm - b.distanceKm;
    });
  }

  return items;
}

export async function fetchHouseById(houseId: string): Promise<HouseListing> {
  const [houseRes, profilesMap] = await Promise.all([
    supabase.from('houses').select('*').eq('id', houseId).maybeSingle(),
    fetchProfilesMap(),
  ]);

  if (houseRes.error) {
    throw new Error(houseRes.error.message || 'Could not load house details.');
  }
  if (!houseRes.data) {
    throw new Error('This house listing could not be found.');
  }
  return mapHouseRow(houseRes.data as Record<string, unknown>, profilesMap);
}

export async function createHouseListing(
  user: AuthUser,
  payload: {
    title: string;
    houseNumber: string;
    streetName: string;
    area: string;
    state: string;
    country: string;
    price: number;
    inspectionFee: number;
    houseType: HouseType;
    phone: string;
    images: string[];
    amenities: string[];
    description: string;
    lat: number | null;
    lng: number | null;
  }
): Promise<HouseListing> {
  const locationText = [payload.houseNumber, payload.streetName, payload.area, payload.state, payload.country]
    .filter(Boolean)
    .join(', ');

  const fullRow = {
    agent_id: user.id,
    agent_code: user.userCode,
    agent_name: user.fullName,
    agent_verified: user.isVerified || user.kycStatus === 'approved',
    title: payload.title.trim(),
    location: locationText,
    house_number: payload.houseNumber.trim(),
    street_name: payload.streetName.trim(),
    area: payload.area.trim(),
    state: payload.state.trim(),
    country: payload.country.trim(),
    price: payload.price,
    inspection_fee: payload.inspectionFee,
    house_type: payload.houseType,
    bedrooms: bedroomsFromHouseType(payload.houseType),
    bathrooms: bedroomsFromHouseType(payload.houseType),
    phone: payload.phone.trim(),
    image_url: payload.images[0] || '',
    images: payload.images,
    amenities: payload.amenities,
    description: payload.description.trim(),
    status: 'Available',
    approval_status: 'pending',
    lat: payload.lat,
    lng: payload.lng,
  };

  const { data, error } = await supabase.from('houses').insert(fullRow).select('*').single();
  if (!error && data) {
    const map = new Map([[user.id, user]]);
    return mapHouseRow(data as Record<string, unknown>, map);
  }

  if (error && isMissingColumnError(error)) {
    const coreRow = {
      title: payload.title.trim(),
      location: `${payload.area.trim()}, ${payload.state.trim()}`,
      price: payload.price,
      image_url: payload.images[0] || '',
      description: `${payload.description.trim()}\n\nContact: ${payload.phone.trim()} · Address: ${locationText} · Type: ${payload.houseType}`,
      bedrooms: bedroomsFromHouseType(payload.houseType),
      bathrooms: bedroomsFromHouseType(payload.houseType),
    };
    const { data: coreData, error: coreErr } = await supabase
      .from('houses')
      .insert(coreRow)
      .select('*')
      .single();
    if (coreErr || !coreData) {
      throw new Error(coreErr?.message || 'Failed to publish house listing.');
    }
    const map = new Map([[user.id, user]]);
    return mapHouseRow(coreData as Record<string, unknown>, map);
  }

  throw new Error(error?.message || 'Failed to publish house listing.');
}

export async function updateHouseStatus(
  houseId: string,
  status: HouseStatus
): Promise<HouseListing> {
  const { data, error } = await supabase
    .from('houses')
    .update({ status })
    .eq('id', houseId)
    .select('*')
    .single();

  if (error) {
    if (isMissingColumnError(error)) {
      throw new Error(
        'Please run supabase_schema.sql in Supabase SQL Editor to enable status updates on houses.'
      );
    }
    throw new Error(error.message || 'Could not update house status.');
  }
  const profilesMap = await fetchProfilesMap();
  return mapHouseRow(data as Record<string, unknown>, profilesMap);
}

export async function updateHousePrice(houseId: string, price: number): Promise<HouseListing> {
  const { data, error } = await supabase
    .from('houses')
    .update({ price })
    .eq('id', houseId)
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message || 'Could not update house price.');
  }
  const profilesMap = await fetchProfilesMap();
  return mapHouseRow(data as Record<string, unknown>, profilesMap);
}

export async function fetchAgentHousesAndBookings(agentId: string): Promise<{
  houses: HouseListing[];
  inspections: InspectionBooking[];
}> {
  const profilesMap = await fetchProfilesMap();
  const { data: housesData, error: housesErr } = await supabase
    .from('houses')
    .select('*')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false });

  if (housesErr) {
    if (isMissingColumnError(housesErr)) {
      return { houses: [], inspections: [] };
    }
    throw new Error(housesErr.message || 'Could not load your listings.');
  }

  const houses = ((housesData || []) as Record<string, unknown>[]).map((r) =>
    mapHouseRow(r, profilesMap)
  );
  const houseIds = houses.map((h) => h.id);
  const housesById = new Map(
    houses.map((h) => [h.id, { title: h.title, location: `${h.area}, ${h.state}` }])
  );

  let inspections: InspectionBooking[] = [];
  if (houseIds.length > 0) {
    const { data: bookingsData } = await supabase
      .from('bookings')
      .select('*')
      .in('house_id', houseIds)
      .order('created_at', { ascending: false });
    if (bookingsData) {
      inspections = (bookingsData as Record<string, unknown>[]).map((b) =>
        mapBookingRow(b, housesById)
      );
    }
  }

  return { houses, inspections };
}

// ==========================================
// BOOKINGS (public.bookings)
// ==========================================

export async function createInspectionBooking(params: {
  house: HouseListing;
  user: AuthUser | null;
  buyerName: string;
  buyerPhone: string;
  preferredDate: string;
  preferredTime: string;
  notes: string;
}): Promise<string> {
  const checkInDate = params.preferredDate || new Date().toISOString().slice(0, 10);
  const fullPayload = {
    house_id: params.house.id,
    user_id: params.user?.id ?? null,
    agent_id: params.house.agentId || null,
    house_title: params.house.title,
    name: params.buyerName.trim(),
    phone: params.buyerPhone.trim(),
    check_in: checkInDate,
    check_out: checkInDate,
    preferred_date: params.preferredDate,
    preferred_time: params.preferredTime,
    notes: params.notes.trim(),
    status: 'pending',
  };

  const { error } = await supabase.from('bookings').insert(fullPayload);
  if (!error) {
    return 'Inspection booking saved! You can also message the landlord on WhatsApp to confirm viewing time.';
  }

  if (isMissingColumnError(error)) {
    const corePayload = {
      house_id: params.house.id,
      user_id: params.user?.id ?? null,
      name: params.buyerName.trim(),
      phone: params.buyerPhone.trim(),
      check_in: checkInDate,
      check_out: params.preferredTime ? `${checkInDate} ${params.preferredTime}` : checkInDate,
      status: 'pending',
    };
    const { error: coreErr } = await supabase.from('bookings').insert(corePayload);
    if (coreErr) {
      throw new Error(coreErr.message || 'Could not save booking to Supabase.');
    }
    return 'Inspection booking saved! You can also message the landlord on WhatsApp to confirm viewing time.';
  }

  throw new Error(error.message || 'Could not save booking.');
}

// ==========================================
// FAVORITES (public.favorites)
// ==========================================

export async function fetchFavoriteHouses(userId: string): Promise<{
  favoriteIds: string[];
  houses: HouseListing[];
}> {
  const { data, error } = await supabase
    .from('favorites')
    .select('house_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    if (isMissingTableError(error)) return { favoriteIds: [], houses: [] };
    return { favoriteIds: [], houses: [] };
  }

  const favoriteIds = ((data || []) as Array<{ house_id: string }>).map((r) => r.house_id);
  if (favoriteIds.length === 0) return { favoriteIds: [], houses: [] };

  const [housesRes, profilesMap] = await Promise.all([
    supabase.from('houses').select('*').in('id', favoriteIds),
    fetchProfilesMap(),
  ]);

  const houses = ((housesRes.data || []) as Record<string, unknown>[]).map((r) =>
    mapHouseRow(r, profilesMap)
  );
  return { favoriteIds, houses };
}

export async function toggleFavoriteHouse(
  userId: string,
  houseId: string,
  currentlySaved: boolean
): Promise<boolean> {
  if (currentlySaved) {
    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('user_id', userId)
      .eq('house_id', houseId);
    if (error) {
      if (isMissingTableError(error)) {
        throw new Error('Please run supabase_schema.sql in Supabase SQL Editor to enable Saved Favorites.');
      }
      throw new Error(error.message);
    }
    return false;
  }

  const { error } = await supabase.from('favorites').insert({ user_id: userId, house_id: houseId });
  if (error) {
    if (isMissingTableError(error)) {
      throw new Error('Please run supabase_schema.sql in Supabase SQL Editor to enable Saved Favorites.');
    }
    throw new Error(error.message);
  }
  return true;
}

// ==========================================
// KYC & AGENT UPGRADES
// ==========================================

export async function fetchMyKyc(userId: string): Promise<KycSubmission | null> {
  const { data, error } = await supabase
    .from('kyc_requests')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  const r = data as Record<string, unknown>;
  return {
    id: String(r.id),
    userId: String(r.user_id),
    idType: r.id_type === 'BVN' ? 'BVN' : 'NIN',
    idNumber: String(r.id_number || ''),
    idCardUrl: (r.id_card_url as string | null) ?? null,
    selfieUrl: String(r.selfie_url || ''),
    livenessVideoUrl: (r.liveness_video_url as string | null) ?? null,
    status: (r.status as KycSubmission['status']) || 'pending',
    rejectionReason: (r.rejection_reason as string | null) ?? null,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at || r.created_at),
  };
}

export async function submitKycRequest(params: {
  userId: string;
  idType: 'NIN' | 'BVN';
  idNumber: string;
  selfieUrl: string;
}): Promise<string> {
  const { error } = await supabase.from('kyc_requests').insert({
    user_id: params.userId,
    id_type: params.idType,
    id_number: params.idNumber,
    selfie_url: params.selfieUrl,
    status: 'pending',
  });

  if (error) {
    if (isMissingTableError(error)) {
      throw new Error('Please run supabase_schema.sql in Supabase SQL Editor to enable KYC verification.');
    }
    throw new Error(error.message || 'Failed to submit KYC.');
  }

  await supabase
    .from('profiles')
    .update({ kyc_status: 'pending', kyc_rejection_reason: null })
    .eq('id', params.userId);

  return 'KYC submitted successfully! Admin will review and verify your account shortly.';
}

export async function requestAgentUpgrade(
  user: AuthUser,
  note = 'Buyer requested switch to Agent / Landlord'
): Promise<{ user: AuthUser; message: string }> {
  const { error } = await supabase.from('agent_upgrade_requests').insert({
    user_id: user.id,
    note,
    status: 'pending',
  });

  if (error) {
    if (isMissingTableError(error)) {
      throw new Error('Please run supabase_schema.sql in Supabase SQL Editor to enable Agent Upgrades.');
    }
    throw new Error(error.message || 'Could not send upgrade request.');
  }

  await supabase
    .from('profiles')
    .update({ agent_upgrade_status: 'pending', agent_upgrade_reason: null })
    .eq('id', user.id);

  const refreshed = await getCurrentAuthUser();
  return {
    user: refreshed || { ...user, agentUpgradeStatus: 'pending' },
    message: 'Upgrade request sent! Admin will review and switch your account to Agent.',
  };
}

// ==========================================
// HOME PROPERTY ITEMS (TV, GAS, FAN, ETC.)
// ==========================================

export async function fetchApprovedHomeItems(filters: {
  q?: string;
  category?: string;
  condition?: string;
  state?: string;
  country?: string;
}): Promise<HomePropertyItem[]> {
  const { data, error } = await supabase
    .from('home_items')
    .select('*')
    .eq('approval_status', 'approved')
    .order('created_at', { ascending: false });

  if (error) {
    if (isMissingTableError(error)) return [];
    throw new Error(error.message || 'Failed to load home property items.');
  }

  let items = ((data || []) as Record<string, unknown>[]).map(mapItemRow);

  if (filters.q?.trim()) {
    const q = filters.q.trim().toLowerCase();
    items = items.filter((it) =>
      `${it.title} ${it.category} ${it.area} ${it.state} ${it.description}`.toLowerCase().includes(q)
    );
  }
  if (filters.category && filters.category !== 'All') {
    items = items.filter((it) => it.category === filters.category);
  }
  if (filters.condition && filters.condition !== 'All') {
    items = items.filter((it) => it.condition === filters.condition);
  }
  if (filters.state && filters.state !== 'All') {
    items = items.filter((it) => it.state.toLowerCase() === filters.state!.toLowerCase());
  }
  if (filters.country && filters.country !== 'All') {
    items = items.filter((it) => it.country.toLowerCase() === filters.country!.toLowerCase());
  }

  return items;
}

export async function fetchMyHomeItems(sellerId: string): Promise<HomePropertyItem[]> {
  const { data, error } = await supabase
    .from('home_items')
    .select('*')
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: false });

  if (error) {
    if (isMissingTableError(error)) return [];
    throw new Error(error.message);
  }
  return ((data || []) as Record<string, unknown>[]).map(mapItemRow);
}

export async function createHomeItem(
  user: AuthUser,
  payload: {
    title: string;
    category: HomePropertyCategory;
    condition: HomePropertyCondition;
    price: number;
    area: string;
    state: string;
    country: string;
    phone: string;
    images: string[];
    description: string;
  }
): Promise<{ item: HomePropertyItem; message: string }> {
  const { data, error } = await supabase
    .from('home_items')
    .insert({
      seller_id: user.id,
      seller_name: user.fullName,
      seller_code: user.userCode,
      title: payload.title.trim(),
      category: payload.category,
      condition: payload.condition,
      price: payload.price,
      area: payload.area.trim(),
      state: payload.state.trim(),
      country: payload.country.trim(),
      phone: payload.phone.trim(),
      images: payload.images,
      description: payload.description.trim(),
      status: 'Available',
      approval_status: 'pending',
    })
    .select('*')
    .single();

  if (error) {
    if (isMissingTableError(error)) {
      throw new Error('Please run supabase_schema.sql in Supabase SQL Editor to enable Home Property Market.');
    }
    throw new Error(error.message || 'Failed to post home property item.');
  }

  return {
    item: mapItemRow(data as Record<string, unknown>),
    message: 'Home property item posted! It will appear live once approved by Admin.',
  };
}

export async function updateHomeItemStatus(
  itemId: string,
  status: 'Available' | 'SOLD'
): Promise<HomePropertyItem> {
  const { data, error } = await supabase
    .from('home_items')
    .update({ status })
    .eq('id', itemId)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return mapItemRow(data as Record<string, unknown>);
}

export async function deleteHomeItem(itemId: string): Promise<void> {
  const { error } = await supabase.from('home_items').delete().eq('id', itemId);
  if (error) throw new Error(error.message);
}

// ==========================================
// REPORTS & ADMIN BROADCAST NOTES
// ==========================================

export async function fetchLatestNotes(): Promise<AdminNote[]> {
  const { data, error } = await supabase
    .from('admin_notes')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error || !data) return [];
  return (data as Array<{ id: string; message: string; created_at: string }>).map((n) => ({
    id: n.id,
    message: n.message,
    createdAt: n.created_at,
  }));
}

export async function submitUserReport(params: {
  reportedUid: string;
  reason: string;
  reporterName: string;
  reporterContact: string;
  listingType: 'general' | 'house' | 'item';
  listingId: string;
}): Promise<string> {
  const cleanUid = params.reportedUid.trim();
  const { data: matchedProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_code', cleanUid)
    .maybeSingle();

  const p = matchedProfile as Record<string, unknown> | null;
  const { error } = await supabase.from('user_reports').insert({
    reported_uid: cleanUid,
    reported_user_id: p?.id ? String(p.id) : null,
    reported_user_name: p?.full_name ? String(p.full_name) : `UID ${cleanUid}`,
    reported_user_email: p?.email ? String(p.email) : '',
    reported_user_phone: p?.phone ? String(p.phone) : '',
    reported_user_role: p?.role ? String(p.role) : '',
    reporter_name: params.reporterName.trim() || 'Anonymous',
    reporter_contact: params.reporterContact.trim(),
    listing_type: params.listingType,
    listing_id: params.listingId,
    reason: params.reason.trim(),
    status: 'open',
  });

  if (error) {
    if (isMissingTableError(error)) {
      throw new Error('Please run supabase_schema.sql in Supabase SQL Editor to enable user reports.');
    }
    throw new Error(error.message || 'Failed to submit report.');
  }
  return 'Report submitted to Glide Homes Admin for review.';
}

// ==========================================
// ADMIN DASHBOARD (ALL SUPABASE TABLES + BOOKINGS)
// ==========================================

export async function fetchAdminDashboardData(): Promise<AdminDashboardData> {
  const [
    profilesRes,
    housesRes,
    bookingsRes,
    kycRes,
    upgradesRes,
    itemsRes,
    reportsRes,
    notesRes,
    logsRes,
  ] = await Promise.all([
    supabase.from('profiles').select('*').order('created_at', { ascending: false }),
    supabase.from('houses').select('*').order('created_at', { ascending: false }),
    supabase.from('bookings').select('*').order('created_at', { ascending: false }),
    supabase.from('kyc_requests').select('*').order('created_at', { ascending: false }),
    supabase.from('agent_upgrade_requests').select('*').order('created_at', { ascending: false }),
    supabase.from('home_items').select('*').order('created_at', { ascending: false }),
    supabase.from('user_reports').select('*').order('created_at', { ascending: false }),
    supabase.from('admin_notes').select('*').order('created_at', { ascending: false }),
    supabase.from('login_logs').select('*').order('logged_in_at', { ascending: false }).limit(100),
  ]);

  const users = ((profilesRes.data || []) as Record<string, unknown>[]).map((r) =>
    mapProfileRow(r)
  );
  const profilesMap = new Map(users.map((u) => [u.id, u]));

  const houses = ((housesRes.data || []) as Record<string, unknown>[]).map((r) =>
    mapHouseRow(r, profilesMap)
  );
  const housesById = new Map(
    houses.map((h) => [h.id, { title: h.title, location: `${h.area}, ${h.state}` }])
  );

  const bookings = ((bookingsRes.data || []) as Record<string, unknown>[]).map((r) =>
    mapBookingRow(r, housesById)
  );

  const kycRequests: KycSubmission[] = (
    (kycRes.data || []) as Record<string, unknown>[]
  ).map((r) => {
    const u = profilesMap.get(String(r.user_id || ''));
    return {
      id: String(r.id),
      userId: String(r.user_id),
      userCode: u?.userCode,
      userFullName: u?.fullName || 'User',
      userEmail: u?.email || '',
      userPhone: u?.phone || '',
      userState: u?.state || '',
      idType: r.id_type === 'BVN' ? 'BVN' : 'NIN',
      idNumber: String(r.id_number || ''),
      idCardUrl: (r.id_card_url as string | null) ?? null,
      selfieUrl: String(r.selfie_url || ''),
      livenessVideoUrl: (r.liveness_video_url as string | null) ?? null,
      status: (r.status as KycSubmission['status']) || 'pending',
      rejectionReason: (r.rejection_reason as string | null) ?? null,
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at || r.created_at),
    };
  });

  const upgradeRequests: AgentUpgradeRequest[] = (
    (upgradesRes.data || []) as Record<string, unknown>[]
  ).map((r) => {
    const u = profilesMap.get(String(r.user_id || ''));
    return {
      id: String(r.id),
      userId: String(r.user_id),
      userCode: u?.userCode || '',
      userFullName: u?.fullName || 'Buyer',
      userEmail: u?.email || '',
      userPhone: u?.phone || '',
      userState: u?.state || '',
      note: String(r.note || ''),
      status: (r.status as AgentUpgradeRequest['status']) || 'pending',
      rejectionReason: (r.rejection_reason as string | null) ?? null,
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at || r.created_at),
    };
  });

  const homeItems = ((itemsRes.data || []) as Record<string, unknown>[]).map(mapItemRow);

  const reports: UserReport[] = ((reportsRes.data || []) as Record<string, unknown>[]).map(
    (r) => {
      const targetUser = r.reported_user_id ? profilesMap.get(String(r.reported_user_id)) : undefined;
      return {
        id: String(r.id),
        reportedUid: String(r.reported_uid || ''),
        reportedUserId: r.reported_user_id ? String(r.reported_user_id) : null,
        reportedUserName: String(r.reported_user_name || targetUser?.fullName || 'Unknown'),
        reportedUserEmail: String(r.reported_user_email || targetUser?.email || ''),
        reportedUserPhone: String(r.reported_user_phone || targetUser?.phone || ''),
        reportedUserRole: String(r.reported_user_role || targetUser?.role || ''),
        reportedUserBlocked: Boolean(targetUser?.isBlocked),
        reporterName: String(r.reporter_name || 'Anonymous'),
        reporterContact: String(r.reporter_contact || ''),
        listingType: (r.listing_type as UserReport['listingType']) || 'general',
        listingId: String(r.listing_id || ''),
        reason: String(r.reason || ''),
        status: (r.status as UserReport['status']) || 'open',
        adminActionNote: (r.admin_action_note as string | null) ?? null,
        createdAt: String(r.created_at),
        updatedAt: String(r.updated_at || r.created_at),
      };
    }
  );

  const notes: AdminNote[] = ((notesRes.data || []) as Array<{ id: string; message: string; created_at: string }>).map(
    (n) => ({
      id: n.id,
      message: n.message,
      createdAt: n.created_at,
    })
  );

  const loginLogs: LoginLogEntry[] = ((logsRes.data || []) as Record<string, unknown>[]).map(
    (l) => ({
      id: String(l.id),
      userId: String(l.user_id || ''),
      userCode: String(l.user_code || ''),
      fullName: String(l.full_name || ''),
      email: String(l.email || ''),
      role: l.role === 'agent' ? 'agent' : 'buyer',
      loggedInAt: String(l.logged_in_at || ''),
    })
  );

  return {
    stats: {
      totalHouses: houses.length,
      pendingHouses: houses.filter((h) => h.approvalStatus === 'pending').length,
      totalUsers: users.length,
      totalAgents: users.filter((u) => u.role === 'agent').length,
      pendingKyc: kycRequests.filter((k) => k.status === 'pending').length,
      pendingUpgrades: upgradeRequests.filter((u) => u.status === 'pending').length,
      totalItems: homeItems.length,
      totalBookings: bookings.length,
      openReports: reports.filter((r) => r.status === 'open').length,
    },
    users,
    kycRequests,
    upgradeRequests,
    houses,
    bookings,
    homeItems,
    reports,
    notes,
    loginLogs,
  };
}

export async function adminApproveKyc(kycId: string): Promise<string> {
  const { data: kyc, error } = await supabase
    .from('kyc_requests')
    .update({ status: 'approved', rejection_reason: null, updated_at: new Date().toISOString() })
    .eq('id', kycId)
    .select('user_id')
    .single();
  if (error) throw new Error(error.message);

  if (kyc?.user_id) {
    await supabase
      .from('profiles')
      .update({ kyc_status: 'approved', is_verified: true, kyc_rejection_reason: null })
      .eq('id', kyc.user_id);
  }
  return 'KYC approved and user marked Verified.';
}

export async function adminRejectKyc(kycId: string, reason: string): Promise<void> {
  const { data: kyc, error } = await supabase
    .from('kyc_requests')
    .update({ status: 'rejected', rejection_reason: reason, updated_at: new Date().toISOString() })
    .eq('id', kycId)
    .select('user_id')
    .single();
  if (error) throw new Error(error.message);

  if (kyc?.user_id) {
    await supabase
      .from('profiles')
      .update({ kyc_status: 'rejected', is_verified: false, kyc_rejection_reason: reason })
      .eq('id', kyc.user_id);
  }
}

export async function adminApproveUpgrade(upgradeId: string): Promise<string> {
  const { data: req, error } = await supabase
    .from('agent_upgrade_requests')
    .update({ status: 'approved', rejection_reason: null, updated_at: new Date().toISOString() })
    .eq('id', upgradeId)
    .select('user_id')
    .single();
  if (error) throw new Error(error.message);

  if (req?.user_id) {
    await supabase
      .from('profiles')
      .update({ role: 'agent', agent_upgrade_status: 'approved', agent_upgrade_reason: null })
      .eq('id', req.user_id);
  }
  return 'Buyer upgraded to Agent / Landlord!';
}

export async function adminRejectUpgrade(upgradeId: string, reason: string): Promise<void> {
  const { data: req, error } = await supabase
    .from('agent_upgrade_requests')
    .update({ status: 'rejected', rejection_reason: reason, updated_at: new Date().toISOString() })
    .eq('id', upgradeId)
    .select('user_id')
    .single();
  if (error) throw new Error(error.message);

  if (req?.user_id) {
    await supabase
      .from('profiles')
      .update({ agent_upgrade_status: 'rejected', agent_upgrade_reason: reason })
      .eq('id', req.user_id);
  }
}

export async function adminApproveHouse(houseId: string): Promise<void> {
  const { error } = await supabase
    .from('houses')
    .update({ approval_status: 'approved', rejection_reason: null })
    .eq('id', houseId);
  if (error) throw new Error(error.message);
}

export async function adminRejectHouse(houseId: string, reason: string): Promise<void> {
  const { error } = await supabase
    .from('houses')
    .update({ approval_status: 'rejected', rejection_reason: reason })
    .eq('id', houseId);
  if (error) throw new Error(error.message);
}

export async function adminDeleteHouse(houseId: string): Promise<void> {
  const { error } = await supabase.from('houses').delete().eq('id', houseId);
  if (error) throw new Error(error.message);
}

export async function adminUpdateBookingStatus(bookingId: string, status: string): Promise<void> {
  const { error } = await supabase.from('bookings').update({ status }).eq('id', bookingId);
  if (error) throw new Error(error.message);
}

export async function adminApproveHomeItem(itemId: string): Promise<void> {
  const { error } = await supabase
    .from('home_items')
    .update({ approval_status: 'approved', rejection_reason: null })
    .eq('id', itemId);
  if (error) throw new Error(error.message);
}

export async function adminRejectHomeItem(itemId: string, reason: string): Promise<void> {
  const { error } = await supabase
    .from('home_items')
    .update({ approval_status: 'rejected', rejection_reason: reason })
    .eq('id', itemId);
  if (error) throw new Error(error.message);
}

export async function adminToggleBlockUser(userId: string, blocked: boolean): Promise<string> {
  const { error } = await supabase
    .from('profiles')
    .update({ is_blocked: blocked })
    .eq('id', userId);
  if (error) throw new Error(error.message);
  return blocked ? 'User account blocked.' : 'User account unblocked.';
}

export async function adminPublishNote(message: string): Promise<string> {
  const { error } = await supabase.from('admin_notes').insert({ message: message.trim() });
  if (error) throw new Error(error.message);
  return 'Broadcast published to all users!';
}

export async function adminDeleteNote(id: string): Promise<void> {
  const { error } = await supabase.from('admin_notes').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function adminClearAllNotes(): Promise<void> {
  const { error } = await supabase.from('admin_notes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (error) throw new Error(error.message);
}

export async function adminLookupUserByUid(uid: string): Promise<{
  user: AuthUser;
  houseCount: number;
  itemCount: number;
  reportCount: number;
}> {
  const { data: profiles } = await supabase.from('profiles').select('*');
  const allUsers = ((profiles || []) as Record<string, unknown>[]).map((r) => mapProfileRow(r));
  const target = allUsers.find((u) => u.userCode === uid.trim());
  if (!target) {
    throw new Error('No user found with that UID number.');
  }

  const [housesRes, itemsRes, reportsRes] = await Promise.all([
    supabase.from('houses').select('id', { count: 'exact', head: true }).eq('agent_id', target.id),
    supabase.from('home_items').select('id', { count: 'exact', head: true }).eq('seller_id', target.id),
    supabase.from('user_reports').select('id', { count: 'exact', head: true }).eq('reported_uid', target.userCode),
  ]);

  return {
    user: target,
    houseCount: housesRes.count || 0,
    itemCount: itemsRes.count || 0,
    reportCount: reportsRes.count || 0,
  };
}

export async function adminSubmitReport(params: {
  reportedUid: string;
  reason: string;
  blockUser: boolean;
}): Promise<string> {
  const { data: profiles } = await supabase.from('profiles').select('*');
  const allUsers = ((profiles || []) as Record<string, unknown>[]).map((r) => mapProfileRow(r));
  const target = allUsers.find((u) => u.userCode === params.reportedUid.trim());

  const { error } = await supabase.from('user_reports').insert({
    reported_uid: params.reportedUid.trim(),
    reported_user_id: target?.id || null,
    reported_user_name: target?.fullName || `UID ${params.reportedUid.trim()}`,
    reported_user_email: target?.email || '',
    reported_user_phone: target?.phone || '',
    reported_user_role: target?.role || '',
    reporter_name: 'Glide Homes Admin',
    reporter_contact: ADMIN_EMAIL,
    listing_type: 'general',
    listing_id: '',
    reason: params.reason.trim(),
    status: params.blockUser ? 'resolved' : 'warned',
    admin_action_note: params.blockUser ? 'Blocked by Admin' : 'Admin warning logged',
  });
  if (error) throw new Error(error.message);

  if (params.blockUser && target) {
    await supabase.from('profiles').update({ is_blocked: true }).eq('id', target.id);
  }
  return params.blockUser
    ? `Warning recorded and UID ${params.reportedUid.trim()} blocked.`
    : `Warning recorded for UID ${params.reportedUid.trim()}.`;
}

export async function adminProcessReportAction(
  reportId: string,
  action: 'warn' | 'block' | 'resolve'
): Promise<string> {
  const { data: report, error: fetchErr } = await supabase
    .from('user_reports')
    .select('*')
    .eq('id', reportId)
    .single();
  if (fetchErr || !report) throw new Error(fetchErr?.message || 'Report not found.');

  const r = report as Record<string, unknown>;
  const nextStatus = action === 'warn' ? 'warned' : 'resolved';
  const note =
    action === 'warn'
      ? 'Official warning issued by Admin'
      : action === 'block'
      ? 'User account blocked by Admin'
      : 'Resolved by Admin';

  const { error } = await supabase
    .from('user_reports')
    .update({ status: nextStatus, admin_action_note: note, updated_at: new Date().toISOString() })
    .eq('id', reportId);
  if (error) throw new Error(error.message);

  if (action === 'block' && r.reported_user_id) {
    await supabase
      .from('profiles')
      .update({ is_blocked: true })
      .eq('id', String(r.reported_user_id));
  }

  return note;
}
