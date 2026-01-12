/**
 * Municipality Bounds Service
 *
 * Provides polygon bounds for Israeli municipalities
 * and point-in-polygon verification for GPS check-ins
 */

interface Coordinate {
  lat: number;
  lng: number;
}

interface MunicipalityBounds {
  name: string;
  nameHe: string;
  polygon: Coordinate[];
  center: Coordinate;
}

/**
 * Municipality polygon bounds
 * These are simplified polygons covering the main urban areas
 * Real implementation should use more detailed municipal boundary data
 */
const MUNICIPALITY_BOUNDS: Record<string, MunicipalityBounds> = {
  'tel-aviv': {
    name: 'Tel Aviv-Yafo',
    nameHe: 'תל אביב-יפו',
    center: { lat: 32.0853, lng: 34.7818 },
    polygon: [
      { lat: 32.1453, lng: 34.7418 },
      { lat: 32.1453, lng: 34.8218 },
      { lat: 32.0253, lng: 34.8218 },
      { lat: 32.0253, lng: 34.7418 },
    ],
  },
  jerusalem: {
    name: 'Jerusalem',
    nameHe: 'ירושלים',
    center: { lat: 31.7683, lng: 35.2137 },
    polygon: [
      { lat: 31.8500, lng: 35.1500 },
      { lat: 31.8500, lng: 35.2800 },
      { lat: 31.7000, lng: 35.2800 },
      { lat: 31.7000, lng: 35.1500 },
    ],
  },
  haifa: {
    name: 'Haifa',
    nameHe: 'חיפה',
    center: { lat: 32.7940, lng: 34.9896 },
    polygon: [
      { lat: 32.8500, lng: 34.9400 },
      { lat: 32.8500, lng: 35.0500 },
      { lat: 32.7400, lng: 35.0500 },
      { lat: 32.7400, lng: 34.9400 },
    ],
  },
  'rishon-lezion': {
    name: 'Rishon LeZion',
    nameHe: 'ראשון לציון',
    center: { lat: 31.9730, lng: 34.7925 },
    polygon: [
      { lat: 32.0200, lng: 34.7400 },
      { lat: 32.0200, lng: 34.8400 },
      { lat: 31.9200, lng: 34.8400 },
      { lat: 31.9200, lng: 34.7400 },
    ],
  },
  'petah-tikva': {
    name: 'Petah Tikva',
    nameHe: 'פתח תקווה',
    center: { lat: 32.0871, lng: 34.8877 },
    polygon: [
      { lat: 32.1300, lng: 34.8400 },
      { lat: 32.1300, lng: 34.9400 },
      { lat: 32.0400, lng: 34.9400 },
      { lat: 32.0400, lng: 34.8400 },
    ],
  },
  ashdod: {
    name: 'Ashdod',
    nameHe: 'אשדוד',
    center: { lat: 31.8014, lng: 34.6437 },
    polygon: [
      { lat: 31.8500, lng: 34.5900 },
      { lat: 31.8500, lng: 34.7000 },
      { lat: 31.7500, lng: 34.7000 },
      { lat: 31.7500, lng: 34.5900 },
    ],
  },
  netanya: {
    name: 'Netanya',
    nameHe: 'נתניה',
    center: { lat: 32.3286, lng: 34.8537 },
    polygon: [
      { lat: 32.3800, lng: 34.8000 },
      { lat: 32.3800, lng: 34.9100 },
      { lat: 32.2800, lng: 34.9100 },
      { lat: 32.2800, lng: 34.8000 },
    ],
  },
  'beer-sheva': {
    name: 'Beer Sheva',
    nameHe: 'באר שבע',
    center: { lat: 31.2518, lng: 34.7913 },
    polygon: [
      { lat: 31.3200, lng: 34.7200 },
      { lat: 31.3200, lng: 34.8600 },
      { lat: 31.1800, lng: 34.8600 },
      { lat: 31.1800, lng: 34.7200 },
    ],
  },
  'bnei-brak': {
    name: 'Bnei Brak',
    nameHe: 'בני ברק',
    center: { lat: 32.0833, lng: 34.8333 },
    polygon: [
      { lat: 32.1100, lng: 34.8100 },
      { lat: 32.1100, lng: 34.8600 },
      { lat: 32.0600, lng: 34.8600 },
      { lat: 32.0600, lng: 34.8100 },
    ],
  },
  holon: {
    name: 'Holon',
    nameHe: 'חולון',
    center: { lat: 32.0115, lng: 34.7723 },
    polygon: [
      { lat: 32.0500, lng: 34.7300 },
      { lat: 32.0500, lng: 34.8200 },
      { lat: 31.9700, lng: 34.8200 },
      { lat: 31.9700, lng: 34.7300 },
    ],
  },
  'ramat-gan': {
    name: 'Ramat Gan',
    nameHe: 'רמת גן',
    center: { lat: 32.0680, lng: 34.8241 },
    polygon: [
      { lat: 32.1000, lng: 34.7900 },
      { lat: 32.1000, lng: 34.8600 },
      { lat: 32.0400, lng: 34.8600 },
      { lat: 32.0400, lng: 34.7900 },
    ],
  },
  ashkelon: {
    name: 'Ashkelon',
    nameHe: 'אשקלון',
    center: { lat: 31.6688, lng: 34.5743 },
    polygon: [
      { lat: 31.7200, lng: 34.5200 },
      { lat: 31.7200, lng: 34.6300 },
      { lat: 31.6200, lng: 34.6300 },
      { lat: 31.6200, lng: 34.5200 },
    ],
  },
  rehovot: {
    name: 'Rehovot',
    nameHe: 'רחובות',
    center: { lat: 31.8928, lng: 34.8113 },
    polygon: [
      { lat: 31.9300, lng: 34.7700 },
      { lat: 31.9300, lng: 34.8600 },
      { lat: 31.8500, lng: 34.8600 },
      { lat: 31.8500, lng: 34.7700 },
    ],
  },
  'bat-yam': {
    name: 'Bat Yam',
    nameHe: 'בת ים',
    center: { lat: 32.0231, lng: 34.7515 },
    polygon: [
      { lat: 32.0500, lng: 34.7200 },
      { lat: 32.0500, lng: 34.7800 },
      { lat: 31.9900, lng: 34.7800 },
      { lat: 31.9900, lng: 34.7200 },
    ],
  },
  herzliya: {
    name: 'Herzliya',
    nameHe: 'הרצליה',
    center: { lat: 32.1663, lng: 34.8464 },
    polygon: [
      { lat: 32.2100, lng: 34.8000 },
      { lat: 32.2100, lng: 34.8900 },
      { lat: 32.1200, lng: 34.8900 },
      { lat: 32.1200, lng: 34.8000 },
    ],
  },
  'kfar-saba': {
    name: 'Kfar Saba',
    nameHe: 'כפר סבא',
    center: { lat: 32.1752, lng: 34.9066 },
    polygon: [
      { lat: 32.2200, lng: 34.8600 },
      { lat: 32.2200, lng: 34.9500 },
      { lat: 32.1300, lng: 34.9500 },
      { lat: 32.1300, lng: 34.8600 },
    ],
  },
  modiin: {
    name: "Modi'in-Maccabim-Re'ut",
    nameHe: 'מודיעין-מכבים-רעות',
    center: { lat: 31.8978, lng: 35.0106 },
    polygon: [
      { lat: 31.9400, lng: 34.9600 },
      { lat: 31.9400, lng: 35.0600 },
      { lat: 31.8500, lng: 35.0600 },
      { lat: 31.8500, lng: 34.9600 },
    ],
  },
  nazareth: {
    name: 'Nazareth',
    nameHe: 'נצרת',
    center: { lat: 32.6996, lng: 35.3035 },
    polygon: [
      { lat: 32.7400, lng: 35.2600 },
      { lat: 32.7400, lng: 35.3500 },
      { lat: 32.6600, lng: 35.3500 },
      { lat: 32.6600, lng: 35.2600 },
    ],
  },
  raanana: {
    name: "Ra'anana",
    nameHe: 'רעננה',
    center: { lat: 32.1836, lng: 34.8742 },
    polygon: [
      { lat: 32.2200, lng: 34.8400 },
      { lat: 32.2200, lng: 34.9100 },
      { lat: 32.1500, lng: 34.9100 },
      { lat: 32.1500, lng: 34.8400 },
    ],
  },
  lod: {
    name: 'Lod',
    nameHe: 'לוד',
    center: { lat: 31.9510, lng: 34.8884 },
    polygon: [
      { lat: 31.9900, lng: 34.8500 },
      { lat: 31.9900, lng: 34.9300 },
      { lat: 31.9100, lng: 34.9300 },
      { lat: 31.9100, lng: 34.8500 },
    ],
  },
};

/**
 * Point-in-polygon algorithm (Ray casting)
 * Determines if a point is inside a polygon
 */
function isPointInPolygon(
  point: Coordinate,
  polygon: Coordinate[]
): boolean {
  let inside = false;
  const n = polygon.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].lat;
    const yi = polygon[i].lng;
    const xj = polygon[j].lat;
    const yj = polygon[j].lng;

    const intersect =
      yi > point.lng !== yj > point.lng &&
      point.lat < ((xj - xi) * (point.lng - yi)) / (yj - yi) + xi;

    if (intersect) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 * Returns distance in kilometers
 */
export function calculateDistance(
  coord1: Coordinate,
  coord2: Coordinate
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((coord2.lat - coord1.lat) * Math.PI) / 180;
  const dLng = ((coord2.lng - coord1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((coord1.lat * Math.PI) / 180) *
      Math.cos((coord2.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Verify if coordinates are within a municipality's bounds
 */
export function verifyLocationInMunicipality(
  latitude: number,
  longitude: number,
  municipalityId: string
): {
  isInside: boolean;
  municipality?: MunicipalityBounds;
  distanceFromCenter?: number;
} {
  const municipality = MUNICIPALITY_BOUNDS[municipalityId.toLowerCase()];

  if (!municipality) {
    return { isInside: false };
  }

  const point: Coordinate = { lat: latitude, lng: longitude };
  const isInside = isPointInPolygon(point, municipality.polygon);
  const distanceFromCenter = calculateDistance(point, municipality.center);

  return {
    isInside,
    municipality,
    distanceFromCenter,
  };
}

/**
 * Get municipality bounds by ID
 */
export function getMunicipalityBounds(
  municipalityId: string
): MunicipalityBounds | null {
  return MUNICIPALITY_BOUNDS[municipalityId.toLowerCase()] || null;
}

/**
 * Get all available municipalities
 */
export function getAllMunicipalities(): Array<{
  id: string;
  name: string;
  nameHe: string;
}> {
  return Object.entries(MUNICIPALITY_BOUNDS).map(([id, bounds]) => ({
    id,
    name: bounds.name,
    nameHe: bounds.nameHe,
  }));
}

/**
 * Find municipality by coordinates (detect which municipality a location is in)
 */
export function findMunicipalityByCoordinates(
  latitude: number,
  longitude: number
): string | null {
  const point: Coordinate = { lat: latitude, lng: longitude };

  for (const [id, bounds] of Object.entries(MUNICIPALITY_BOUNDS)) {
    if (isPointInPolygon(point, bounds.polygon)) {
      return id;
    }
  }

  return null;
}

/**
 * Check if GPS accuracy is acceptable for verification
 * We require accuracy of 100 meters or better
 */
export function isAccuracyAcceptable(accuracy: number): boolean {
  return accuracy <= 100;
}

/**
 * Verify a GPS check-in
 * Returns verification result with details
 */
export function verifyCheckIn(
  latitude: number,
  longitude: number,
  accuracy: number | undefined,
  expectedMunicipality: string
): {
  verified: boolean;
  inMunicipality: boolean;
  accuracyAcceptable: boolean;
  distanceFromCenter?: number;
  error?: string;
} {
  // Check accuracy first
  if (accuracy !== undefined && !isAccuracyAcceptable(accuracy)) {
    return {
      verified: false,
      inMunicipality: false,
      accuracyAcceptable: false,
      error: 'GPS accuracy is too low. Please try in an open area.',
    };
  }

  // Check if in municipality
  const locationResult = verifyLocationInMunicipality(
    latitude,
    longitude,
    expectedMunicipality
  );

  if (!locationResult.municipality) {
    return {
      verified: false,
      inMunicipality: false,
      accuracyAcceptable: accuracy === undefined || isAccuracyAcceptable(accuracy),
      error: 'Unknown municipality',
    };
  }

  if (!locationResult.isInside) {
    return {
      verified: false,
      inMunicipality: false,
      accuracyAcceptable: accuracy === undefined || isAccuracyAcceptable(accuracy),
      distanceFromCenter: locationResult.distanceFromCenter,
      error: `Location is outside ${locationResult.municipality.nameHe}`,
    };
  }

  return {
    verified: true,
    inMunicipality: true,
    accuracyAcceptable: true,
    distanceFromCenter: locationResult.distanceFromCenter,
  };
}
