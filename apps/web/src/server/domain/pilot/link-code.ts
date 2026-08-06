const LINK_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz';
export const PILOT_LINK_CODE_LENGTH = 8;

export function generatePilotLinkCode(
  fill: (bytes: Uint8Array) => Uint8Array = (bytes) => crypto.getRandomValues(bytes)
): string {
  const bytes = fill(new Uint8Array(PILOT_LINK_CODE_LENGTH));
  return Array.from(
    bytes,
    (byte) => LINK_ALPHABET[byte % LINK_ALPHABET.length]
  ).join('');
}

/** Generate a code and retry once when the database already holds it. */
export async function generateAvailablePilotLinkCode(
  isTaken: (code: string) => Promise<boolean>,
  generate: () => string = generatePilotLinkCode
): Promise<string> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const code = generate();
    if (!(await isTaken(code))) return code;
  }
  throw new Error('could not allocate a unique pilot link code');
}

export function isPilotBotUserAgent(userAgent: string | null): boolean {
  if (!userAgent) return false;
  return /facebookexternalhit|facebot|whatsapp|telegrambot|discordbot|slackbot|bot\b|crawler|spider|preview|curl|wget|headless/i.test(
    userAgent
  );
}
