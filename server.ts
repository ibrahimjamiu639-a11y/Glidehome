import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import express from 'express';
import cookieParser from 'cookie-parser';
import Database from 'better-sqlite3';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const PORT = 3000;
const ADMIN_EMAIL = 'ibrahimjamiuakofe08@gmail.com';
const SESSION_COOKIE = 'glide_session';
const ADMIN_COOKIE = 'glide_mega_session';

const DATA_DIR = path.resolve('data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'glide_homes.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    user_code TEXT NOT NULL DEFAULT '',
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    state TEXT NOT NULL DEFAULT '',
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('buyer', 'agent')),
    is_verified INTEGER NOT NULL DEFAULT 1,
    is_blocked INTEGER NOT NULL DEFAULT 0,
    kyc_status TEXT NOT NULL DEFAULT 'unsubmitted' CHECK(kyc_status IN ('unsubmitted', 'pending', 'approved', 'rejected')),
    kyc_rejection_reason TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS login_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_code TEXT NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL,
    logged_in_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS password_resets (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires_at INTEGER NOT NULL,
    used INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS kyc_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    id_type TEXT NOT NULL CHECK(id_type IN ('NIN', 'BVN')),
    id_number TEXT NOT NULL,
    id_card_url TEXT NOT NULL,
    selfie_url TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
    rejection_reason TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS houses (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    house_number TEXT NOT NULL,
    street_name TEXT NOT NULL,
    area TEXT NOT NULL,
    state TEXT NOT NULL,
    country TEXT NOT NULL,
    price INTEGER NOT NULL,
    inspection_fee INTEGER NOT NULL DEFAULT 3000,
    house_type TEXT NOT NULL,
    phone TEXT NOT NULL,
    images_json TEXT NOT NULL,
    amenities_json TEXT NOT NULL DEFAULT '[]',
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Available' CHECK(status IN ('Available', 'SOLD OUT')),
    approval_status TEXT NOT NULL DEFAULT 'pending' CHECK(approval_status IN ('pending', 'approved', 'rejected')),
    rejection_reason TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS inspections (
    id TEXT PRIMARY KEY,
    house_id TEXT NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
    buyer_name TEXT NOT NULL,
    buyer_phone TEXT NOT NULL,
    preferred_date TEXT NOT NULL,
    preferred_time TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS admin_notes (
    id TEXT PRIMARY KEY,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS admin_credentials (
    email TEXT PRIMARY KEY,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS agent_upgrade_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    note TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
    rejection_reason TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS home_items (
    id TEXT PRIMARY KEY,
    seller_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    condition TEXT NOT NULL,
    price INTEGER NOT NULL,
    area TEXT NOT NULL,
    state TEXT NOT NULL,
    country TEXT NOT NULL,
    phone TEXT NOT NULL,
    images_json TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Available' CHECK(status IN ('Available', 'SOLD')),
    approval_status TEXT NOT NULL DEFAULT 'approved' CHECK(approval_status IN ('pending', 'approved', 'rejected')),
    rejection_reason TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS user_reports (
    id TEXT PRIMARY KEY,
    reported_uid TEXT NOT NULL,
    reported_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    reporter_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    reporter_name TEXT NOT NULL DEFAULT '',
    reporter_contact TEXT NOT NULL DEFAULT '',
    listing_type TEXT NOT NULL DEFAULT 'general' CHECK(listing_type IN ('general', 'house', 'item')),
    listing_id TEXT NOT NULL DEFAULT '',
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'warned', 'resolved')),
    admin_action_note TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS favorites (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    house_id TEXT NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    PRIMARY KEY (user_id, house_id)
  );
`);

function ensureColumn(table: string, column: string, definition: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

ensureColumn('users', 'user_code', "TEXT NOT NULL DEFAULT ''");
ensureColumn('users', 'is_blocked', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('users', 'state', "TEXT NOT NULL DEFAULT ''");
ensureColumn('users', 'normalized_phone', "TEXT NOT NULL DEFAULT ''");
ensureColumn('users', 'password_fingerprint', "TEXT NOT NULL DEFAULT ''");
ensureColumn('users', 'agent_upgrade_status', "TEXT NOT NULL DEFAULT 'none'");
ensureColumn('users', 'agent_upgrade_reason', 'TEXT');
ensureColumn('houses', 'amenities_json', "TEXT NOT NULL DEFAULT '[]'");
ensureColumn('houses', 'approval_status', "TEXT NOT NULL DEFAULT 'pending'");
ensureColumn('houses', 'rejection_reason', 'TEXT');
ensureColumn('houses', 'inspection_fee', 'INTEGER NOT NULL DEFAULT 3000');
ensureColumn('houses', 'lat', 'REAL');
ensureColumn('houses', 'lng', 'REAL');
ensureColumn('kyc_requests', 'liveness_video_url', 'TEXT');

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 13 && digits.startsWith('234')) {
    return `0${digits.slice(3)}`;
  }
  if (digits.length === 10 && /^[789]/.test(digits)) {
    return `0${digits}`;
  }
  return digits;
}

function generateUserCode(_fullName?: string): string {
  for (let attempt = 0; attempt < 25; attempt++) {
    const candidate = String(crypto.randomInt(10000000, 99999999));
    const exists = db.prepare('SELECT 1 FROM users WHERE user_code = ?').get(candidate);
    if (!exists) return candidate;
  }
  return String(Date.now()).slice(-8) + String(crypto.randomInt(10, 99));
}

const usersWithoutCode = db.prepare("SELECT id, full_name FROM users WHERE user_code = '' OR user_code IS NULL").all() as Array<{ id: string; full_name: string }>;
for (const u of usersWithoutCode) {
  db.prepare('UPDATE users SET user_code = ? WHERE id = ?').run(generateUserCode(u.full_name), u.id);
}

const usersWithoutNormPhone = db
  .prepare("SELECT id, phone FROM users WHERE normalized_phone = '' OR normalized_phone IS NULL")
  .all() as Array<{ id: string; phone: string }>;
for (const u of usersWithoutNormPhone) {
  const norm = normalizePhone(u.phone || '');
  if (norm) {
    db.prepare('UPDATE users SET normalized_phone = ? WHERE id = ?').run(norm, u.id);
  }
}

function getSessionSecret(): string {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16) {
    return process.env.SESSION_SECRET;
  }
  const secretPath = path.join(DATA_DIR, '.session_secret');
  if (fs.existsSync(secretPath)) {
    return fs.readFileSync(secretPath, 'utf8').trim();
  }
  const generated = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(secretPath, generated, { mode: 0o600 });
  return generated;
}

const SESSION_SECRET = getSessionSecret();

function computePasswordFingerprint(password: string): string {
  return crypto.createHmac('sha256', SESSION_SECRET).update(password).digest('hex');
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, key] = stored.split(':');
  if (!salt || !key) return false;
  const keyBuf = Buffer.from(key, 'hex');
  const derived = crypto.scryptSync(password, salt, 64);
  if (keyBuf.length !== derived.length) return false;
  return crypto.timingSafeEqual(keyBuf, derived);
}

function signToken(payload: Record<string, unknown>): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verifyToken(token: string | undefined): Record<string, unknown> | null {
  if (!token || !token.includes('.')) return null;
  const [data, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as Record<string, unknown>;
    if (typeof parsed.exp === 'number' && parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function sendEmail(to: string, subject: string, html: string, text: string): Promise<boolean> {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    return false;
  }
  try {
    const transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT || 587) === 465,
      auth: { user, pass },
    });
    await transporter.sendMail({
      from: process.env.SMTP_FROM || `Glide Homes <${user}>`,
      to,
      subject,
      text,
      html,
    });
    return true;
  } catch (err) {
    console.error('Failed to send SMTP email:', err);
    return false;
  }
}

function mapUser(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    userCode: String(row.user_code || ''),
    fullName: String(row.full_name),
    phone: String(row.phone),
    email: String(row.email),
    state: String(row.state || ''),
    role: String(row.role) as 'buyer' | 'agent',
    isVerified: Number(row.is_verified) === 1,
    isBlocked: Number(row.is_blocked || 0) === 1,
    kycStatus: String(row.kyc_status) as 'unsubmitted' | 'pending' | 'approved' | 'rejected',
    kycRejectionReason: row.kyc_rejection_reason ? String(row.kyc_rejection_reason) : null,
    agentUpgradeStatus: String(row.agent_upgrade_status || 'none') as 'none' | 'pending' | 'approved' | 'rejected',
    agentUpgradeReason: row.agent_upgrade_reason ? String(row.agent_upgrade_reason) : null,
    createdAt: String(row.created_at),
  };
}

function mapHomeItem(row: Record<string, unknown>) {
  let images: string[] = [];
  try {
    images = JSON.parse(String(row.images_json));
  } catch {
    images = [];
  }
  return {
    id: String(row.id),
    sellerId: String(row.seller_id),
    sellerName: row.seller_name ? String(row.seller_name) : 'Glide Seller',
    sellerCode: row.seller_code ? String(row.seller_code) : undefined,
    title: String(row.title),
    category: String(row.category),
    condition: String(row.condition),
    price: Number(row.price),
    area: String(row.area),
    state: String(row.state),
    country: String(row.country),
    phone: String(row.phone),
    images,
    description: String(row.description),
    status: String(row.status) as 'Available' | 'SOLD',
    approvalStatus: String(row.approval_status || 'approved') as 'pending' | 'approved' | 'rejected',
    rejectionReason: row.rejection_reason ? String(row.rejection_reason) : null,
    createdAt: String(row.created_at),
  };
}

function mapHouse(row: Record<string, unknown>) {
  let images: string[] = [];
  let amenities: string[] = [];
  try {
    images = JSON.parse(String(row.images_json));
  } catch {
    images = [];
  }
  try {
    amenities = JSON.parse(String(row.amenities_json || '[]'));
  } catch {
    amenities = [];
  }
  return {
    id: String(row.id),
    agentId: String(row.agent_id),
    agentCode: row.agent_code ? String(row.agent_code) : undefined,
    agentName: row.agent_name ? String(row.agent_name) : 'Verified Landlord',
    agentVerified: Number(row.agent_verified || 0) === 1 || String(row.agent_kyc_status) === 'approved',
    title: String(row.title),
    houseNumber: String(row.house_number),
    streetName: String(row.street_name),
    area: String(row.area),
    state: String(row.state),
    country: String(row.country),
    price: Number(row.price),
    inspectionFee: Number(row.inspection_fee || 3000),
    houseType: String(row.house_type),
    phone: String(row.phone),
    images,
    amenities,
    description: String(row.description),
    status: String(row.status) as 'Available' | 'SOLD OUT',
    approvalStatus: String(row.approval_status || 'pending') as 'pending' | 'approved' | 'rejected',
    rejectionReason: row.rejection_reason ? String(row.rejection_reason) : null,
    lat: row.lat !== null && row.lat !== undefined && Number.isFinite(Number(row.lat)) ? Number(row.lat) : null,
    lng: row.lng !== null && row.lng !== undefined && Number.isFinite(Number(row.lng)) ? Number(row.lng) : null,
    createdAt: String(row.created_at),
  };
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function getMapsApiKey(): string {
  return process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || '';
}

class MapsQuotaError extends Error {
  quotaExceeded = true;
  constructor(message: string) {
    super(message);
  }
}

async function geocodeAddressServer(address: string): Promise<{
  lat: number;
  lng: number;
  formattedAddress: string;
  state?: string;
  area?: string;
  country?: string;
} | null> {
  const apiKey = getMapsApiKey();
  if (!apiKey || !address.trim()) return null;

  // 1. Try Geocoding API v4 (first full string, then without trailing country if empty)
  const candidates = [address.trim()];
  const strippedCountry = address.trim().replace(/,\s*nigeria$/i, '').trim();
  if (strippedCountry && strippedCountry !== address.trim()) {
    candidates.push(strippedCountry);
  }

  for (const query of candidates) {
    const v4Url = `https://geocode.googleapis.com/v4/geocode/address/${encodeURIComponent(query)}?regionCode=NG&languageCode=en`;
    const v4Res = await fetch(v4Url, {
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'results.location,results.formattedAddress,results.addressComponents',
        'X-Goog-Maps-Solution-ID': 'gmp_mcp_codeassist_v1_aistudio',
      },
    });

    if (v4Res.status === 429) {
      throw new MapsQuotaError('Google Maps Geocoding quota reached.');
    }
    const v4Json = (await v4Res.json().catch(() => ({}))) as {
      error?: { status?: string; message?: string };
      results?: Array<{
        location?: { latitude?: number; longitude?: number };
        formattedAddress?: string;
        addressComponents?: Array<{ longText?: string; types?: string[] }>;
      }>;
    };
    if (v4Json?.error?.status === 'RESOURCE_EXHAUSTED') {
      throw new MapsQuotaError(v4Json.error.message || 'Google Maps Geocoding quota reached.');
    }
    const first = v4Json?.results?.[0];
    if (v4Res.ok && first?.location?.latitude !== undefined && first?.location?.longitude !== undefined) {
      const comps = first.addressComponents || [];
      const stateComp = comps.find((c) => c.types?.includes('administrative_area_level_1'))?.longText;
      const areaComp = comps.find(
        (c) => c.types?.includes('sublocality') || c.types?.includes('locality') || c.types?.includes('neighborhood')
      )?.longText;
      const countryComp = comps.find((c) => c.types?.includes('country'))?.longText;
      return {
        lat: Number(first.location.latitude),
        lng: Number(first.location.longitude),
        formattedAddress: first.formattedAddress || query,
        state: stateComp,
        area: areaComp,
        country: countryComp,
      };
    }
  }

  // 2. Fallback to Places API (New) Text Search for neighborhood/area queries
  const placesRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.formattedAddress,places.location,places.addressComponents',
      'X-Goog-Maps-Solution-ID': 'gmp_mcp_codeassist_v1_aistudio',
    },
    body: JSON.stringify({
      textQuery: address.trim(),
      languageCode: 'en',
    }),
  });

  if (placesRes.status === 429) {
    throw new MapsQuotaError('Google Maps Places quota reached.');
  }
  const placesJson = (await placesRes.json().catch(() => ({}))) as {
    error?: { status?: string; message?: string };
    places?: Array<{
      formattedAddress?: string;
      location?: { latitude?: number; longitude?: number };
      addressComponents?: Array<{ longText?: string; types?: string[] }>;
    }>;
  };
  if (placesJson?.error?.status === 'RESOURCE_EXHAUSTED') {
    throw new MapsQuotaError(placesJson.error.message || 'Google Maps Places quota reached.');
  }

  const place = placesJson?.places?.[0];
  if (!placesRes.ok || place?.location?.latitude === undefined || place?.location?.longitude === undefined) {
    return null;
  }

  const comps = place.addressComponents || [];
  const stateComp = comps.find((c) => c.types?.includes('administrative_area_level_1'))?.longText;
  const areaComp = comps.find(
    (c) => c.types?.includes('sublocality') || c.types?.includes('locality') || c.types?.includes('neighborhood')
  )?.longText;
  const countryComp = comps.find((c) => c.types?.includes('country'))?.longText;
  return {
    lat: Number(place.location.latitude),
    lng: Number(place.location.longitude),
    formattedAddress: place.formattedAddress || address,
    state: stateComp,
    area: areaComp,
    country: countryComp,
  };
}

async function reverseGeocodeServer(lat: number, lng: number): Promise<{
  lat: number;
  lng: number;
  formattedAddress: string;
  state?: string;
  area?: string;
  country?: string;
} | null> {
  const apiKey = getMapsApiKey();
  if (!apiKey) return null;

  const v4Url = `https://geocode.googleapis.com/v4/geocode/location/${lat},${lng}?languageCode=en`;
  const res = await fetch(v4Url, {
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'results.formattedAddress,results.addressComponents',
      'X-Goog-Maps-Solution-ID': 'gmp_mcp_codeassist_v1_aistudio',
    },
  });
  if (res.status === 429) {
    throw new MapsQuotaError('Google Maps Geocoding quota reached.');
  }
  const data = (await res.json().catch(() => ({}))) as {
    error?: { status?: string; message?: string };
    results?: Array<{
      formattedAddress?: string;
      addressComponents?: Array<{ longText?: string; types?: string[] }>;
    }>;
  };
  if (data?.error?.status === 'RESOURCE_EXHAUSTED') {
    throw new MapsQuotaError(data.error.message || 'Google Maps Geocoding quota reached.');
  }
  const hit = data.results?.[0];
  if (!res.ok || !hit) return null;
  const comps = hit.addressComponents || [];
  const stateComp = comps.find((c) => c.types?.includes('administrative_area_level_1'))?.longText;
  const areaComp = comps.find(
    (c) => c.types?.includes('sublocality') || c.types?.includes('locality') || c.types?.includes('neighborhood')
  )?.longText;
  const countryComp = comps.find((c) => c.types?.includes('country'))?.longText;
  return {
    lat,
    lng,
    formattedAddress: hit.formattedAddress || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
    state: stateComp,
    area: areaComp,
    country: countryComp,
  };
}

function extractBearerToken(req: express.Request): string | undefined {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  return req.cookies?.[SESSION_COOKIE];
}

function extractAdminToken(req: express.Request): string | undefined {
  const headerToken = req.headers['x-admin-token'];
  if (typeof headerToken === 'string' && headerToken.trim()) {
    return headerToken.trim();
  }
  return req.cookies?.[ADMIN_COOKIE];
}

function getAuthenticatedUser(req: express.Request) {
  const token = extractBearerToken(req);
  const payload = verifyToken(token);
  if (!payload || typeof payload.userId !== 'string') return null;
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.userId) as Record<string, unknown> | undefined;
  if (!row) return null;
  const user = mapUser(row);
  if (user.isBlocked) return null;
  return user;
}

function isAuthenticatedAdmin(req: express.Request): boolean {
  const token = extractAdminToken(req);
  const payload = verifyToken(token);
  return Boolean(payload && payload.role === 'admin' && payload.email === ADMIN_EMAIL);
}

function getStoredAdminCredential() {
  return db.prepare('SELECT * FROM admin_credentials WHERE email = ?').get(ADMIN_EMAIL) as
    | { email: string; password_hash: string; created_at: string; updated_at: string }
    | undefined;
}

function authenticateOrInitializeAdmin(password: string): {
  ok: boolean;
  error?: string;
  status?: number;
  firstTimeConfigured?: boolean;
} {
  const envPassword = process.env.ADMIN_PASSWORD;
  const storedCred = getStoredAdminCredential();

  if (!envPassword && !storedCred) {
    if (password.length < 6) {
      return {
        ok: false,
        status: 400,
        error: 'Password must be at least 6 characters.',
      };
    }
    const now = new Date().toISOString();
    db.prepare(
      'INSERT OR IGNORE INTO admin_credentials (email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?)'
    ).run(ADMIN_EMAIL, hashPassword(password), now, now);

    // Confirm stored hash matches in case of concurrent first-time initialization
    const saved = getStoredAdminCredential();
    if (!saved || !verifyPassword(password, saved.password_hash)) {
      return { ok: false, status: 401, error: 'Invalid email/phone or password.' };
    }
    return { ok: true, firstTimeConfigured: true };
  }

  let valid = false;
  if (storedCred && verifyPassword(password, storedCred.password_hash)) {
    valid = true;
  }
  if (!valid && envPassword) {
    const passBuf = Buffer.from(password);
    const expectedBuf = Buffer.from(envPassword);
    if (passBuf.length === expectedBuf.length && crypto.timingSafeEqual(passBuf, expectedBuf)) {
      valid = true;
    }
  }
  if (!valid) {
    return { ok: false, status: 401, error: 'Invalid email/phone or password.' };
  }
  return { ok: true, firstTimeConfigured: false };
}

function setCookie(req: express.Request, res: express.Response, name: string, value: string, maxAgeMs: number) {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.cookie(name, value, {
    httpOnly: true,
    sameSite: isHttps ? 'none' : 'lax',
    secure: isHttps,
    maxAge: maxAgeMs,
    path: '/',
  });
}

function recordLoginLog(user: ReturnType<typeof mapUser>) {
  db.prepare(`
    INSERT INTO login_logs (id, user_id, user_code, full_name, email, role, logged_in_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(crypto.randomUUID(), user.id, user.userCode, user.fullName, user.email, user.role, new Date().toISOString());
}

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '40mb' }));
  app.use(cookieParser());
  app.use((_req, res, next) => {
    res.setHeader('Permissions-Policy', 'geolocation=*, camera=*, microphone=*');
    res.setHeader('Feature-Policy', 'geolocation *; camera *; microphone *');
    next();
  });

  app.use('/uploads', express.static(UPLOADS_DIR));
  app.use('/src/assets/images', express.static(path.resolve('src/assets/images')));
  app.use('/mediapipe/wasm', express.static(path.resolve('node_modules/@mediapipe/tasks-vision/wasm')));
  app.get('/mediapipe/face_landmarker.task', (_req, res) => {
    const modelPath = path.resolve('data/models/face_landmarker.task');
    if (!fs.existsSync(modelPath)) {
      return res.status(404).json({ error: 'Face landmarker model not found.' });
    }
    res.sendFile(modelPath);
  });

  // --- PUBLIC ADMIN NOTES / BROADCASTS ---
  app.get('/api/notes/latest', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const notes = db
      .prepare('SELECT id, message, created_at FROM admin_notes ORDER BY created_at DESC LIMIT 5')
      .all() as Array<{ id: string; message: string; created_at: string }>;
    res.json({
      notes: notes.map((n) => ({ id: n.id, message: n.message, createdAt: n.created_at })),
    });
  });

  // --- AUTH ROUTES ---
  app.get('/api/auth/me', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const user = getAuthenticatedUser(req);
    res.json({ user });
  });

  app.post('/api/auth/register', (req, res) => {
    try {
      const { fullName, phone, email, state, password, confirmPassword, role } = req.body as Record<string, string>;
      if (!fullName?.trim() || !phone?.trim() || !email?.trim() || !password) {
        return res.status(400).json({
          error: 'Name or Company Name, phone number, email address, and password are all required.',
        });
      }
      const cleanName = fullName.trim();
      if (cleanName.length < 2 || cleanName.length > 120) {
        return res.status(400).json({
          error: 'Name or Company Name must be between 2 and 120 characters.',
        });
      }
      const cleanState = (state || 'Lagos').trim();
      if (cleanState.length < 2 || cleanState.length > 80) {
        return res.status(400).json({ error: 'Please select or enter a valid State.' });
      }
      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters.' });
      }
      if (password !== confirmPassword) {
        return res.status(400).json({ error: 'Passwords do not match.' });
      }
      if (role !== 'buyer' && role !== 'agent') {
        return res.status(400).json({ error: 'Please choose Buyer or Agent / Landlord.' });
      }

      const cleanEmail = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || cleanEmail.length > 180) {
        return res.status(400).json({ error: 'Please enter a valid email address.' });
      }
      if (cleanEmail === ADMIN_EMAIL) {
        return res.status(403).json({
          error: 'This email is reserved for private administration. Please sign in on the Login page.',
        });
      }
      const normalizedPhone = normalizePhone(phone.trim());
      if (normalizedPhone.length < 7 || phone.trim().length > 30) {
        return res.status(400).json({ error: 'Please enter a valid phone number.' });
      }
      const passwordFingerprint = computePasswordFingerprint(password);

      const existingEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
      if (existingEmail) {
        return res.status(409).json({ error: 'An account with this email already exists. Please login.' });
      }

      const existingPhone = db
        .prepare("SELECT id FROM users WHERE normalized_phone = ? AND normalized_phone != ''")
        .get(normalizedPhone);
      if (existingPhone) {
        return res.status(409).json({
          error: 'An account with this phone number already exists. Only one account is allowed per person.',
        });
      }

      const existingPassword = db
        .prepare("SELECT id FROM users WHERE password_fingerprint = ? AND password_fingerprint != ''")
        .get(passwordFingerprint);
      if (existingPassword) {
        return res.status(409).json({
          error: 'This password is already linked to an existing account. Multiple accounts cannot be created by one person.',
        });
      }

      const id = crypto.randomUUID();
      const userCode = generateUserCode(fullName);
      const now = new Date().toISOString();
      const passwordHash = hashPassword(password);

      db.prepare(`
        INSERT INTO users (
          id, user_code, full_name, phone, normalized_phone, email, state,
          password_hash, password_fingerprint, role, is_verified, is_blocked,
          kyc_status, agent_upgrade_status, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, 'unsubmitted', 'none', ?)
      `).run(
        id,
        userCode,
        fullName.trim(),
        phone.trim(),
        normalizedPhone,
        cleanEmail,
        state.trim(),
        passwordHash,
        passwordFingerprint,
        role,
        now
      );

      const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as Record<string, unknown>;
      const user = mapUser(userRow);
      recordLoginLog(user);

      const token = signToken({ userId: user.id, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 });
      setCookie(req, res, SESSION_COOKIE, token, 7 * 24 * 60 * 60 * 1000);

      res.status(201).json({
        user,
        token,
        message: `Account created successfully! Your UID Number is ${user.userCode}.`,
      });
    } catch (error) {
      console.error('Register error:', error);
      res.status(500).json({ error: 'Registration failed. Please try again.' });
    }
  });

  app.post('/api/auth/login', (req, res) => {
    try {
      const { email, password } = req.body as Record<string, string>;
      if (!email?.trim() || !password) {
        return res.status(400).json({ error: 'Email or phone number and password are required.' });
      }
      const rawIdentifier = email.trim();
      const cleanEmail = rawIdentifier.toLowerCase();
      const normPhone = normalizePhone(rawIdentifier);

      if (cleanEmail === ADMIN_EMAIL) {
        const authResult = authenticateOrInitializeAdmin(password);
        if (!authResult.ok) {
          return res.status(authResult.status || 401).json({
            error: authResult.error || 'Invalid email/phone or password.',
          });
        }
        const adminToken = signToken({
          role: 'admin',
          email: ADMIN_EMAIL,
          exp: Date.now() + 24 * 60 * 60 * 1000,
        });
        setCookie(req, res, ADMIN_COOKIE, adminToken, 24 * 60 * 60 * 1000);
        return res.json({
          isAdmin: true,
          adminToken,
          firstTimeConfigured: Boolean(authResult.firstTimeConfigured),
          redirectTo: '/admin-portal',
        });
      }

      let userRow = db.prepare('SELECT * FROM users WHERE email = ?').get(cleanEmail) as
        | Record<string, unknown>
        | undefined;
      if (!userRow && normPhone.length >= 7) {
        userRow = db
          .prepare("SELECT * FROM users WHERE normalized_phone = ? AND normalized_phone != ''")
          .get(normPhone) as Record<string, unknown> | undefined;
      }

      if (!userRow || !verifyPassword(password, String(userRow.password_hash))) {
        return res.status(401).json({ error: 'Invalid email/phone or password.' });
      }

      if (Number(userRow.is_blocked || 0) === 1) {
        return res.status(403).json({
          error: 'Your account has been blocked by the administrator. Contact WhatsApp Support +2347025940054.',
        });
      }

      if (Number(userRow.is_verified) !== 1) {
        db.prepare('UPDATE users SET is_verified = 1 WHERE id = ?').run(String(userRow.id));
        userRow.is_verified = 1;
      }

      if (!userRow.password_fingerprint) {
        const fp = computePasswordFingerprint(password);
        db.prepare('UPDATE users SET password_fingerprint = ? WHERE id = ?').run(fp, String(userRow.id));
      }

      const user = mapUser(userRow);
      recordLoginLog(user);

      const token = signToken({ userId: user.id, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 });
      setCookie(req, res, SESSION_COOKIE, token, 7 * 24 * 60 * 60 * 1000);
      res.json({ user, token });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed.' });
    }
  });

  app.post('/api/auth/forgot-password', async (req, res) => {
    try {
      const { email } = req.body as Record<string, string>;
      if (!email?.trim()) {
        return res.status(400).json({ error: 'Email is required.' });
      }
      const cleanEmail = email.trim().toLowerCase();
      if (cleanEmail === ADMIN_EMAIL) {
        return res.json({ message: 'If an account exists for that email, a password reset link has been sent.' });
      }
      const userRow = db.prepare('SELECT * FROM users WHERE email = ?').get(cleanEmail) as Record<string, unknown> | undefined;
      if (!userRow) {
        return res.json({ message: 'If an account exists for that email, a password reset link has been sent.' });
      }

      const token = crypto.randomBytes(24).toString('hex');
      const expiresAt = Date.now() + 60 * 60 * 1000;
      db.prepare('INSERT INTO password_resets (id, email, token, expires_at, used, created_at) VALUES (?, ?, ?, ?, 0, ?)').run(
        crypto.randomUUID(),
        cleanEmail,
        token,
        expiresAt,
        new Date().toISOString()
      );

      const origin = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
      const resetPath = `/reset-password?token=${token}`;
      const resetUrl = `${origin.replace(/\/$/, '')}${resetPath}`;

      const sent = await sendEmail(
        cleanEmail,
        'Glide Homes — Reset Your Password',
        `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;">
          <h2 style="color:#0B7A3E;">Reset Your Password</h2>
          <p>Click the link below to set a new password for your Glide Homes account:</p>
          <p><a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#0B7A3E;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Create New Password</a></p>
          <p style="color:#64748B;font-size:12px;">Link expires in 1 hour.</p>
        </div>`,
        `Reset your Glide Homes password using this link: ${resetUrl}`
      );

      res.json({
        message: 'If an account exists for that email, a password reset link has been sent.',
        emailDispatched: sent,
        devResetPath: sent ? undefined : resetPath,
      });
    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({ error: 'Failed to process password reset request.' });
    }
  });

  app.post('/api/auth/reset-password', (req, res) => {
    try {
      const { token, password, confirmPassword } = req.body as Record<string, string>;
      if (!token || !password) {
        return res.status(400).json({ error: 'Reset token and new password are required.' });
      }
      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters.' });
      }
      if (password !== confirmPassword) {
        return res.status(400).json({ error: 'Passwords do not match.' });
      }

      const resetRow = db
        .prepare('SELECT * FROM password_resets WHERE token = ? AND used = 0')
        .get(token) as Record<string, unknown> | undefined;

      if (!resetRow || Number(resetRow.expires_at) < Date.now()) {
        return res.status(400).json({ error: 'Reset link is invalid or has expired.' });
      }

      const resetEmail = String(resetRow.email);
      if (resetEmail.toLowerCase() === ADMIN_EMAIL) {
        return res.status(403).json({ error: 'Admin password cannot be reset or changed.' });
      }
      const fp = computePasswordFingerprint(password);
      const conflict = db
        .prepare("SELECT id FROM users WHERE password_fingerprint = ? AND password_fingerprint != '' AND email != ?")
        .get(fp, resetEmail);
      if (conflict) {
        return res.status(409).json({
          error: 'Please choose a unique password not used on another account.',
        });
      }

      const newHash = hashPassword(password);
      db.prepare('UPDATE users SET password_hash = ?, password_fingerprint = ?, is_verified = 1 WHERE email = ?').run(
        newHash,
        fp,
        resetEmail
      );
      db.prepare('UPDATE password_resets SET used = 1 WHERE id = ?').run(String(resetRow.id));

      res.json({ message: 'Password updated successfully. You can now login.' });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({ error: 'Failed to reset password.' });
    }
  });

  app.post('/api/auth/request-agent-upgrade', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ error: 'Please login first.' });
    if (user.role === 'agent') {
      return res.status(400).json({ error: 'Your account is already an Agent / Landlord.' });
    }
    const existingPending = db
      .prepare("SELECT id FROM agent_upgrade_requests WHERE user_id = ? AND status = 'pending'")
      .get(user.id);
    if (existingPending) {
      return res.status(409).json({ error: 'Your upgrade request is already pending admin review.' });
    }

    const note = String((req.body as { note?: string })?.note || '').trim() || 'Requesting switch from Buyer to Agent / Landlord';
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO agent_upgrade_requests (id, user_id, note, status, rejection_reason, created_at, updated_at)
      VALUES (?, ?, ?, 'pending', NULL, ?, ?)
    `).run(id, user.id, note, now, now);
    db.prepare("UPDATE users SET agent_upgrade_status = 'pending', agent_upgrade_reason = NULL WHERE id = ?").run(user.id);

    const updatedRow = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id) as Record<string, unknown>;
    res.status(201).json({
      user: mapUser(updatedRow),
      message: 'Upgrade request submitted! Your account will become an Agent once approved by the Admin.',
    });
  });

  app.post('/api/auth/logout', (_req, res) => {
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.json({ ok: true });
  });

  // --- IMAGE & VIDEO UPLOAD ENDPOINT ---
  app.post('/api/upload', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Please login to upload verification media.' });
    }
    const { dataUrl } = req.body as { dataUrl?: string };
    if (!dataUrl || typeof dataUrl !== 'string') {
      return res.status(400).json({ error: 'Media data is required.' });
    }
    const imgMatch = /^data:image\/(jpeg|jpg|png|webp)(?:;[^;]*)*;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
    const vidMatch = /^data:video\/(webm|mp4|quicktime)(?:;[^;]*)*;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
    if (!imgMatch && !vidMatch) {
      return res.status(400).json({ error: 'Only JPG, PNG, WEBP images and WEBM/MP4 videos are supported.' });
    }

    if (imgMatch) {
      const ext = imgMatch[1] === 'jpeg' ? 'jpg' : imgMatch[1];
      const buffer = Buffer.from(imgMatch[2], 'base64');
      if (buffer.byteLength > 8 * 1024 * 1024) {
        return res.status(400).json({ error: 'Image must be 8MB or smaller.' });
      }
      const filename = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
      fs.writeFileSync(path.join(UPLOADS_DIR, filename), buffer);
      return res.json({ url: `/uploads/${filename}` });
    }

    const vidExt = vidMatch![1] === 'quicktime' ? 'mov' : vidMatch![1];
    const vidBuffer = Buffer.from(vidMatch![2], 'base64');
    if (vidBuffer.byteLength > 25 * 1024 * 1024) {
      return res.status(400).json({ error: 'Liveness video must be 25MB or smaller.' });
    }
    const filename = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${vidExt}`;
    fs.writeFileSync(path.join(UPLOADS_DIR, filename), vidBuffer);
    res.json({ url: `/uploads/${filename}` });
  });

  // --- KYC ROUTES ---
  app.get('/api/kyc/me', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const user = getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required.' });
    const row = db
      .prepare('SELECT * FROM kyc_requests WHERE user_id = ? ORDER BY created_at DESC LIMIT 1')
      .get(user.id) as Record<string, unknown> | undefined;
    if (!row) return res.json({ kyc: null });
    res.json({
      kyc: {
        id: String(row.id),
        userId: String(row.user_id),
        idType: String(row.id_type),
        idNumber: String(row.id_number),
        idCardUrl: String(row.id_card_url),
        selfieUrl: String(row.selfie_url),
        livenessVideoUrl: row.liveness_video_url ? String(row.liveness_video_url) : null,
        status: String(row.status),
        rejectionReason: row.rejection_reason ? String(row.rejection_reason) : null,
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
      },
    });
  });

  app.post('/api/kyc', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ error: 'Please login first.' });
    if (user.role !== 'agent') {
      return res.status(403).json({ error: 'Only Agent / Landlord accounts require KYC verification.' });
    }
    if (user.kycStatus === 'approved') {
      return res.status(400).json({ error: 'Your KYC is already approved.' });
    }

    const { idType, idNumber, idCardUrl, selfieUrl, livenessVideoUrl } = req.body as Record<string, string | undefined>;
    if (idType !== 'NIN' && idType !== 'BVN') {
      return res.status(400).json({ error: 'ID type must be NIN or BVN.' });
    }
    const cleanIdNumber = (idNumber || '').trim();
    if (!/^\d{11}$/.test(cleanIdNumber)) {
      return res.status(400).json({ error: `${idType} must be exactly 11 digits.` });
    }
    if (!selfieUrl && !livenessVideoUrl) {
      return res.status(400).json({ error: 'Please capture your face photo inside the circle before submitting.' });
    }

    const cleanIdCardUrl = (idCardUrl || '').trim();
    const cleanSelfieUrl = (selfieUrl || livenessVideoUrl || '').trim();
    const cleanVideoUrl = livenessVideoUrl ? livenessVideoUrl.trim() : null;

    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO kyc_requests (id, user_id, id_type, id_number, id_card_url, selfie_url, liveness_video_url, status, rejection_reason, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NULL, ?, ?)
    `).run(id, user.id, idType, cleanIdNumber, cleanIdCardUrl, cleanSelfieUrl, cleanVideoUrl, now, now);

    db.prepare("UPDATE users SET kyc_status = 'pending', kyc_rejection_reason = NULL WHERE id = ?").run(user.id);

    res.status(201).json({
      message: 'KYC submitted successfully and is under review until admin approves it.',
      status: 'pending',
    });
  });

  // --- GOOGLE MAPS PROXY ROUTES (Geocoding & Routes API) ---
  app.post('/api/maps/geocode', async (req, res) => {
    try {
      const { address, lat, lng, houseId } = req.body as {
        address?: string;
        lat?: number;
        lng?: number;
        houseId?: string;
      };

      if (!getMapsApiKey()) {
        return res.status(503).json({ error: 'Google Maps API key is not configured.' });
      }

      if (typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng)) {
        const result = await reverseGeocodeServer(lat, lng);
        if (!result) {
          return res.status(404).json({ error: 'Could not determine address for coordinates.' });
        }
        return res.json(result);
      }

      if (!address || !address.trim()) {
        return res.status(400).json({ error: 'Address or coordinates are required.' });
      }

      const result = await geocodeAddressServer(address.trim());
      if (!result) {
        return res.status(404).json({ error: 'Could not locate that address on the map.' });
      }

      if (houseId) {
        const existingHouse = db.prepare('SELECT id, lat, lng FROM houses WHERE id = ?').get(houseId) as
          | { id: string; lat: number | null; lng: number | null }
          | undefined;
        if (existingHouse && (existingHouse.lat === null || existingHouse.lng === null)) {
          db.prepare('UPDATE houses SET lat = ?, lng = ?, updated_at = ? WHERE id = ?').run(
            result.lat,
            result.lng,
            new Date().toISOString(),
            houseId
          );
        }
      }

      res.json(result);
    } catch (err) {
      if (err instanceof MapsQuotaError) {
        return res.status(429).json({ error: err.message, quotaExceeded: true });
      }
      console.error('Geocode error:', err);
      res.status(500).json({ error: 'Unable to geocode location right now.' });
    }
  });

  app.post('/api/maps/route', async (req, res) => {
    try {
      const apiKey = getMapsApiKey();
      if (!apiKey) {
        return res.status(503).json({ error: 'Google Maps API key is not configured.' });
      }

      const { originLat, originLng, destLat, destLng, travelMode } = req.body as {
        originLat?: number;
        originLng?: number;
        destLat?: number;
        destLng?: number;
        travelMode?: string;
      };

      if (
        !Number.isFinite(originLat) ||
        !Number.isFinite(originLng) ||
        !Number.isFinite(destLat) ||
        !Number.isFinite(destLng)
      ) {
        return res.status(400).json({ error: 'Valid origin and destination coordinates are required.' });
      }

      const allowedModes = ['DRIVE', 'WALK', 'TWO_WHEELER'] as const;
      const mode = allowedModes.includes(travelMode as (typeof allowedModes)[number]) ? travelMode : 'DRIVE';

      const routeRes = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline',
          'X-Goog-Maps-Solution-ID': 'gmp_mcp_codeassist_v1_aistudio',
        },
        body: JSON.stringify({
          origin: {
            location: { latLng: { latitude: originLat, longitude: originLng } },
          },
          destination: {
            location: { latLng: { latitude: destLat, longitude: destLng } },
          },
          travelMode: mode,
          routingPreference: mode === 'WALK' ? undefined : 'TRAFFIC_AWARE',
          computeAlternativeRoutes: false,
          languageCode: 'en',
          units: 'METRIC',
        }),
      });

      const payload = (await routeRes.json().catch(() => ({}))) as {
        error?: { status?: string; message?: string };
        routes?: Array<{
          distanceMeters?: number;
          duration?: string;
          polyline?: { encodedPolyline?: string };
        }>;
      };

      if (routeRes.status === 429 || payload?.error?.status === 'RESOURCE_EXHAUSTED') {
        return res.status(429).json({
          error: payload?.error?.message || 'Google Maps Routes quota reached.',
          quotaExceeded: true,
        });
      }

      if (!routeRes.ok) {
        return res.status(routeRes.status).json({
          error: payload?.error?.message || 'Could not compute route.',
        });
      }

      const route = payload?.routes?.[0];
      if (!route) {
        return res.status(404).json({ error: 'No driving route found between these coordinates.' });
      }

      const distanceMeters = Number(route.distanceMeters || 0);
      const durationSeconds = Number(String(route.duration || '0s').replace(/[^\d.]/g, '')) || 0;
      const mins = Math.max(1, Math.round(durationSeconds / 60));
      const hours = Math.floor(mins / 60);
      const remMins = mins % 60;
      const durationText = hours > 0 ? `${hours} hr ${remMins} min` : `${mins} min`;

      res.json({
        distanceMeters,
        distanceKm: Number((distanceMeters / 1000).toFixed(2)),
        durationSeconds,
        durationText,
        encodedPolyline: route.polyline?.encodedPolyline || '',
      });
    } catch (err) {
      console.error('Routes proxy error:', err);
      res.status(500).json({ error: 'Unable to calculate route right now.' });
    }
  });

  // --- HOUSE LISTING ROUTES ---
  app.get('/api/houses', (req, res) => {
    const q = String(req.query.q || '').trim().toLowerCase();
    const houseType = String(req.query.houseType || '').trim();
    const state = String(req.query.state || '').trim();
    const country = String(req.query.country || '').trim();
    const minPrice = Number(req.query.minPrice || 0);
    const maxPrice = Number(req.query.maxPrice || 0);
    const sort = String(req.query.sort || 'newest').trim();
    const userLatRaw = req.query.userLat !== undefined ? Number(req.query.userLat) : NaN;
    const userLngRaw = req.query.userLng !== undefined ? Number(req.query.userLng) : NaN;
    const hasUserCoords = Number.isFinite(userLatRaw) && Number.isFinite(userLngRaw);
    const maxKm = Number(req.query.maxKm || 0);
    const amenitiesParam = String(req.query.amenities || '').trim();
    const requiredAmenities = amenitiesParam
      ? amenitiesParam.split(',').map((a) => a.trim().toLowerCase()).filter(Boolean)
      : [];

    const rows = db
      .prepare(`
        SELECT h.*, u.full_name as agent_name, u.user_code as agent_code, u.kyc_status as agent_kyc_status
        FROM houses h
        JOIN users u ON u.id = h.agent_id
        WHERE h.approval_status = 'approved' AND u.is_blocked = 0
        ORDER BY h.created_at DESC
      `)
      .all() as Record<string, unknown>[];

    let houses = rows
      .map((row) => {
        const mapped = mapHouse(row);
        const distanceKm =
          hasUserCoords && mapped.lat != null && mapped.lng != null
            ? Number(haversineKm(userLatRaw, userLngRaw, mapped.lat, mapped.lng).toFixed(2))
            : null;
        return { ...mapped, distanceKm };
      })
      .filter((h) => {
        if (q) {
          const haystack = `${h.title} ${h.area} ${h.state} ${h.country} ${h.streetName} ${h.houseType} ${h.description}`.toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        if (houseType && houseType !== 'All' && h.houseType !== houseType) return false;
        if (state && state !== 'All' && h.state.toLowerCase() !== state.toLowerCase()) return false;
        if (country && country !== 'All' && h.country.toLowerCase() !== country.toLowerCase()) return false;
        if (minPrice > 0 && h.price < minPrice) return false;
        if (maxPrice > 0 && h.price > maxPrice) return false;
        if (hasUserCoords && maxKm > 0) {
          if (h.distanceKm === null || h.distanceKm === undefined || h.distanceKm > maxKm) {
            return false;
          }
        }

        if (requiredAmenities.length > 0) {
          const amenityText = `${h.amenities.join(' ')} ${h.title} ${h.description}`.toLowerCase();
          const hasAll = requiredAmenities.every((am) => {
            if (am === 'electricity') {
              return (
                amenityText.includes('electricity') ||
                amenityText.includes('light') ||
                amenityText.includes('prepaid') ||
                amenityText.includes('power')
              );
            }
            if (am === 'generator') {
              return (
                amenityText.includes('generator') ||
                amenityText.includes('backup gen') ||
                amenityText.includes('inverter') ||
                amenityText.includes('solar')
              );
            }
            if (am === 'parking') {
              return (
                amenityText.includes('parking') ||
                amenityText.includes('car park') ||
                amenityText.includes('garage')
              );
            }
            if (am === 'water') {
              return amenityText.includes('water') || amenityText.includes('borehole');
            }
            if (am === 'toilet') {
              return (
                amenityText.includes('toilet') ||
                amenityText.includes('bath') ||
                amenityText.includes('en-suite')
              );
            }
            if (am === 'fenced') {
              return amenityText.includes('fenced') || amenityText.includes('gated') || amenityText.includes('gate');
            }
            return amenityText.includes(am);
          });
          if (!hasAll) return false;
        }
        return true;
      });

    if (sort === 'price_asc') {
      houses = [...houses].sort((a, b) => a.price - b.price);
    } else if (sort === 'price_desc') {
      houses = [...houses].sort((a, b) => b.price - a.price);
    } else if (sort === 'nearest' && hasUserCoords) {
      houses = [...houses].sort((a, b) => {
        const da = a.distanceKm ?? Number.POSITIVE_INFINITY;
        const dbDist = b.distanceKm ?? Number.POSITIVE_INFINITY;
        return da - dbDist;
      });
    }

    res.json({ houses });
  });

  app.get('/api/houses/:id', (req, res) => {
    const user = getAuthenticatedUser(req);
    const isAdmin = isAuthenticatedAdmin(req);
    const row = db
      .prepare(`
        SELECT h.*, u.full_name as agent_name, u.user_code as agent_code, u.kyc_status as agent_kyc_status, u.is_blocked as agent_blocked
        FROM houses h
        JOIN users u ON u.id = h.agent_id
        WHERE h.id = ?
      `)
      .get(req.params.id) as Record<string, unknown> | undefined;

    if (!row) return res.status(404).json({ error: 'House not found.' });

    const isOwner = user && user.id === String(row.agent_id);
    if (String(row.approval_status) !== 'approved' && !isOwner && !isAdmin) {
      return res.status(404).json({ error: 'House listing is pending admin approval.' });
    }
    if (Number(row.agent_blocked || 0) === 1 && !isAdmin) {
      return res.status(404).json({ error: 'House listing is unavailable.' });
    }

    res.json({ house: mapHouse(row) });
  });

  app.post('/api/houses', async (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ error: 'Please login first.' });
    if (user.role !== 'agent') {
      return res.status(403).json({ error: 'Only Agent / Landlord accounts can upload houses.' });
    }
    if (user.kycStatus !== 'approved') {
      return res.status(403).json({ error: 'Your KYC must be approved by an admin before uploading houses.' });
    }

    const {
      title,
      houseNumber,
      streetName,
      area,
      state,
      country,
      price,
      inspectionFee,
      houseType,
      phone,
      images,
      amenities,
      description,
      lat,
      lng,
    } = req.body as Record<string, unknown>;

    if (
      typeof title !== 'string' || !title.trim() ||
      typeof houseNumber !== 'string' || !houseNumber.trim() ||
      typeof streetName !== 'string' || !streetName.trim() ||
      typeof area !== 'string' || !area.trim() ||
      typeof state !== 'string' || !state.trim() ||
      typeof country !== 'string' || !country.trim() ||
      typeof houseType !== 'string' || !houseType.trim() ||
      typeof phone !== 'string' || !phone.trim() ||
      typeof description !== 'string' || !description.trim()
    ) {
      return res.status(400).json({ error: 'All property fields are required.' });
    }

    const numericPrice = Number(price);
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      return res.status(400).json({ error: 'Please enter a valid price in Naira.' });
    }

    const numericFee = Number(inspectionFee ?? 3000);
    if (!Number.isFinite(numericFee) || numericFee < 3000 || numericFee > 5000) {
      return res.status(400).json({ error: 'Inspection acceptance fee must be between ₦3,000 and ₦5,000.' });
    }

    if (!Array.isArray(images) || images.length < 5 || images.length > 10) {
      return res.status(400).json({ error: 'Please upload between 5 and 10 pictures of the house.' });
    }

    const cleanAmenities = Array.isArray(amenities)
      ? amenities.filter((a): a is string => typeof a === 'string' && a.trim().length > 0)
      : [];

    let resolvedLat: number | null =
      lat !== undefined && lat !== null && Number.isFinite(Number(lat)) ? Number(lat) : null;
    let resolvedLng: number | null =
      lng !== undefined && lng !== null && Number.isFinite(Number(lng)) ? Number(lng) : null;

    if (resolvedLat === null || resolvedLng === null) {
      try {
        const fullAddress = `${streetName.trim()}, ${area.trim()}, ${state.trim()}, ${country.trim()}`;
        const geocoded = await geocodeAddressServer(fullAddress);
        if (geocoded) {
          resolvedLat = geocoded.lat;
          resolvedLng = geocoded.lng;
        }
      } catch {
        // Non-fatal: house listing still saves even if geocoding is unavailable
      }
    }

    const now = new Date().toISOString();
    const id = `house-${crypto.randomUUID().slice(0, 12)}`;
    db.prepare(`
      INSERT INTO houses (
        id, agent_id, title, house_number, street_name, area, state, country,
        price, inspection_fee, house_type, phone, images_json, amenities_json, description,
        status, approval_status, lat, lng, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Available', 'pending', ?, ?, ?, ?)
    `).run(
      id,
      user.id,
      title.trim(),
      houseNumber.trim(),
      streetName.trim(),
      area.trim(),
      state.trim(),
      country.trim(),
      Math.round(numericPrice),
      Math.round(numericFee),
      houseType.trim(),
      phone.trim(),
      JSON.stringify(images),
      JSON.stringify(cleanAmenities),
      description.trim(),
      resolvedLat,
      resolvedLng,
      now,
      now
    );

    const created = db
      .prepare(`
        SELECT h.*, u.full_name as agent_name, u.user_code as agent_code, u.kyc_status as agent_kyc_status
        FROM houses h JOIN users u ON u.id = h.agent_id WHERE h.id = ?
      `)
      .get(id) as Record<string, unknown>;

    res.status(201).json({
      house: mapHouse(created),
      message: 'House uploaded! It is currently Pending Admin Approval before appearing publicly.',
    });
  });

  app.patch('/api/houses/:id/status', (req, res) => {
    const user = getAuthenticatedUser(req);
    const isAdmin = isAuthenticatedAdmin(req);
    if (!user && !isAdmin) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const house = db.prepare('SELECT * FROM houses WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
    if (!house) return res.status(404).json({ error: 'House not found.' });

    if (!isAdmin && user?.id !== String(house.agent_id)) {
      return res.status(403).json({ error: 'You can only update your own listings.' });
    }

    const nextStatus = (req.body as { status?: string })?.status === 'Available' ? 'Available' : 'SOLD OUT';
    db.prepare('UPDATE houses SET status = ?, updated_at = ? WHERE id = ?').run(
      nextStatus,
      new Date().toISOString(),
      req.params.id
    );

    const updated = db
      .prepare(`
        SELECT h.*, u.full_name as agent_name, u.user_code as agent_code, u.kyc_status as agent_kyc_status
        FROM houses h JOIN users u ON u.id = h.agent_id WHERE h.id = ?
      `)
      .get(req.params.id) as Record<string, unknown>;

    res.json({ house: mapHouse(updated) });
  });

  app.patch('/api/houses/:id/price', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required.' });

    const house = db.prepare('SELECT * FROM houses WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
    if (!house) return res.status(404).json({ error: 'House not found.' });

    if (user.id !== String(house.agent_id)) {
      return res.status(403).json({ error: 'You can only adjust the price of your own listings.' });
    }

    const newPrice = Number((req.body as { price?: unknown })?.price);
    if (!Number.isFinite(newPrice) || newPrice <= 0) {
      return res.status(400).json({ error: 'Please enter a valid price in Naira.' });
    }

    db.prepare('UPDATE houses SET price = ?, updated_at = ? WHERE id = ?').run(
      Math.round(newPrice),
      new Date().toISOString(),
      req.params.id
    );

    const updated = db
      .prepare(`
        SELECT h.*, u.full_name as agent_name, u.user_code as agent_code, u.kyc_status as agent_kyc_status
        FROM houses h JOIN users u ON u.id = h.agent_id WHERE h.id = ?
      `)
      .get(req.params.id) as Record<string, unknown>;

    res.json({ house: mapHouse(updated) });
  });

  app.get('/api/agent/houses', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required.' });

    const houseRows = db
      .prepare(`
        SELECT h.*, u.full_name as agent_name, u.user_code as agent_code, u.kyc_status as agent_kyc_status
        FROM houses h JOIN users u ON u.id = h.agent_id
        WHERE h.agent_id = ?
        ORDER BY h.created_at DESC
      `)
      .all(user.id) as Record<string, unknown>[];

    const inspectionRows = db
      .prepare(`
        SELECT i.*, h.title as house_title
        FROM inspections i
        JOIN houses h ON h.id = i.house_id
        WHERE h.agent_id = ?
        ORDER BY i.created_at DESC
      `)
      .all(user.id) as Record<string, unknown>[];

    res.json({
      houses: houseRows.map(mapHouse),
      inspections: inspectionRows.map((r) => ({
        id: String(r.id),
        houseId: String(r.house_id),
        houseTitle: String(r.house_title),
        buyerName: String(r.buyer_name),
        buyerPhone: String(r.buyer_phone),
        preferredDate: String(r.preferred_date),
        preferredTime: String(r.preferred_time),
        notes: String(r.notes || ''),
        createdAt: String(r.created_at),
      })),
    });
  });

  app.get('/api/favorites', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required.' });

    const rows = db
      .prepare(`
        SELECT h.*, u.full_name as agent_name, u.user_code as agent_code, u.kyc_status as agent_kyc_status
        FROM favorites f
        JOIN houses h ON h.id = f.house_id
        JOIN users u ON u.id = h.agent_id
        WHERE f.user_id = ?
          AND u.is_blocked = 0
          AND (h.approval_status = 'approved' OR h.agent_id = ?)
        ORDER BY f.created_at DESC
      `)
      .all(user.id, user.id) as Record<string, unknown>[];

    const houses = rows.map(mapHouse);
    res.json({
      favoriteIds: houses.map((h) => h.id),
      houses,
    });
  });

  app.post('/api/favorites/:houseId/toggle', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ error: 'Please login to save properties.' });

    const houseId = req.params.houseId;
    const house = db.prepare('SELECT id FROM houses WHERE id = ?').get(houseId) as { id: string } | undefined;
    if (!house) return res.status(404).json({ error: 'House not found.' });

    const existing = db
      .prepare('SELECT 1 FROM favorites WHERE user_id = ? AND house_id = ?')
      .get(user.id, houseId);

    if (existing) {
      db.prepare('DELETE FROM favorites WHERE user_id = ? AND house_id = ?').run(user.id, houseId);
      return res.json({ favorited: false, houseId });
    }

    db.prepare('INSERT INTO favorites (user_id, house_id, created_at) VALUES (?, ?, ?)').run(
      user.id,
      houseId,
      new Date().toISOString()
    );
    return res.json({ favorited: true, houseId });
  });

  app.post('/api/houses/:id/inspections', (req, res) => {
    const house = db.prepare('SELECT * FROM houses WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
    if (!house || String(house.approval_status) !== 'approved') {
      return res.status(404).json({ error: 'House not found.' });
    }
    if (String(house.status) === 'SOLD OUT') {
      return res.status(400).json({ error: 'This house is already marked SOLD OUT.' });
    }

    const { buyerName, buyerPhone, preferredDate, preferredTime, notes } = req.body as Record<string, string>;
    if (!buyerName?.trim() || !buyerPhone?.trim() || !preferredDate?.trim() || !preferredTime?.trim()) {
      return res.status(400).json({ error: 'Name, phone number, preferred date, and time are required.' });
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO inspections (id, house_id, buyer_name, buyer_phone, preferred_date, preferred_time, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, req.params.id, buyerName.trim(), buyerPhone.trim(), preferredDate.trim(), preferredTime.trim(), (notes || '').trim(), now);

    res.status(201).json({
      message: 'Inspection booked! Meet the landlord in person — pay the ₦3,000–₦5,000 inspection acceptance fee face-to-face only after meeting at the property.',
      inspectionId: id,
    });
  });

  // --- HOME PROPERTY MARKETPLACE ROUTES (TV, Gas, Fan, Furniture, etc.) ---
  app.get('/api/items', (req, res) => {
    const q = String(req.query.q || '').trim().toLowerCase();
    const category = String(req.query.category || '').trim();
    const state = String(req.query.state || '').trim();
    const country = String(req.query.country || '').trim();
    const condition = String(req.query.condition || '').trim();

    const rows = db
      .prepare(`
        SELECT i.*, u.full_name as seller_name, u.user_code as seller_code
        FROM home_items i
        JOIN users u ON u.id = i.seller_id
        WHERE i.approval_status = 'approved' AND u.is_blocked = 0
        ORDER BY i.created_at DESC
      `)
      .all() as Record<string, unknown>[];

    const items = rows.map(mapHomeItem).filter((item) => {
      if (q) {
        const hay = `${item.title} ${item.category} ${item.area} ${item.state} ${item.country} ${item.description}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (category && category !== 'All' && item.category !== category) return false;
      if (state && state !== 'All' && item.state.toLowerCase() !== state.toLowerCase()) return false;
      if (country && country !== 'All' && item.country.toLowerCase() !== country.toLowerCase()) return false;
      if (condition && condition !== 'All' && item.condition !== condition) return false;
      return true;
    });

    res.json({ items });
  });

  app.get('/api/items/mine', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required.' });

    const rows = db
      .prepare(`
        SELECT i.*, u.full_name as seller_name, u.user_code as seller_code
        FROM home_items i
        JOIN users u ON u.id = i.seller_id
        WHERE i.seller_id = ?
        ORDER BY i.created_at DESC
      `)
      .all(user.id) as Record<string, unknown>[];

    res.json({ items: rows.map(mapHomeItem) });
  });

  app.post('/api/items', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ error: 'Please login first to post home property for sale.' });

    const { title, category, condition, price, area, state, country, phone, images, description } =
      req.body as Record<string, unknown>;

    if (
      typeof title !== 'string' || !title.trim() ||
      typeof category !== 'string' || !category.trim() ||
      typeof condition !== 'string' || !condition.trim() ||
      typeof area !== 'string' || !area.trim() ||
      typeof state !== 'string' || !state.trim() ||
      typeof country !== 'string' || !country.trim() ||
      typeof phone !== 'string' || !phone.trim() ||
      typeof description !== 'string' || !description.trim()
    ) {
      return res.status(400).json({ error: 'All home property fields are required.' });
    }

    const numericPrice = Number(price);
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      return res.status(400).json({ error: 'Please enter a valid selling price in Naira.' });
    }

    if (!Array.isArray(images) || images.length < 1 || images.length > 8) {
      return res.status(400).json({ error: 'Please add between 1 and 8 photos of the home item.' });
    }

    const id = `item-${crypto.randomUUID().slice(0, 12)}`;
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO home_items (
        id, seller_id, title, category, condition, price, area, state, country,
        phone, images_json, description, status, approval_status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Available', 'approved', ?, ?)
    `).run(
      id,
      user.id,
      title.trim(),
      category.trim(),
      condition.trim(),
      Math.round(numericPrice),
      area.trim(),
      state.trim(),
      country.trim(),
      phone.trim(),
      JSON.stringify(images),
      description.trim(),
      now,
      now
    );

    const created = db
      .prepare(`
        SELECT i.*, u.full_name as seller_name, u.user_code as seller_code
        FROM home_items i JOIN users u ON u.id = i.seller_id WHERE i.id = ?
      `)
      .get(id) as Record<string, unknown>;

    res.status(201).json({
      item: mapHomeItem(created),
      message: 'Your home property is now live for buyers!',
    });
  });

  app.patch('/api/items/:id/status', (req, res) => {
    const user = getAuthenticatedUser(req);
    const isAdmin = isAuthenticatedAdmin(req);
    if (!user && !isAdmin) return res.status(401).json({ error: 'Authentication required.' });

    const item = db.prepare('SELECT * FROM home_items WHERE id = ?').get(req.params.id) as
      | Record<string, unknown>
      | undefined;
    if (!item) return res.status(404).json({ error: 'Item not found.' });
    if (!isAdmin && user?.id !== String(item.seller_id)) {
      return res.status(403).json({ error: 'You can only update your own items.' });
    }

    const nextStatus = (req.body as { status?: string })?.status === 'Available' ? 'Available' : 'SOLD';
    db.prepare('UPDATE home_items SET status = ?, updated_at = ? WHERE id = ?').run(
      nextStatus,
      new Date().toISOString(),
      req.params.id
    );

    const updated = db
      .prepare(`
        SELECT i.*, u.full_name as seller_name, u.user_code as seller_code
        FROM home_items i JOIN users u ON u.id = i.seller_id WHERE i.id = ?
      `)
      .get(req.params.id) as Record<string, unknown>;
    res.json({ item: mapHomeItem(updated) });
  });

  app.delete('/api/items/:id', (req, res) => {
    const user = getAuthenticatedUser(req);
    const isAdmin = isAuthenticatedAdmin(req);
    if (!user && !isAdmin) return res.status(401).json({ error: 'Authentication required.' });

    const item = db.prepare('SELECT * FROM home_items WHERE id = ?').get(req.params.id) as
      | Record<string, unknown>
      | undefined;
    if (!item) return res.status(404).json({ error: 'Item not found.' });
    if (!isAdmin && user?.id !== String(item.seller_id)) {
      return res.status(403).json({ error: 'You can only delete your own items.' });
    }

    db.prepare('DELETE FROM home_items WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  });

  // --- USER REPORT / WARNING SUBMISSION (REQUIRES UID NUMBER) ---
  app.post('/api/reports', (req, res) => {
    const reporter = getAuthenticatedUser(req);
    const {
      reportedUid,
      reason,
      reporterName,
      reporterContact,
      listingType,
      listingId,
    } = req.body as Record<string, string | undefined>;

    const cleanUid = (reportedUid || '').trim();
    if (!cleanUid) {
      return res.status(400).json({ error: 'Please provide the UID number of the user you are reporting.' });
    }
    const cleanReason = (reason || '').trim();
    if (cleanReason.length < 5) {
      return res.status(400).json({ error: 'Please describe the warning or report (at least 5 characters).' });
    }

    const targetRow = db
      .prepare('SELECT id, full_name, user_code FROM users WHERE LOWER(user_code) = LOWER(?)')
      .get(cleanUid) as { id: string; full_name: string; user_code: string } | undefined;

    if (!targetRow) {
      return res.status(404).json({
        error: `No registered user found with UID number "${cleanUid}". Please check and enter the exact UID number.`,
      });
    }

    const cleanType =
      listingType === 'house' || listingType === 'item' ? listingType : 'general';
    const cleanListingId = (listingId || '').trim();
    const id = `rep-${crypto.randomUUID().slice(0, 12)}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO user_reports (
        id, reported_uid, reported_user_id, reporter_user_id,
        reporter_name, reporter_contact, listing_type, listing_id,
        reason, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)
    `).run(
      id,
      targetRow.user_code,
      targetRow.id,
      reporter ? reporter.id : null,
      reporter ? reporter.fullName : (reporterName || 'Visitor').trim(),
      reporter ? reporter.phone : (reporterContact || '').trim(),
      cleanType,
      cleanListingId,
      cleanReason,
      now,
      now
    );

    res.status(201).json({
      message: `Report submitted to Admin for ${targetRow.full_name} (UID: ${targetRow.user_code}).`,
    });
  });

  // --- PRIVATE ADMIN CONTROL ROUTES ---
  app.get('/api/mega/me', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const authed = isAuthenticatedAdmin(req);
    res.json({
      isAdmin: authed,
      email: authed ? ADMIN_EMAIL : null,
    });
  });

  app.post('/api/mega/login', (req, res) => {
    const { email, password } = req.body as Record<string, string>;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    if (cleanEmail !== ADMIN_EMAIL) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const authResult = authenticateOrInitializeAdmin(password);
    if (!authResult.ok) {
      return res.status(authResult.status || 401).json({ error: authResult.error || 'Invalid credentials.' });
    }

    const adminToken = signToken({ role: 'admin', email: ADMIN_EMAIL, exp: Date.now() + 24 * 60 * 60 * 1000 });
    setCookie(req, res, ADMIN_COOKIE, adminToken, 24 * 60 * 60 * 1000);
    res.json({
      isAdmin: true,
      email: ADMIN_EMAIL,
      adminToken,
      firstTimeConfigured: Boolean(authResult.firstTimeConfigured),
    });
  });

  app.post('/api/mega/logout', (_req, res) => {
    res.clearCookie(ADMIN_COOKIE, { path: '/' });
    res.json({ ok: true });
  });

  app.get('/api/mega/dashboard', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!isAuthenticatedAdmin(req)) {
      return res.status(401).json({ error: 'Authorization required.' });
    }

    const userRows = db.prepare('SELECT * FROM users ORDER BY created_at DESC').all() as Record<string, unknown>[];
    const kycRows = db
      .prepare(`
        SELECT k.*, u.full_name as user_full_name, u.user_code as user_code, u.email as user_email, u.phone as user_phone, u.state as user_state
        FROM kyc_requests k
        JOIN users u ON u.id = k.user_id
        ORDER BY CASE WHEN k.status = 'pending' THEN 0 ELSE 1 END, k.created_at DESC
      `)
      .all() as Record<string, unknown>[];
    const houseRows = db
      .prepare(`
        SELECT h.*, u.full_name as agent_name, u.user_code as agent_code, u.kyc_status as agent_kyc_status
        FROM houses h
        JOIN users u ON u.id = h.agent_id
        ORDER BY CASE WHEN h.approval_status = 'pending' THEN 0 ELSE 1 END, h.created_at DESC
      `)
      .all() as Record<string, unknown>[];
    const upgradeRows = db
      .prepare(`
        SELECT r.*, u.full_name as user_full_name, u.user_code as user_code, u.email as user_email, u.phone as user_phone, u.state as user_state
        FROM agent_upgrade_requests r
        JOIN users u ON u.id = r.user_id
        ORDER BY CASE WHEN r.status = 'pending' THEN 0 ELSE 1 END, r.created_at DESC
      `)
      .all() as Record<string, unknown>[];
    const itemRows = db
      .prepare(`
        SELECT i.*, u.full_name as seller_name, u.user_code as seller_code
        FROM home_items i
        JOIN users u ON u.id = i.seller_id
        ORDER BY i.created_at DESC
      `)
      .all() as Record<string, unknown>[];
    const noteRows = db.prepare('SELECT * FROM admin_notes ORDER BY created_at DESC').all() as Array<{
      id: string;
      message: string;
      created_at: string;
    }>;
    const loginRows = db.prepare('SELECT * FROM login_logs ORDER BY logged_in_at DESC LIMIT 200').all() as Array<
      Record<string, unknown>
    >;
    const reportRows = db
      .prepare(`
        SELECT r.*, u.full_name as reported_user_name, u.email as reported_user_email,
               u.phone as reported_user_phone, u.role as reported_user_role, u.is_blocked as reported_user_blocked
        FROM user_reports r
        LEFT JOIN users u ON u.id = r.reported_user_id
        ORDER BY CASE WHEN r.status = 'open' THEN 0 ELSE 1 END, r.created_at DESC
      `)
      .all() as Array<Record<string, unknown>>;

    const users = userRows.map(mapUser);
    const houses = houseRows.map(mapHouse);
    const homeItems = itemRows.map(mapHomeItem);
    const reports = reportRows.map((r) => ({
      id: String(r.id),
      reportedUid: String(r.reported_uid),
      reportedUserId: r.reported_user_id ? String(r.reported_user_id) : null,
      reportedUserName: r.reported_user_name ? String(r.reported_user_name) : 'Unknown User',
      reportedUserEmail: r.reported_user_email ? String(r.reported_user_email) : '',
      reportedUserPhone: r.reported_user_phone ? String(r.reported_user_phone) : '',
      reportedUserRole: r.reported_user_role ? String(r.reported_user_role) : '',
      reportedUserBlocked: Number(r.reported_user_blocked || 0) === 1,
      reporterName: String(r.reporter_name || 'Visitor'),
      reporterContact: String(r.reporter_contact || ''),
      listingType: String(r.listing_type || 'general') as 'general' | 'house' | 'item',
      listingId: String(r.listing_id || ''),
      reason: String(r.reason),
      status: String(r.status) as 'open' | 'warned' | 'resolved',
      adminActionNote: r.admin_action_note ? String(r.admin_action_note) : null,
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
    }));
    const kycRequests = kycRows.map((r) => ({
      id: String(r.id),
      userId: String(r.user_id),
      userCode: String(r.user_code || ''),
      userFullName: String(r.user_full_name),
      userEmail: String(r.user_email),
      userPhone: String(r.user_phone),
      userState: String(r.user_state || ''),
      idType: String(r.id_type) as 'NIN' | 'BVN',
      idNumber: String(r.id_number),
      idCardUrl: String(r.id_card_url),
      selfieUrl: String(r.selfie_url),
      livenessVideoUrl: r.liveness_video_url ? String(r.liveness_video_url) : null,
      status: String(r.status) as 'pending' | 'approved' | 'rejected',
      rejectionReason: r.rejection_reason ? String(r.rejection_reason) : null,
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
    }));
    const upgradeRequests = upgradeRows.map((r) => ({
      id: String(r.id),
      userId: String(r.user_id),
      userCode: String(r.user_code || ''),
      userFullName: String(r.user_full_name),
      userEmail: String(r.user_email),
      userPhone: String(r.user_phone),
      userState: String(r.user_state || ''),
      note: String(r.note || ''),
      status: String(r.status) as 'pending' | 'approved' | 'rejected',
      rejectionReason: r.rejection_reason ? String(r.rejection_reason) : null,
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
    }));

    res.json({
      stats: {
        totalHouses: houses.length,
        pendingHouses: houses.filter((h) => h.approvalStatus === 'pending').length,
        totalUsers: users.length,
        totalAgents: users.filter((u) => u.role === 'agent').length,
        pendingKyc: kycRequests.filter((k) => k.status === 'pending').length,
        pendingUpgrades: upgradeRequests.filter((u) => u.status === 'pending').length,
        totalItems: homeItems.length,
        openReports: reports.filter((r) => r.status === 'open').length,
      },
      users,
      kycRequests,
      upgradeRequests,
      houses,
      homeItems,
      reports,
      notes: noteRows.map((n) => ({ id: n.id, message: n.message, createdAt: n.created_at })),
      loginLogs: loginRows.map((l) => ({
        id: String(l.id),
        userId: String(l.user_id),
        userCode: String(l.user_code),
        fullName: String(l.full_name),
        email: String(l.email),
        role: String(l.role) as 'buyer' | 'agent',
        loggedInAt: String(l.logged_in_at),
      })),
    });
  });

  app.get('/api/mega/users/by-uid/:uid', (req, res) => {
    if (!isAuthenticatedAdmin(req)) return res.status(401).json({ error: 'Authorization required.' });
    const cleanUid = String(req.params.uid || '').trim();
    if (!cleanUid) return res.status(400).json({ error: 'Please provide a UID number.' });

    const userRow = db
      .prepare('SELECT * FROM users WHERE LOWER(user_code) = LOWER(?)')
      .get(cleanUid) as Record<string, unknown> | undefined;
    if (!userRow) {
      return res.status(404).json({ error: `No user found with UID number "${cleanUid}".` });
    }
    const foundUser = mapUser(userRow);
    const houseCount = (
      db.prepare('SELECT COUNT(*) as c FROM houses WHERE agent_id = ?').get(foundUser.id) as { c: number }
    ).c;
    const itemCount = (
      db.prepare('SELECT COUNT(*) as c FROM home_items WHERE seller_id = ?').get(foundUser.id) as { c: number }
    ).c;
    const reportCount = (
      db
        .prepare('SELECT COUNT(*) as c FROM user_reports WHERE reported_user_id = ? OR LOWER(reported_uid) = LOWER(?)')
        .get(foundUser.id, cleanUid) as { c: number }
    ).c;

    res.json({ user: foundUser, houseCount, itemCount, reportCount });
  });

  app.post('/api/mega/reports', (req, res) => {
    if (!isAuthenticatedAdmin(req)) return res.status(401).json({ error: 'Authorization required.' });
    const { reportedUid, reason, blockUser } = req.body as {
      reportedUid?: string;
      reason?: string;
      blockUser?: boolean;
    };
    const cleanUid = (reportedUid || '').trim();
    if (!cleanUid) {
      return res.status(400).json({ error: 'UID number is required to log a warning or report.' });
    }
    const cleanReason = (reason || '').trim();
    if (cleanReason.length < 3) {
      return res.status(400).json({ error: 'Please enter the warning or report reason.' });
    }

    const targetRow = db
      .prepare('SELECT id, full_name, user_code FROM users WHERE LOWER(user_code) = LOWER(?)')
      .get(cleanUid) as { id: string; full_name: string; user_code: string } | undefined;
    if (!targetRow) {
      return res.status(404).json({ error: `No registered user found with UID number "${cleanUid}".` });
    }

    const id = `rep-${crypto.randomUUID().slice(0, 12)}`;
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO user_reports (
        id, reported_uid, reported_user_id, reporter_name, reporter_contact,
        listing_type, listing_id, reason, status, admin_action_note, created_at, updated_at
      ) VALUES (?, ?, ?, 'Admin Desk', 'Direct Warning', 'general', '', ?, 'warned', ?, ?, ?)
    `).run(
      id,
      targetRow.user_code,
      targetRow.id,
      cleanReason,
      blockUser ? 'User blocked by Admin' : 'Warning logged by Admin',
      now,
      now
    );

    if (blockUser) {
      db.prepare('UPDATE users SET is_blocked = 1 WHERE id = ?').run(targetRow.id);
    }

    res.status(201).json({
      message: blockUser
        ? `User ${targetRow.full_name} (UID: ${targetRow.user_code}) warned and blocked.`
        : `Warning recorded for ${targetRow.full_name} (UID: ${targetRow.user_code}).`,
    });
  });

  app.post('/api/mega/reports/:id/action', (req, res) => {
    if (!isAuthenticatedAdmin(req)) return res.status(401).json({ error: 'Authorization required.' });
    const { action, note } = req.body as { action?: 'warn' | 'block' | 'resolve'; note?: string };
    const report = db.prepare('SELECT * FROM user_reports WHERE id = ?').get(req.params.id) as
      | Record<string, unknown>
      | undefined;
    if (!report) return res.status(404).json({ error: 'Report not found.' });

    const now = new Date().toISOString();
    const nextStatus = action === 'resolve' ? 'resolved' : 'warned';
    const actionNote =
      (note || '').trim() ||
      (action === 'block'
        ? 'Account blocked by Admin after report review'
        : action === 'resolve'
        ? 'Resolved by Admin'
        : 'Formal warning issued by Admin');

    db.prepare('UPDATE user_reports SET status = ?, admin_action_note = ?, updated_at = ? WHERE id = ?').run(
      nextStatus,
      actionNote,
      now,
      req.params.id
    );

    if (action === 'block' && report.reported_user_id) {
      db.prepare('UPDATE users SET is_blocked = 1 WHERE id = ?').run(String(report.reported_user_id));
    }

    res.json({
      message:
        action === 'block'
          ? `Reported user (UID: ${String(report.reported_uid)}) has been blocked.`
          : action === 'resolve'
          ? 'Report marked as resolved.'
          : `Warning issued for UID: ${String(report.reported_uid)}.`,
    });
  });

  app.post('/api/mega/users/:id/block', (req, res) => {
    if (!isAuthenticatedAdmin(req)) return res.status(401).json({ error: 'Authorization required.' });
    const blocked = Boolean((req.body as { blocked?: boolean })?.blocked);
    const info = db.prepare('UPDATE users SET is_blocked = ? WHERE id = ?').run(blocked ? 1 : 0, req.params.id);
    if (info.changes === 0) return res.status(404).json({ error: 'User not found.' });
    res.json({ message: blocked ? 'User has been blocked.' : 'User has been unblocked.' });
  });

  app.post('/api/mega/upgrades/:id/approve', (req, res) => {
    if (!isAuthenticatedAdmin(req)) return res.status(401).json({ error: 'Authorization required.' });
    const upgradeReq = db
      .prepare('SELECT * FROM agent_upgrade_requests WHERE id = ?')
      .get(req.params.id) as Record<string, unknown> | undefined;
    if (!upgradeReq) return res.status(404).json({ error: 'Upgrade request not found.' });

    const now = new Date().toISOString();
    const userId = String(upgradeReq.user_id);
    db.prepare(
      "UPDATE agent_upgrade_requests SET status = 'approved', rejection_reason = NULL, updated_at = ? WHERE id = ? OR (user_id = ? AND status = 'pending')"
    ).run(now, req.params.id, userId);
    db.prepare(
      "UPDATE users SET role = 'agent', agent_upgrade_status = 'approved', agent_upgrade_reason = NULL WHERE id = ?"
    ).run(userId);

    res.json({ message: 'User upgraded to Agent / Landlord immediately!' });
  });

  app.post('/api/mega/upgrades/:id/reject', (req, res) => {
    if (!isAuthenticatedAdmin(req)) return res.status(401).json({ error: 'Authorization required.' });
    const reason = String((req.body as { reason?: string })?.reason || '').trim();
    if (!reason) return res.status(400).json({ error: 'Please provide a rejection reason.' });

    const upgradeReq = db
      .prepare('SELECT * FROM agent_upgrade_requests WHERE id = ?')
      .get(req.params.id) as Record<string, unknown> | undefined;
    if (!upgradeReq) return res.status(404).json({ error: 'Upgrade request not found.' });

    const now = new Date().toISOString();
    db.prepare(
      "UPDATE agent_upgrade_requests SET status = 'rejected', rejection_reason = ?, updated_at = ? WHERE id = ?"
    ).run(reason, now, req.params.id);
    db.prepare("UPDATE users SET agent_upgrade_status = 'rejected', agent_upgrade_reason = ? WHERE id = ?").run(
      reason,
      String(upgradeReq.user_id)
    );

    res.json({ message: 'Agent upgrade request rejected.' });
  });

  app.post('/api/mega/kyc/:id/approve', (req, res) => {
    if (!isAuthenticatedAdmin(req)) return res.status(401).json({ error: 'Authorization required.' });
    const kyc = db.prepare('SELECT * FROM kyc_requests WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
    if (!kyc) return res.status(404).json({ error: 'KYC request not found.' });

    const now = new Date().toISOString();
    const userId = String(kyc.user_id);
    db.prepare(
      "UPDATE kyc_requests SET status = 'approved', rejection_reason = NULL, updated_at = ? WHERE id = ? OR (user_id = ? AND status = 'pending')"
    ).run(now, req.params.id, userId);
    db.prepare(
      "UPDATE users SET kyc_status = 'approved', kyc_rejection_reason = NULL, is_verified = 1 WHERE id = ?"
    ).run(userId);

    res.json({ message: 'KYC approved! The user account is now verified immediately.' });
  });

  app.post('/api/mega/kyc/:id/reject', (req, res) => {
    if (!isAuthenticatedAdmin(req)) return res.status(401).json({ error: 'Authorization required.' });
    const reason = String((req.body as { reason?: string })?.reason || '').trim();
    if (!reason) return res.status(400).json({ error: 'Please provide a rejection reason.' });

    const kyc = db.prepare('SELECT * FROM kyc_requests WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
    if (!kyc) return res.status(404).json({ error: 'KYC request not found.' });

    const now = new Date().toISOString();
    db.prepare("UPDATE kyc_requests SET status = 'rejected', rejection_reason = ?, updated_at = ? WHERE id = ?").run(
      reason,
      now,
      req.params.id
    );
    db.prepare("UPDATE users SET kyc_status = 'rejected', kyc_rejection_reason = ? WHERE id = ?").run(
      reason,
      String(kyc.user_id)
    );

    res.json({ message: 'KYC rejected with reason.' });
  });

  app.post('/api/mega/houses/:id/approve', (req, res) => {
    if (!isAuthenticatedAdmin(req)) return res.status(401).json({ error: 'Authorization required.' });
    const info = db
      .prepare("UPDATE houses SET approval_status = 'approved', rejection_reason = NULL, updated_at = ? WHERE id = ?")
      .run(new Date().toISOString(), req.params.id);
    if (info.changes === 0) return res.status(404).json({ error: 'House not found.' });
    res.json({ message: 'House approved and is now live on the Home page.' });
  });

  app.post('/api/mega/houses/:id/reject', (req, res) => {
    if (!isAuthenticatedAdmin(req)) return res.status(401).json({ error: 'Authorization required.' });
    const reason = String((req.body as { reason?: string })?.reason || '').trim();
    if (!reason) return res.status(400).json({ error: 'Please provide a rejection reason.' });
    const info = db
      .prepare("UPDATE houses SET approval_status = 'rejected', rejection_reason = ?, updated_at = ? WHERE id = ?")
      .run(reason, new Date().toISOString(), req.params.id);
    if (info.changes === 0) return res.status(404).json({ error: 'House not found.' });
    res.json({ message: 'House rejected with reason.' });
  });

  app.delete('/api/mega/houses/:id', (req, res) => {
    if (!isAuthenticatedAdmin(req)) return res.status(401).json({ error: 'Authorization required.' });
    const info = db.prepare('DELETE FROM houses WHERE id = ?').run(req.params.id);
    if (info.changes === 0) return res.status(404).json({ error: 'House not found.' });
    res.json({ message: 'House listing deleted.' });
  });

  app.post('/api/mega/items/:id/approve', (req, res) => {
    if (!isAuthenticatedAdmin(req)) return res.status(401).json({ error: 'Authorization required.' });
    const info = db
      .prepare("UPDATE home_items SET approval_status = 'approved', rejection_reason = NULL, updated_at = ? WHERE id = ?")
      .run(new Date().toISOString(), req.params.id);
    if (info.changes === 0) return res.status(404).json({ error: 'Home item not found.' });
    res.json({ message: 'Home property item approved.' });
  });

  app.post('/api/mega/items/:id/reject', (req, res) => {
    if (!isAuthenticatedAdmin(req)) return res.status(401).json({ error: 'Authorization required.' });
    const reason = String((req.body as { reason?: string })?.reason || '').trim();
    if (!reason) return res.status(400).json({ error: 'Please provide a rejection reason.' });
    const info = db
      .prepare("UPDATE home_items SET approval_status = 'rejected', rejection_reason = ?, updated_at = ? WHERE id = ?")
      .run(reason, new Date().toISOString(), req.params.id);
    if (info.changes === 0) return res.status(404).json({ error: 'Home item not found.' });
    res.json({ message: 'Home property item rejected.' });
  });

  app.delete('/api/mega/items/:id', (req, res) => {
    if (!isAuthenticatedAdmin(req)) return res.status(401).json({ error: 'Authorization required.' });
    const info = db.prepare('DELETE FROM home_items WHERE id = ?').run(req.params.id);
    if (info.changes === 0) return res.status(404).json({ error: 'Home item not found.' });
    res.json({ message: 'Home property item deleted.' });
  });

  app.post('/api/mega/notes', (req, res) => {
    if (!isAuthenticatedAdmin(req)) return res.status(401).json({ error: 'Authorization required.' });
    const message = String((req.body as { message?: string })?.message || '').trim();
    if (message.length < 3) return res.status(400).json({ error: 'Please write a broadcast message of at least 3 characters.' });

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare('INSERT INTO admin_notes (id, message, created_at) VALUES (?, ?, ?)').run(id, message, now);
    res.status(201).json({
      note: { id, message, createdAt: now },
      message: 'Broadcast message published! All registered users will see it at the top of their Home page and Dashboard.',
    });
  });

  app.delete('/api/mega/notes/:id', (req, res) => {
    if (!isAuthenticatedAdmin(req)) return res.status(401).json({ error: 'Authorization required.' });
    db.prepare('DELETE FROM admin_notes WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  });

  app.delete('/api/mega/notes', (req, res) => {
    if (!isAuthenticatedAdmin(req)) return res.status(401).json({ error: 'Authorization required.' });
    db.prepare('DELETE FROM admin_notes').run();
    res.json({ ok: true });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve('dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Glide Homes server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
