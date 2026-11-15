import { AMENITY_OPTIONS } from '../data/locations.ts';
import type { HouseType } from '../types.ts';

export interface RentEstimateInput {
  area: string;
  state: string;
  country: string;
  houseType: HouseType;
  amenities: string[];
}

export interface RentEstimateResult {
  minPrice: number;
  maxPrice: number;
  suggestedPrice: number;
  basePrice: number;
  areaMultiplier: number;
  marketTierLabel: string;
  amenityBonusPct: number;
  matchedAmenityLabels: string[];
}

const BASE_RENT_BY_TYPE: Record<HouseType, number> = {
  'Single Room': 180000,
  'Self-Contain': 450000,
  '1 Bedroom': 850000,
  '2 Bedroom': 1400000,
  '3 Bedroom': 2200000,
  Duplex: 4500000,
  Shop: 600000,
};

const AMENITY_PREMIUM_PCT: Record<string, number> = {
  generator: 14,
  security: 8,
  parking: 7,
  electricity: 7,
  kitchen: 6,
  water: 5,
  fenced: 5,
  toilet: 4,
  tiled: 4,
};

const PRIME_AREAS = [
  'ikoyi',
  'banana island',
  'victoria island',
  'vi',
  'eko atlantic',
  'maitama',
  'asokoro',
  'wuse 2',
  'wuse ii',
  'katampe extension',
];

const HIGH_DEMAND_AREAS = [
  'lekki',
  'chevron',
  'oniru',
  'ikate',
  'ajah',
  'ikeja',
  'gbagada',
  'magodo',
  'omole',
  'yaba',
  'surulere',
  'maryland',
  'anthony',
  'wuse',
  'garki',
  'jabi',
  'utako',
  'gwarinpa',
  'guzape',
  'gra',
  'bodija',
  'akobo',
  'independence layout',
  'new haven',
];

const SUBURBAN_AREAS = [
  'ikorodu',
  'badagry',
  'epe',
  'agbara',
  'mowe',
  'ibafo',
  'magboro',
  'sango',
  'ota',
  'kubwa',
  'lugbe',
  'karu',
  'nyanya',
  'mararaba',
  'bwari',
  'moniya',
  'apata',
  'oluyole',
];

const METRO_STATES = new Set(['Lagos', 'FCT Abuja']);
const HUB_STATES = new Set([
  'Rivers',
  'Ogun',
  'Oyo',
  'Enugu',
  'Delta',
  'Kano',
  'Kaduna',
  'Anambra',
  'Edo',
  'Akwa Ibom',
  'Cross River',
  'Kwara',
]);

function roundToStep(value: number): number {
  const step = value >= 1000000 ? 50000 : 10000;
  return Math.max(step, Math.round(value / step) * step);
}

function resolveAreaTier(area: string, state: string, country: string): { multiplier: number; label: string } {
  const normalizedArea = area.trim().toLowerCase();

  if (normalizedArea) {
    if (PRIME_AREAS.some((kw) => normalizedArea === kw || normalizedArea.includes(kw))) {
      return { multiplier: 2.35, label: 'Prime Urban District' };
    }
    if (HIGH_DEMAND_AREAS.some((kw) => normalizedArea.includes(kw))) {
      return { multiplier: 1.45, label: 'High-Demand Neighborhood' };
    }
    if (SUBURBAN_AREAS.some((kw) => normalizedArea.includes(kw))) {
      return { multiplier: 0.78, label: 'Developing Suburban Belt' };
    }
  }

  if (country.trim() && country.trim().toLowerCase() !== 'nigeria') {
    return { multiplier: 1.5, label: 'International Market' };
  }

  if (METRO_STATES.has(state)) {
    return { multiplier: 1.2, label: `${state} Metro Baseline` };
  }

  if (HUB_STATES.has(state)) {
    return { multiplier: 0.95, label: `${state} Urban Hub` };
  }

  return { multiplier: 0.74, label: `${state || 'Regional'} Standard Market` };
}

export function estimateRecommendedRent({
  area,
  state,
  country,
  houseType,
  amenities,
}: RentEstimateInput): RentEstimateResult {
  const basePrice = BASE_RENT_BY_TYPE[houseType] ?? BASE_RENT_BY_TYPE['2 Bedroom'];
  const tier = resolveAreaTier(area, state, country);

  const uniqueAmenities = Array.from(new Set(amenities));
  const amenityBonusPct = uniqueAmenities.reduce(
    (sum, key) => sum + (AMENITY_PREMIUM_PCT[key] ?? 4),
    0
  );

  const matchedAmenityLabels = uniqueAmenities.map(
    (key) => AMENITY_OPTIONS.find((item) => item.key === key)?.shortLabel || key
  );

  const rawSuggested = basePrice * tier.multiplier * (1 + amenityBonusPct / 100);
  const suggestedPrice = roundToStep(rawSuggested);
  const minPrice = roundToStep(rawSuggested * 0.88);
  const maxPrice = Math.max(suggestedPrice + 50000, roundToStep(rawSuggested * 1.15));

  return {
    minPrice,
    maxPrice,
    suggestedPrice,
    basePrice,
    areaMultiplier: tier.multiplier,
    marketTierLabel: tier.label,
    amenityBonusPct,
    matchedAmenityLabels,
  };
}
