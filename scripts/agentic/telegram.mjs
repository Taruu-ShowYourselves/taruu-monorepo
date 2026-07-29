const TELEGRAM_API_ROOT = 'https://api.telegram.org';

export function telegramHookDelivery(settings) {
  const target = String(settings.TELEGRAM_CHAT_ID ?? '').trim();
  if (!target) return { deliver: false };
  return {
    deliver: true,
    channel: 'telegram',
    to: target,
  };
}

export async function sendTelegramMessage(
  { token, chatId, text },
  fetchImpl = fetch,
) {
  if (!token || !chatId || !text) return { skipped: true };

  const response = await fetchImpl(
    `${TELEGRAM_API_ROOT}/bot${token}/sendMessage`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(20_000),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Telegram notification failed with HTTP ${response.status}.`,
    );
  }

  return { skipped: false };
}
