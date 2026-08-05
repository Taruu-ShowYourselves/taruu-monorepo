/**
 * SMS sender - provider-agnostic delivery transport for OTP messages.
 *
 * The OTP lifecycle (generate, store, verify) is owned in-app now (see otp.ts);
 * this is only the delivery leg. Point it at any modern SMS REST API via
 * SMS_API_URL + SMS_API_KEY - the request body covers the common `{ to, text }`
 * shape; adapt per provider if needed. When unconfigured, `getSmsSender()`
 * returns null and the app mock-degrades (the routes return 503 and the client
 * soft-passes in dev), exactly as the previous Twilio integration did.
 */

export interface SmsSender {
  send(phone: string, message: string): Promise<void>;
}

function httpSender(url: string, apiKey: string, from?: string): SmsSender {
  return {
    async send(phone, message) {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ to: phone, from, text: message }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`SMS gateway responded ${res.status}: ${detail}`);
      }
    },
  };
}

/** The configured sender, or null when SMS delivery isn't set up. */
export function getSmsSender(): SmsSender | null {
  const url = process.env.SMS_API_URL;
  const apiKey = process.env.SMS_API_KEY;
  if (url && apiKey) return httpSender(url, apiKey, process.env.SMS_FROM);
  return null;
}

/** True when a real SMS gateway is configured. */
export function isSmsServiceConfigured(): boolean {
  return Boolean(process.env.SMS_API_URL && process.env.SMS_API_KEY);
}
