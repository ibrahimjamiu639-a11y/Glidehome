import { AMENITY_OPTIONS, formatNaira } from '../data/locations.ts';
import type { AuthUser, HomePropertyItem, HouseListing } from '../types.ts';

export function normalizeWhatsappPhone(rawPhone: string): string {
  const digits = (rawPhone || '').replace(/[^\d]/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) {
    return normalizeWhatsappPhone(digits.slice(2));
  }
  if (digits.startsWith('2340') && digits.length >= 14) {
    return `234${digits.slice(4)}`;
  }
  if (digits.startsWith('0') && digits.length >= 10 && digits.length <= 11) {
    return `234${digits.slice(1)}`;
  }
  if (digits.length === 10 && /^[789]/.test(digits)) {
    return `234${digits}`;
  }
  return digits;
}

function cleanSnippet(text: string, maxLen = 220): string {
  const normalized = (text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return 'See listing for details';
  if (normalized.length <= maxLen) return normalized;
  return `${normalized.slice(0, maxLen - 3).trimEnd()}...`;
}

function getOrigin(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return '';
}

export function buildHouseWhatsappMessage(
  house: HouseListing,
  buyer?: AuthUser | null
): string {
  const amenityLabels = (house.amenities || [])
    .map((key) => AMENITY_OPTIONS.find((a) => a.key === key)?.label || key)
    .filter(Boolean);

  const addressParts = [
    [house.houseNumber, house.streetName].filter(Boolean).join(' '),
    house.area,
    house.state,
    house.country,
  ].filter(Boolean);

  const origin = getOrigin();
  const listingUrl = origin ? `${origin}/house/${house.id}` : `/house/${house.id}`;

  const lines = [
    `Hello ${house.agentName}, I am interested in this house on Glide Homes:`,
    '',
    `*House Title:* ${house.title}`,
    `*Status:* ${house.status}`,
    `*House Type:* ${house.houseType}`,
    `*Annual Rent:* ${formatNaira(house.price)} / year`,
    `*Inspection Fee:* ${formatNaira(house.inspectionFee || 3000)} (face-to-face)`,
    `*Full Address:* ${addressParts.join(', ')}`,
    ...(amenityLabels.length > 0 ? [`*Amenities:* ${amenityLabels.join(', ')}`] : []),
    `*Details:* ${cleanSnippet(house.description)}`,
    ...(house.agentCode ? [`*Agent UID:* ${house.agentCode}`] : []),
    `*House Link:* ${listingUrl}`,
    ...(buyer
      ? ['', `*Buyer:* ${buyer.fullName}${buyer.userCode ? ` (UID: ${buyer.userCode})` : ''}`]
      : []),
    '',
    'Please let me know when I can come for a physical inspection.',
  ];

  return lines.join('\n');
}

export function buildHouseWhatsappUrl(
  house: HouseListing,
  buyer?: AuthUser | null
): string {
  const number = normalizeWhatsappPhone(house.phone);
  const message = buildHouseWhatsappMessage(house, buyer);
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

export function buildItemWhatsappMessage(
  item: HomePropertyItem,
  buyer?: AuthUser | null
): string {
  const locationText = [item.area, item.state, item.country].filter(Boolean).join(', ');
  const origin = getOrigin();
  const marketUrl = origin ? `${origin}/?tab=items` : '/?tab=items';

  const lines = [
    `Hello ${item.sellerName}, I am interested in this Home Property listed on Glide Homes:`,
    '',
    `*Property Name:* ${item.title}`,
    `*Status:* ${item.status}`,
    `*Category:* ${item.category}`,
    `*Condition:* ${item.condition}`,
    `*Price:* ${formatNaira(item.price)}`,
    `*Location:* ${locationText}`,
    `*Details:* ${cleanSnippet(item.description)}`,
    ...(item.sellerCode ? [`*Seller UID:* ${item.sellerCode}`] : []),
    `*Listing Link:* ${marketUrl}`,
    ...(buyer
      ? ['', `*Buyer:* ${buyer.fullName}${buyer.userCode ? ` (UID: ${buyer.userCode})` : ''}`]
      : []),
    '',
    'Is this property still available for inspection and pickup?',
  ];

  return lines.join('\n');
}

export function buildItemWhatsappUrl(
  item: HomePropertyItem,
  buyer?: AuthUser | null
): string {
  const number = normalizeWhatsappPhone(item.phone);
  const message = buildItemWhatsappMessage(item, buyer);
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
