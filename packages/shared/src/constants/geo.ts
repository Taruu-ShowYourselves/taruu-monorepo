/**
 * Municipality geo data — centroids for GPS → municipality resolution.
 * Self-contained (no external geocoding API): nearest-centroid matching
 * within a sanity radius. Coordinates are stable public geographic facts.
 */

export interface MunicipalityGeo {
  /** Canonical municipality name — matches votes.municipality_id. */
  name: string;
  lat: number;
  lng: number;
  /** Alternative spellings users may type. */
  aliases: string[];
}

export const MUNICIPALITY_GEO: MunicipalityGeo[] = [
  { name: 'תל אביב-יפו', lat: 32.0853, lng: 34.7818, aliases: ['תל אביב', 'ת"א', 'תא', 'יפו', 'tel aviv'] },
  { name: 'ירושלים', lat: 31.7683, lng: 35.2137, aliases: ['jerusalem', 'ירושלים המערבית'] },
  { name: 'חיפה', lat: 32.794, lng: 34.9896, aliases: ['haifa'] },
  { name: 'ראשון לציון', lat: 31.973, lng: 34.7925, aliases: ['ראשלצ', 'ראשל"צ', 'rishon'] },
  { name: 'פתח תקווה', lat: 32.0871, lng: 34.8878, aliases: ['פ"ת', 'פת', 'petah tikva'] },
  { name: 'אשדוד', lat: 31.8014, lng: 34.6435, aliases: ['ashdod'] },
  { name: 'נתניה', lat: 32.3215, lng: 34.8532, aliases: ['netanya'] },
  { name: 'באר שבע', lat: 31.253, lng: 34.7915, aliases: ['ב"ש', 'בש', 'beer sheva'] },
  { name: 'חולון', lat: 32.0158, lng: 34.7874, aliases: ['holon'] },
  { name: 'בני ברק', lat: 32.0807, lng: 34.8338, aliases: ['ב"ב', 'bnei brak'] },
  { name: 'רמת גן', lat: 32.0684, lng: 34.8248, aliases: ['ר"ג', 'רג', 'ramat gan'] },
  { name: 'אשקלון', lat: 31.6688, lng: 34.5743, aliases: ['ashkelon'] },
  { name: 'רחובות', lat: 31.8928, lng: 34.8113, aliases: ['rehovot'] },
  { name: 'בת ים', lat: 32.0171, lng: 34.7455, aliases: ['bat yam'] },
  { name: 'הרצליה', lat: 32.1663, lng: 34.8433, aliases: ['herzliya'] },
  { name: 'כפר סבא', lat: 32.175, lng: 34.907, aliases: ['כפ"ס', 'kfar saba'] },
  { name: 'חדרה', lat: 32.434, lng: 34.9196, aliases: ['hadera'] },
  { name: 'מודיעין-מכבים-רעות', lat: 31.8928, lng: 35.0124, aliases: ['מודיעין', 'modiin'] },
  { name: 'לוד', lat: 31.9467, lng: 34.8903, aliases: ['lod'] },
  { name: 'רעננה', lat: 32.1848, lng: 34.8713, aliases: ['raanana'] },
  { name: 'קריית טבעון', lat: 32.722, lng: 35.1235, aliases: ['קרית טבעון', 'טבעון', 'kiryat tivon'] },
];

/** Max distance (km) for GPS nearest-centroid match before we give up. */
export const GEO_MATCH_MAX_KM = 25;

/** Haversine distance in km. */
export function distanceKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number
): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) *
      Math.cos((bLat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** GPS coords → nearest municipality within GEO_MATCH_MAX_KM, else null. */
export function municipalityFromCoords(
  lat: number,
  lng: number
): MunicipalityGeo | null {
  let best: MunicipalityGeo | null = null;
  let bestDist = Infinity;
  for (const muni of MUNICIPALITY_GEO) {
    const d = distanceKm(lat, lng, muni.lat, muni.lng);
    if (d < bestDist) {
      bestDist = d;
      best = muni;
    }
  }
  return bestDist <= GEO_MATCH_MAX_KM ? best : null;
}

const normalize = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/['"׳״ְּ-ֻ]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/-/g, ' ');

/** Free-text town name → municipality (exact, alias, then prefix match). */
export function municipalityFromText(input: string): MunicipalityGeo | null {
  const q = normalize(input);
  if (q.length < 2) return null;

  for (const muni of MUNICIPALITY_GEO) {
    if (normalize(muni.name) === q) return muni;
  }
  for (const muni of MUNICIPALITY_GEO) {
    if (muni.aliases.some((a) => normalize(a) === q)) return muni;
  }
  for (const muni of MUNICIPALITY_GEO) {
    if (
      normalize(muni.name).startsWith(q) ||
      muni.aliases.some((a) => normalize(a).startsWith(q))
    ) {
      return muni;
    }
  }
  return null;
}
