import { internal, type AppError } from '@/server/http/errors';

interface DraftInput {
  municipality: string;
  link: string;
  topics: { title: string; participantCount: number }[];
}

export async function draftPilotFacebookPost(input: DraftInput): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw internal('ANTHROPIC_API_KEY is not configured');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: process.env.PILOT_COPY_MODEL || 'claude-sonnet-4-20250514',
        max_tokens: 1200,
        system: 'את/ה קופירייטר/ית מדויק/ת לפיילוט אזרחי בישראל. כתוב/כתבי פוסט Facebook בעברית בלבד. אסור להמציא מספרים, קישורים או הבטחות. שמור/שמרי על טון מזמין, ברור ולא מפלגתי.',
        messages: [{
          role: 'user',
          content: `נסח/י פוסט אחד לקבוצת פייסבוק של ${input.municipality}. מבנה חובה: (1) הודעה שהרשות נמדדה בין 10 המובילות במעורבות אזרחית; (2) רשימת חמשת הנושאים שנפתחו להצבעה, עם מספר המשתתפים הנתון בלבד; (3) משפט ברור שרק תושבי ${input.municipality} מצביעים ושאר הארץ צופה; (4) קריאה לפעולה עם הקישור הבא בדיוק, ללא שינוי וללא Markdown: ${input.link}.\n\nנתונים:\n${JSON.stringify(input.topics)}`,
        }],
      }),
    });
    if (!response.ok) throw internal(`Anthropic request failed (${response.status})`);
    const payload = await response.json() as { stop_reason?: string; content?: { type: string; text?: string }[] };
    const text = payload.content?.find((block) => block.type === 'text')?.text?.trim();
    if (payload.stop_reason === 'refusal' || !text) throw internal('Anthropic did not return a usable draft');
    return text;
  } finally {
    clearTimeout(timer);
  }
}
