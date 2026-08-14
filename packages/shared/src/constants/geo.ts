/**
 * Municipality geo data - centroids for GPS → municipality resolution.
 * Self-contained (no external geocoding API): nearest-centroid matching
 * within a sanity radius. Coordinates are stable public geographic facts.
 */

export interface MunicipalityGeo {
  /** Canonical municipality name - matches votes.municipality_id. */
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
  // Enclave and periphery cities. These have to be listed once the regional
  // councils below are: nearest-centroid matching has no notion of enclaves,
  // so a reader in שדרות was otherwise 0.7km from שער הנגב's seat and got
  // assigned the council that surrounds their city instead of the city
  // itself. Every name is the canonical MUNICIPALITIES string.
  { name: 'שדרות', lat: 31.525, lng: 34.596, aliases: ['sderot'] },
  { name: 'עכו', lat: 32.928, lng: 35.077, aliases: ['akko', 'acre'] },
  { name: 'נהריה', lat: 33.006, lng: 35.098, aliases: ['nahariya'] },
  { name: 'עפולה', lat: 32.61, lng: 35.289, aliases: ['afula'] },
  { name: 'נצרת', lat: 32.699, lng: 35.303, aliases: ['nazareth'] },
  { name: 'קרית אתא', lat: 32.811, lng: 35.113, aliases: ['קריית אתא', 'kiryat ata'] },
  { name: 'קרית מוצקין', lat: 32.837, lng: 35.078, aliases: ['קריית מוצקין', 'kiryat motzkin'] },
  { name: 'קרית ביאליק', lat: 32.827, lng: 35.086, aliases: ['קריית ביאליק', 'kiryat bialik'] },
  { name: 'קרית ים', lat: 32.846, lng: 35.069, aliases: ['קריית ים', 'kiryat yam'] },
  { name: 'יקנעם עילית', lat: 32.659, lng: 35.11, aliases: ['יקנעם', 'yokneam'] },
  { name: 'מגדל העמק', lat: 32.678, lng: 35.24, aliases: ['migdal haemek'] },
  { name: 'טבריה', lat: 32.795, lng: 35.531, aliases: ['tiberias'] },
  { name: 'כרמיאל', lat: 32.919, lng: 35.295, aliases: ['karmiel'] },
  { name: 'מעלות-תרשיחא', lat: 33.016, lng: 35.271, aliases: ['מעלות', 'maalot'] },
  { name: 'בית שאן', lat: 32.497, lng: 35.496, aliases: ['beit shean'] },
  // Regional councils (מועצות אזוריות) - coordinates are approximate council
  // seats / territorial centroids (Hebrew Wikipedia). They exist so the desks'
  // distance ordering can see these authorities instead of giving their topics
  // a flat unknown-penalty.
  { name: 'עמק יזרעאל', lat: 32.65, lng: 35.29, aliases: ['מועצה אזורית עמק יזרעאל', 'יזרעאל', 'emek yizrael'] },
  { name: 'זבולון', lat: 32.79, lng: 35.12, aliases: ['מועצה אזורית זבולון', 'zvulun'] },
  { name: 'מגידו', lat: 32.61, lng: 35.09, aliases: ['מועצה אזורית מגידו', 'megiddo'] },
  { name: 'משגב', lat: 32.86, lng: 35.26, aliases: ['מועצה אזורית משגב', 'misgav'] },
  { name: 'הגליל התחתון', lat: 32.71, lng: 35.41, aliases: ['מועצה אזורית הגליל התחתון', 'גליל תחתון', 'lower galilee'] },
  { name: 'עמק חפר', lat: 32.34, lng: 34.91, aliases: ['מועצה אזורית עמק חפר', 'emek hefer'] },
  { name: 'מטה יהודה', lat: 31.76, lng: 35.0, aliases: ['מועצה אזורית מטה יהודה', 'mate yehuda'] },
  { name: 'הגלבוע', lat: 32.55, lng: 35.4, aliases: ['מועצה אזורית הגלבוע', 'גלבוע', 'gilboa'] },
  { name: 'חוף הכרמל', lat: 32.68, lng: 34.96, aliases: ['מועצה אזורית חוף הכרמל', 'hof hacarmel'] },
  { name: 'דרום השרון', lat: 32.13, lng: 34.91, aliases: ['מועצה אזורית דרום השרון', 'drom hasharon'] },
  { name: 'מטה אשר', lat: 32.97, lng: 35.09, aliases: ['מועצה אזורית מטה אשר', 'mate asher'] },
  { name: 'שער הנגב', lat: 31.52, lng: 34.6, aliases: ['מועצה אזורית שער הנגב', 'shaar hanegev'] },
  { name: 'הגליל העליון', lat: 33.19, lng: 35.57, aliases: ['מועצה אזורית הגליל העליון', 'גליל עליון', 'upper galilee'] },
  { name: 'עמק הירדן', lat: 32.71, lng: 35.58, aliases: ['מועצה אזורית עמק הירדן', 'emek hayarden'] },
  { name: 'עמק המעיינות', lat: 32.49, lng: 35.52, aliases: ['מועצה אזורית עמק המעיינות', 'עמק בית שאן', 'emek hamaayanot'] },
  { name: 'גולן', lat: 32.99, lng: 35.69, aliases: ['מועצה אזורית גולן', 'רמת הגולן', 'golan'] },
  { name: 'אשכול', lat: 31.3, lng: 34.43, aliases: ['מועצה אזורית אשכול', 'eshkol'] },
  { name: 'גזר', lat: 31.89, lng: 34.92, aliases: ['מועצה אזורית גזר', 'gezer'] },
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
