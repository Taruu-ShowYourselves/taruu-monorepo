import { internal } from '@/server/http/errors';

interface DraftInput {
  municipality: string;
  link: string;
  topics: { title: string; participantCount: number }[];
}

/**
 * Gemini emits reasoning as ordinary parts flagged `thought`. They must be
 * dropped rather than rendered - a draft that leaks the model's deliberation
 * into a Facebook post is worse than no draft at all.
 */
interface GeminiPart {
  text?: string;
  thought?: boolean;
}

interface GeminiResponse {
  candidates?: {
    content?: { parts?: GeminiPart[] };
    finishReason?: string;
  }[];
  /** Present instead of candidates when the prompt itself was refused. */
  promptFeedback?: { blockReason?: string };
}

const API_ORIGIN = 'https://generativelanguage.googleapis.com';
const DEFAULT_MODEL = 'gemini-3.6-flash';

/**
 * Which model a draft came from, resolved in one place: the copy row records
 * it and the request sends it, and those two must never disagree.
 */
export function pilotCopyModel(): string {
  return process.env.PILOT_COPY_MODEL || DEFAULT_MODEL;
}

const SYSTEM_PROMPT =
  'את/ה קופירייטר/ית מדויק/ת לפיילוט אזרחי בישראל. כתוב/כתבי פוסט Facebook בעברית בלבד. אסור להמציא מספרים, קישורים או הבטחות. שמור/שמרי על טון מזמין, ברור ולא מפלגתי.';

function userPrompt({ municipality, link, topics }: DraftInput): string {
  return `נסח/י פוסט אחד לקבוצת פייסבוק של ${municipality}. מבנה חובה: (1) הודעה שהרשות נמדדה בין 10 המובילות במעורבות אזרחית; (2) רשימת חמשת הנושאים שנפתחו להצבעה, עם מספר המשתתפים הנתון בלבד; (3) משפט ברור שרק תושבי ${municipality} מצביעים ושאר הארץ צופה; (4) קריאה לפעולה עם הקישור הבא בדיוק, ללא שינוי וללא Markdown: ${link}.\n\nנתונים:\n${JSON.stringify(topics)}`;
}

export async function draftPilotFacebookPost(input: DraftInput): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw internal('GEMINI_API_KEY is not configured');

  const model = pilotCopyModel();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    const response = await fetch(
      `${API_ORIGIN}/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          // Header rather than the ?key= query parameter: a URL travels through
          // proxies and access logs, a header does not.
          'x-goog-api-key': apiKey,
        },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: 'user', parts: [{ text: userPrompt(input) }] }],
          generationConfig: { maxOutputTokens: 1200 },
        }),
      }
    );
    if (!response.ok) throw internal(`Gemini request failed (${response.status})`);

    const payload = (await response.json()) as GeminiResponse;

    // A blocked prompt returns no candidates at all, so this has to be checked
    // before reaching for candidates[0].
    if (payload.promptFeedback?.blockReason) {
      throw internal(`Gemini refused the prompt (${payload.promptFeedback.blockReason})`);
    }

    const candidate = payload.candidates?.[0];
    // Anything other than a clean stop means the text is partial or withheld:
    // MAX_TOKENS truncates mid-post, SAFETY and RECITATION withhold it.
    if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
      throw internal(`Gemini did not finish the draft (${candidate.finishReason})`);
    }

    const text = (candidate?.content?.parts ?? [])
      .filter((part) => !part.thought && typeof part.text === 'string')
      .map((part) => part.text)
      .join('')
      .trim();

    if (!text) throw internal('Gemini did not return a usable draft');
    return text;
  } finally {
    clearTimeout(timer);
  }
}
